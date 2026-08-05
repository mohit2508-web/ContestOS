import React from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface PracticeExploreCanvasProps {
  onClose: () => void;
}

export const PracticeExploreCanvas: React.FC<PracticeExploreCanvasProps> = ({ onClose }) => {
  const initialNodes = [
    {
      id: 'n-1',
      position: { x: 50, y: 150 },
      data: { label: '🧠 Aptitude & Syllogism (80% Accuracy)' },
      style: { background: '#0f172a', color: '#2dd4bf', border: '1px solid #2dd4bf', borderRadius: '12px', padding: '10px' },
    },
    {
      id: 'n-2',
      position: { x: 350, y: 80 },
      data: { label: '🔢 Quant Estimation & Numerical (100% Accuracy)' },
      style: { background: '#0f172a', color: '#10b981', border: '1px solid #10b981', borderRadius: '12px', padding: '10px' },
    },
    {
      id: 'n-3',
      position: { x: 350, y: 220 },
      data: { label: '🧩 Algorithmic Code Ordering (50% Accuracy)' },
      style: { background: '#0f172a', color: '#f59e0b', border: '1px solid #f59e0b', borderRadius: '12px', padding: '10px' },
    },
  ];

  const initialEdges = [
    { id: 'e1-2', source: 'n-1', target: 'n-2', animated: true, style: { stroke: '#2dd4bf' } },
    { id: 'e1-3', source: 'n-1', target: 'n-3', animated: true, style: { stroke: '#f59e0b' } },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-[#0f172a] border border-[#1e293b] rounded-2xl px-5 py-3 mb-3">
        <div className="flex items-center space-x-3">
          <span className="text-teal-400 font-extrabold text-sm">🌌 Practice Skill Graph Analytics</span>
          <span className="text-xs text-slate-400">(Interactive Topic Breakdown View)</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 bg-[#1e293b] text-slate-300 hover:text-white rounded-xl text-xs font-bold"
        >
          ✕ Close Analytics
        </button>
      </div>

      {/* Infinite Canvas */}
      <div className="flex-1 bg-[#080c14] border border-[#1e293b] rounded-2xl overflow-hidden relative">
        <ReactFlow nodes={initialNodes} edges={initialEdges} fitView>
          <Background color="#1e293b" gap={24} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
};
