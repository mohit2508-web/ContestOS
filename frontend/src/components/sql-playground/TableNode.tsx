import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { TableNodeData } from './utils/parseSchema';
import { KeyRound, Link2, Table as TableIcon } from 'lucide-react';

interface TableNodeProps {
  data: TableNodeData & {
    onColumnClick?: (tableName: string, columnName: string) => void;
    onTableClick?: (tableName: string) => void;
  };
}

export const TableNode: React.FC<TableNodeProps> = ({ data }) => {
  return (
    <div className="bg-[#12131e] border border-white/15 rounded-xl shadow-2xl overflow-hidden min-w-[220px] max-w-[260px] group transition-all hover:border-blue-500/50 hover:shadow-blue-500/10">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-blue-500 border-2 border-[#12131e] !left-[-6px]"
      />
      
      {/* Table Header Card */}
      <div
        onClick={() => data.onTableClick?.(data.name)}
        className={`px-3.5 py-2.5 bg-gradient-to-r ${data.categoryColor || 'from-blue-500/20 to-indigo-500/5 text-blue-400 border-blue-500/30'} border-b flex items-center justify-between cursor-pointer hover:brightness-125 transition-all`}
        title="Click to insert table name into editor"
      >
        <div className="flex items-center gap-2">
          <TableIcon className="w-4 h-4" />
          <span className="font-mono font-bold text-xs tracking-wide text-white">{data.name}</span>
        </div>
        <span className="text-[10px] font-semibold bg-white/10 px-1.5 py-0.5 rounded text-gray-300">
          {data.columns.length} cols
        </span>
      </div>

      {/* Column Rows List */}
      <div className="divide-y divide-white/5 bg-[#0e0f18]/80">
        {data.columns.map(col => (
          <div
            key={col.name}
            onClick={() => data.onColumnClick?.(data.name, col.name)}
            className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-white/5 transition-colors cursor-pointer group/col"
            title={`Click to insert ${data.name}.${col.name}`}
          >
            <div className="flex items-center gap-1.5">
              {col.isPrimaryKey && (
                <KeyRound className="w-3 h-3 text-amber-400 shrink-0" title="Primary Key" />
              )}
              {col.isForeignKey && (
                <Link2 className="w-3 h-3 text-blue-400 shrink-0" title="Foreign Key" />
              )}
              {!col.isPrimaryKey && !col.isForeignKey && (
                <span className="w-3 h-3 rounded-full bg-white/10 shrink-0 group-hover/col:bg-blue-400/40" />
              )}
              <span className="font-mono text-gray-200 group-hover/col:text-blue-300 font-medium">
                {col.name}
              </span>
            </div>

            <span className="font-mono text-[10px] text-gray-500 uppercase tracking-tighter">
              {col.type}
            </span>
          </div>
        ))}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-blue-500 border-2 border-[#12131e] !right-[-6px]"
      />
    </div>
  );
};
