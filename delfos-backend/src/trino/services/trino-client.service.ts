import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError, AxiosRequestConfig } from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import * as https from 'https';
import { ExecuteQueryRequestDto } from '../dto/execute-query-request.dto';
import { ExecuteQueryResponseDto, PaginationInfo } from '../dto/execute-query-response.dto';

@Injectable()
export class TrinoClientService {
  private readonly logger = new Logger(TrinoClientService.name);
  private readonly baseUrl: string;
  private readonly defaultTimeout: number;
  private readonly defaultUser: string;
  private readonly defaultCatalog: string;
  /** Agente SOCKS5 (Tailscale userspace) p/ alcançar Trino atrás de VPN. undefined = sem proxy. */
  private readonly socksAgent?: SocksProxyAgent;
  /** Header `Authorization: Basic` (TRINO_USER:TRINO_PASSWORD). undefined = Trino sem auth. */
  private readonly authHeader?: string;
  /** Agente HTTPS que aceita cert self-signed (Trino na VM Oracle). undefined = TLS estrito. */
  private readonly insecureHttpsAgent?: https.Agent;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('TRINO_URL') ||
      'http://localhost:8081';
    this.defaultTimeout =
      this.configService.get<number>('TRINO_TIMEOUT') || 30000;
    this.defaultUser =
      this.configService.get<string>('TRINO_USER') || 'delfos_user';
    this.defaultCatalog =
      this.configService.get<string>('TRINO_CATALOG') || 'default';

    if (!this.configService.get<string>('TRINO_URL')) {
      this.logger.warn(
        'TRINO_URL não configurada. Usando padrão: http://localhost:8081',
      );
    }

    // Proxy SOCKS5 opcional (ex: socks5h://localhost:1055 do tailscaled userspace).
    // Roteia SÓ as requisições do Trino pela tailnet; resto do backend sai direto.
    const socksProxy = this.configService.get<string>('TRINO_SOCKS_PROXY');
    if (socksProxy) {
      this.socksAgent = new SocksProxyAgent(socksProxy);
      this.logger.log(`Trino acessível via proxy SOCKS5: ${socksProxy}`);
    }

    // Auth por senha (Trino PASSWORD authenticator). Enviado em todas as requisições.
    const password = this.configService.get<string>('TRINO_PASSWORD');
    if (password) {
      const token = Buffer.from(`${this.defaultUser}:${password}`).toString(
        'base64',
      );
      this.authHeader = `Basic ${token}`;
      this.logger.log('Trino com autenticação por senha (Basic) habilitada.');
    }

