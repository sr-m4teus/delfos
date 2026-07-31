import { SqlLiteralSanitizerService } from './sql-literal-sanitizer.service';

describe('SqlLiteralSanitizerService', () => {
  const service = new SqlLiteralSanitizerService();

  it('substitui literal simples', () => {
    const sql =
      "SELECT * FROM dbo.usuarios u WHERE u.name = 'Fulano de Tal'";
    expect(service.sanitizeForRag(sql)).toBe(
      'SELECT * FROM dbo.usuarios u WHERE u.name = [PARAM_1]',
    );
  });

  it('preserva aspas duplicadas escapadas dentro do literal', () => {
    const sql = "SELECT * FROM t WHERE c = 'O''Reilly'";
    expect(service.sanitizeForRag(sql)).toBe(
      'SELECT * FROM t WHERE c = [PARAM_1]',
    );
  });

  it('substitui múltiplos literais', () => {
    const sql = "SELECT * FROM t WHERE a = 'x' AND b = 'y'";
    expect(service.sanitizeForRag(sql)).toBe(
      'SELECT * FROM t WHERE a = [PARAM_1] AND b = [PARAM_2]',
    );
  });

  it('retorna string vazia como está', () => {
    expect(service.sanitizeForRag('')).toBe('');
  });
});
