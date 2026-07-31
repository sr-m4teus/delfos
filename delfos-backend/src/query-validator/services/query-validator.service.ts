import { Injectable, Logger } from '@nestjs/common';
import { ValidateQueryRequestDto } from '../dto/validate-query-request.dto';
import { ValidateQueryResponseDto } from '../dto/validate-query-response.dto';

@Injectable()
export class QueryValidatorService {
  private readonly logger = new Logger(QueryValidatorService.name);

  /**
   * Detecta postgres_catalogo.algo onde algo não é "public" (falta o schema SQL real).
   */
  private hasFederatedCatalogMissingSchema(sql: string): boolean {
    // Catalogo federado usado como catalogo.tabela (2 partes) -> Trino le como
    // schema.tabela e falha. Exige catalogo.schema.tabela (3 partes).
    // \b apos o identificador impede falso-positivo por backtracking quando ha schema.
    const re = /\bsupabase_targets\.[a-z0-9_]+\b(?!\.)/i;
    return re.test(sql);
  }

  // Comandos SQL perigosos que devem ser bloqueados
  private readonly DANGEROUS_COMMANDS = [
    'DROP',
    'DELETE',
    'TRUNCATE',
    'ALTER',
    'CREATE',
    'INSERT',
    'UPDATE',
    'GRANT',
    'REVOKE',
    'EXEC',
    'EXECUTE',
    'CALL',
  ];

  // Padrões suspeitos de SQL injection (não incluir ' e ; — usados em literais e fim de comando)
  private readonly SQL_INJECTION_PATTERNS = [
    /(\/\*|\*\/)/, // comentários em bloco (podem ocultar payload)
    /(\bUNION\b.*\bSELECT\b)/i,
    /(\bEXEC\b|\bEXECUTE\b)/i,
    /(\bSCRIPT\b)/i,
    /(\bJAVASCRIPT\b)/i,
    /(\bVBSCRIPT\b)/i,
    /(\bONLOAD\b)/i,
    /(\bONERROR\b)/i,
  ];

  /**
   * Valida uma query SQL quanto a segurança e sintaxe básica
   */
  async validateQuery(
    request: ValidateQueryRequestDto,
  ): Promise<ValidateQueryResponseDto> {
    const { sql_query } = request;
    const warnings: string[] = [];
    const detectedPatterns: string[] = [];
    const blockedCommands: string[] = [];

    this.logger.debug(`Validando query: ${sql_query.substring(0, 50)}...`);

    // Normalizar query (remover espaços extras, converter para uppercase para análise)
    const normalizedQuery = sql_query.trim().replace(/\s+/g, ' ');
    const upperQuery = normalizedQuery.toUpperCase();

    // 1. Verificar comandos perigosos
    for (const command of this.DANGEROUS_COMMANDS) {
      const regex = new RegExp(`\\b${command}\\b`, 'i');
      if (regex.test(normalizedQuery)) {
        blockedCommands.push(command);
      }
    }

    if (blockedCommands.length > 0) {
      return {
        valid: false,
        reason: `Comandos perigosos detectados: ${blockedCommands.join(', ')}`,
        details: {
          blocked_commands: blockedCommands,
        },
      };
    }

    // 2. Verificar padrões de SQL injection
    for (const pattern of this.SQL_INJECTION_PATTERNS) {
      if (pattern.test(normalizedQuery)) {
        detectedPatterns.push(pattern.toString());
      }
    }

    if (detectedPatterns.length > 0) {
      return {
        valid: false,
        reason: 'Padrões suspeitos de SQL injection detectados',
        details: {
          detected_patterns: detectedPatterns,
        },
      };
    }

    // 3. Validar sintaxe básica (verificar se começa com SELECT)
    // if (!upperQuery.startsWith('SELECT')) {
    //   return {
    //     valid: false,
    //     reason: 'Apenas comandos SELECT são permitidos',
    //   };
    // }

    // 3b. Trino: catalogo.tabela (2 partes) vira schema.tabela no catálogo default (erro comum do LLM)
    if (this.hasFederatedCatalogMissingSchema(normalizedQuery)) {
      return {
        valid: false,
        reason:
          'No Trino, use sempre catalogo.schema.tabela (ex.: supabase_targets.db_frota.veiculo). ' +
          'Evite catalogo.tabela — o motor interpreta como schema.tabela e falha com Catalog \'default\' not found.',
      };
    }

    // 4. Verificar se a query não está vazia
    if (normalizedQuery.length === 0) {
      return {
        valid: false,
        reason: 'Query vazia',
      };
    }

    // 5. Verificar tamanho máximo
    if (normalizedQuery.length > 10000) {
      return {
        valid: false,
        reason: 'Query muito longa (máximo 10000 caracteres)',
      };
    }

    // 6. Avisos (não bloqueiam a execução)
    if (upperQuery.includes('SELECT *')) {
      warnings.push('Considerar especificar colunas ao invés de usar SELECT *');
    }

    if (normalizedQuery.length > 5000) {
      warnings.push('Query muito longa, pode ter impacto na performance');
    }

    this.logger.log(`Query validada com sucesso`);

    return {
      valid: true,
      reason: 'Query válida',
      warnings: warnings.length > 0 ? warnings : undefined,
      details: {
        allowed_operations: ['SELECT'],
      },
    };
  }

  /**
   * Valida uma query editada pelo usuário (validação mais rigorosa)
   */
  async validateEditedQuery(
    request: ValidateQueryRequestDto,
  ): Promise<ValidateQueryResponseDto> {
    // Aplicar validação padrão
    const result = await this.validateQuery(request);

    if (!result.valid) {
      return result;
    }

    // Validações adicionais para queries editadas
    const warnings = result.warnings || [];
    const normalizedQuery = request.sql_query.trim().toUpperCase();

    // Verificar se há múltiplas queries (separadas por ;)
    const queries = request.sql_query.split(';').filter((q) => q.trim().length > 0);
    if (queries.length > 1) {
      return {
        valid: false,
        reason: 'Múltiplas queries não são permitidas',
      };
    }

    // Verificar uso de funções potencialmente perigosas
    const dangerousFunctions = ['EVAL', 'EXEC', 'EXECUTE', 'SP_', 'XP_'];
    for (const func of dangerousFunctions) {
      if (normalizedQuery.includes(func)) {
        warnings.push(`Uso de função potencialmente perigosa: ${func}`);
      }
    }

    return {
      ...result,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
}