    // Cert self-signed do Trino (VM Oracle): aceitar quando TRINO_TLS_INSECURE=true.
    if (
      this.baseUrl.startsWith('https') &&
      this.configService.get<string>('TRINO_TLS_INSECURE') === 'true'
    ) {
      this.insecureHttpsAgent = new https.Agent({ rejectUnauthorized: false });
      this.logger.warn(
        'Trino HTTPS com verificação de certificado DESABILITADA (cert self-signed).',
      );
    }
  }

  /**
   * Mescla a config axios com o agente SOCKS5 (quando TRINO_SOCKS_PROXY definida).
   * proxy:false evita que o axios também tente proxies de variáveis de ambiente.
   */
  private withProxy(config: AxiosRequestConfig): AxiosRequestConfig {
    const merged: AxiosRequestConfig = { ...config };

    if (this.socksAgent) {
      // SOCKS5 cobre http e https; desabilita proxies de env do axios.
      merged.httpAgent = this.socksAgent;
      merged.httpsAgent = this.socksAgent;
      merged.proxy = false;
    } else if (this.insecureHttpsAgent) {
      merged.httpsAgent = this.insecureHttpsAgent;
    }

    // Injeta Basic auth em toda requisição (statement, paginação e cancelamento).
    if (this.authHeader) {
      merged.headers = { ...(merged.headers || {}), Authorization: this.authHeader };
    }

    return merged;
  }

  /**
   * Cancela uma query em andamento no Trino (DELETE na nextUri do protocolo REST).
   */
  private async cancelTrinoQuery(
    nextUri: string,
    timeout: number,
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.delete(
          nextUri,
          this.withProxy({
            headers: {
              'X-Trino-User': this.defaultUser,
            },
            timeout,
          }),
        ),
      );
      this.logger.debug('Query Trino cancelada após leitura parcial (paginação).');
    } catch (err) {
      this.logger.warn(
        `Falha ao cancelar query Trino (não afeta a resposta já montada): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * Executa uma query SQL no Trino
   */
  async executeQuery(
    request: ExecuteQueryRequestDto,
  ): Promise<ExecuteQueryResponseDto> {
    const startTime = Date.now();
    const { sql_query, catalog, schema, timeout } = request;

    // Trino não aceita ; no fim da instrução — remover para evitar erro de parser
    const normalizedSql = sql_query.trim().replace(/;\s*$/, '');

    this.logger.log(
      `Executando query no Trino: ${normalizedSql.substring(0, 50)}...`,
    );

    try {
      // Preparar URL do endpoint de query do Trino
      const queryUrl = `${this.baseUrl}/v1/statement`;

      // Preparar headers
      const headers: Record<string, string> = {
        'Content-Type': 'text/plain',
        'X-Trino-User': this.defaultUser,
        'X-Trino-Catalog': catalog || this.defaultCatalog,
      };

      if (schema) {
        headers['X-Trino-Schema'] = schema;
      }

      // Executar query inicial (Trino usa protocolo de múltiplas requisições)
      const response = await firstValueFrom(
        this.httpService.post(
          queryUrl,
          normalizedSql,
          this.withProxy({
            headers,
            timeout: timeout || this.defaultTimeout,
          }),
        ),
      );

      // Trino retorna um objeto com nextUri para buscar resultados
      const queryId = response.headers['x-trino-query-id'];
      let nextUri = response.data.nextUri;

      if (!nextUri) {
        // Query pode ter falhado imediatamente
        if (response.data.error) {
          throw new HttpException(
            response.data.error.message || 'Erro ao executar query no Trino',
            HttpStatus.BAD_REQUEST,
          );
        }
        throw new HttpException(
          'Resposta inválida do Trino',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Buscar resultados (Trino pode retornar dados em múltiplas páginas)
      const allData: Record<string, any>[] = [];
      const columns: string[] = [];
      let queryState = 'RUNNING';

      const paginated =
        request.page !== undefined || request.pageSize !== undefined;
      const page = paginated ? request.page || 1 : 1;
      const pageSize = paginated
        ? Math.min(request.pageSize || 50, 100)
        : 50;
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      /** true = ainda havia nextUri / query não finalizada ao parar por paginação */
      let stoppedEarlyWithMore = false;

      const effectiveTimeout = timeout || this.defaultTimeout;

      while (nextUri && queryState !== 'FINISHED') {
        const resultResponse = await firstValueFrom(
          this.httpService.get(
            nextUri,
            this.withProxy({
              headers: {
                'X-Trino-User': this.defaultUser,
              },
              timeout: effectiveTimeout,
            }),
          ),
        );

        const resultData = resultResponse.data;

        // Extrair colunas na primeira iteração
        if (columns.length === 0 && resultData.columns) {
          resultData.columns.forEach((col: any) => {
            columns.push(col.name);
          });
        }

        // Extrair dados
        if (resultData.data) {
          resultData.data.forEach((row: any[]) => {
            const rowObj: Record<string, any> = {};
            columns.forEach((col, index) => {
              rowObj[col] = row[index];
            });
            allData.push(rowObj);
          });
        }

        queryState = resultData.stats?.state || 'FINISHED';
        nextUri = resultData.nextUri;

        // Verificar erros
        if (resultData.error) {
          throw new HttpException(
            resultData.error.message || 'Erro ao executar query no Trino',
            HttpStatus.BAD_REQUEST,
          );
        }

        // Timeout de segurança
        if (Date.now() - startTime > effectiveTimeout) {
          throw new HttpException(
            'Timeout ao executar query no Trino',
            HttpStatus.REQUEST_TIMEOUT,
          );
        }

        if (paginated && allData.length >= endIndex) {
          if (nextUri && queryState !== 'FINISHED') {
            stoppedEarlyWithMore = true;
            await this.cancelTrinoQuery(nextUri, effectiveTimeout);
          }
          break;
        }
      }

      const executionTime = Date.now() - startTime;
      const materializedRowCount = allData.length;

      // Aplicar paginação se solicitado
      let paginatedData = allData;
      let pagination: PaginationInfo | undefined = undefined;
      let rowCount = materializedRowCount;

      if (paginated) {
        paginatedData = allData.slice(startIndex, endIndex);
        rowCount = paginatedData.length;

        if (stoppedEarlyWithMore) {
          pagination = {
            current_page: page,
            page_size: pageSize,
            has_more: true,
          };
          this.logger.log(
            `Query Trino (paginada): ${rowCount} linhas nesta página em ${executionTime}ms; total global não materializado (has_more).`,
          );
        } else {
          const totalRows = materializedRowCount;
          const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
          pagination = {
            current_page: page,
            page_size: pageSize,
            has_more: false,
            total_rows: totalRows,
            total_pages: totalPages,
          };
          this.logger.log(
            `Query executada com sucesso: ${totalRows} linhas em ${executionTime}ms (página ${page}/${totalPages})`,
          );
        }
      } else {
        this.logger.log(
          `Query executada com sucesso: ${materializedRowCount} linhas em ${executionTime}ms`,
        );
      }

      return {
        success: true,
        data: paginatedData,
        columns,
        row_count: rowCount,
        pagination,
        execution_time_ms: executionTime,
        metadata: {
          query_id: queryId,
          query_state: queryState,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      if (error instanceof HttpException) {
        throw error;
      }

      if (error instanceof AxiosError) {
        const status = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
        const message =
          error.response?.data?.error?.message ||
          error.message ||
          'Erro ao executar query no Trino';

        this.logger.error(`Erro ao executar query: ${message}`, error.stack);

        return {
          success: false,
          error: message,
          execution_time_ms: executionTime,
        };
      }

      this.logger.error('Erro inesperado ao executar query', error);
      throw new HttpException(
        'Erro interno ao executar query',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

}
