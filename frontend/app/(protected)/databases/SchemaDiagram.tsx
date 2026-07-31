'use client';

import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
  type OnNodesChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { TableCardNode, type TableCardNodeData } from './TableCardNode';

const nodeTypes: NodeTypes = {
  tableCard: TableCardNode,
};

interface SchemaDiagramProps {
  nodes: Node<TableCardNodeData>[];
  edges: Edge[];
  onNodesChange?: OnNodesChange;
}

export default function SchemaDiagram({ nodes, edges, onNodesChange }: SchemaDiagramProps) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      nodeTypes={nodeTypes}
      nodesDraggable
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.2}
      maxZoom={1.5}
      defaultEdgeOptions={{ type: 'smoothstep' }}
    >
      <Background color="#e8e8e8" gap={16} />
      <Controls />
      <MiniMap
        nodeColor={(n) => {
          if (n.type !== 'tableCard' || !n.data?.color) return '#ccc';
          return n.data.color;
        }}
        maskColor="rgba(0,0,0,0.06)"
      />
    </ReactFlow>
  );
}
