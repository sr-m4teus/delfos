import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('table_fk_edge', { schema: 'delfos' })
@Unique('uq_fk_edge', ['srcFqn', 'srcColumn', 'refFqn', 'refColumn'])
export class TableFkEdge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 512, name: 'src_fqn' })
  srcFqn: string;

  @Column({ type: 'varchar', length: 255, name: 'src_column' })
  srcColumn: string;

  @Column({ type: 'varchar', length: 512, name: 'ref_fqn' })
  refFqn: string;

  @Column({ type: 'varchar', length: 255, name: 'ref_column' })
  refColumn: string;

  /** Source catalog of this edge — used for clean per-catalog re-sync delete. */
  @Index()
  @Column({ type: 'varchar', length: 255 })
  catalog: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
