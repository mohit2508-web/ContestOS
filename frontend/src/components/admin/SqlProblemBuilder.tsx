import React, { useState } from 'react';
import api from '../../services/api';

export interface SqlColumnDef {
  name: string;
  type: string;
  constraints?: string;
}

export interface SqlTableDef {
  name: string;
  columns: SqlColumnDef[];
  sampleRows: Record<string, string>[];
}

interface SqlProblemBuilderProps {
  onSave: (problemData: {
    starterCode: { sql: string; schema: { tables: SqlTableDef[]; setup: string } };
    expectedOutput: string;
  }) => void;
  initialSql?: string;
}

export const SqlProblemBuilder: React.FC<SqlProblemBuilderProps> = ({ onSave, initialSql }) => {
  const [tables, setTables] = useState<SqlTableDef[]>([
    {
      name: 'Employees',
      columns: [
        { name: 'id', type: 'INT', constraints: 'PRIMARY KEY' },
        { name: 'name', type: 'VARCHAR(50)', constraints: 'NOT NULL' },
        { name: 'salary', type: 'INT' },
      ],
      sampleRows: [
        { id: '1', name: 'Alice', salary: '90000' },
        { id: '2', name: 'Bob', salary: '75000' },
      ],
    },
  ]);

  const [solutionSql, setSolutionSql] = useState(initialSql || '-- Write reference SQL solution\nSELECT name, salary FROM Employees WHERE salary > 80000;');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    success: boolean;
    columns?: string[];
    rows?: Record<string, any>[];
    expectedOutput?: string;
    error?: string;
  } | null>(null);

  // Generate CREATE TABLE and INSERT INTO SQL script automatically
  const generateSetupSql = (): string => {
    const statements: string[] = [];

    tables.forEach(table => {
      if (!table.name.trim()) return;
      const colDefs = table.columns
        .filter(c => c.name.trim())
        .map(c => `${c.name} ${c.type}${c.constraints ? ' ' + c.constraints : ''}`)
        .join(', ');

      if (colDefs) {
        statements.push(`CREATE TABLE ${table.name} (${colDefs});`);
      }

      if (table.sampleRows && table.sampleRows.length > 0) {
        const validCols = table.columns.filter(c => c.name.trim()).map(c => c.name);
        const rowStrings = table.sampleRows.map(row => {
          const vals = validCols.map(col => {
            const val = row[col];
            if (val === undefined || val === null || val === 'NULL' || val === '') return 'NULL';
            if (!isNaN(Number(val))) return val;
            return `'${val.replace(/'/g, "''")}'`;
          });
          return `(${vals.join(', ')})`;
        });
        statements.push(`INSERT INTO ${table.name} VALUES ${rowStrings.join(', ')};`);
      }
    });

    return statements.join('\n');
  };

  const addTable = () => {
    setTables(prev => [
      ...prev,
      {
        name: `Table_${prev.length + 1}`,
        columns: [{ name: 'id', type: 'INT', constraints: 'PRIMARY KEY' }],
        sampleRows: [{ id: '1' }],
      },
    ]);
  };

  const addColumn = (tableIndex: number) => {
    setTables(prev => {
      const next = [...prev];
      next[tableIndex].columns.push({ name: `col_${next[tableIndex].columns.length + 1}`, type: 'VARCHAR(50)' });
      return next;
    });
  };

  const addSampleRow = (tableIndex: number) => {
    setTables(prev => {
      const next = [...prev];
      const newRow: Record<string, string> = {};
      next[tableIndex].columns.forEach(c => {
        newRow[c.name] = '';
      });
      next[tableIndex].sampleRows.push(newRow);
      return next;
    });
  };

  // Run Setter Solution SQL against generated Setup SQL to auto-generate expected output
  const handleValidateSolution = async () => {
    setIsValidating(true);
    setValidationResult(null);

    const setupSql = generateSetupSql();
    try {
      const res = await api.post('/code/run', {
        language: 'sql',
        code: solutionSql,
        setup: setupSql,
      });

      if (res.error || !res.success) {
        setValidationResult({ success: false, error: res.error || 'Execution failed' });
      } else {
        const cols: string[] = res.columns || [];
        const rows: any[] = res.rows || [];
        const header = cols.join('\t');
        const body = rows.map(r => cols.map(c => (r[c] === null ? 'NULL' : String(r[c]))).join('\t')).join('\n');
        const expectedOutput = body ? `${header}\n${body}` : header;

        setValidationResult({
          success: true,
          columns: cols,
          rows,
          expectedOutput,
        });

        // Trigger onSave callback to update parent form state
        onSave({
          starterCode: {
            sql: '-- Write your SQL query here\n',
            schema: { tables, setup: setupSql },
          },
          expectedOutput,
        });
      }
    } catch (err: any) {
      setValidationResult({ success: false, error: err.message || 'Validation request failed' });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="space-y-6 bg-[#0f0f16] p-5 rounded-2xl border border-white/10 text-white">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
            SQL Problem Builder & Schema Generator
          </h3>
          <p className="text-xs text-gray-400 mt-1">Design tables visually, add sample data, and validate solution query to auto-generate expected outputs.</p>
        </div>
        <button onClick={addTable} className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-semibold transition-all flex items-center gap-1">
          + Add Table
        </button>
      </div>

      {/* Visual Tables Builder */}
      <div className="space-y-4">
        {tables.map((table, ti) => (
          <div key={ti} className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <input
                type="text"
                value={table.name}
                onChange={e => {
                  const val = e.target.value;
                  setTables(prev => {
                    const next = [...prev];
                    next[ti].name = val;
                    return next;
                  });
                }}
                className="bg-[#161622] border border-white/10 rounded-lg px-3 py-1 text-sm font-bold text-amber-400 focus:outline-none focus:border-amber-400"
                placeholder="Table Name"
              />
              <button
                onClick={() => addColumn(ti)}
                className="text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg transition-all"
              >
                + Add Column
              </button>
            </div>

            {/* Columns list */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Columns</span>
              {table.columns.map((col, ci) => (
                <div key={ci} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={col.name}
                    onChange={e => {
                      const val = e.target.value;
                      setTables(prev => {
                        const next = [...prev];
                        next[ti].columns[ci].name = val;
                        return next;
                      });
                    }}
                    placeholder="Column Name"
                    className="bg-[#0d0d14] border border-white/10 rounded px-2 py-1 text-xs text-white flex-1"
                  />
                  <select
                    value={col.type}
                    onChange={e => {
                      const val = e.target.value;
                      setTables(prev => {
                        const next = [...prev];
                        next[ti].columns[ci].type = val;
                        return next;
                      });
                    }}
                    className="bg-[#0d0d14] border border-white/10 rounded px-2 py-1 text-xs text-blue-400"
                  >
                    <option value="INT">INT</option>
                    <option value="VARCHAR(50)">VARCHAR(50)</option>
                    <option value="VARCHAR(255)">VARCHAR(255)</option>
                    <option value="TEXT">TEXT</option>
                    <option value="TIMESTAMP">TIMESTAMP</option>
                    <option value="DECIMAL(10,2)">DECIMAL(10,2)</option>
                    <option value="BOOLEAN">BOOLEAN</option>
                  </select>
                  <input
                    type="text"
                    value={col.constraints || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setTables(prev => {
                        const next = [...prev];
                        next[ti].columns[ci].constraints = val;
                        return next;
                      });
                    }}
                    placeholder="PRIMARY KEY / NOT NULL"
                    className="bg-[#0d0d14] border border-white/10 rounded px-2 py-1 text-xs text-gray-400 w-44"
                  />
                </div>
              ))}
            </div>

            {/* Sample rows */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Sample Rows</span>
                <button onClick={() => addSampleRow(ti)} className="text-[11px] text-blue-400 hover:underline">+ Add Sample Row</button>
              </div>
              {table.sampleRows.map((row, ri) => (
                <div key={ri} className="flex items-center gap-2 overflow-x-auto">
                  {table.columns.map((col, ci) => (
                    <input
                      key={ci}
                      type="text"
                      value={row[col.name] || ''}
                      onChange={e => {
                        const val = e.target.value;
                        setTables(prev => {
                          const next = [...prev];
                          next[ti].sampleRows[ri][col.name] = val;
                          return next;
                        });
                      }}
                      placeholder={col.name}
                      className="bg-[#0d0d14] border border-white/10 rounded px-2 py-1 text-xs text-gray-300 w-28 shrink-0 font-mono"
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Generated Setup DDL Script Preview */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Auto-Generated Setup SQL</span>
        <pre className="p-3 bg-[#0d0d14] border border-white/10 rounded-xl text-xs font-mono text-emerald-400 whitespace-pre-wrap max-h-36 overflow-auto">
          {generateSetupSql() || '-- Add tables and columns above to generate setup SQL'}
        </pre>
      </div>

      {/* Reference Solution SQL & Auto Validator */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Reference Solution Query</span>
        <textarea
          value={solutionSql}
          onChange={e => setSolutionSql(e.target.value)}
          rows={4}
          className="w-full p-3 bg-[#0d0d14] border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={handleValidateSolution}
          disabled={isValidating}
          className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {isValidating ? (
            <span>Validating Query...</span>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              <span>Validate Solution & Auto-Generate Expected Output</span>
            </>
          )}
        </button>
      </div>

      {/* Validation Result Box */}
      {validationResult && (
        <div className={`p-4 rounded-xl border text-xs ${validationResult.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
          {validationResult.success ? (
            <div>
              <div className="font-bold mb-2">✓ Solution Validated Successfully! Expected Output auto-populated:</div>
              <pre className="p-2.5 bg-[#0d0d14] rounded font-mono text-gray-200 whitespace-pre-wrap max-h-40 overflow-auto">{validationResult.expectedOutput}</pre>
            </div>
          ) : (
            <div className="font-mono">✗ Validation Failed: {validationResult.error}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default SqlProblemBuilder;
