import React, { useMemo, useState, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { parseSchemaToGraph } from './utils/parseSchema';
import { getLayoutedElements } from './utils/layoutEngine';
import { TableNode } from './TableNode';
import { SchemaTreeView } from './SchemaTreeView';
import { LayoutGrid, Network, Search } from 'lucide-react';

interface SchemaViewerProps {
  tables: any[];
  problemDescription?: string;
  onInsertText?: (text: string) => void;
}

const nodeTypes = {
  tableNode: TableNode,
};

const SchemaViewerContent: React.FC<SchemaViewerProps> = ({ tables, problemDescription, onInsertText }) => {
  const [viewMode, setViewMode] = useState<'diagram' | 'tree'>('diagram');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Parse Graph
  const graph = useMemo(() => parseSchemaToGraph(tables, problemDescription), [tables, problemDescription]);

  // 2. Compute Dagre Auto-Layout
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    return getLayoutedElements(graph.nodes, graph.edges, 'LR');
  }, [graph]);

  // Pass click handlers to node data
  const nodesWithHandlers = useMemo(() => {
    return initialNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        onTableClick: (tName: string) => onInsertText?.(tName),
        onColumnClick: (tName: string, cName: string) => onInsertText?.(`${tName}.${cName}`),
      },
    }));
  }, [initialNodes, onInsertText]);

  const [nodes, , onNodesChange] = useNodesState(nodesWithHandlers);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  // Filter nodes based on search term
  const filteredNodes = useMemo(() => {
    if (!searchTerm.trim()) return nodes;
    const term = searchTerm.toLowerCase();
    return nodes.map(node => {
      const tName = (node.data as any).name.toLowerCase();
      const hasMatchingCol = (node.data as any).columns.some((c: any) => c.name.toLowerCase().includes(term));
      const matches = tName.includes(term) || hasMatchingCol;
      return {
        ...node,
        style: { ...node.style, opacity: matches ? 1 : 0.25 },
      };
    });
  }, [nodes, searchTerm]);

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0b12] overflow-hidden select-none border border-white/10 rounded-xl">
      {/* Header Controls Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#12131f] border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-white flex items-center gap-2">
            <Network className="w-4 h-4 text-blue-400" />
            Database Schema Model
          </span>
          <span className="text-[10px] bg-blue-500/20 text-blue-400 font-extrabold px-2 py-0.5 rounded-full border border-blue-500/30">
            {graph.nodes.length} Table{graph.nodes.length !== 1 ? 's' : ''} • {graph.edges.length} FK Relationship{graph.edges.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search table or column..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1 bg-black/40 border border-white/15 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-44 transition-all"
            />
          </div>

          {/* Mode Switcher Pills */}
          <div className="flex items-center bg-black/40 p-0.5 border border-white/15 rounded-lg">
            <button
              onClick={() => setViewMode('diagram')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                viewMode === 'diagram'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              Diagram View
            </button>

            <button
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                viewMode === 'tree'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Tree View
            </button>
          </div>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 relative w-full h-full min-h-[350px]">
        {viewMode === 'diagram' ? (
          <ReactFlow
            nodes={filteredNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            proOptions={{ hideAttribution: true }}
            className="bg-[#0a0b12]"
          >
            <Background color="#1e2030" gap={24} size={1} />
            <Controls className="bg-[#12131f] border border-white/10 fill-white text-white rounded-lg overflow-hidden" />
            <MiniMap
              nodeColor={() => '#3b82f6'}
              maskColor="rgba(10, 11, 18, 0.7)"
              className="bg-[#12131f] border border-white/15 rounded-lg overflow-hidden"
            />
          </ReactFlow>
        ) : (
          <div className="h-full overflow-y-auto p-2">
            <SchemaTreeView nodes={graph.nodes} onInsertText={onInsertText} />
          </div>
        )}
      </div>
    </div>
  );
};

export const SchemaViewer: React.FC<SchemaViewerProps> = props => (
  <ReactFlowProvider>
    <SchemaViewerContent {...props} />
  </ReactFlowProvider>
);
