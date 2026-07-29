import { useState, useEffect, useCallback } from 'react';
import Editor from "@monaco-editor/react";
import { executeCode } from '../lib/piston';

const DEFAULT_SQL = `-- SQL Playground
-- Write your SQL queries here

CREATE TABLE users (
  id INT PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100)
);

INSERT INTO users VALUES
  (1, 'Alice', 'alice@example.com'),
  (2, 'Bob', 'bob@example.com'),
  (3, 'Charlie', 'charlie@example.com');

SELECT * FROM users;
`;

export function SqlPlayground({ onRegisterRun }: { onRegisterRun?: (fn: () => void) => void }) {
  const [sql, setSql] = useState(DEFAULT_SQL);
  const [results, setResults] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [outputHeight, setOutputHeight] = useState(200);
  const [isDrag, setIsDrag] = useState(false);

  useEffect(() => {
    if (!isDrag) return;
    const handleMouseMove = (e: MouseEvent) => {
      const container = document.querySelector('.middle-column');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const maxHeight = rect.height - 100;
      const newHeight = Math.max(100, Math.min(maxHeight, rect.bottom - e.clientY));
      setOutputHeight(newHeight);
    };
    const handleMouseUp = () => setIsDrag(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isDrag]);

  const runSql = useCallback(async () => {
    setIsRunning(true);
    setResults(null);
    setShowResults(true);
    try {
      const encodedSql = btoa(unescape(encodeURIComponent(sql)));
      const wrapped = `
def execute_sql():
    import base64, sqlite3
    exec_sql = base64.b64decode("""${encodedSql}""").decode('utf-8')
    conn = sqlite3.connect(':memory:')
    cursor = conn.cursor()
    for stmt in exec_sql.strip().split(';'):
        stmt = stmt.strip()
        if stmt:
            try:
                cursor.execute(stmt)
                if stmt.upper().startswith('SELECT'):
                    rows = cursor.fetchall()
                    col_names = [desc[0] for desc in cursor.description]
                    print('| ' + ' | '.join(col_names) + ' |')
                    print('|' + '|'.join(['---' for _ in col_names]) + '|')
                    for row in rows:
                        print('| ' + ' | '.join(str(c) for c in row) + ' |')
                else:
                    print(f"Query OK, {cursor.rowcount} rows affected")
            except Exception as e:
                print(f"Error: {e}")
    conn.close()
execute_sql()
`;
      const result = await executeCode('python', wrapped);
      setResults(result.output || result.error || 'No output');
    } catch (err: unknown) {
      setResults(err instanceof Error ? err.message : 'Error running query');
    } finally {
      setIsRunning(false);
    }
  }, [sql]);

  useEffect(() => { onRegisterRun?.(runSql); }, [onRegisterRun, runSql]);

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#1a1a1a] border-b border-white/5">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">SQL</span>
        </div>
        <div className="flex-1 min-h-0">
          <Editor
            height="100%"
            language="sql"
            value={sql}
            onChange={(value) => setSql(value || '')}
            theme="vs-dark"
            options={{ fontSize: 13, minimap: { enabled: false }, wordWrap: 'on', lineNumbers: 'on', folding: true, scrollBeyondLastLine: false }}
          />
        </div>
      </div>
      {showResults && <div className="flex flex-col bg-black flex-none border-t border-[#2D2D2D]" style={{ height: outputHeight }}>
        <div
          onMouseDown={e => { e.preventDefault(); setIsDrag(true); }}
          className="h-1.5 cursor-row-resize bg-[#2D2D2D] hover:bg-[#4CAF50] transition-colors flex-none"
        />
        <div className="flex items-center justify-between px-4 py-1.5 bg-[#1E1E1E] border-b border-[#2D2D2D]">
          <span className="text-[10px] font-bold text-[#4CAF50] uppercase tracking-wider">Results</span>
          <button onClick={() => setShowResults(false)} className="text-[var(--text-muted)] hover:text-white p-0.5 rounded transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 font-mono">
          <pre className="text-sm text-[var(--text-muted)] whitespace-pre-wrap leading-relaxed">{results || (isRunning ? 'Running...' : 'Click "Run Query" to execute')}</pre>
        </div>
      </div>}
    </div>
  );
}
