import React, { useState } from 'react';
import { TableNodeData } from './utils/parseSchema';
import { ChevronDown, ChevronRight, KeyRound, Link2, Table as TableIcon } from 'lucide-react';

interface SchemaTreeViewProps {
  nodes: TableNodeData[];
  onInsertText?: (text: string) => void;
}

export const SchemaTreeView: React.FC<SchemaTreeViewProps> = ({ nodes, onInsertText }) => {
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    nodes.forEach(n => { init[n.name] = true; });
    return init;
  });

  const toggleTable = (tableName: string) => {
    setExpandedTables(prev => ({ ...prev, [tableName]: !prev[tableName] }));
  };

  return (
    <div className="space-y-2 p-3 font-mono text-xs text-gray-300 select-none">
      {nodes.map(table => {
        const isExpanded = expandedTables[table.name] ?? true;
        return (
          <div key={table.name} className="border border-white/10 rounded-xl bg-[#11121d] overflow-hidden">
            {/* Table Accordion Header */}
            <div
              onClick={() => toggleTable(table.name)}
              className="flex items-center justify-between px-3 py-2 bg-white/[0.03] hover:bg-white/[0.07] cursor-pointer transition-all"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                <TableIcon className="w-4 h-4 text-blue-400" />
                <span
                  onClick={e => { e.stopPropagation(); onInsertText?.(table.name); }}
                  className="font-bold text-white hover:text-blue-300 hover:underline"
                  title="Click to insert table name"
                >
                  {table.name}
                </span>
              </div>
              <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full font-sans">
                {table.columns.length} columns
              </span>
            </div>

            {/* Nested Column Rows */}
            {isExpanded && (
              <div className="divide-y divide-white/5 bg-[#0a0b12] pl-6 pr-3 py-1">
                {table.columns.map(col => (
                  <div
                    key={col.name}
                    onClick={() => onInsertText?.(`${table.name}.${col.name}`)}
                    className="flex items-center justify-between py-1.5 hover:text-blue-300 cursor-pointer group"
                    title={`Click to insert ${table.name}.${col.name}`}
                  >
                    <div className="flex items-center gap-2">
                      {col.isPrimaryKey ? (
                        <KeyRound className="w-3 h-3 text-amber-400" title="Primary Key" />
                      ) : col.isForeignKey ? (
                        <Link2 className="w-3 h-3 text-blue-400" title="Foreign Key" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-600 group-hover:bg-blue-400" />
                      )}
                      <span className="text-gray-300 group-hover:text-white font-medium">{col.name}</span>
                      {col.references && (
                        <span className="text-[10px] text-blue-400/80 font-sans">
                          → {col.references.table}.{col.references.column}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-500">{col.type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
