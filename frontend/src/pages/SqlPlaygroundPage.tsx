import Editor from "@monaco-editor/react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from 'axios';
import { api } from "../services/api";
import { DEFAULT_CODE, SQL_FREE_SCHEMA } from "./playground/constants";
import { ProblemsModal } from "./playground/ProblemsModal";
import MarkdownRenderer from "../components/MarkdownRenderer";
import type { Problem, SqlResult, DatabaseTable } from "./playground/types";
import { useSidebar } from '../contexts/SidebarContext';
import { useAuth } from '../contexts/AuthContext';
import { SecureContestWrapper } from '../components/SecureContestWrapper';
import { useNotify } from '../components/notifications';
import { SchemaViewer } from '../components/sql-playground/SchemaViewer';
import { SchemaViewerModal } from '../components/sql-playground/SchemaViewerModal';
import { parseSchemaToGraph } from '../components/sql-playground/utils/parseSchema';
import { formatProblemDescriptionWithImages } from '../utils/formatProblemDescription';
import { ProblemLockConfirmationModal } from '../components/ExamFlowModals';

// ── Types ──────────────────────────────────────────────────────────────────
interface QueryTab {
  id: string;
  name: string;
  code: string;
}

interface HistoryEntry {
  id: string;
  query: string;
  timestamp: number;
  status: 'success' | 'error';
  rowCount?: number;
  execTime?: number;
}

// ── Helper: format SQL ──────────────────────────────────────────────────────
function formatSQL(sql: string): string {
  const keywords = ['SELECT','FROM','WHERE','JOIN','LEFT JOIN','RIGHT JOIN','INNER JOIN','ON',
    'GROUP BY','ORDER BY','HAVING','LIMIT','OFFSET','INSERT INTO','VALUES','UPDATE','SET',
    'DELETE FROM','CREATE TABLE','DROP TABLE','ALTER TABLE','UNION','AND','OR','NOT','IN',
    'EXISTS','BETWEEN','LIKE','AS','DISTINCT','COUNT','SUM','AVG','MAX','MIN','CASE','WHEN',
    'THEN','ELSE','END','WITH','RETURNING'];
  let result = sql.replace(/\s+/g, ' ').trim();
  keywords.forEach(kw => {
    result = result.replace(new RegExp(`\\b${kw}\\b`, 'gi'), '\n' + kw);
  });
  return result.replace(/^\n/, '').trim();
}

