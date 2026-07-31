import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { OpenRouterRequestDto } from './dto/openrouter-request.dto';
import { OpenRouterResponseDto } from './dto/openrouter-response.dto';
import {
  TranslateQueryRequestDto,
  SchemaContextDto,
} from './dto/translate-query-request.dto';
import { TranslateQueryResponseDto } from './dto/translate-query-response.dto';
import { SubstituteSqlPlaceholdersRequestDto } from './dto/substitute-sql-placeholders-request.dto';

const OPENROUTER_FREE_MODEL = 'meta-llama/llama-3.2-3b-instruct:free';

/**
 * Cadeia de fallback de modelos free (ordenada). Enviada no campo `models` da
 * requisição: OpenRouter tenta o modelo primário e, se falhar/rate-limit/
 * indisponível, percorre esta lista na ordem. Todos ≥128K de contexto para
 * suportar schemas grandes + expansão FK no prompt.
 */
const OPENROUTER_FALLBACK_MODELS = [
  'openai/gpt-oss-120b:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
];

/** Regras Trino para SQL federado; injetadas nos prompts. */
const TRINO_IDENTIFIER_RULES = `
REGRAS TRINO (IDENTIFICADORES FEDERADOS) — OBRIGATÓRIO:
- Use SEMPRE três qualificadores: catalogo.schema.tabela, EXATAMENTE como aparecem no CONTEXTO (ex.: supabase_targets.db_frota.veiculo, supabase_targets.db_crm.cliente).
- NÃO invente o schema e NÃO assuma "public": cada banco é um schema próprio (db_frota, db_rh, db_crm, db_operacoes, db_financeiro, db_manutencao, db_estoque). Use o schema exato do contexto.
- NUNCA use só catalogo.tabela (ex.: supabase_targets.veiculo): o Trino interpreta como schema.tabela no catálogo da sessão e gera erro "Catalog 'default' not found".
- Em subconsultas, CTEs e JOINs, qualifique TODAS as tabelas da mesma forma (três partes, com o schema do contexto).
`;

