import {
  Entity,
  Column,
  PrimaryColumn,
  Index,
  UpdateDateColumn,
} from 'typeorm';

@Entity('table_node', { schema: 'delfos' })
export class TableNode {
  /** Fully-qualified name: catalog.schema.table */
  @PrimaryColumn({ type: 'varchar', length: 512 })
  fqn: string;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  catalog: string;

  @Column({ type: 'varchar', length: 255, name: 'schema_name' })
  schemaName: string;

  @Column({ type: 'varchar', length: 255, name: 'table_name' })
  tableName: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
