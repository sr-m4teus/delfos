import {
  buildDependencyGraph,
  EdgeRecord,
} from './dependency-graph.util';

// Fixture (CRM):
//   vendas.cliente_id      -> clientes.id
//   vendas.produto_id      -> produtos.id
//   itens_venda.venda_id   -> vendas.id     (reverse into vendas)
//   clientes.cidade_id     -> cidades.id
//   cidades.estado_id      -> estados.id
const C = 'postgres_crm.public';
const EDGES: EdgeRecord[] = [
  { srcFqn: `${C}.vendas`, srcColumn: 'cliente_id', refFqn: `${C}.clientes`, refColumn: 'id' },
  { srcFqn: `${C}.vendas`, srcColumn: 'produto_id', refFqn: `${C}.produtos`, refColumn: 'id' },
  { srcFqn: `${C}.itens_venda`, srcColumn: 'venda_id', refFqn: `${C}.vendas`, refColumn: 'id' },
  { srcFqn: `${C}.clientes`, srcColumn: 'cidade_id', refFqn: `${C}.cidades`, refColumn: 'id' },
  { srcFqn: `${C}.cidades`, srcColumn: 'estado_id', refFqn: `${C}.estados`, refColumn: 'id' },
];

describe('buildDependencyGraph', () => {
  it('returns empty graph when the table does not exist', () => {
    const g = buildDependencyGraph(`${C}.naoexiste`, false, EDGES);
    expect(g).toEqual({ nodes: [], edges: [] });
  });

  it('returns a single node when the table has no FK in either direction', () => {
    const g = buildDependencyGraph(`${C}.estados`, true, [
      { srcFqn: `${C}.a`, srcColumn: 'x', refFqn: `${C}.b`, refColumn: 'id' },
    ]);
    expect(g).toEqual({ nodes: [`${C}.estados`], edges: [] });
  });

  it('is bidirectional at depth 1 (out + reverse)', () => {
    const g = buildDependencyGraph(`${C}.vendas`, true, EDGES, 1);
    expect(new Set(g.nodes)).toEqual(
      new Set([
        `${C}.vendas`,
        `${C}.clientes`,
        `${C}.produtos`,
        `${C}.itens_venda`,
      ]),
    );
  });

  it('reaches depth 2 but not depth 3', () => {
    const g = buildDependencyGraph(`${C}.vendas`, true, EDGES, 2);
    expect(g.nodes).toContain(`${C}.cidades`); // hop2 via clientes
    expect(g.nodes).not.toContain(`${C}.estados`); // hop3
  });

  it('includes only edges whose both endpoints are visited, keeping FK direction', () => {
    const g = buildDependencyGraph(`${C}.vendas`, true, EDGES, 2);
    expect(g.edges).toContainEqual({
      from: `${C}.vendas`,
      to: `${C}.clientes`,
      from_column: 'cliente_id',
      to_column: 'id',
    });
    expect(g.edges).toContainEqual({
      from: `${C}.itens_venda`,
      to: `${C}.vendas`,
      from_column: 'venda_id',
      to_column: 'id',
    });
    expect(g.edges.some((e) => e.to === `${C}.estados`)).toBe(false);
  });

  it('does not duplicate nodes in a diamond', () => {
    const diamond: EdgeRecord[] = [
      { srcFqn: `${C}.a`, srcColumn: 'b_id', refFqn: `${C}.b`, refColumn: 'id' },
      { srcFqn: `${C}.a`, srcColumn: 'c_id', refFqn: `${C}.c`, refColumn: 'id' },
      { srcFqn: `${C}.b`, srcColumn: 'd_id', refFqn: `${C}.d`, refColumn: 'id' },
      { srcFqn: `${C}.c`, srcColumn: 'd_id', refFqn: `${C}.d`, refColumn: 'id' },
    ];
    const g = buildDependencyGraph(`${C}.a`, true, diamond, 2);
    expect(g.nodes.filter((n) => n === `${C}.d`)).toHaveLength(1);
  });
});
