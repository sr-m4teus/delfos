/**
 * Limiar para usar SQL template do RAG em modo substituição (OpenRouter).
 */
export const DEFAULT_RAG_PERFECT_SIMILARITY_THRESHOLD = 0.999;

export type RagQueryMatch = {
  similarity: number;
  rank: number;
  sql_query: string;
};

export function parsePerfectSimilarityThreshold(
  raw: string | number | undefined | null,
): number {
  if (raw === undefined || raw === null || raw === '') {
    return DEFAULT_RAG_PERFECT_SIMILARITY_THRESHOLD;
  }
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : DEFAULT_RAG_PERFECT_SIMILARITY_THRESHOLD;
}

/**
 * Escolhe o SQL template só se houver match com similaridade >= limiar (ex.: NL quase idêntica).
 */
export function pickTemplateSqlWithPerfectSimilarity(
  queries: RagQueryMatch[],
  threshold: number,
): string | null {
  const matches = queries.filter(
    (q) =>
      typeof q.similarity === 'number' &&
      q.similarity >= threshold &&
      String(q.sql_query ?? '').trim().length > 0,
  );
  if (matches.length === 0) {
    return null;
  }
  matches.sort((a, b) => {
    if (b.similarity !== a.similarity) {
      return b.similarity - a.similarity;
    }
    return a.rank - b.rank;
  });
  return matches[0].sql_query;
}
