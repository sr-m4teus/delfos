import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'SERVER_ERROR';
    let message = 'Erro interno do servidor';
    let details: Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message;
        
        // Mapear códigos de erro
        if (status === HttpStatus.UNAUTHORIZED) {
          error = 'UNAUTHORIZED';
          if (message.includes('credenciais') || message.includes('senha')) {
            error = 'INVALID_CREDENTIALS';
          } else if (message.includes('expirado') || message.includes('expirada')) {
            error = 'SESSION_EXPIRED';
          }
        } else if (status === HttpStatus.FORBIDDEN) {
          error = 'FORBIDDEN';
        } else if (status === HttpStatus.BAD_REQUEST) {
          error = 'VALIDATION_ERROR';
          // Se já tem details formatados, usar diretamente
          if (responseObj.details) {
            details = responseObj.details;
          } else if (Array.isArray(responseObj.message)) {
            // Formatar erros de validação do class-validator
            details = {};
            responseObj.message.forEach((msg: string) => {
              // Tentar extrair campo e mensagem
              const fieldMatch = msg.match(/^(\w+)\s+(.+)$/);
              if (fieldMatch) {
                const [, field, errorMsg] = fieldMatch;
                if (!details![field]) {
                  details![field] = [];
                }
                details![field].push(errorMsg);
              }
            });
          } else if (responseObj.message && typeof responseObj.message === 'string') {
            // Verificar se é erro de email duplicado
            if (responseObj.message.includes('já está cadastrado')) {
              error = 'EMAIL_ALREADY_EXISTS';
            }
          }
        }

        // Se já tem details no response, usar
        if (responseObj.details) {
          details = responseObj.details;
        }
      } else {
        message = exceptionResponse as string;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    response.status(status).json({
      error,
      message,
      ...(details && { details }),
    });
  }
}
