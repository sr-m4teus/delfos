import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TableNode } from '../entities/table-node.entity';
import { TableFkEdge } from '../entities/table-fk-edge.entity';
import {
  buildDependencyGraph,
  EdgeRecord,
} from '../dependency-graph.util';
import {
  DependencyGraphResponseDto,
} from '../dto/dependency-graph.dto';

@Injectable()
export class DependencyGraphService {
  private readonly logger = new Logger(DependencyGraphService.name);

  constructor(
    @InjectRepository(TableNode)
    private readonly nodeRepo: Repository<TableNode>,
    @InjectRepository(TableFkEdge)
    private readonly edgeRepo: Repository<TableFkEdge>,
  ) {}

  /** key = exact requested string; depth fixed at 2 (spec). */
  async getGraphs(tables: string[]): Promise<DependencyGraphResponseDto> {
    const result: DependencyGraphResponseDto = {};
    // cache edges per catalog within this request
    const edgesByCatalog = new Map<string, EdgeRecord[]>();

    for (const name of tables) {
      const node = await this.nodeRepo.findOne({ where: { fqn: name } });
      if (!node) {
        this.logger.debug(
          `FQN não encontrado em table_node: "${name}" (grafo vazio)`,
        );
        result[name] = { nodes: [], edges: [] };
        continue;
      }

      let edges = edgesByCatalog.get(node.catalog);
      if (!edges) {
        const rows = await this.edgeRepo.find({
          where: { catalog: node.catalog },
        });
        edges = rows.map((r) => ({
          srcFqn: r.srcFqn,
          srcColumn: r.srcColumn,
          refFqn: r.refFqn,
          refColumn: r.refColumn,
        }));
        edgesByCatalog.set(node.catalog, edges);
      }

      result[name] = buildDependencyGraph(name, true, edges, 2);
    }

    return result;
  }
}