// ── Helper: DiffTable ──────────────────────────────────────────────────────
function DiffTable({ expected, actual, passed }: { expected: string; actual: string; passed?: boolean }) {
  const parseRows = (str: string) => str.trim().split('\n').map(r => r.split('\t'));
  const expRows = parseRows(expected);
  const actRows = parseRows(actual);
  const isPassed = passed ?? (expected.trim().toLowerCase() === actual.trim().toLowerCase() && expected.trim() !== '');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Expected Result */}
      <div className="bg-[#0b0b12] border border-emerald-500/30 rounded-xl p-3">
        <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          Expected Result
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            {expRows.length > 0 && (
              <thead>
                <tr className="border-b border-emerald-500/20 text-emerald-300">
                  {expRows[0].map((h, i) => <th key={i} className="py-1 px-2">{h}</th>)}
                </tr>
              </thead>
            )}
            <tbody>
              {expRows.slice(1).map((r, i) => (
                <tr key={i} className="border-b border-white/5 text-gray-300">
                  {r.map((v, j) => <td key={j} className="py-1 px-2">{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actual Result */}
      <div className={`bg-[#0b0b12] border ${isPassed ? 'border-emerald-500/30' : 'border-rose-500/30'} rounded-xl p-3`}>
        <div className={`text-xs font-bold ${isPassed ? 'text-emerald-400' : 'text-rose-400'} uppercase tracking-wider mb-2 flex items-center gap-1.5`}>
          {isPassed ? (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          )}
          Your Result
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            {actRows.length > 0 && (
              <thead>
                <tr className={`border-b ${isPassed ? 'border-emerald-500/20 text-emerald-300' : 'border-rose-500/20 text-rose-300'}`}>
                  {actRows[0].map((h, i) => <th key={i} className="py-1 px-2">{h}</th>)}
                </tr>
              </thead>
            )}
            <tbody>
              {actRows.slice(1).map((r, i) => (
                <tr key={i} className="border-b border-white/5 text-gray-300">
                  {r.map((v, j) => <td key={j} className="py-1 px-2">{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Helper: ERD Diagram View ───────────────────────────────────────────────
function ERDDiagram({ tables }: { tables: DatabaseTable[] }) {
  if (!tables || tables.length === 0) return <div className="text-gray-500 text-xs py-4 text-center">No tables available</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
          Interactive Entity-Relationship Diagram (ERD)
        </h4>
        <span className="text-[10px] text-gray-500">{tables.length} entity tables</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tables.map((tbl, i) => (
          <div key={i} className="bg-[#12121c] border-2 border-amber-500/30 rounded-2xl p-4 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="text-sm font-bold text-amber-300 font-mono">{tbl.name}</span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono bg-white/5 px-2 py-0.5 rounded-full">{tbl.columns?.length || 0} fields</span>
            </div>
            <div className="space-y-2">
              {tbl.columns?.map((col, j) => {
                const isPk = col.constraints?.toUpperCase().includes('PRIMARY KEY');
                const isFk = col.constraints?.toUpperCase().includes('FOREIGN KEY') || col.name.endsWith('_id') || col.name.endsWith('Id');
                return (
                  <div key={j} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/5 transition-colors text-xs font-mono">
                    <div className="flex items-center gap-2">
                      {isPk ? <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold">PK 🔑</span>
                      : isFk ? <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-bold">FK 🔗</span>
                      : <span className="w-4" />}
                      <span className="text-white font-medium">{col.name}</span>
                    </div>
                    <span className="text-blue-400/80 text-[11px]">{col.type}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Helper: export ──────────────────────────────────────────────────────────
function exportCSV(columns: string[], rows: Record<string, any>[]): void {
  const header = columns.join(',');
  const body = rows.map(r => columns.map(c => {
    const v = r[c] ?? '';
    return `"${String(v).replace(/"/g, '""')}"`;
  }).join(',')).join('\n');
  const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'results.csv'; a.click();
}

function exportJSON(columns: string[], rows: Record<string, any>[]): void {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'results.json'; a.click();
}


// ── Main component ───────────────────────────────────────────────────────────
export function SqlPlaygroundPage({ embeddedInContest }: { embeddedInContest?: boolean } = {}) {
  const notify = useNotify();
  const { setSidebarHidden } = useSidebar();
  const { user } = useAuth();
  const userStorageId = (user as any)?.id || (user as any)?.userId || 'guest';
  const navigate = useNavigate();

  // ── Contest state ──────────────────────────────────────────────────────────
  const [contestId, setContestId] = useState<string | null>(null);
  const [lockedProblems, setLockedProblems] = useState<Set<string>>(() => {
    const cid = new URLSearchParams(window.location.search).get('contestId');
    if (!cid) return new Set();
    try {
      const saved = sessionStorage.getItem(`lockedProblems_${cid}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [showFinalLockModal, setShowFinalLockModal] = useState(false);
  const [pendingLockProblem, setPendingLockProblem] = useState<{ id: string; title: string; score: number } | null>(null);
  const [contestFlags, setContestFlags] = useState<any>(null);
  const [contestSubmitToast, setContestSubmitToast] = useState<{ status: 'success' | 'error'; message: string } | null>(null);
  const [contestProblems, setContestProblems] = useState<Array<{ order: number; points: number; problem: { id: string; title: string; difficulty: string; problemType?: string } }>>([]);
  const [solvedProblems, setSolvedProblems] = useState<Set<string>>(new Set());
  const autoNavigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [_submitStatus, setSubmitStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cid = params.get('contestId');
    if (cid) {
      setContestId(cid);
      setSidebarHidden(true);
      const fetchFlags = async () => {
        try {
          const res = await api.getManagerContest(cid);
          setContestFlags({
            requireFullscreen: res.contest.requireFullscreen ?? false,
            preventTabSwitch: res.contest.preventTabSwitch ?? false,
            disableCopyPaste: res.contest.disableCopyPaste ?? false,
            enableProctoring: res.contest.enableProctoring ?? false,
            allowMultipleMonitors: res.contest.allowMultipleMonitors ?? false,
            pasteMode: res.contest.pasteMode ?? 'LOG_ONLY',
            faceCheckEnabled: res.contest.faceCheckEnabled ?? false,
            voiceCheckEnabled: res.contest.voiceCheckEnabled ?? false,
            snapshotIntervalSeconds: res.contest.snapshotIntervalSeconds ?? 45,
            maxWarnings: res.contest.maxWarnings ?? 3
          });
          if (res.contest?.problems) {
            const sqlProblems = res.contest.problems.filter((cp: any) => cp.problem.problemType === 'sql');
            setContestProblems(sqlProblems);
          }
        } catch (err) { console.error("Failed to load contest details:", err); }
      };
      fetchFlags();
      return () => {
        setSidebarHidden(false);
        if (autoNavigateTimerRef.current) clearTimeout(autoNavigateTimerRef.current);
      };
    }
  }, [setSidebarHidden]);

  // ── Play mode ──────────────────────────────────────────────────────────────
  const [playMode, setPlayMode] = useState<"free" | "problem">(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('contestId')) return 'problem';
    const saved = localStorage.getItem('sql_playground_playMode');
    return (saved === 'free' || saved === 'problem') ? saved : 'problem';
  });

  // ── Multi-Tab Query State ──────────────────────────────────────────────────
  const [queryTabs, setQueryTabs] = useState<QueryTab[]>([{ id: '1', name: 'Query 1', code: DEFAULT_CODE.sql }]);
  const [activeTabId, setActiveTabId] = useState('1');
  const activeTab = queryTabs.find(t => t.id === activeTabId) || queryTabs[0];
  const sqlCode = activeTab?.code || DEFAULT_CODE.sql;
  const setSqlCode = (code: string) => {
    setQueryTabs(tabs => tabs.map(t => t.id === activeTabId ? { ...t, code } : t));
  };

  const addQueryTab = () => {
    const newId = String(Date.now());
    const newName = `Query ${queryTabs.length + 1}`;
    setQueryTabs(tabs => [...tabs, { id: newId, name: newName, code: DEFAULT_CODE.sql }]);
    setActiveTabId(newId);
  };

  const closeQueryTab = (id: string) => {
    if (queryTabs.length <= 1) return;
    const remaining = queryTabs.filter(t => t.id !== id);
    setQueryTabs(remaining);
    if (activeTabId === id) setActiveTabId(remaining[remaining.length - 1].id);
  };

  // ── Query History ──────────────────────────────────────────────────────────
  const [queryHistory, setQueryHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const addToHistory = (query: string, status: 'success' | 'error', rowCount?: number, execTime?: number) => {
    const entry: HistoryEntry = { id: String(Date.now()), query: query.trim(), timestamp: Date.now(), status, rowCount, execTime };
    setQueryHistory(prev => [entry, ...prev].slice(0, 20));
  };

  // ── SQL state ──────────────────────────────────────────────────────────────
  const [sqlResult, setSqlResult] = useState<SqlResult | null>(null);
  const [sqlFreeSchema, setSqlFreeSchema] = useState(SQL_FREE_SCHEMA);
  const [activeSqlTab, setActiveSqlTab] = useState<"results" | "schema" | "messages" | "tests">("results");
  const [isRunning, setIsRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [sqlTestResults, setSqlTestResults] = useState<any[] | null>(null);
  const [sqlTestSummary, setSqlTestSummary] = useState<{ passed: number; failed: number; total: number } | null>(null);

  // ── Result grid sort state ─────────────────────────────────────────────────
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sortedRows = sqlResult?.rows
    ? (sortCol
        ? [...sqlResult.rows].sort((a, b) => {
            const av = a[sortCol] ?? ''; const bv = b[sortCol] ?? '';
            const n = String(av).localeCompare(String(bv), undefined, { numeric: true });
            return sortDir === 'asc' ? n : -n;
          })
        : sqlResult.rows)
    : [];

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  // ── Schema tree ────────────────────────────────────────────────────────────
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [sampleDataModal, setSampleDataModal] = useState<{ table: DatabaseTable } | null>(null);
  const [showSchemaPanel, setShowSchemaPanel] = useState(false);
  const [showSchemaModal, setShowSchemaModal] = useState(false);

  // ── Problems state ─────────────────────────────────────────────────────────
  const [problems, setProblems] = useState<Problem[]>([]);
  const [totalProblems, setTotalProblems] = useState(0);
  const [problemSearchQuery, setProblemSearchQuery] = useState("");
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [showProblems, setShowProblems] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [unlockedHints, setUnlockedHints] = useState<Set<number>>(new Set());
  const [isLoadingProblems, setIsLoadingProblems] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [problemStatuses, setProblemStatuses] = useState<Record<string, 'solved' | 'attempted' | 'none'>>({});
  const [isSaved, setIsSaved] = useState(true);

  // ── Editor settings ────────────────────────────────────────────────────────
  const [editorFontSize, setEditorFontSize] = useState(() => { const s = localStorage.getItem('sql_playground_fontSize'); return s ? parseInt(s) : 14; });
  const [editorTabSize, setEditorTabSize] = useState(() => { const s = localStorage.getItem('sql_playground_tabSize'); return s ? parseInt(s) : 4; });
  const [editorWordWrap, setEditorWordWrap] = useState(() => localStorage.getItem('sql_playground_wordWrap') === 'true');
  const [editorMinimap, setEditorMinimap] = useState(() => localStorage.getItem('sql_playground_minimap') !== 'false');

  // ── Layout ─────────────────────────────────────────────────────────────────
  const [leftPanelWidth, setLeftPanelWidth] = useState(35);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(35);
  const [showOutput, setShowOutput] = useState(true);
  const [selectedTestCaseIdx, setSelectedTestCaseIdx] = useState(0);

  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const outputPanelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isResizingLeft = useRef(false);
  const isResizingBottom = useRef(false);
  const startX = useRef(0); const startY = useRef(0);
  const startLeftWidth = useRef(0); const startBottomHeight = useRef(0);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const isProgrammaticUpdateRef = useRef(false);

  const setEditorValue = (value: string) => {
    if (!editorRef.current) return;
    const model = editorRef.current.getModel();
    if (model && model.getValue() !== value) {
      isProgrammaticUpdateRef.current = true;
      try { model.pushEditOperations([], [{ range: model.getFullModelRange(), text: value }], () => null); }
      finally { isProgrammaticUpdateRef.current = false; }
    }
  };

  const insertTextAtCursor = useCallback((text: string) => {
    if (editorRef.current) {
      const selection = editorRef.current.getSelection();
      const id = { major: 1, minor: 1 };
      const op = {
        identifier: id,
        range: selection,
        text: text,
        forceMoveMarkers: true,
      };
      editorRef.current.executeEdits('insert-text', [op]);
      editorRef.current.focus();
    } else {
      setSqlCode(sqlCode + (sqlCode.endsWith(' ') || sqlCode.endsWith('\n') ? '' : ' ') + text);
    }
  }, []);

  const modelsRef = useRef<Map<string, any>>(new Map());
  const getOrCreateModel = (key: string, codeVal: string) => {
    if (!monacoRef.current) return null;
    if (!modelsRef.current.has(key)) {
      const uri = monacoRef.current.Uri.parse(`file:///${key}.sql`);
      let model = monacoRef.current.editor.getModel(uri);
      if (!model) model = monacoRef.current.editor.createModel(codeVal, 'sql', uri);
      modelsRef.current.set(key, model);
    }
    return modelsRef.current.get(key);
  };

  // Switch Monaco model when tab changes
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      const model = getOrCreateModel(activeTabId, sqlCode);
      if (model) editorRef.current.setModel(model);
    }
  }, [activeTabId]);

  useEffect(() => { setEditorValue(sqlCode); }, [sqlCode]);

  // ── Persist settings ───────────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem('sql_playground_playMode', playMode); }, [playMode]);
  useEffect(() => { localStorage.setItem('sql_playground_fontSize', editorFontSize.toString()); }, [editorFontSize]);
  useEffect(() => { localStorage.setItem('sql_playground_tabSize', editorTabSize.toString()); }, [editorTabSize]);
  useEffect(() => { localStorage.setItem('sql_playground_wordWrap', editorWordWrap.toString()); }, [editorWordWrap]);
  useEffect(() => { localStorage.setItem('sql_playground_minimap', editorMinimap.toString()); }, [editorMinimap]);

  // ── Monaco cleanup ─────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (monacoRef.current) monacoRef.current.editor.getModels().forEach((m: any) => m.dispose());
      editorRef.current = null; monacoRef.current = null;
    };
  }, []);

  // ── Fetch problems ─────────────────────────────────────────────────────────
  const fetchAllProblems = async (problemType?: string, opts?: { skip?: number; search?: string }) => {
    try {
      setIsLoadingProblems(true);
      const params = new URLSearchParams({ type: problemType || "sql", take: "200" });
      if (opts?.skip) params.set('skip', opts.skip.toString());
      if (opts?.search) params.set('search', opts.search);
      const response = await api.get(`/problems?${params}`);
      const newProblems = (response.problems || []).filter((p: Problem) => p.problemType === 'sql');
      const total = response.total || 0;
      setTotalProblems(total);
      if (opts?.skip && opts.skip > 0) setProblems(prev => [...prev, ...newProblems]);
      else setProblems(newProblems);
    } catch (error) { console.error("Failed to fetch all problems:", error); }
    finally { setIsLoadingProblems(false); }
  };

  const loadMoreProblems = () => fetchAllProblems("sql", { skip: problems.length, search: problemSearchQuery || undefined });

  const debounceSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (value: string) => {
    setProblemSearchQuery(value);
    if (debounceSearchRef.current) clearTimeout(debounceSearchRef.current);
    debounceSearchRef.current = setTimeout(() => fetchAllProblems("sql", { skip: 0, search: value || undefined }), 400);
  };

  function renderFormattedExampleOutput(outputStr: string) {
    if (!outputStr || typeof outputStr !== 'string') return null;
    const lines = outputStr.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) return null;

    const isTabSeparated = lines.some(l => l.includes('\t'));
    const isPipeSeparated = lines.some(l => l.includes('|'));

    if (isTabSeparated || isPipeSeparated) {
      const delimiter = isTabSeparated ? '\t' : '|';
      const rows = lines.map(line => 
        line.split(delimiter).map(cell => cell.trim()).filter(Boolean)
      ).filter(r => r.length > 0 && !r.every(c => /^[-:]+$/.test(c)));

      if (rows.length > 0) {
        const headers = rows[0];
        const dataRows = rows.slice(1);

        return (
          <div className="my-2 overflow-x-auto rounded-xl border border-white/15 bg-[#0e0f18] shadow-inner">
            <table className="w-full text-xs font-mono text-left border-collapse">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="px-3 py-2 text-amber-400 font-bold uppercase tracking-wider text-[11px]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {dataRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-white/5 transition-colors">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3 py-1.5 text-gray-200 whitespace-nowrap">
                        {cell === 'NULL' || cell === 'null' ? (
                          <span className="text-gray-500 italic font-semibold">null</span>
                        ) : (
                          cell
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
    }

    return (
      <pre className="my-2 p-3 rounded-xl bg-black/50 border border-white/10 font-mono text-xs text-amber-300 leading-relaxed overflow-x-auto">
        {outputStr}
      </pre>
    );
  }

  const loadProblemStatuses = async () => {
    try {
      const res = await api.get("/submissions");
      const subs = res.submissions || [];
      const statuses: Record<string, 'solved' | 'attempted' | 'none'> = {};
      subs.forEach((sub: any) => {
        const pid = sub.problemId; if (!pid) return;
        if (sub.status === 'passed') statuses[pid] = 'solved';
        else if (!statuses[pid]) statuses[pid] = 'attempted';
      });
      setProblemStatuses(statuses);
    } catch (error) { console.error("Failed to load problem statuses:", error); }
  };

  useEffect(() => {
    const init = async () => { await fetchAllProblems("sql"); loadProblemStatuses(); };
    init();
  }, []);

  // ── Helper to detect non-SQL programming code ─────────────────────────────────
  const isNonSqlCode = (str?: string): boolean => {
    if (!str) return false;
    return /class\s+Solution|def\s+\w+|#include|import\s+java|using\s+namespace|public\s+static\s+void|function\s+\w+\(/i.test(str);
  };

  const getSqlStarterCode = (prob?: Problem | null): string => {
    if (!prob) return DEFAULT_CODE.sql;
    let starter: any = prob.starterCode;
    if (typeof starter === 'string') {
      try { starter = JSON.parse(starter); } catch {}
    }
    let codeStr = '';
    if (starter && typeof starter === 'object' && typeof starter.sql === 'string' && starter.sql.trim()) {
      codeStr = starter.sql.trim();
    } else if (typeof starter === 'string' && (starter.includes('SELECT') || starter.includes('CREATE') || starter.startsWith('--'))) {
      codeStr = starter.trim();
    }

    // Sanitize: If starterCode matches referenceSolution or contains full JOIN/WHERE query, return clean template so solution isn't pre-filled!
    const refSol = (prob.referenceSolution || '').trim();
    if (codeStr && (
      (refSol && codeStr.toLowerCase() === refSol.toLowerCase()) ||
      (codeStr.toUpperCase().includes('SELECT') && codeStr.toUpperCase().includes('FROM') && codeStr.toUpperCase().includes('WHERE'))
    )) {
      return '-- Write your SQL query below\n';
    }

    return codeStr || DEFAULT_CODE.sql;
  };

  function parseTableStructure(schemaDdl: string): DatabaseTable[] {
    if (!schemaDdl || typeof schemaDdl !== 'string') return [];
    const tables: DatabaseTable[] = [];
    const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`?\w+`?\.)?`?(\w+)`?\s*\(([\s\S]*?)\);/gi;
    let tableMatch;
    while ((tableMatch = tableRegex.exec(schemaDdl)) !== null) {
      const tableName = tableMatch[1];
      const columnsBody = tableMatch[2];
      const columns: Array<{ name: string; type: string; constraints?: string }> = [];

      // Split column definitions by comma/newline outside parentheses (e.g. DECIMAL(10,2))
      const colLines: string[] = [];
      let current = '';
      let parenDepth = 0;
      for (let i = 0; i < columnsBody.length; i++) {
        const char = columnsBody[i];
        if (char === '(') parenDepth++;
        else if (char === ')') parenDepth--;

        if ((char === ',' || char === '\n') && parenDepth === 0) {
          if (current.trim()) colLines.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      if (current.trim()) colLines.push(current.trim());

      const filteredLines = colLines.filter(l => {
        const u = l.toUpperCase();
        return l && !u.startsWith('PRIMARY') && !u.startsWith('UNIQUE') && !u.startsWith('INDEX') && !u.startsWith('KEY') && !u.startsWith('CONSTRAINT') && !u.startsWith('FOREIGN');
      });

      for (const line of filteredLines) {
        const clean = line.replace(/,$/, '').trim();
        if (!clean) continue;
        const parts = clean.split(/\s+/);
        if (parts.length >= 2) {
          const name = parts[0].replace(/`/g, '');
          let type = '';
          const constraintParts: string[] = [];
          for (let i = 1; i < parts.length; i++) {
            const p = parts[i];
            const pu = p.toUpperCase();
            if (pu === 'NOT' || pu === 'NULL' || pu === 'PRIMARY' || pu === 'KEY' || pu === 'UNIQUE' || pu === 'AUTO_INCREMENT' || pu === 'DEFAULT') {
              constraintParts.push(p);
            } else if (pu.startsWith('REFERENCES')) {
              constraintParts.push(parts.slice(i).join(' '));
              break;
            } else {
              type += (type ? ' ' : '') + p;
            }
          }
          columns.push({ name, type: type || 'VARCHAR', constraints: constraintParts.join(' ') });
        }
      }
      tables.push({ name: tableName, columns });
    }
    return tables;
  }

  function parseMarkdownDescriptionSchema(description: string): DatabaseTable[] {
    if (!description || typeof description !== 'string') return [];
    const tables: DatabaseTable[] = [];
    const lines = description.split('\n');
    let currentTableName = '';
    let currentColumns: Array<{ name: string; type: string; constraints?: string }> = [];
    let inTableGrid = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Look for "Table: TableName" or "**Table: TableName**" or "### Table: TableName"
      const tableHeaderMatch = line.match(/(?:Table|Entity):\s*\**([A-Za-z0-9_]+)\**/i);
      if (tableHeaderMatch) {
        if (currentTableName && currentColumns.length > 0) {
          tables.push({ name: currentTableName, columns: [...currentColumns] });
        }
        currentTableName = tableHeaderMatch[1];
        currentColumns = [];
        inTableGrid = false;
        continue;
      }

      // Detect markdown table header: "| Column Name | Type |" or "| Column | Type |"
      if (line.startsWith('|') && (line.toLowerCase().includes('column') || line.toLowerCase().includes('type') || line.toLowerCase().includes('field'))) {
        inTableGrid = true;
        continue;
      }

      // Skip separator line: "|---|---|"
      if (line.startsWith('|') && line.includes('---')) {
        continue;
      }

      // Parse markdown grid row: "| id | int |"
      if (inTableGrid && line.startsWith('|')) {
        const parts = line.split('|').map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          const colName = parts[0].replace(/`/g, '');
          const colType = parts[1].replace(/`/g, '').toUpperCase();
          if (colName && colType && colName.toLowerCase() !== 'column name' && colName.toLowerCase() !== 'column') {
            let constraints = '';
            // Only assign PRIMARY KEY if no other column in currentColumns already has it
            const alreadyHasPK = currentColumns.some(c => c.constraints?.includes('PRIMARY KEY'));
            if (!alreadyHasPK && (
              new RegExp(`${colName}\\s+is\\s+the\\s+primary\\s+key`, 'i').test(description) ||
              new RegExp(`primary\\s+key.*${colName}`, 'i').test(description)
            )) {
              constraints = 'PRIMARY KEY';
            }
            if (new RegExp(`${colName}\\s+is\\s+a\\s+foreign\\s+key`, 'i').test(description)) {
              constraints = constraints ? `${constraints} FOREIGN KEY` : 'FOREIGN KEY';
            }
            currentColumns.push({ name: colName, type: colType, constraints });
          }
        }
      } else if (line === '' || (!line.startsWith('|') && inTableGrid)) {
        inTableGrid = false;
      }
    }

    if (currentTableName && currentColumns.length > 0) {
      tables.push({ name: currentTableName, columns: [...currentColumns] });
    }

    return tables;
  }

  // ── Bulletproof 3-Layer Schema Resolver ────────────────────────────────────
  const getProblemSchema = (prob?: Problem | null) => {
    if (playMode === "free") {
      const parsedTables = parseTableStructure(sqlFreeSchema);
      return { setup: sqlFreeSchema, tables: parsedTables };
    }

    if (!prob) return null;

    // LAYER 1: Explicit DB Schema (Object or DDL String)
    let rawSchema: any = (prob as any).schema;
    if (!rawSchema) {
      let starter: any = prob.starterCode;
      if (typeof starter === 'string') {
        try { starter = JSON.parse(starter); } catch {}
      }
      if (starter && typeof starter === 'object' && starter.schema) {
        rawSchema = starter.schema;
      }
    }

    if (rawSchema) {
      if (typeof rawSchema === 'string') {
        const parsedTables = parseTableStructure(rawSchema);
        if (parsedTables.length > 0) {
          return { setup: rawSchema, tables: parsedTables };
        }
      } else if (typeof rawSchema === 'object') {
        let tables = rawSchema.tables;
        if ((!tables || !Array.isArray(tables) || tables.length === 0) && typeof rawSchema.setup === 'string') {
          tables = parseTableStructure(rawSchema.setup);
        }
        if (tables && Array.isArray(tables) && tables.length > 0) {
          return { setup: rawSchema.setup || '', tables };
        }
      }
    }

    // LAYER 2: Test Case Setup DML/DDL Script Parser
    if (prob.testCases && Array.isArray(prob.testCases) && prob.testCases.length > 0) {
      const combinedSetup = prob.testCases.map((tc: any) => tc.setup || tc.input || '').join('\n');
      const ddlTables = parseTableStructure(combinedSetup);
      if (ddlTables.length > 0) {
        return { setup: combinedSetup, tables: ddlTables };
      }
    }

    // LAYER 3: Markdown Problem Description Parser (Fail-Safe Guaranteed 100%)
    if (prob.description) {
      const descTables = parseMarkdownDescriptionSchema(prob.description);
      if (descTables.length > 0) {
        const mockSetup = descTables.map(t => {
          // Build column definitions — strip PRIMARY KEY from inline constraints to avoid duplicate PK errors
          // SQLite only allows one PRIMARY KEY per table; use table-level PRIMARY KEY constraint instead
          let pkCol: string | null = null;
          const colDefs = t.columns.map(c => {
            const cleanConstraints = (c.constraints || '')
              .replace(/PRIMARY\s+KEY/gi, '').replace(/FOREIGN\s+KEY/gi, '').trim();
            if ((c.constraints || '').toUpperCase().includes('PRIMARY KEY') && !pkCol) {
              pkCol = c.name;
            }
            return `${c.name} ${c.type}${cleanConstraints ? ' ' + cleanConstraints : ''}`;
          });
          if (pkCol) colDefs.push(`PRIMARY KEY (${pkCol})`);
          return `CREATE TABLE IF NOT EXISTS ${t.name} (${colDefs.join(', ')});`;
        }).join('\n');
        return { setup: mockSetup, tables: descTables };
      }
    }

    return null;
  };

  // ── Select problem on load ─────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const problemId = params.get('problem');
    const cid = params.get('contestId');
    const savedProblemId = localStorage.getItem('sql_playground_selected_problem');

    if (playMode === "free" && !cid) {
      setSqlCode(DEFAULT_CODE.sql); setSqlFreeSchema(SQL_FREE_SCHEMA); setSqlResult(null); setSelectedProblem(null); return;
    }

    const targetProblemId = problemId || (cid && contestProblems.length > 0 ? contestProblems[0].problem?.id : savedProblemId);

    if (targetProblemId) {
      if (selectedProblem && selectedProblem.id === targetProblemId && selectedProblem.description && selectedProblem.testCases && selectedProblem.testCases.length > 0) return;
      const fetch = async () => {
        try {
          const res = await api.getProblem(targetProblemId);
          const prob = res.problem || res;
          if (prob?.id) {
            setProblems(prev => prev.some(p => p.id === prob.id) ? prev.map(p => p.id === prob.id ? prob : p) : [prob, ...prev]);
            setSelectedProblem(prob);
            localStorage.setItem('sql_playground_selected_problem', prob.id);
          } else {
            const fallback = problems.find(p => p.id === targetProblemId) || contestProblems.find(cp => cp.problem?.id === targetProblemId)?.problem;
            if (fallback) setSelectedProblem(fallback as any);
          }
        } catch {
          const fallback = problems.find(p => p.id === targetProblemId) || contestProblems.find(cp => cp.problem?.id === targetProblemId)?.problem;
          if (fallback) setSelectedProblem(fallback as any);
        }
      };
      fetch();
    } else if (!selectedProblem && (problems.length > 0 || contestProblems.length > 0)) {
      const first = problems[0] || contestProblems[0]?.problem;
      if (first) setSelectedProblem(first as any);
    }
  }, [problems, playMode, selectedProblem, contestProblems]);

  // ── Load saved code for problem ────────────────────────────────────────────
  useEffect(() => {
    if (!selectedProblem || playMode === "free") return;
    if (selectedProblem.problemType === "sql") {
      const savedKey = `sql_playground_${userStorageId}_${selectedProblem.id}`;
      const savedCode = localStorage.getItem(savedKey);
      let codeToUse = getSqlStarterCode(selectedProblem);
      if (savedCode && !isNonSqlCode(savedCode)) {
        const refSol = (selectedProblem.referenceSolution || '').trim();
        // Purge if saved code contains complete answer query
        if (
          (refSol && savedCode.trim().toLowerCase() === refSol.toLowerCase()) ||
          (savedCode.toUpperCase().includes('SELECT') && savedCode.toUpperCase().includes('JOIN') && savedCode.toUpperCase().includes('WHERE'))
        ) {
          localStorage.removeItem(savedKey);
          codeToUse = getSqlStarterCode(selectedProblem);
        } else {
          codeToUse = savedCode;
        }
      } else if (savedCode && isNonSqlCode(savedCode)) {
        localStorage.removeItem(savedKey);
      }
      setQueryTabs(tabs => tabs.map(t => t.id === activeTabId ? { ...t, code: codeToUse } : t));
    }
  }, [selectedProblem?.id, playMode, userStorageId]);

  // ── Auto-save ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedProblem) return;
    setIsSaved(false);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      localStorage.setItem(`sql_playground_${userStorageId}_${selectedProblem.id}`, sqlCode);
      setIsSaved(true);
    }, 2000);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [sqlCode, selectedProblem, playMode, userStorageId]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runSqlCode(); }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') { e.preventDefault(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sqlCode, isRunning]);

  // ── Click-outside settings ─────────────────────────────────────────────────
  useEffect(() => {
    if (!showSettings) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettings(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSettings]);

  // ── Resize handlers ────────────────────────────────────────────────────────
  const startResizeLeft = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); isResizingLeft.current = true;
    startX.current = e.clientX; startLeftWidth.current = leftPanelWidth;
    document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none";
  }, [leftPanelWidth]);

  const startResizeBottom = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); isResizingBottom.current = true;
    startY.current = e.clientY; startBottomHeight.current = bottomPanelHeight;
    document.body.style.cursor = "row-resize"; document.body.style.userSelect = "none";
  }, [bottomPanelHeight]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft.current && containerRef.current) {
        const cw = containerRef.current.getBoundingClientRect().width;
        const newWidth = Math.max(22, Math.min(60, startLeftWidth.current + ((e.clientX - startX.current) / cw) * 100));
        setLeftPanelWidth(newWidth);
      }
      if (isResizingBottom.current && containerRef.current) {
        const ch = containerRef.current.getBoundingClientRect().height;
        const newHeight = Math.max(15, Math.min(65, startBottomHeight.current + ((startY.current - e.clientY) / ch) * 100));
        setBottomPanelHeight(newHeight);
      }
    };
    const handleMouseUp = () => {
      isResizingLeft.current = false; isResizingBottom.current = false;
      document.body.style.cursor = ""; document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
  }, []);

  // ── Monaco mount with IntelliSense ─────────────────────────────────────────
  const handleEditorMount = (editor: any, monaco: any) => {
    monacoRef.current = monaco; editorRef.current = editor;

    if (contestId) {
      editor.updateOptions({ contextmenu: false });
      ['editor.action.clipboardCopyAction', 'editor.action.clipboardPasteAction', 'editor.action.clipboardCutAction']
        .forEach(id => { const a = editor.getAction(id); if (a) a.run = () => undefined; });
    }

    // Register SQL IntelliSense completions for current problem schema
    monaco.languages.registerCompletionItemProvider('sql', {
      triggerCharacters: ['.', ' '],
      provideCompletionItems: (model: any, position: any) => {
        const suggestions: any[] = [];
        const activeSchema = getProblemSchema(selectedProblem);
        const tables = activeSchema?.tables as DatabaseTable[] | undefined;
        if (tables) {
          tables.forEach(table => {
            suggestions.push({
              label: table.name,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: table.name,
              detail: 'Table',
              range: { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: position.column, endColumn: position.column },
            });
            table.columns?.forEach(col => {
              suggestions.push({
                label: `${table.name}.${col.name}`,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: col.name,
                detail: `${table.name} — ${col.type}`,
                range: { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: position.column, endColumn: position.column },
              });
            });
          });
        }
        return { suggestions };
      },
    });

    // Ctrl+Enter shortcut inside editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runSqlCode());
  };

  // ── Run SQL ────────────────────────────────────────────────────────────────
  /**
   * Sanitize a DDL setup string to ensure each CREATE TABLE has at most ONE PRIMARY KEY.
   * SQLite & PostgreSQL both reject tables with multiple inline PRIMARY KEY columns.
   */
  function sanitizeSetupDDL(setupSql: string): string {
    if (!setupSql || typeof setupSql !== 'string') return setupSql;
    return setupSql.replace(
      /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+\w+\s*\([\s\S]*?\);/gi,
      (tableBlock) => {
        let pkCount = 0;
        // Replace inline PRIMARY KEY constraints — keep first, remove rest
        return tableBlock.replace(/\bPRIMARY\s+KEY\b/gi, (match) => {
          pkCount++;
          if (pkCount === 1) return match;
          return ''; // Remove extra PRIMARY KEY
        });
      }
    );
  }

  const runSqlCode = async () => {
    if (isRunning) return;
    setIsRunning(true); setRunStatus('running');
    setSqlResult(null); setSqlTestResults(null); setSqlTestSummary(null);
    setActiveSqlTab("results"); setShowOutput(true); setBottomPanelHeight(38);
    setSortCol(null);
    const startTime = performance.now();
    try {
      const activeSchema = getProblemSchema(selectedProblem);
      if (playMode === "problem" && selectedProblem?.testCases?.length) {
        const globalSetup = sanitizeSetupDDL(activeSchema?.setup || '');
        const testCases = selectedProblem.testCases.map(tc => {
          const tcSetup = sanitizeSetupDDL((tc as any).setup || (tc as any).input || '');
          // If tc.setup/input already has CREATE TABLE, don't prepend globalSetup (it would conflict)
          // Instead, only use globalSetup as fallback when tc has no DDL
          const tcHasDDL = /CREATE\s+TABLE/i.test(tcSetup);
          const finalSetup = tcHasDDL ? tcSetup : (globalSetup + (tcSetup ? '\n' + tcSetup : ''));
          return { input: (tc as any).input || '', expectedOutput: tc.expectedOutput, setup: finalSetup };
        });
        const response = await api.post("/code/run-tests", { language: "sql", code: sqlCode, problemId: selectedProblem?.id, testCases });
        const data = response;
        if (data.results?.length) {
          setSqlTestResults(data.results); setSqlTestSummary(data.summary);
          const first = data.results[0];
          setSqlResult(first.error
            ? { columns: [], rows: [], rowCount: 0, error: first.error, executionTime: first.executionTime }
            : { columns: first.columns || [], rows: first.rows || [], rowCount: first.rowCount || 0, affected: first.affected, executionTime: first.executionTime });
          setRunStatus(first.error ? 'error' : 'success');
          addToHistory(sqlCode, first.error ? 'error' : 'success', first.rowCount, first.executionTime);
        } else {
          setSqlResult({ columns: [], rows: [], rowCount: 0, error: "No test results returned", executionTime: Math.round(performance.now() - startTime) });
          setRunStatus('error');
          addToHistory(sqlCode, 'error');
        }
        return;
      }

      const payload: any = { language: "sql", code: sqlCode, problemId: selectedProblem?.id };
      if (playMode === "free") {
        payload.setup = sqlFreeSchema;
      } else {
        const activeSchema = getProblemSchema(selectedProblem);
        payload.setup = activeSchema?.setup || '';
      }

      const response = await api.post("/code/run", payload);
      const endTime = performance.now();
      const data = response;

      if (data.error) {
        setSqlResult({ columns: [], rows: [], rowCount: 0, error: data.error, executionTime: Math.round(endTime - startTime) });
        setRunStatus('error'); addToHistory(sqlCode, 'error'); return;
      }

      if (data.columns && Array.isArray(data.columns)) {
        setSqlResult({ columns: data.columns, rows: data.rows || [], rowCount: (data.rows || []).length, executionTime: Math.round(endTime - startTime) });
        setRunStatus('success'); addToHistory(sqlCode, 'success', (data.rows || []).length, Math.round(endTime - startTime)); return;
      }

      const stdout = data.stdout || data.output || "";
      const lines = stdout.trim().split('\n').filter((l: string) => l.trim());
      if (lines.length === 0) {
        setSqlResult({ columns: [], rows: [], rowCount: 0, executionTime: Math.round(endTime - startTime) });
        setRunStatus('success'); addToHistory(sqlCode, 'success', 0, Math.round(endTime - startTime)); return;
      }
      const headers = lines[0].split(/\s*\|\s*|\s{2,}/).map((h: string) => h.trim()).filter(Boolean);
      const dataRows: Record<string, any>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(/\s*\|\s*|\s{2,}/).map((v: string) => v.trim());
        if (values.length === headers.length) {
          const row: Record<string, any> = {};
          headers.forEach((h: string, idx: number) => { row[h] = values[idx]; });
          dataRows.push(row);
        }
      }
      setSqlResult({ columns: headers, rows: dataRows, rowCount: dataRows.length, executionTime: Math.round(endTime - startTime) });
      setRunStatus('success'); addToHistory(sqlCode, 'success', dataRows.length, Math.round(endTime - startTime));
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? (axios.isAxiosError(err) ? err.response?.data?.error || err.message : err.message) : "Failed to execute SQL.";
      setSqlResult({ columns: [], rows: [], rowCount: 0, error: errorMsg });
      setRunStatus('error'); addToHistory(sqlCode, 'error');
    } finally { setIsRunning(false); }
  };

  // ── Submit SQL (Official Evaluation against all test cases) ─────────────────
  const submitSqlCode = async () => {
    if (isRunning || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitStatus('running');
    setActiveSqlTab("tests");
    setShowOutput(true);
    setBottomPanelHeight(42);

    try {
      const activeSchema = getProblemSchema(selectedProblem);
      if (!selectedProblem?.testCases || selectedProblem.testCases.length === 0) {
        notify.toast.error("No test cases defined for this problem.");
        return;
      }

      const globalSetup = sanitizeSetupDDL(activeSchema?.setup || '');
      const testCases = selectedProblem.testCases.map(tc => {
        const tcSetup = sanitizeSetupDDL((tc as any).setup || (tc as any).input || '');
        const tcHasDDL = /CREATE\s+TABLE/i.test(tcSetup);
        const finalSetup = tcHasDDL ? tcSetup : (globalSetup + (tcSetup ? '\n' + tcSetup : ''));
        return { input: (tc as any).input || '', expectedOutput: tc.expectedOutput, setup: finalSetup };
      });

      if (contestId && selectedProblem?.id) {
        const res = await api.submitContestCode(contestId, {
          problemId: selectedProblem.id,
          code: sqlCode,
          language: 'sql'
        });

        if (res.passed) {
          setSubmitStatus('success');
          setSolvedProblems(prev => new Set(prev).add(selectedProblem.id));
          setPendingLockProblem({
            id: selectedProblem.id,
            title: selectedProblem.title,
            score: res.currentScore ?? 0
          });
          setShowFinalLockModal(true);
        } else {
          setSubmitStatus('error');
          notify.toast.error(`Submission Failed: Passed ${res.passedTests}/${res.totalTests} tests.`);
        }
        return;
      }

      const response = await api.post("/code/run-tests", {
        language: "sql",
        code: sqlCode,
        problemId: selectedProblem?.id,
        testCases,
      });

      if (response.results?.length) {
        setSqlTestResults(response.results);
        setSqlTestSummary(response.summary);
        setSelectedTestCaseIdx(0);

        const allPassed = response.summary.passed === response.summary.total;
        setSubmitStatus(allPassed ? 'success' : 'error');

        if (allPassed) {
          notify.toast.success("🎉 ACCEPTED! All test cases passed successfully!");
          if (selectedProblem?.id) {
            setSolvedProblems(prev => new Set(prev).add(selectedProblem.id));
            setProblemStatuses(prev => ({ ...prev, [selectedProblem.id]: 'solved' }));
            try {
              await api.post('/submissions', {
                problemId: selectedProblem.id,
                language: 'sql',
                code: sqlCode,
                contestId: contestId || undefined,
                status: 'passed',
              });
            } catch (e) { console.error("Failed to record submission", e); }
          }
        } else {
          notify.toast.error(`Wrong Answer! Passed ${response.summary.passed}/${response.summary.total} test cases.`);
          if (selectedProblem?.id && !solvedProblems.has(selectedProblem.id)) {
            setProblemStatuses(prev => ({ ...prev, [selectedProblem.id]: 'attempted' }));
          }
        }
      }
    } catch (err: any) {
      notify.toast.error("Submission evaluation failed: " + (err.message || 'Error'));
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Select problem ─────────────────────────────────────────────────────────
  const selectProblem = async (problem: Problem) => {
    if (playMode === "free") { window.history.pushState({}, '', '/playground/sql'); return; }
    if (problem.problemType && problem.problemType !== 'sql') {
      localStorage.removeItem('sql_playground_selected_problem');
      return;
    }

    let fullProblem = problem;
    // Always fetch full problem details if schema or testcases are missing from the list summary
    if (!fullProblem.testCases || fullProblem.testCases.length === 0 || !getProblemSchema(fullProblem)) {
      try {
        const res = await api.getProblem(problem.id);
        if (res.problem) {
          fullProblem = res.problem;
        }
      } catch (e) { console.error("Failed to fetch full problem details", e); }
    }

    setSelectedProblem(fullProblem);
    setProblems(prev => prev.map(p => p.id === fullProblem.id ? { ...p, ...fullProblem } : p));
    localStorage.setItem('sql_playground_selected_problem', fullProblem.id);
    setRunStatus('idle'); setSqlResult(null); setSqlTestResults(null); setSqlTestSummary(null);
    setShowOutput(false); setShowProblems(false); setIsSaved(true); setUnlockedHints(new Set());
    // Reset tabs to fresh single tab with starter code
    const savedKey = `sql_playground_${userStorageId}_${fullProblem.id}`;
    const savedCode = localStorage.getItem(savedKey);
    let codeToSet = getSqlStarterCode(fullProblem);
    if (savedCode && !isNonSqlCode(savedCode)) {
      codeToSet = savedCode;
    } else if (savedCode && isNonSqlCode(savedCode)) {
      localStorage.removeItem(savedKey);
    }
    const newTabId = String(Date.now());
    setQueryTabs([{ id: newTabId, name: 'Query 1', code: codeToSet }]);
    setActiveTabId(newTabId);
    const params = new URLSearchParams(window.location.search);
    params.set('problem', fullProblem.id);
    window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
  };

  // ── Difficulty badge ───────────────────────────────────────────────────────
  const diffBadge = (d?: string) => {
    const cl = d === 'Easy' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      : d === 'Medium' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
      : d === 'Hard' ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    return <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${cl}`}>{d || 'Easy'}</span>;
  };

  // ── Loading guard ──────────────────────────────────────────────────────────
  if (contestId && !contestFlags) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-400 mx-auto mb-4" />
          <p className="text-gray-400 font-mono text-sm">Loading secure environment...</p>
        </div>
      </div>
    );
  }

  const sqlContestProblems = contestProblems.filter(cp => cp.problem.problemType === 'sql');
  const totalSolved = Object.values(problemStatuses).filter(s => s === 'solved').length;
  const totalAttempted = Object.values(problemStatuses).filter(s => s === 'attempted').length;

  // ─────────────────────────────────────────────────────────────────────────
  const playgroundLayout = (
    <div ref={containerRef} className="h-screen md:h-[calc(100vh-4rem)] flex flex-col bg-[#0d0d12] select-none">

      {/* ── Contest Progress Bar ── */}
      {contestId && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0a0a0f] border-b border-white/10 flex-shrink-0 overflow-x-auto">
          <button
            onClick={() => navigate(`/contests/${contestId}`)}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-black text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-all shadow-sm shrink-0 mr-2 cursor-pointer"
            title="Back to Contest Overview"
          >
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            <span>← Back to Contest</span>
          </button>
          {sqlContestProblems.length > 0 && (
            <>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest shrink-0 mr-1">Contest</span>
              <div className="flex items-center gap-1.5">
                {sqlContestProblems.map((cp, idx) => {
                  const isSolved = solvedProblems.has(cp.problem.id);
                  const isCurrent = selectedProblem?.id === cp.problem.id;
                  return (
                    <button key={cp.problem.id} onClick={() => { const prob = problems.find(p => p.id === cp.problem.id); if (prob) selectProblem(prob); }} title={cp.problem.title}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all shrink-0 ${isCurrent ? 'bg-amber-500/20 border-amber-400 text-amber-300' : isSolved ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300' : 'bg-white/5 border-white/20 text-gray-400 hover:border-white/40 hover:text-white'}`}>
                      {isSolved && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      {String.fromCharCode(65 + idx)}
                    </button>
                  );
                })}
              </div>
              <div className="ml-auto flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold text-gray-400">
                  <span className={solvedProblems.size > 0 ? 'text-emerald-400' : 'text-gray-500'}>{solvedProblems.size}</span>
                  <span className="text-gray-600">/{sqlContestProblems.length}</span>
                  <span className="text-gray-500 ml-1">solved</span>
                </span>
                <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${sqlContestProblems.length > 0 ? (solvedProblems.size / sqlContestProblems.length) * 100 : 0}%` }} />
                </div>
                {selectedProblem && (
                  <button
                    onClick={() => {
                      const earnedScore = sqlTestSummary && sqlTestSummary.total > 0
                        ? Math.round((sqlTestSummary.passed / sqlTestSummary.total) * (selectedProblem.points || 100))
                        : 0;
                      setPendingLockProblem({
                        id: selectedProblem.id,
                        title: selectedProblem.title,
                        score: earnedScore
                      });
                      setShowFinalLockModal(true);
                    }}
                    className="px-2.5 py-1 bg-gradient-to-r from-amber-500 to-amber-400 text-black text-[11px] font-black rounded-lg transition-all shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-300 flex items-center gap-1 cursor-pointer shrink-0 ml-2"
                    title="Final lock and submit this problem"
                  >
                    🔒 Lock Problem
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex flex-1 min-h-0">

        {/* ── Left Panel: Problem Description ── */}
        {playMode !== "free" && (
          <div ref={leftPanelRef}
            className={`flex-col border-r border-white/10 relative overflow-hidden ${showLeftPanel ? "flex" : "hidden"} lg:flex flex-shrink-0`}
            style={{ width: showLeftPanel ? `${leftPanelWidth}%` : "0%" }}>

            {/* Problem Header */}
            <div className="p-3 border-b border-white/10 bg-[#0f0f16] flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => setShowLeftPanel(false)} className="text-gray-400 hover:text-white p-1 shrink-0 lg:hidden" title="Close panel">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                {!contestId && (
                  <button onClick={() => setShowProblems(true)} className="text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg transition-colors">
                    All Problems
                  </button>
                )}
              </div>

              {selectedProblem && playMode === "problem" ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    {contestId ? (
                      <div className="flex items-center gap-2 w-full">
                        <h2 className="text-base font-bold text-white truncate">{selectedProblem.title}</h2>
                      </div>
                    ) : (
                      <button onClick={() => setShowProblems(!showProblems)} className="flex items-center gap-2 hover:bg-white/5 rounded-lg px-2 py-1 transition-colors flex-1 min-w-0">
                        <h2 className="text-base font-bold text-white truncate">{selectedProblem.title}</h2>
                        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                    )}
                    {!contestId && (
                      <div className="flex items-center gap-1 ml-auto shrink-0">
                        <button onClick={() => { const idx = problems.findIndex(p => p.id === selectedProblem.id); if (idx > 0) selectProblem(problems[idx - 1]); }} disabled={problems.findIndex(p => p.id === selectedProblem.id) <= 0} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                        <button onClick={() => { const idx = problems.findIndex(p => p.id === selectedProblem.id); if (idx < problems.length - 1) selectProblem(problems[idx + 1]); }} disabled={problems.findIndex(p => p.id === selectedProblem.id) >= problems.length - 1} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {diffBadge(selectedProblem.difficulty)}
                    <span className="text-xs text-blue-400 font-medium bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">SQL</span>
                    {selectedProblem.acceptanceRate !== undefined && <span className="text-xs text-gray-500">{selectedProblem.acceptanceRate}% acceptance</span>}
                  </div>
                </>
              ) : playMode === "problem" ? (
                <div className="text-center py-3">
                  <p className="text-gray-500 text-sm mb-3">No problem selected</p>
                  <button onClick={() => setShowProblems(true)} className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded-lg text-sm font-semibold transition-all">Browse SQL Problems</button>
                </div>
              ) : null}
            </div>

            {/* Problem Content */}
            <div className={`flex-1 overflow-auto p-4 space-y-5 ${contestId ? 'select-none' : ''}`} onContextMenu={contestId ? e => e.preventDefault() : undefined} style={contestId ? { userSelect: 'none' } : undefined}>
              {selectedProblem && playMode === "problem" ? (
                <>
                  {/* Description */}
                  <div>
                    <MarkdownRenderer content={formatProblemDescriptionWithImages(selectedProblem.description || '', selectedProblem.images)} />
                  </div>

                  {/* Examples */}
                  {selectedProblem.testCases && selectedProblem.testCases.filter(tc => !tc.isHidden).length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        Examples
                      </h3>
                      <div className="space-y-3">
                        {selectedProblem.testCases.filter(tc => !tc.isHidden).map((tc, idx) => (
                          <div key={idx} className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
                            <div className="px-3 py-2 bg-white/[0.03] border-b border-white/5 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                              <span className="text-xs text-blue-400 font-bold tracking-wide">Example {idx + 1}</span>
                            </div>
                            <div className="px-3 py-2">
                              {tc.expectedOutput && (
                                <div>
                                  <div className="text-[11px] text-gray-500 font-semibold uppercase tracking-widest mb-1.5">Output</div>
                                  {renderFormattedExampleOutput(tc.expectedOutput)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Schema Explorer (Interactive Tree) */}
                  {(() => {
                    const activeSchema = getProblemSchema(selectedProblem);
                    if (!activeSchema?.tables || !Array.isArray(activeSchema.tables) || typeof activeSchema.tables[0] !== 'object') return null;
                    return (
                      <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
                          Database Schema
                        </h3>
                        <div className="space-y-2">
                          {(activeSchema.tables as DatabaseTable[]).map((table, ti) => {
                            const isExpanded = expandedTables.has(table.name);
                            return (
                              <div key={ti} className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => {
                                  const s = new Set(expandedTables);
                                  if (s.has(table.name)) s.delete(table.name); else s.add(table.name);
                                  setExpandedTables(s);
                                }}>
                                  <div className="flex items-center gap-2">
                                    <svg className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M10 3v18M14 3v18" /></svg>
                                    <button onClick={(e) => { e.stopPropagation(); insertTextAtCursor(table.name); }} className="text-sm font-bold text-amber-400 hover:underline text-left" title="Click to insert table name in editor">
                                      {table.name}
                                    </button>
                                    <span className="text-[10px] text-gray-600">({table.columns?.length || 0} cols)</span>
                                  </div>
                                  <button onClick={e => { e.stopPropagation(); setSampleDataModal({ table }); }} className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 px-2 py-0.5 rounded-full transition-all" title="Preview sample data">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    Preview
                                  </button>
                                </div>
                                {isExpanded && (
                                  <div className="border-t border-white/10 px-3 py-2 space-y-1.5">
                                    {table.columns?.map((col, ci) => (
                                      <div key={ci} onClick={() => insertTextAtCursor(col.name)} className="flex items-center gap-3 text-xs cursor-pointer hover:bg-white/5 p-1 rounded transition-colors group" title="Click to insert column in editor">
                                        <svg className="w-3 h-3 text-gray-600 group-hover:text-amber-400 shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                        <span className="text-white font-medium group-hover:text-amber-300 transition-colors">{col.name}</span>
                                        <span className="text-blue-400/70 font-mono">{col.type}</span>
                                        {col.constraints && <span className="text-gray-600 italic text-[10px]">{col.constraints}</span>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Hints (Tiered unlock) */}
                  {selectedProblem.hints && (
                    <div>
                      <button onClick={() => setShowHints(!showHints)} className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2 hover:text-white transition-colors">
                        <svg className={`w-3.5 h-3.5 transition-transform ${showHints ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        Hints {selectedProblem.hints.includes('|') ? `(${selectedProblem.hints.split('|').length})` : ''}
                      </button>
                      {showHints && (
                        <div className="space-y-2">
                          {selectedProblem.hints.split('|').map((hint, idx) => {
                            const isUnlocked = unlockedHints.has(idx);
                            return (
                              <div key={idx} className={`rounded-xl border overflow-hidden transition-all ${isUnlocked ? 'bg-amber-500/5 border-amber-500/20' : 'bg-white/[0.02] border-white/10'}`}>
                                <div className="flex items-center justify-between px-3 py-2">
                                  <span className={`text-xs font-semibold ${isUnlocked ? 'text-amber-400' : 'text-gray-500'}`}>Hint {idx + 1}</span>
                                  {!isUnlocked && (
                                    <button onClick={() => { const s = new Set(unlockedHints); s.add(idx); setUnlockedHints(s); }} className="text-[10px] text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 px-2 py-0.5 rounded-full transition-all flex items-center gap-1">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                      Reveal
                                    </button>
                                  )}
                                </div>
                                {isUnlocked && <p className="text-sm text-gray-300 px-3 pb-3">{hint.trim()}</p>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Progress tracker (non-contest) */}
                  {!contestId && Object.keys(problemStatuses).length > 0 && (
                    <div className="mt-2 p-3 bg-white/[0.03] border border-white/10 rounded-xl">
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Your Progress</div>
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-400" /><span className="text-emerald-400 font-semibold">{totalSolved}</span><span className="text-gray-500">Solved</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400" /><span className="text-amber-400 font-semibold">{totalAttempted}</span><span className="text-gray-500">Attempted</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-gray-600" /><span className="text-gray-400 font-semibold">{Math.max(0, (totalProblems || problems.length) - totalSolved - totalAttempted)}</span><span className="text-gray-500">Unsolved</span></div>
                      </div>
                      <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${(totalProblems || problems.length) > 0 ? (totalSolved / (totalProblems || problems.length)) * 100 : 0}%` }} />
                      </div>
                    </div>
                  )}
                </>
              ) : playMode === "problem" ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
                  </div>
                  <p className="text-gray-400 text-sm mb-4">Choose a SQL problem to get started</p>
                  <button onClick={() => setShowProblems(true)} className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded-lg text-sm font-semibold transition-all">Browse Problems</button>
                </div>
              ) : null}
            </div>

            {/* Resize handle */}
            <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-transparent hover:bg-blue-500/40 transition-colors z-20" onMouseDown={startResizeLeft}>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-12 bg-white/20 rounded-full" />
            </div>
          </div>
        )}

        {/* ── Right Panel: Editor + Output ── */}
        <div ref={rightPanelRef} className="flex-1 flex flex-col min-w-0">

          {/* Toolbar */}
          <div className="flex items-center gap-2 px-3 py-2 bg-[#0f0f16] border-b border-white/10 flex-shrink-0 flex-wrap">
            {playMode !== "free" && !showLeftPanel && (
              <button onClick={() => setShowLeftPanel(true)} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            )}

            {!contestId && (
              <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
                <button onClick={() => { setPlayMode("free"); setQueryTabs([{ id: '1', name: 'Query 1', code: DEFAULT_CODE.sql }]); setActiveTabId('1'); setSqlFreeSchema(SQL_FREE_SCHEMA); setSqlResult(null); setSqlTestResults(null); setSqlTestSummary(null); setSelectedProblem(null); window.history.pushState({}, '', '/playground/sql'); }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${playMode === "free" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-gray-400 hover:text-white"}`}>
                  Free Mode
                </button>
                <button onClick={() => { setPlayMode("problem"); setSqlResult(null); setSqlTestResults(null); setSqlTestSummary(null); }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${playMode === "problem" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "text-gray-400 hover:text-white"}`}>
                  Problems
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 ml-auto">
              {/* Schema toggle */}
              <button onClick={() => setShowSchemaModal(true)} className="px-3 py-1.5 rounded-xl transition-all text-xs font-extrabold flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 hover:border-amber-400 shadow-lg shadow-amber-500/10" title="Open Full-Screen Interactive ER Diagram Modal">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
                <span className="hidden sm:inline font-bold">Schema</span>
              </button>

              {/* History */}
              <div className="relative">
                <button onClick={() => setShowHistory(v => !v)} className={`p-2 rounded-lg transition-all text-xs font-semibold flex items-center gap-1.5 ${showHistory ? 'bg-purple-500/20 text-purple-400' : 'text-gray-400 hover:text-white hover:bg-white/10'}`} title="Query History">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="hidden sm:inline">History</span>
                  {queryHistory.length > 0 && <span className="text-[10px] bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded-full">{queryHistory.length}</span>}
                </button>
                {showHistory && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-[#16161f] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Recent Queries</span>
                      {queryHistory.length > 0 && <button onClick={() => setQueryHistory([])} className="text-[10px] text-gray-500 hover:text-red-400 transition-colors">Clear All</button>}
                    </div>
                    {queryHistory.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 text-xs">No queries yet</div>
                    ) : (
                      <div className="max-h-72 overflow-auto divide-y divide-white/5">
                        {queryHistory.map(h => (
                          <div key={h.id} className="px-3 py-2 hover:bg-white/5 cursor-pointer transition-colors" onClick={() => { setSqlCode(h.query); setShowHistory(false); }}>
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-[10px] font-semibold ${h.status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>{h.status === 'success' ? '✓' : '✗'} {h.rowCount !== undefined ? `${h.rowCount} rows` : ''} {h.execTime !== undefined ? `in ${h.execTime}ms` : ''}</span>
                              <span className="text-[10px] text-gray-600">{new Date(h.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <div className="text-xs text-gray-400 font-mono truncate">{h.query}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Format SQL */}
              <button onClick={() => { setSqlCode(formatSQL(sqlCode)); }} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all" title="Format SQL (Prettify)">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" /></svg>
              </button>

              {/* Settings */}
              <div className="relative" ref={settingsRef}>
                <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all" title="Editor Settings">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
                {showSettings && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-[#16161f] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/10"><span className="text-sm font-semibold text-white">Editor Settings</span></div>
                    <div className="py-2">
                      <div className="px-4 py-3">
                        <label className="text-xs text-gray-400 uppercase tracking-wider font-medium">Font Size</label>
                        <select value={editorFontSize} onChange={e => setEditorFontSize(Number(e.target.value))} className="w-full mt-2 px-3 py-2 bg-[#0d0d12] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
                          {[12,14,16,18,20].map(s => <option key={s} value={s} className="bg-[#16161f]">{s}px</option>)}
                        </select>
                      </div>
                      <div className="px-4 py-3">
                        <label className="text-xs text-gray-400 uppercase tracking-wider font-medium">Tab Size</label>
                        <select value={editorTabSize} onChange={e => setEditorTabSize(Number(e.target.value))} className="w-full mt-2 px-3 py-2 bg-[#0d0d12] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
                          <option value={2} className="bg-[#16161f]">2 spaces</option>
                          <option value={4} className="bg-[#16161f]">4 spaces</option>
                        </select>
                      </div>
                      <div className="px-4 py-3"><label className="flex items-center justify-between cursor-pointer"><span className="text-xs text-gray-300 font-medium">Word Wrap</span><input type="checkbox" checked={editorWordWrap} onChange={e => setEditorWordWrap(e.target.checked)} className="w-4 h-4 rounded border-gray-500" /></label></div>
                      <div className="px-4 py-3 border-t border-white/10"><label className="flex items-center justify-between cursor-pointer"><span className="text-xs text-gray-300 font-medium">Show Minimap</span><input type="checkbox" checked={editorMinimap} onChange={e => setEditorMinimap(e.target.checked)} className="w-4 h-4 rounded border-gray-500" /></label></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Run & Submit */}
            <div className="flex items-center gap-2.5 ml-0">
              <button onClick={() => { setQueryTabs([{ id: '1', name: 'Query 1', code: selectedProblem?.starterCode?.sql || DEFAULT_CODE.sql }]); setActiveTabId('1'); setSqlResult(null); }} className="px-3 py-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all text-xs font-semibold">Reset</button>
              <button onClick={runSqlCode} disabled={isRunning || isSubmitting}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all flex items-center gap-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20">
                {isRunning ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Running...</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Run Query</>
                )}
              </button>
              {selectedProblem && playMode === "problem" && (
                <button onClick={submitSqlCode} disabled={isRunning || isSubmitting}
                  className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold rounded-xl transition-all flex items-center gap-2 text-xs disabled:opacity-50 shadow-lg shadow-emerald-500/20">
                  {isSubmitting ? 'Submitting...' : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Submit Solution</>}
                </button>
              )}
              {selectedProblem && (
                <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold ${isSaved ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'}`}>
                  {isSaved ? '● Saved' : '● Saving…'}
                </span>
              )}
            </div>
          </div>

          {/* Query tabs bar */}
          <div className="flex items-center bg-[#0a0a0f] border-b border-white/10 flex-shrink-0 overflow-x-auto">
            {queryTabs.map(tab => (
              <div key={tab.id} className={`flex items-center group px-3 py-2 border-r border-white/10 cursor-pointer flex-shrink-0 transition-all ${tab.id === activeTabId ? 'bg-[#0d0d12] text-white border-b-2 border-blue-500 -mb-px' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} onClick={() => setActiveTabId(tab.id)}>
                <span className="text-xs font-medium">{tab.name}</span>
                {queryTabs.length > 1 && (
                  <button onClick={e => { e.stopPropagation(); closeQueryTab(tab.id); }} className="ml-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            ))}
            <button onClick={addQueryTab} className="px-3 py-2 text-gray-500 hover:text-white hover:bg-white/5 transition-all flex-shrink-0" title="New tab">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>

          {/* Schema panel (floating under tabs) */}
          {showSchemaPanel && (
            <div className="border-b border-white/10 bg-[#0a0b12] p-2 flex-shrink-0 h-64 overflow-hidden relative">
              {(() => {
                const activeSchema = getProblemSchema(selectedProblem);
                if (activeSchema?.tables && Array.isArray(activeSchema.tables) && activeSchema.tables.length > 0) {
                  return (
                    <SchemaViewer
                      tables={activeSchema.tables}
                      problemDescription={selectedProblem?.description}
                      onInsertText={insertTextAtCursor}
                    />
                  );
                }
                if (playMode === "free") {
                  return <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap p-3">{sqlFreeSchema}</pre>;
                }
                return <div className="text-center text-gray-500 text-xs py-4">No schema available for this problem</div>;
              })()}
            </div>
          )}

          {/* Editor */}
          <div className="min-h-0 transition-all duration-75" style={{ flex: showOutput ? `1 1 ${100 - bottomPanelHeight}%` : '1 1 100%' }}>
            {isRunning && (
              <div className="absolute inset-0 z-10 pointer-events-none">
                <div className="h-0.5 bg-emerald-500/20 overflow-hidden">
                  <div className="h-full bg-emerald-500 animate-pulse" style={{ width: '60%' }} />
                </div>
              </div>
            )}
            <Editor
              key="sql-main-editor"
              height="100%"
              language="sql"
              defaultValue={sqlCode}
              onChange={value => { if (!isProgrammaticUpdateRef.current) setSqlCode(value || ""); }}
              onMount={handleEditorMount}
              theme="vs-dark"
              options={{
                minimap: { enabled: editorMinimap },
                fontSize: editorFontSize,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: editorTabSize,
                wordWrap: editorWordWrap ? "on" : "off",
                padding: { top: 16 },
                suggest: { showWords: false },
                quickSuggestions: { other: true, comments: false, strings: false },
              }}
            />
          </div>

          {/* Output Panel */}
          {showOutput && (
            <div ref={outputPanelRef} className="bg-[#0f0f16] border-t border-white/10 flex flex-col flex-shrink-0 relative" style={{ flex: `0 0 ${bottomPanelHeight}%`, minHeight: "150px" }}>
              {/* Resize handle */}
              <div className="absolute left-0 right-0 -top-1 h-2 cursor-row-resize z-20 group flex items-center justify-center" onMouseDown={startResizeBottom}>
                <div className="w-16 h-1 rounded-full bg-white/15 group-hover:bg-blue-500/60 transition-colors" />
              </div>

              {/* Output header / tab bar */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 flex-shrink-0 mt-1">
                <div className="flex items-center gap-1">
                  {/* Status indicator */}
                  {runStatus === 'running' && (
                    <div className="flex items-center gap-1.5 mr-3">
                      <svg className="w-4 h-4 animate-spin text-amber-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      <span className="text-xs text-amber-400 font-medium">Running...</span>
                    </div>
                  )}
                  {runStatus === 'success' && (
                    <div className="flex items-center gap-1.5 mr-3">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      <span className="text-xs text-emerald-400 font-medium">
                        {sqlResult && !sqlResult.error ? `${sqlResult.rowCount} row${sqlResult.rowCount !== 1 ? 's' : ''} in ${sqlResult.executionTime}ms` : 'Success'}
                      </span>
                      {sqlTestSummary && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ml-1 ${sqlTestSummary.failed === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                          {sqlTestSummary.passed}/{sqlTestSummary.total} passed
                        </span>
                      )}
                    </div>
                  )}
                  {runStatus === 'error' && (
                    <div className="flex items-center gap-1.5 mr-3">
                      <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      <span className="text-xs text-red-400 font-medium">Error</span>
                    </div>
                  )}

                  {(['results', 'tests', 'schema', 'messages'] as const).map(tab => {
                    if (tab === 'tests' && !sqlTestResults) return null;
                    return (
                      <button key={tab} onClick={() => setActiveSqlTab(tab)}
                        className={`px-3 py-1.5 text-xs font-semibold transition-all rounded-md ${activeSqlTab === tab ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                        {tab === 'results' ? 'Results' : tab === 'tests' ? `Tests ${sqlTestSummary ? `(${sqlTestSummary.passed}/${sqlTestSummary.total})` : ''}` : tab === 'schema' ? 'Schema' : 'Messages'}
                        {tab === 'results' && sqlResult && !sqlResult.error && <span className="ml-1.5 text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">{sqlResult.rowCount}</span>}
                        {tab === 'messages' && sqlResult?.error && <span className="ml-1.5 text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">!</span>}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  {/* Export buttons */}
                  {activeSqlTab === 'results' && sqlResult && !sqlResult.error && sqlResult.columns.length > 0 && (
                    <>
                      <button onClick={() => exportCSV(sqlResult.columns, sortedRows)} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg transition-all" title="Export CSV">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        CSV
                      </button>
                      <button onClick={() => exportJSON(sqlResult.columns, sortedRows)} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg transition-all" title="Export JSON">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        JSON
                      </button>
                    </>
                  )}
                  <button onClick={() => { setShowOutput(false); setRunStatus('idle'); }} className="text-gray-500 hover:text-white transition-colors p-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              {/* Output content */}
              <div className="flex-1 overflow-auto p-4">
                {/* Results tab */}
                {activeSqlTab === "results" && sqlResult && (
                  <div>
                    {sqlResult.error ? (
                      <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          <span className="text-sm text-red-400 font-semibold">SQL Error</span>
                        </div>
                        <pre className="text-sm text-red-300 font-mono whitespace-pre-wrap">{sqlResult.error}</pre>
                      </div>
                    ) : sqlResult.columns.length === 0 ? (
                      <div className="text-center py-10 text-gray-500 text-sm">
                        <svg className="w-10 h-10 mx-auto mb-3 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" /></svg>
                        Query executed successfully — no rows returned.
                      </div>
                    ) : (
                      <div>
                        <div className="overflow-x-auto rounded-xl border border-white/10">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-white/5">
                                {sqlResult.columns.map(col => (
                                  <th key={col} onClick={() => handleSort(col)} className="px-4 py-2.5 text-xs font-bold text-amber-400 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-white/5 transition-colors select-none">
                                    <div className="flex items-center gap-1">
                                      {col}
                                      {sortCol === col ? (
                                        <svg className={`w-3 h-3 ${sortDir === 'asc' ? '' : 'rotate-180'} transition-transform`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                      ) : <svg className="w-3 h-3 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>}
                                    </div>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {sortedRows.map((row, ri) => (
                                <tr key={ri} className="hover:bg-white/[0.03] transition-colors">
                                  {sqlResult.columns.map((col, ci) => (
                                    <td key={ci} className="px-4 py-2.5 text-sm text-gray-300 font-mono whitespace-nowrap">
                                      {row[col] === null || row[col] === undefined ? <span className="text-gray-600 italic">NULL</span> : String(row[col])}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                          <span>{sqlResult.rowCount} row{sqlResult.rowCount !== 1 ? 's' : ''} returned{sqlResult.executionTime !== undefined ? ` in ${sqlResult.executionTime}ms` : ''}</span>
                          {sortCol && <button onClick={() => setSortCol(null)} className="text-blue-400 hover:text-blue-300 transition-colors">Clear sort</button>}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tests tab */}
                {activeSqlTab === "tests" && sqlTestResults && sqlTestSummary && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-white">Test Evaluation</span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-extrabold ${sqlTestSummary.failed === 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                          {sqlTestSummary.passed === sqlTestSummary.total ? '🎉 ACCEPTED' : '❌ WRONG ANSWER'} ({sqlTestSummary.passed}/{sqlTestSummary.total} Passed)
                        </span>
                      </div>
                    </div>

                    {/* Test Case Selector Pills */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-white/10">
                      {sqlTestResults.map((tr: any, idx: number) => {
                        const isSelected = selectedTestCaseIdx === idx;
                        return (
                          <button
                            key={idx}
                            onClick={() => setSelectedTestCaseIdx(idx)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                              isSelected
                                ? tr.passed
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-lg shadow-rose-500/10'
                                : tr.passed
                                ? 'bg-white/[0.03] text-emerald-400/80 border border-white/10 hover:bg-white/5'
                                : 'bg-white/[0.03] text-rose-400/80 border border-white/10 hover:bg-white/5'
                            }`}
                          >
                            <span className={tr.passed ? 'text-emerald-400' : 'text-rose-400'}>{tr.passed ? '✓' : '✗'}</span>
                            <span>Case {idx + 1}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected Test Case Output Detail */}
                    {(() => {
                      const tr = sqlTestResults[selectedTestCaseIdx] || sqlTestResults[0];
                      if (!tr) return null;
                      return (
                        <div className="space-y-3">
                          <div className={`p-3 rounded-xl border flex items-center justify-between ${tr.passed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-bold ${tr.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {tr.passed ? '✓ Test Case Passed' : '✗ Test Case Failed'}
                              </span>
                            </div>
                            {tr.executionTime !== undefined && <span className="text-xs text-gray-400 font-mono">{tr.executionTime}ms</span>}
                          </div>

                          {tr.error ? (
                            <div className="text-xs text-rose-300 font-mono bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 whitespace-pre-wrap">
                              {tr.error}
                            </div>
                          ) : (
                            <DiffTable expected={tr.expectedOutput || ''} actual={tr.actualOutput || ''} passed={tr.passed} />
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Schema tab */}
                {activeSqlTab === "schema" && (
                  <div className="h-[400px] w-full">
                    {playMode === "free" ? (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-white">Current Schema</h4>
                          <button onClick={() => setSqlFreeSchema(SQL_FREE_SCHEMA)} className="text-xs text-gray-400 hover:text-white underline">Reset to default</button>
                        </div>
                        <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap bg-white/[0.02] p-3 rounded-xl border border-white/10">{sqlFreeSchema}</pre>
                      </div>
                    ) : (() => {
                      const activeSchema = getProblemSchema(selectedProblem);
                      if (activeSchema?.tables && Array.isArray(activeSchema.tables) && activeSchema.tables.length > 0) {
                        return (
                          <SchemaViewer
                            tables={activeSchema.tables}
                            problemDescription={selectedProblem?.description}
                            onInsertText={insertTextAtCursor}
                          />
                        );
                      }
                      return <div className="text-gray-500 text-sm text-center py-8">No schema available for this problem</div>;
                    })()}
                  </div>
                )}

                {/* Messages tab */}
                {activeSqlTab === "messages" && (
                  <div className="space-y-3">
                    {!sqlResult ? (
                      <div className="text-center py-10 text-gray-500 text-sm">Run your SQL query to see output messages...</div>
                    ) : sqlResult.error ? (
                      <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                        <pre className="text-sm text-red-400 font-mono whitespace-pre-wrap">{sqlResult.error}</pre>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                        <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        <span className="text-sm text-emerald-400 font-medium">
                          Query executed successfully — {sqlResult.rowCount} row{sqlResult.rowCount !== 1 ? 's' : ''} returned{sqlResult.executionTime !== undefined ? ` in ${sqlResult.executionTime}ms` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Shortcuts bar */}
              <div className="px-4 py-1.5 border-t border-white/10 text-[10px] text-gray-600 flex gap-4 flex-shrink-0">
                <span><kbd className="px-1 py-0.5 bg-white/10 rounded text-[10px]">Ctrl</kbd> + <kbd className="px-1 py-0.5 bg-white/10 rounded text-[10px]">Enter</kbd> Run</span>
                <span><kbd className="px-1 py-0.5 bg-white/10 rounded text-[10px]">Ctrl</kbd> + <kbd className="px-1 py-0.5 bg-white/10 rounded text-[10px]">Shift</kbd> + <kbd className="px-1 py-0.5 bg-white/10 rounded text-[10px]">Enter</kbd> Submit</span>
              </div>
            </div>
          )}
        </div>

        {/* ProblemsModal */}
        <ProblemsModal
          isOpen={showProblems && playMode === "problem"}
          onClose={() => setShowProblems(false)}
          problems={problems}
          selectedProblem={selectedProblem}
          onSelect={selectProblem}
          problemStatuses={problemStatuses}
          isLoading={isLoadingProblems}
          totalProblems={totalProblems}
          onLoadMore={loadMoreProblems}
          searchQuery={problemSearchQuery}
          onSearchChange={handleSearchChange}
        />

        {/* Interactive ER Diagram Modal */}
        {(() => {
          const activeSchema = getProblemSchema(selectedProblem);
          const tablesToPass = activeSchema?.tables && Array.isArray(activeSchema.tables) ? activeSchema.tables : [];
          return (
            <SchemaViewerModal
              isOpen={showSchemaModal}
              onClose={() => setShowSchemaModal(false)}
              tables={tablesToPass}
              problemDescription={selectedProblem?.description}
              onInsertText={insertTextAtCursor}
            />
          );
        })()}

        {/* Contest toast */}
        {contestSubmitToast && (
          <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-xl shadow-2xl border flex items-center gap-3 text-sm font-semibold ${contestSubmitToast.status === 'success' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-red-500/20 border-red-500 text-red-300'}`}>
            {contestSubmitToast.status === 'success' ? <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
            {contestSubmitToast.message}
            <button onClick={() => setContestSubmitToast(null)} className="ml-2 text-gray-400 hover:text-white"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
        )}
      </div>

      {/* Sample Data Modal */}
      {sampleDataModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setSampleDataModal(null)}>
          <div className="bg-[#16161f] border border-white/10 rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-black text-white">Preview: <span className="text-amber-400">{sampleDataModal.table.name}</span></h3>
                <p className="text-xs text-gray-500 mt-0.5">Sample table structure & data</p>
              </div>
              <button onClick={() => setSampleDataModal(null)} className="text-gray-400 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10">
                    {sampleDataModal.table.columns?.map(col => (
                      <th key={col.name} className="px-4 py-2.5 text-xs font-bold text-amber-400 uppercase tracking-wider whitespace-nowrap">
                        <div>{col.name}</div>
                        <div className="text-[10px] text-blue-400/70 font-mono font-normal">{col.type}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sampleDataModal.table.sampleData && sampleDataModal.table.sampleData.length > 0 ? (
                    sampleDataModal.table.sampleData.slice(0, 5).map((row: any, ri: number) => (
                      <tr key={ri} className="hover:bg-white/[0.03] transition-colors">
                        {sampleDataModal.table.columns?.map((col, ci) => (
                          <td key={ci} className="px-4 py-2.5 text-gray-300 font-mono whitespace-nowrap">
                            {row[col.name] === null || row[col.name] === undefined ? <span className="text-gray-600 italic">NULL</span> : String(row[col.name])}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={sampleDataModal.table.columns?.length || 1} className="px-4 py-8 text-center text-gray-500 text-xs">No sample data available for this table</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {sampleDataModal.table.sampleData && sampleDataModal.table.sampleData.length > 5 && (
              <p className="text-[10px] text-gray-600 mt-2">Showing first 5 rows of {sampleDataModal.table.sampleData.length}</p>
            )}
          </div>
        </div>
      )}

      {/* Problem Final Lock Confirmation Modal */}
      <ProblemLockConfirmationModal
        isOpen={showFinalLockModal}
        problemTitle={pendingLockProblem?.title || selectedProblem?.title || 'Problem'}
        scoreEarned={pendingLockProblem?.score}
        maxPoints={selectedProblem?.points || 100}
        onConfirm={() => {
          if (!pendingLockProblem?.id || !contestId) return;
          const pid = pendingLockProblem.id;
          const newSolved = new Set([...solvedProblems, pid]);
          setSolvedProblems(newSolved);
          sessionStorage.setItem(`solvedProblems_${contestId}`, JSON.stringify([...newSolved]));
          const newLocked = new Set([...lockedProblems, pid]);
          setLockedProblems(newLocked);
          sessionStorage.setItem(`lockedProblems_${contestId}`, JSON.stringify([...newLocked]));
          sessionStorage.setItem(`locked_prob_${userStorageId}_${contestId}_${pid}`, '1');
          localStorage.setItem(`locked_prob_${userStorageId}_${contestId}_${pid}`, '1');
          setShowFinalLockModal(false);
          setPendingLockProblem(null);
          notify.toast.success(`🔒 Problem "${pendingLockProblem.title}" locked & submitted!`);
          navigate(`/contests/${contestId}`);
        }}
        onCancel={() => {
          setShowFinalLockModal(false);
          setPendingLockProblem(null);
        }}
      />
    </div>
  );

  if (contestId && contestFlags && !embeddedInContest) {
    return (
      <SecureContestWrapper contestId={contestId} flags={contestFlags}>
        {playgroundLayout}
      </SecureContestWrapper>
    );
  }

  return playgroundLayout;
}
