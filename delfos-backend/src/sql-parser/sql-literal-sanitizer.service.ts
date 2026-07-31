import { Injectable } from '@nestjs/common';

/**
 * Substitui literais string (aspas simples, com '' escapado) por [PARAM_1], [PARAM_2], ...
 * para generalizar SQL antes de persistir no RAG. Não altera identificadores nem comentários
 * de forma explícita (comentários -- não contêm aspas simples balanceadas da mesma forma).
 */
@Injectable()
export class SqlLiteralSanitizerService {
  sanitizeForRag(sql: string): string {
    if (!sql) {
      return sql;
    }
    let i = 0;
    let out = '';
    let paramIndex = 1;
    const n = sql.length;

    while (i < n) {
      const c = sql[i];
      if (c !== "'") {
        out += c;
        i += 1;
        continue;
      }

      let j = i + 1;
      while (j < n) {
        if (sql[j] === "'") {
          if (j + 1 < n && sql[j + 1] === "'") {
            j += 2;
            continue;
          }
          break;
        }
        j += 1;
      }

      if (j >= n) {
        out += sql.slice(i);
        break;
      }

      out += `[PARAM_${paramIndex++}]`;
      i = j + 1;
    }

    return out;
  }
}
