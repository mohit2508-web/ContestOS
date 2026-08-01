import dagre from '@dagrejs/dagre';
import { Node, Edge } from '@xyflow/react';
import { TableNodeData } from './parseSchema';

export function getLayoutedElements(
  nodesData: TableNodeData[],
  rawEdges: Array<{ id: string; source: string; target: string; sourceColumn: string; targetColumn: string; label?: string }>,
  direction: 'LR' | 'TB' = 'LR'
) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 80,
    ranksep: 120,
    marginx: 40,
    marginy: 40,
  });

  const nodes: Node[] = nodesData.map(data => {
    const nodeWidth = 240;
    const nodeHeight = 50 + data.columns.length * 28;
    dagreGraph.setNode(data.id, { width: nodeWidth, height: nodeHeight });

    return {
      id: data.id,
      type: 'tableNode',
      position: { x: 0, y: 0 },
      data,
    };
  });

  const edges: Edge[] = rawEdges.map(e => {
    dagreGraph.setEdge(e.source, e.target);
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      animated: true,
      style: { stroke: '#3b82f6', strokeWidth: 2 },
      label: `${e.sourceColumn} 🔗 ${e.targetColumn}`,
      labelStyle: { fill: '#93c5fd', fontWeight: 600, fontSize: 10 },
      labelBgStyle: { fill: '#1e1b4b', rx: 6, ry: 6 },
    };
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map(node => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const nodeWidth = 240;
    const nodeHeight = 50 + (node.data as unknown as TableNodeData).columns.length * 28;

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}