@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl =
      this.configService.get<string>('OPENROUTER_API_URL') ||
      'https://openrouter.ai/api/v1';
    this.apiKey =
      this.configService.get<string>('OPENROUTER_API_KEY') || '';
    this.defaultModel =
      this.configService.get<string>('OPENROUTER_DEFAULT_MODEL') ||
      'openai/gpt-5-nano';

    if (!this.apiKey) {
      this.logger.warn(
        'OPENROUTER_API_KEY não configurada. Configure no arquivo .env',
      );
    }
  }

  /**
   * Traduz uma consulta em linguagem natural para SQL usando OpenRouter
   */
  async translateQueryToSql(
    request: TranslateQueryRequestDto,
  ): Promise<TranslateQueryResponseDto> {
    try {
      // Construir prompt com contexto
      const messages = this.buildPromptMessages(request);

      // Preparar requisição para OpenRouter
      const openRouterRequest: OpenRouterRequestDto = {
        model: request.model || this.defaultModel,
        messages,
        temperature:
          Number(this.configService.get('OPENROUTER_TEMPERATURE')) || 0.3,
        max_tokens:
          Number(this.configService.get('OPENROUTER_MAX_TOKENS')) || 2000,
        stream: false,
      };

      const logTs = this.formatLogTimestamp(new Date());
      await this.writeOpenRouterContextToLog(
        {
          mode: 'translate',
          natural_language_query: request.natural_language_query,
          model: openRouterRequest.model,
          temperature: openRouterRequest.temperature,
          max_tokens: openRouterRequest.max_tokens,
          stop: openRouterRequest.stop,
          messages: openRouterRequest.messages as Array<{
            role: string;
            content: string;
          }>,
        },
        logTs,
      );

      // Fazer requisição para OpenRouter (com fallback para modelo :free se 404 por data policy)
      let response: OpenRouterResponseDto;
      try {
        response = await this.callOpenRouter(openRouterRequest);
      } catch (err) {
        const is404DataPolicy =
          err instanceof HttpException &&
          err.getStatus() === 404 &&
          String(err.getResponse()).includes('data policy');
        const modelUsed = openRouterRequest.model || this.defaultModel;
        if (is404DataPolicy && modelUsed !== OPENROUTER_FREE_MODEL) {
          this.logger.warn(
            `OpenRouter rejeitou o modelo "${modelUsed}" (política de dados). Tentando com modelo livre.`,
          );
          response = await this.callOpenRouter({
            ...openRouterRequest,
            model: OPENROUTER_FREE_MODEL,
          });
        } else {
          throw err;
        }
      }

      // Extrair SQL da resposta
      const sqlQuery = this.extractSqlFromResponse(response);

      await this.writeSqlToLog(sqlQuery, request.natural_language_query, logTs);

      return {
        sql_query: sqlQuery,
        model: response.model,
        usage: response.usage,
        request_id: response.id,
      };
    } catch (error) {
      this.logger.error('Erro ao traduzir query para SQL', error);
      throw this.handleError(error);
    }
  }

  /**
   * Apenas substitui placeholders [PARAM_n] no template SQL com valores inferidos da NL.
   */
  async substitutePlaceholdersInSql(
    request: SubstituteSqlPlaceholdersRequestDto,
  ): Promise<TranslateQueryResponseDto> {
    try {
      const messages = this.buildSubstitutionPromptMessages(request);
      const openRouterRequest: OpenRouterRequestDto = {
        model: request.model || this.defaultModel,
        messages,
        temperature:
          Number(this.configService.get('OPENROUTER_TEMPERATURE')) || 0.1,
        max_tokens:
          Number(this.configService.get('OPENROUTER_MAX_TOKENS')) || 2000,
        stream: false,
      };

      const logTs = this.formatLogTimestamp(new Date());
      await this.writeOpenRouterContextToLog(
        {
          mode: 'substitute',
          natural_language_query: request.natural_language_query,
          template_sql: request.template_sql,
          model: openRouterRequest.model,
          temperature: openRouterRequest.temperature,
          max_tokens: openRouterRequest.max_tokens,
          stop: openRouterRequest.stop,
          messages: openRouterRequest.messages as Array<{
            role: string;
            content: string;
          }>,
        },
        logTs,
      );

      let response: OpenRouterResponseDto;
      try {
        response = await this.callOpenRouter(openRouterRequest);
      } catch (err) {
        const is404DataPolicy =
          err instanceof HttpException &&
          err.getStatus() === 404 &&
          String(err.getResponse()).includes('data policy');
        const modelUsed = openRouterRequest.model || this.defaultModel;
        if (is404DataPolicy && modelUsed !== OPENROUTER_FREE_MODEL) {
          this.logger.warn(
            `OpenRouter rejeitou o modelo "${modelUsed}" (política de dados). Tentando com modelo livre.`,
          );
          response = await this.callOpenRouter({
            ...openRouterRequest,
            model: OPENROUTER_FREE_MODEL,
          });
        } else {
          throw err;
        }
      }

      const sqlQuery = this.extractSqlFromResponse(response);
      await this.writeSqlToLog(sqlQuery, request.natural_language_query, logTs);

      return {
        sql_query: sqlQuery,
        model: response.model,
        usage: response.usage,
        request_id: response.id,
      };
    } catch (error) {
      this.logger.error('Erro ao substituir placeholders no SQL', error);
      throw this.handleError(error);
    }
  }

  private appendSchemasToSystemPrompt(
    systemPrompt: string,
    schemas?: SchemaContextDto[],
  ): string {
    if (!schemas?.length) {
      return systemPrompt;
    }
    let out = systemPrompt;
    out += '\n\nSCHEMAS DOS BANCOS DE DADOS (filtrados por relevância + expansão FK):\n';
    let totalTables = 0;
    schemas.forEach((schema, index) => {
      out += `\n--- Schema ${index + 1} (${schema.database_name || schema.database_id}) ---\n`;
      out += JSON.stringify(schema.schema, null, 2);
      out += '\n';
      const tables = (schema.schema as any)?.tables;
      if (Array.isArray(tables)) {
        totalTables += tables.length;
      }
    });
    // Estimativa ~4 chars/token (regra de bolso GPT-style)
    const approxTokens = Math.ceil(out.length / 4);
    this.logger.log(
      `Schemas no prompt: ${schemas.length} databases, ${totalTables} tabelas, ~${approxTokens} tokens`,
    );
    return out;
  }

  private buildSubstitutionPromptMessages(
    request: SubstituteSqlPlaceholdersRequestDto,
  ): Array<{ role: string; content: string }> {
    let systemPrompt = `Você preenche um SQL Trino já existente.

INSTRUÇÕES OBRIGATÓRIAS:
- Você recebe um template SQL que contém apenas placeholders no formato [PARAM_1], [PARAM_2], etc.
- Substitua cada placeholder pelo valor textual apropriado inferido da pergunta do usuário em português.
- Preserve toda a estrutura da query (tabelas, colunas, JOINs, funções): altere SOMENTE os trechos [PARAM_n].
- Use nomes de tabelas e colunas exatamente como nos schemas fornecidos abaixo.
- Use aspas simples ao redor de valores string SQL quando necessário; escape aspas internas com duas aspas simples ('').
- Retorne APENAS o SQL final, sem markdown e sem explicações.
${TRINO_IDENTIFIER_RULES}`;

    systemPrompt = this.appendSchemasToSystemPrompt(
      systemPrompt,
      request.schemas,
    );

    return [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Pergunta do usuário:\n${request.natural_language_query}\n\nTemplate SQL:\n${request.template_sql}\n\nRetorne o SQL completo com os placeholders substituídos.`,
      },
    ];
  }

  /**
   * Constrói as mensagens do prompt com contexto de schemas e exemplos
   */
  private buildPromptMessages(
    request: TranslateQueryRequestDto,
  ): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];

    // Mensagem do sistema com instruções
    let systemPrompt = `Você é um especialista em SQL que traduz consultas em português para SQL Federado compatível com Trino.

INSTRUÇÕES:
- Traduza APENAS para SQL válido
- Use sintaxe SQL padrão compatível com Trino
- Retorne APENAS o SQL, sem explicações ou markdown
- Use nomes de tabelas e colunas exatamente como fornecidos nos schemas
- Se houver ambiguidade, use o schema mais relevante
${TRINO_IDENTIFIER_RULES}`;

    systemPrompt = this.appendSchemasToSystemPrompt(
      systemPrompt,
      request.schemas,
    );

    // Adicionar exemplos de consultas similares
    if (request.query_examples && request.query_examples.length > 0) {
      systemPrompt += '\n\nEXEMPLOS DE CONSULTAS SIMILARES:\n';
      request.query_examples.forEach((example, index) => {
        systemPrompt += `\nExemplo ${index + 1} (similaridade ${example.similarity}):\n`;
        systemPrompt += `Pergunta: ${example.natural_language_query}\n`;
        systemPrompt += `SQL: ${example.sql_query}\n`;
      });
    }

    messages.push({
      role: 'system',
      content: systemPrompt,
    });

    // Mensagem do usuário com a consulta
    messages.push({
      role: 'user',
      content: `Traduza para SQL: ${request.natural_language_query}`,
    });

    return messages;
  }

  /**
   * Faz a chamada HTTP para a API do OpenRouter
   */
  private async callOpenRouter(
    request: OpenRouterRequestDto,
  ): Promise<OpenRouterResponseDto> {
    if (!this.apiKey) {
      throw new HttpException(
        'OpenRouter API key não configurada',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const url = `${this.apiUrl}/chat/completions`;

    // Monta a cadeia de fallback: modelo primário primeiro, depois os free,
    // sem duplicatas. OpenRouter percorre em ordem se um modelo falhar.
    // OpenRouter aceita no máximo 3 itens em `models`; corta a cadeia.
    const primaryModel = request.model || this.defaultModel;
    const models = [
      primaryModel,
      ...OPENROUTER_FALLBACK_MODELS.filter((m) => m !== primaryModel),
    ].slice(0, 3);
    const payload: OpenRouterRequestDto = { ...request, models };

    try {
      const response = await firstValueFrom(
        this.httpService.post<OpenRouterResponseDto>(url, payload, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': this.configService.get<string>(
              'OPENROUTER_HTTP_REFERER',
              'https://delfos.local',
            ),
            'X-Title': this.configService.get<string>(
              'OPENROUTER_X_TITLE',
              'Delfos',
            ),
          },
        }),
      );

      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
        const message =
          error.response?.data?.error?.message ||
          error.message ||
          'Erro ao chamar OpenRouter API';
        throw new HttpException(message, status);
      }
      throw error;
    }
  }

  /**
   * Extrai o SQL da resposta do OpenRouter
   */
  private extractSqlFromResponse(response: OpenRouterResponseDto): string {
    if (!response.choices || response.choices.length === 0) {
      throw new HttpException(
        'Resposta do OpenRouter não contém escolhas',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const rawContent = response.choices[0].message.content;
    if (rawContent === null || rawContent === undefined) {
      throw new HttpException(
        `Resposta do OpenRouter sem conteúdo (finish_reason: ${response.choices[0].finish_reason ?? 'desconhecido'})`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const content = rawContent.trim();

    // Remover markdown code blocks se existirem
    const sqlCodeBlockRegex = /```(?:sql)?\s*([\s\S]*?)\s*```/;
    const match = content.match(sqlCodeBlockRegex);
    if (match) {
      return match[1].trim();
    }

    // Se não houver code block, retornar o conteúdo diretamente
    return content;
  }

  private formatLogTimestamp(now: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  }

  /**
   * Grava o corpo enviado ao OpenRouter (mensagens + hiperparâmetros) em JSON.
   * Usa o mesmo timestamp que sql-{ts}.sql para correlação.
   */
  private async writeOpenRouterContextToLog(
    payload: {
      mode: 'translate' | 'substitute';
      natural_language_query: string;
      template_sql?: string;
      model?: string;
      temperature?: number;
      max_tokens?: number;
      stop?: string[];
      messages: Array<{ role: string; content: string }>;
    },
    timestamp: string,
  ): Promise<void> {
    try {
      const logDir = join(process.cwd(), 'log');
      await mkdir(logDir, { recursive: true });
      const filepath = join(logDir, `openrouter-context-${timestamp}.json`);
      const body = {
        logged_at: new Date().toISOString(),
        ...payload,
      };
      await writeFile(filepath, JSON.stringify(body, null, 2), 'utf-8');
      this.logger.log(`Contexto OpenRouter gravado em ${filepath}`);
    } catch (err) {
      this.logger.warn(
        'Falha ao gravar contexto OpenRouter em log (não interrompe o fluxo)',
        err,
      );
    }
  }

  /**
   * Grava o SQL gerado na pasta log do backend (delfos-backend/log).
   * Nome do arquivo: sql-YYYY-MM-DD_HH-mm-ss.sql
   */
  private async writeSqlToLog(
    sqlQuery: string,
    naturalLanguageQuery?: string,
    timestamp?: string,
  ): Promise<void> {
    try {
      const logDir = join(process.cwd(), 'log');
      await mkdir(logDir, { recursive: true });
      const now = new Date();
      const ts = timestamp ?? this.formatLogTimestamp(now);
      const filename = `sql-${ts}.sql`;
      const filepath = join(logDir, filename);
      const contextRef = `-- Contexto OpenRouter: openrouter-context-${ts}.json (mesma pasta)\n`;
      const header = naturalLanguageQuery
        ? `${contextRef}-- Consulta (linguagem natural): ${naturalLanguageQuery}\n-- Gerado em: ${now.toISOString()}\n\n`
        : `${contextRef}-- Gerado em: ${now.toISOString()}\n\n`;
      await writeFile(filepath, header + sqlQuery, 'utf-8');
      this.logger.log(`SQL gravado em ${filepath}`);
    } catch (err) {
      this.logger.warn('Falha ao gravar SQL em log (não interrompe o fluxo)', err);
    }
  }

  /**
   * Trata erros da API do OpenRouter
   */
  private handleError(error: any): HttpException {
    if (error instanceof HttpException) {
      return error;
    }

    if (error instanceof AxiosError) {
      const status = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const message =
        error.response?.data?.error?.message ||
        error.message ||
        'Erro ao comunicar com OpenRouter';
      return new HttpException(message, status);
    }

    return new HttpException(
      'Erro interno ao processar tradução',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
