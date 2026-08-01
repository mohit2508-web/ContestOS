import React from 'react';
import { SchemaViewer } from './SchemaViewer';
import { X, Network } from 'lucide-react';

interface SchemaViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: any[];
  problemDescription?: string;
  onInsertText?: (text: string) => void;
}

export const SchemaViewerModal: React.FC<SchemaViewerProps & { isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
  tables,
  problemDescription,
  onInsertText,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6 select-none" onClick={onClose}>
      <div
        className="bg-[#0b0c16] border border-blue-500/30 rounded-2xl w-full max-w-7xl h-[88vh] flex flex-col shadow-2xl overflow-hidden relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#121322] border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-wide flex items-center gap-2">
                Logical Data Model <span className="text-xs font-mono font-normal text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full">Interactive ER Diagram</span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Interactive entity relationship graph powered by React Flow & Dagre Auto-Layout</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-xl border border-white/10 transition-all"
            title="Close ER Diagram"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Canvas Body */}
        <div className="flex-1 w-full h-full p-2 overflow-hidden bg-[#07080f]">
          <SchemaViewer
            tables={tables}
            problemDescription={problemDescription}
            onInsertText={onInsertText}
          />
        </div>
      </div>
    </div>
  );
};
