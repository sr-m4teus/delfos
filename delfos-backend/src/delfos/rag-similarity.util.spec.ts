import {
  DEFAULT_RAG_PERFECT_SIMILARITY_THRESHOLD,
  parsePerfectSimilarityThreshold,
  pickTemplateSqlWithPerfectSimilarity,
} from './rag-similarity.util';

describe('parsePerfectSimilarityThreshold', () => {
  it('usa padrão 0.999 quando vazio ou inválido', () => {
    expect(parsePerfectSimilarityThreshold(undefined)).toBe(
      DEFAULT_RAG_PERFECT_SIMILARITY_THRESHOLD,
    );
    expect(parsePerfectSimilarityThreshold('')).toBe(
      DEFAULT_RAG_PERFECT_SIMILARITY_THRESHOLD,
    );
    expect(parsePerfectSimilarityThreshold('não-número')).toBe(
      DEFAULT_RAG_PERFECT_SIMILARITY_THRESHOLD,
    );
  });

  it('aceita string e número válidos', () => {
    expect(parsePerfectSimilarityThreshold('0.95')).toBe(0.95);
    expect(parsePerfectSimilarityThreshold(1)).toBe(1);
  });
});

describe('pickTemplateSqlWithPerfectSimilarity — cenários tradução vs substituição', () => {
  const threshold = DEFAULT_RAG_PERFECT_SIMILARITY_THRESHOLD;

  it('cenário A: nenhuma query >= limiar → null (fluxo tradução completa)', () => {
    const sql = pickTemplateSqlWithPerfectSimilarity(
      [
        { similarity: 0.72, rank: 1, sql_query: 'SELECT 1' },
        { similarity: 0.51, rank: 2, sql_query: 'SELECT 2' },
      ],
      threshold,
    );
    expect(sql).toBeNull();
  });

  it('cenário B: query com similaridade 1.0 >= 0.999 → retorna SQL do melhor match', () => {
    const sql = pickTemplateSqlWithPerfectSimilarity(
      [
        { similarity: 0.85, rank: 1, sql_query: 'SELECT baixo' },
        { similarity: 1.0, rank: 2, sql_query: 'SELECT perfeito' },
      ],
      threshold,
    );
    expect(sql).toBe('SELECT perfeito');
  });

  it('empate de similaridade: menor rank vence', () => {
    const sql = pickTemplateSqlWithPerfectSimilarity(
      [
        { similarity: 1.0, rank: 2, sql_query: 'SELECT segundo' },
        { similarity: 1.0, rank: 1, sql_query: 'SELECT primeiro' },
      ],
      threshold,
    );
    expect(sql).toBe('SELECT primeiro');
  });

  it('similaridade alta mas SQL vazio não conta', () => {
    const sql = pickTemplateSqlWithPerfectSimilarity(
      [{ similarity: 1.0, rank: 1, sql_query: '   ' }],
      threshold,
    );
    expect(sql).toBeNull();
  });
});
