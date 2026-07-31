/** A persisted FK edge row, normalized for traversal. */
export interface EdgeRecord {
  srcFqn: string;
  srcColumn: string;
  refFqn: string;
  refColumn: string;
}

/** An edge in the returned graph; direction preserves the FK (from = src). */
export interface GraphEdge {
  from: string;
  to: string;
  from_column: string;
  to_column: string;
}

export interface DependencyGraph {
  nodes: string[];
  edges: GraphEdge[];
}

/**
 * Bidirectional BFS over FK edges up to `maxDepth` hops from `centerFqn`.
 * - exists=false  -> { nodes: [], edges: [] }  (table not found)
 * - no neighbors  -> { nodes: [centerFqn], edges: [] }
 * Output edges = every edge whose both endpoints are in the visited set.
 */
export function buildDependencyGraph(
  centerFqn: string,
  exists: boolean,
  edges: EdgeRecord[],
  maxDepth = 2,
): DependencyGraph {
  if (!exists) {
    return { nodes: [], edges: [] };
  }

  const visited = new Set<string>([centerFqn]);
  let frontier: string[] = [centerFqn];

  for (let depth = 0; depth < maxDepth; depth++) {
    const next: string[] = [];
    for (const node of frontier) {
      for (const e of edges) {
        let neighbor: string | null = null;
        if (e.srcFqn === node) neighbor = e.refFqn;
        else if (e.refFqn === node) neighbor = e.srcFqn;
        if (neighbor && !visited.has(neighbor)) {
          visited.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }

  const resultEdges: GraphEdge[] = edges
    .filter((e) => visited.has(e.srcFqn) && visited.has(e.refFqn))
    .map((e) => ({
      from: e.srcFqn,
      to: e.refFqn,
      from_column: e.srcColumn,
      to_column: e.refColumn,
    }));

  return { nodes: [...visited], edges: resultEdges };
}
