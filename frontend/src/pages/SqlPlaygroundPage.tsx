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
import { SecureContestWrapper } from '../components/SecureContestWrapper';
import { useNotify } from '../components/notifications';

export function SqlPlaygroundPage({ embeddedInContest }: { embeddedInContest?: boolean } = {}) {
  const notify = useNotify();
  const { setSidebarHidden } = useSidebar();
  const navigate = useNavigate();
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
          // Store SQL-type contest problems for progress bar
          if (res.contest?.problems) {
            const sqlProblems = res.contest.problems.filter((cp: any) =>
              cp.problem.problemType === 'sql'
            );
            setContestProblems(sqlProblems);
          }
        } catch (err) {
          console.error("Failed to load contest details:", err);
        }
      };
      fetchFlags();

      return () => {
        setSidebarHidden(false);
        if (autoNavigateTimerRef.current) clearTimeout(autoNavigateTimerRef.current);
      };
    }
  }, [setSidebarHidden]);

  const [playMode, setPlayMode] = useState<"free" | "problem">(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('contestId')) return 'problem';
    const saved = localStorage.getItem('sql_playground_playMode');
    return (saved === 'free' || saved === 'problem') ? saved : 'problem';
  });

  const [sqlCode, setSqlCode] = useState(() => {
    return DEFAULT_CODE.sql;
  });
  const [sqlResult, setSqlResult] = useState<SqlResult | null>(null);
  const [sqlFreeSchema, setSqlFreeSchema] = useState(SQL_FREE_SCHEMA);
  const [activeSqlTab, setActiveSqlTab] = useState<"results" | "schema" | "messages" | "tests">("results");

  const [isRunning, setIsRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');

  const [problems, setProblems] = useState<Problem[]>([]);
  const [totalProblems, setTotalProblems] = useState(0);
  const [problemSearchQuery, setProblemSearchQuery] = useState("");
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [showProblems, setShowProblems] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [isLoadingProblems, setIsLoadingProblems] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [editorFontSize, setEditorFontSize] = useState(() => {
    const saved = localStorage.getItem('sql_playground_fontSize');
    return saved ? parseInt(saved) : 14;
  });
  const [editorTabSize, setEditorTabSize] = useState(() => {
    const saved = localStorage.getItem('sql_playground_tabSize');
    return saved ? parseInt(saved) : 4;
  });
  const [editorWordWrap, setEditorWordWrap] = useState(() => {
    const saved = localStorage.getItem('sql_playground_wordWrap');
    return saved === 'true';
  });
  const [editorMinimap, setEditorMinimap] = useState(() => {
    const saved = localStorage.getItem('sql_playground_minimap');
    return saved !== 'false';
  });

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const isProgrammaticUpdateRef = useRef(false);

  const setEditorValue = (value: string) => {
    if (!editorRef.current) return;
    const model = editorRef.current.getModel();
    if (model && model.getValue() !== value) {
      isProgrammaticUpdateRef.current = true;
      try {
        model.pushEditOperations([], [{ range: model.getFullModelRange(), text: value }], () => null);
      } finally {
        isProgrammaticUpdateRef.current = false;
      }
    }
  };

  const modelsRef = useRef<Map<string, any>>(new Map());
  const getOrCreateModel = (problemId: string, codeVal: string) => {
    if (!monacoRef.current) return null;
    const modelKey = `${problemId}_sql`;
    if (!modelsRef.current.has(modelKey)) {
      const uri = monacoRef.current.Uri.parse(`file:///${problemId}_sql.sql`);
      let model = monacoRef.current.editor.getModel(uri);
      if (!model) {
        model = monacoRef.current.editor.createModel(codeVal, "sql", uri);
      }
      modelsRef.current.set(modelKey, model);
    }
    return modelsRef.current.get(modelKey);
  };

  useEffect(() => {
    if (editorRef.current && monacoRef.current && selectedProblem) {
      const model = getOrCreateModel(selectedProblem.id, sqlCode);
      if (model) {
        editorRef.current.setModel(model);
      }
    }
  }, [selectedProblem?.id]);

  useEffect(() => {
    setEditorValue(sqlCode);
  }, [sqlCode]);

  const [leftPanelWidth, setLeftPanelWidth] = useState(35);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(30);
  const [showOutput, setShowOutput] = useState(false);

  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const outputPanelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isResizingLeft = useRef(false);
  const isResizingBottom = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startLeftWidth = useRef(0);
  const startBottomHeight = useRef(0);
  const [isSaved, setIsSaved] = useState(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [problemStatuses, setProblemStatuses] = useState<Record<string, 'solved' | 'attempted' | 'none'>>({});
  const [sqlTestResult, setSqlTestResult] = useState<{ passed: boolean; expectedOutput: string; actualOutput: string } | null>(null);
  const [sqlTestResults, setSqlTestResults] = useState<any[] | null>(null);
  const [sqlTestSummary, setSqlTestSummary] = useState<{ passed: number; failed: number; total: number } | null>(null);

  useEffect(() => {
    localStorage.setItem('sql_playground_playMode', playMode);
  }, [playMode]);

  useEffect(() => {
    return () => {
      if (monacoRef.current) {
        monacoRef.current.editor.getModels().forEach((m: any) => m.dispose());
      }
      editorRef.current = null;
      monacoRef.current = null;
    };
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchAllProblems("sql");
      loadProblemStatuses();
    };
    init();
  }, []);

  useEffect(() => {
    localStorage.setItem('sql_playground_fontSize', editorFontSize.toString());
  }, [editorFontSize]);

  useEffect(() => {
    localStorage.setItem('sql_playground_tabSize', editorTabSize.toString());
  }, [editorTabSize]);

  useEffect(() => {
    localStorage.setItem('sql_playground_wordWrap', editorWordWrap.toString());
  }, [editorWordWrap]);

  useEffect(() => {
    localStorage.setItem('sql_playground_minimap', editorMinimap.toString());
  }, [editorMinimap]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const problemId = params.get('problem');
    const cid = params.get('contestId');
    const savedProblemId = localStorage.getItem('sql_playground_selected_problem');

    if (playMode === "free" && !cid) {
      setSqlCode(DEFAULT_CODE.sql);
      setSqlFreeSchema(SQL_FREE_SCHEMA);
      setSqlResult(null);
      setSelectedProblem(null);
      return;
    }

    const targetProblemId = problemId || (cid && contestProblems.length > 0 ? contestProblems[0].problem.id : savedProblemId);

    if (targetProblemId) {
      if (selectedProblem && selectedProblem.id === targetProblemId && selectedProblem.description) {
        return;
      }

      const existingProblem = problems.find(p => p.id === targetProblemId) ||
        contestProblems.find(cp => cp.problem.id === targetProblemId)?.problem as any;

      if (existingProblem && existingProblem.description) {
        selectProblem(existingProblem);
        return;
      }

      const fetchTargetProblem = async () => {
        try {
          const res = await api.getProblem(targetProblemId);
          const prob = res.problem || res;
          if (prob && prob.id) {
            setProblems(prev => {
              if (prev.some(p => p.id === prob.id)) {
                return prev.map(p => p.id === prob.id ? prob : p);
              }
              return [prob, ...prev];
            });
            selectProblem(prob);
          } else if (!cid && problems.length > 0) {
            localStorage.removeItem('sql_playground_selected_problem');
            selectProblem(problems[0]);
          }
        } catch (err) {
          console.error("Failed to fetch target SQL problem:", err);
          if (!cid && problems.length > 0) {
            localStorage.removeItem('sql_playground_selected_problem');
            selectProblem(problems[0]);
          }
        }
      };
      fetchTargetProblem();
    } else if (!selectedProblem && problems.length > 0) {
      selectProblem(problems[0]);
    }
  }, [problems, playMode, selectedProblem, contestProblems]);

  useEffect(() => {
    if (!selectedProblem || playMode === "free") return;
    if (selectedProblem.problemType === "sql") {
      const savedKey = `sql_playground_${selectedProblem.id}`;
      const savedCode = localStorage.getItem(savedKey);
      const sqlStarter = selectedProblem.starterCode?.sql || DEFAULT_CODE.sql;
      setSqlCode(savedCode || sqlStarter);
    }
  }, [selectedProblem?.id, playMode]);

  useEffect(() => {
    if (!selectedProblem) return;

    setIsSaved(false);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const key = `sql_playground_${selectedProblem.id}`;
      localStorage.setItem(key, sqlCode);
      setIsSaved(true);
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [sqlCode, selectedProblem, playMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "'") {
        e.preventDefault();
        runSqlCode();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sqlCode, isRunning]);

  useEffect(() => {
    if (!showSettings) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (settingsRef.current && !settingsRef.current.contains(target)) {
        setShowSettings(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSettings]);

  const serializeSqlResult = (result: SqlResult): string => {
    if (result.columns.length === 0) {
      if (result.affected !== undefined) {
        return `Rows matched: ${result.affected}  Changed: ${result.affected}  Warnings: 0`;
      }
      return '';
    }
    const colWidths = result.columns.map(col =>
      Math.max(col.length, ...result.rows.map(row => String(row[col] ?? 'NULL').length))
    );
    const header = result.columns.map((col, i) => col.padEnd(colWidths[i])).join(' | ');
    const rows = result.rows.map(row =>
      result.columns.map((col, i) => String(row[col] ?? 'NULL').padEnd(colWidths[i])).join(' | ')
    );
    return [header, ...rows].join('\n');
  };

  useEffect(() => {
    if (sqlTestResults) {
      setSqlTestResult(null);
      return;
    }
    if (runStatus !== 'success' || !sqlResult || playMode !== 'problem' || !selectedProblem?.testCases?.length) {
      setSqlTestResult(null);
      return;
    }
    const testCase = selectedProblem.testCases[0];
    if (!testCase?.expectedOutput) {
      setSqlTestResult(null);
      return;
    }
    const actualOutput = serializeSqlResult(sqlResult);
    const passed = actualOutput.trim() === testCase.expectedOutput.trim();
    setSqlTestResult({ passed, expectedOutput: testCase.expectedOutput, actualOutput });
  }, [sqlResult, runStatus, sqlTestResults]);

  const startResizeLeft = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingLeft.current = true;
    startX.current = e.clientX;
    startLeftWidth.current = leftPanelWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.body.style.overflow = "hidden";
  }, [leftPanelWidth]);

  const startResizeBottom = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingBottom.current = true;
    startY.current = e.clientY;
    startBottomHeight.current = bottomPanelHeight;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    document.body.style.overflow = "hidden";
  }, [bottomPanelHeight]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft.current && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const deltaX = e.clientX - startX.current;
        const deltaWidth = (deltaX / containerWidth) * 100;
        const newWidth = Math.max(20, Math.min(60, startLeftWidth.current + deltaWidth));
        setLeftPanelWidth(newWidth);
      }
      if (isResizingBottom.current && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const containerHeight = containerRect.height;
        const deltaY = startY.current - e.clientY;
        const deltaHeight = (deltaY / containerHeight) * 100;
        const newHeight = Math.max(15, Math.min(60, startBottomHeight.current + deltaHeight));
        setBottomPanelHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      isResizingLeft.current = false;
      isResizingBottom.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.body.style.overflow = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const fetchAllProblems = async (problemType?: string, opts?: { skip?: number; search?: string }) => {
    try {
      setIsLoadingProblems(true);
      const params = new URLSearchParams({ type: problemType || "sql", take: "200" });
      if (opts?.skip) params.set('skip', opts.skip.toString());
      if (opts?.search) params.set('search', opts.search);
      const response = await api.get(`/problems?${params}`);
      const newProblems = response.problems || [];
      const total = response.total || 0;
      setTotalProblems(total);
      if (opts?.skip && opts.skip > 0) {
        setProblems(prev => [...prev, ...newProblems]);
      } else {
        setProblems(newProblems);
      }
    } catch (error) {
      console.error("Failed to fetch all problems:", error);
    } finally {
      setIsLoadingProblems(false);
    }
  };

  const loadMoreProblems = () => {
    fetchAllProblems("sql", { skip: problems.length, search: problemSearchQuery || undefined });
  };

  const debounceSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (value: string) => {
    setProblemSearchQuery(value);
    if (debounceSearchRef.current) clearTimeout(debounceSearchRef.current);
    debounceSearchRef.current = setTimeout(() => {
      fetchAllProblems("sql", { skip: 0, search: value || undefined });
    }, 400);
  };

  const loadProblemStatuses = async () => {
    try {
      const res = await api.get("/submissions");
      const subs = res.submissions || [];
      const statuses: Record<string, 'solved' | 'attempted' | 'none'> = {};
      subs.forEach((sub: any) => {
        const pid = sub.problemId;
        if (!pid) return;
        if (sub.status === 'passed') {
          statuses[pid] = 'solved';
        } else if (!statuses[pid]) {
          statuses[pid] = 'attempted';
        }
      });
      setProblemStatuses(statuses);
    } catch (error) {
      console.error("Failed to load problem statuses:", error);
    }
  };

  const runSqlCode = async () => {
    setIsRunning(true);
    setRunStatus('running');
    setSqlResult(null);
    setSqlTestResults(null);
    setSqlTestSummary(null);
    setActiveSqlTab("results");
    setShowOutput(true);
    setBottomPanelHeight(35);

    try {
      const startTime = performance.now();

      if (playMode === "problem" && selectedProblem?.testCases?.length) {
        const globalSetup = selectedProblem.schema?.setup || '';
        const testCases = selectedProblem.testCases.map(tc => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          setup: globalSetup + (tc.setup ? '\n' + tc.setup : ''),
        }));
        const response = await api.post("/code/run-tests", { language: "sql", code: sqlCode, testCases });
        const data = response;

        if (data.results?.length) {
          setSqlTestResults(data.results);
          setSqlTestSummary(data.summary);

          const firstResult = data.results[0];
          if (firstResult.error) {
            setSqlResult({
              columns: [],
              rows: [],
              rowCount: 0,
              error: firstResult.error,
              executionTime: firstResult.executionTime
            });
            setRunStatus('error');
          } else {
            setSqlResult({
              columns: firstResult.columns || [],
              rows: firstResult.rows || [],
              rowCount: firstResult.rowCount || 0,
              affected: firstResult.affected,
              executionTime: firstResult.executionTime
            });
            setRunStatus('success');
          }
        } else {
          setSqlResult({
            columns: [],
            rows: [],
            rowCount: 0,
            error: "No test results returned",
            executionTime: Math.round(performance.now() - startTime)
          });
          setRunStatus('error');
        }
        return;
      }

      const payload: any = { language: "sql", code: sqlCode };

      if (playMode === "free") {
        payload.setup = sqlFreeSchema;
      } else if (selectedProblem && (selectedProblem as { schema?: { setup?: string } }).schema?.setup) {
        payload.setup = (selectedProblem as { schema?: { setup?: string } }).schema?.setup;
      }

      const response = await api.post("/code/run", payload);
      const endTime = performance.now();

      const data = response;

      if (data.error) {
        setSqlResult({
          columns: [],
          rows: [],
          rowCount: 0,
          error: data.error,
          executionTime: Math.round(endTime - startTime)
        });
        setRunStatus('error');
        return;
      }

      if (data.columns && Array.isArray(data.columns)) {
        setSqlResult({
          columns: data.columns,
          rows: data.rows || [],
          rowCount: (data.rows || []).length,
          executionTime: Math.round(endTime - startTime)
        });
        setRunStatus('success');
        setActiveSqlTab("results");
        return;
      }

      const stdout = data.stdout || data.output || "";

      const lines = stdout.trim().split('\n').filter((l: string) => l.trim());
      if (lines.length === 0) {
        setSqlResult({
          columns: [],
          rows: [],
          rowCount: 0,
          executionTime: Math.round(endTime - startTime)
        });
        setRunStatus('success');
        return;
      }

      const headers = lines[0].split(/\s*\|\s*|\s{2,}/).map((h: string) => h.trim()).filter(Boolean);
      const dataRows: Record<string, any>[] = [];

      if (headers.length > 0) {
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(/\s*\|\s*|\s{2,}/).map((v: string) => v.trim());
          if (values.length === headers.length) {
            const row: Record<string, any> = {};
            headers.forEach((h: string, idx: number) => {
              row[h] = values[idx];
            });
            dataRows.push(row);
          }
        }
      }

      setSqlResult({
        columns: headers,
        rows: dataRows,
        rowCount: dataRows.length,
        executionTime: Math.round(endTime - startTime)
      });
      setRunStatus('success');
      setActiveSqlTab("results");
    } catch (err: unknown) {
      console.error("SQL execution error:", err);
      const errorMsg = err instanceof Error ? (axios.isAxiosError(err) ? err.response?.data?.error || err.message : err.message) : "Failed to execute SQL.";
      setSqlResult({
        columns: [],
        rows: [],
        rowCount: 0,
        error: errorMsg,
      });
      setRunStatus('error');
    } finally {
      setIsRunning(false);
    }
  };

  const selectProblem = async (problem: Problem) => {
    if (playMode === "free") {
      window.history.pushState({}, '', '/playground/sql');
      return;
    }

    setSqlCode("");

    setSelectedProblem(problem);
    localStorage.setItem('sql_playground_selected_problem', problem.id);
    setRunStatus('idle');

    const params = new URLSearchParams(window.location.search);
    params.set('problem', problem.id);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newUrl);

    if (problem.problemType === "sql") {
      const savedKey = `sql_playground_${problem.id}`;
      const savedCode = localStorage.getItem(savedKey);

      const sqlStarter = problem.starterCode?.sql || DEFAULT_CODE.sql;
      const codeToSet = savedCode || sqlStarter;
      setSqlCode(codeToSet);

      if (editorRef.current) {
        setEditorValue(codeToSet);
      }
    }

    setSqlResult(null);
    setSqlTestResults(null);
    setSqlTestSummary(null);
    setShowOutput(false);
    setShowProblems(false);
    setIsSaved(true);
  };

  const formatSchemaAsTable = (problem: Problem): string => {
    if (!problem.schema?.tables?.length) return '';
    if (typeof problem.schema.tables[0] === 'string') return '';
    const tables = problem.schema.tables;
    return tables.map(table => {
      `Table: ${table.name}\n+${table.columns.map(c => '-'.repeat(Math.max(c.name.length + 2, 12))).join('+')}+\n| ${table.columns.map(c => c.name.padEnd(Math.max(c.name.length, 10))).join(' | ')} |\n+${table.columns.map(c => '-'.repeat(Math.max(c.name.length + 2, 12))).join('+')}+\n| ${table.columns.map(c => c.type.padEnd(Math.max(c.name.length, 10))).join(' | ')} |\n+${table.columns.map(c => '-'.repeat(Math.max(c.name.length + 2, 12))).join('+')}+`;
    }).join('\n\n');
  };

  const renderDataFromInsert = (insertSql: string): string => {
    const lines: string[] = [];
    const regex = /\(([^)]+)\)/g;
    let match;
    while ((match = regex.exec(insertSql)) !== null) {
      const content = match[1].trim();
      if (content && !content.toUpperCase().startsWith('SELECT') && content.includes(',')) {
        lines.push(content);
      }
    }
    return lines.length > 0 ? lines.join('\n') : insertSql;
  };

  const parseExamples = (problem: Problem): { input: string; output: string; explanation?: string }[] => {
    try {
      const testCases = problem.testCases;
      if (!testCases || testCases.length === 0) return [];
      const schemaTable = formatSchemaAsTable(problem);
      return testCases
        .filter(tc => !tc.isHidden)
        .map(tc => {
          let input = schemaTable || tc.input;
          if (tc.setup && problem.schema?.tables?.length) {
            const dataRows = renderDataFromInsert(tc.setup);
            if (dataRows) {
              const tableName = problem.schema.tables[0].name;
              input += `\n\n${tableName} table:\n+${problem.schema.tables[0].columns.map(c => '-'.repeat(Math.max(c.name.length + 2, 12))).join('+')}+\n`;
              dataRows.split('\n').forEach(row => {
                const vals = row.split(',').map(v => v.trim().replace(/'/g, ''));
                input += `| ${vals.map((v, i) => v.padEnd(Math.max(problem!.schema!.tables[0].columns[i]?.name.length || 10, 10))).join(' | ')} |\n`;
              });
              input += `+${problem.schema.tables[0].columns.map(c => '-'.repeat(Math.max(c.name.length + 2, 12))).join('+')}+`;
            }
          }
          return { input, output: tc.expectedOutput };
        });
    } catch {
      return [];
    }
  };

  const parseConstraints = (problem: Problem): string[] => {
    if (problem.constraints) return problem.constraints;
    return [];
  };

  const handleEditorMount = (editor: any, monaco: any) => {
    monacoRef.current = monaco;
    editorRef.current = editor;

    if (contestId) {
      editor.updateOptions({ contextmenu: false });
      const clipboardActions = [
        'editor.action.clipboardCopyAction',
        'editor.action.clipboardPasteAction',
        'editor.action.clipboardCutAction',
      ];
      for (const actionId of clipboardActions) {
        const action = editor.getAction(actionId);
        if (action) action.run = () => undefined;
      }
    }
  };

  if (contestId && !contestFlags) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent-green)] mx-auto mb-4" />
          <p className="text-gray-400 font-mono">Loading secure environment...</p>
        </div>
      </div>
    );
  }

  const sqlContestProblems = contestProblems.filter(cp => cp.problem.problemType === 'sql');

  const playgroundLayout = (
    <div ref={containerRef} className="h-screen md:h-[calc(100vh-4rem)] flex flex-col bg-[var(--bg-primary)] select-none">

      {/* Contest Progress Bar */}
      {contestId && sqlContestProblems.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950 border-b border-white/10 flex-shrink-0 overflow-x-auto">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest shrink-0 mr-1">Contest</span>
          <div className="flex items-center gap-1.5">
            {sqlContestProblems.map((cp, idx) => {
              const isSolved = solvedProblems.has(cp.problem.id);
              const isCurrent = selectedProblem?.id === cp.problem.id;
              return (
                <button
                  key={cp.problem.id}
                  onClick={() => {
                    const prob = problems.find((p: any) => p.id === cp.problem.id);
                    if (prob) selectProblem(prob);
                  }}
                  title={cp.problem.title}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all shrink-0 ${isCurrent
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : isSolved
                        ? 'bg-green-500/20 border-green-400 text-green-300'
                        : 'bg-white/5 border-white/20 text-gray-400 hover:border-white/40 hover:text-white'
                    }`}
                >
                  {isSolved && (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {String.fromCharCode(65 + idx)}
                </button>
              );
            })}
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-gray-400">
              <span className={solvedProblems.size > 0 ? 'text-green-400' : 'text-gray-500'}>{solvedProblems.size}</span>
              <span className="text-gray-600">/{sqlContestProblems.length}</span>
              <span className="text-gray-500 ml-1">solved</span>
            </span>
            <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${sqlContestProblems.length > 0 ? (solvedProblems.size / sqlContestProblems.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Left Panel - Problem Description */}
        {playMode !== "free" && (
          <div
            ref={leftPanelRef}
            className={`flex-col border-r border-white/10 relative overflow-hidden ${showLeftPanel ? "flex" : "hidden"
              } lg:flex flex-shrink-0`}
            style={{ width: showLeftPanel ? `${leftPanelWidth}%` : "0%" }}
          >
            {/* Problem Header */}
            <div className="p-3 border-b border-white/10 bg-[var(--bg-card)] flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setShowLeftPanel(false)}
                  className="text-gray-400 hover:text-white p-1 shrink-0 lg:hidden"
                  title="Close panel"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                {playMode === "problem" && !contestId && (
                  <button
                    onClick={() => setShowProblems(true)}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Problems
                  </button>
                )}
              </div>
              {selectedProblem && playMode === "problem" ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    {selectedProblem.difficulty === "Solved" && (
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {!contestId ? (
                      <button
                        onClick={() => setShowProblems(!showProblems)}
                        className="flex items-center gap-2 hover:bg-white/10 rounded-lg px-2 py-1 transition-colors"
                      >
                        <h2 className="text-lg font-bold text-white">{selectedProblem.title}</h2>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 px-2 py-1">
                        <button
                          onClick={() => navigate(`/contests/${contestId}`)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                          title="Back to Contest"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                          </svg>
                          Back
                        </button>
                        <h2 className="text-lg font-bold text-white">{selectedProblem.title}</h2>
                      </div>
                    )}
                    {!contestId && (
                      <div className="flex items-center gap-1 ml-auto">
                        <button
                          onClick={() => {
                            const idx = problems.findIndex(p => p.id === selectedProblem.id);
                            if (idx > 0) selectProblem(problems[idx - 1]);
                          }}
                          disabled={problems.findIndex(p => p.id === selectedProblem.id) <= 0}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Previous Problem"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            const idx = problems.findIndex(p => p.id === selectedProblem.id);
                            if (idx < problems.length - 1) selectProblem(problems[idx + 1]);
                          }}
                          disabled={problems.findIndex(p => p.id === selectedProblem.id) >= problems.length - 1}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Next Problem"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded ${selectedProblem.difficulty === "Easy" ? "bg-green-500/20 text-green-400" :
                        selectedProblem.difficulty === "Medium" ? "bg-yellow-500/20 text-yellow-400" :
                          selectedProblem.difficulty === "Hard" ? "bg-red-500/20 text-red-400" :
                            "bg-green-500/20 text-green-400"
                      }`}>
                      {selectedProblem.difficulty === "Solved" ? "Solved" : selectedProblem.difficulty}
                    </span>
                    {selectedProblem.acceptanceRate !== undefined && (
                      <span className="text-xs text-gray-500">
                        {selectedProblem.acceptanceRate}% acceptance
                      </span>
                    )}
                    {selectedProblem.totalSubmissions !== undefined && (
                      <span className="text-xs text-gray-500">
                        {selectedProblem.totalSubmissions.toLocaleString()} submissions
                      </span>
                    )}
                  </div>
                  {selectedProblem.topics && selectedProblem.topics.length > 0 && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {selectedProblem.topics.map((topic, idx) => (
                        <span key={idx} className="text-xs px-2 py-0.5 bg-white/5 text-gray-400 rounded">
                          {topic}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : playMode === "problem" ? (
                <p className="text-gray-500 text-sm">Select a problem to get started</p>
              ) : null}
            </div>

            {/* Problem Content */}
            <div
              className={`flex-1 overflow-auto p-4 space-y-4 ${contestId ? 'select-none' : ''}`}
              onContextMenu={contestId ? e => e.preventDefault() : undefined}
              style={contestId ? { userSelect: 'none' } : undefined}
            >
              {selectedProblem && playMode === "problem" ? (
                <>
                  {/* Description */}
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-2">Description</h3>
                    <MarkdownRenderer content={(() => {
                          let desc = selectedProblem.description || '';
                          let images = selectedProblem.images || {};
                          if (typeof images === 'string') {
                              try { images = JSON.parse(images); } catch (e) {}
                          }
                          const isValidImageUrl = (url: any) => typeof url === 'string' && url.startsWith('http');

                          if (isValidImageUrl(images.example1)) {
                              const regex = /(###\s*Example\s*1:?|\*\*Example\s*1:?\*\*|Example\s*1:?)/i;
                              if (regex.test(desc)) desc = desc.replace(regex, `$1\n\n![Example 1 Figure](${images.example1})\n\n`);
                              else desc += `\n\n![Example 1 Figure](${images.example1})\n\n`;
                          }
                          if (isValidImageUrl(images.example2)) {
                              const regex = /(###\s*Example\s*2:?|\*\*Example\s*2:?\*\*|Example\s*2:?)/i;
                              if (regex.test(desc)) desc = desc.replace(regex, `$1\n\n![Example 2 Figure](${images.example2})\n\n`);
                              else desc += `\n\n![Example 2 Figure](${images.example2})\n\n`;
                          }
                          if (isValidImageUrl(images.example3)) {
                              const regex = /(###\s*Example\s*3:?|\*\*Example\s*3:?\*\*|Example\s*3:?)/i;
                              if (regex.test(desc)) desc = desc.replace(regex, `$1\n\n![Example 3 Figure](${images.example3})\n\n`);
                              else desc += `\n\n![Example 3 Figure](${images.example3})\n\n`;
                          }

                          if (isValidImageUrl(images.main)) {
                              const constraintsRegex = /(###\s*Constraints:?|\*\*Constraints:?\*\*|Constraints:?)/i;
                              if (constraintsRegex.test(desc)) {
                                  desc = desc.replace(constraintsRegex, `![Main Figure](${images.main})\n\n$1`);
                              } else {
                                  desc = `![Main Figure](${images.main})\n\n${desc}`;
                              }
                          }
                          
                          return desc;
                        })()} />
                  </div>

                  {/* Examples */}
                  {parseExamples(selectedProblem).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-white mb-2">Examples</h3>
                      <div className="space-y-3">
                        {parseExamples(selectedProblem).map((example, idx) => (
                          <div key={idx} className="bg-white/5 rounded-lg p-3">
                            <div className="text-xs text-gray-500 mb-1">Example {idx + 1}</div>
                            <div className="font-mono text-xs space-y-1">
                              <div className="flex gap-2">
                                <span className="text-gray-400 min-w-[60px]">Input:</span>
                                <span className="text-gray-300">{example.input}</span>
                              </div>
                              <div className="flex gap-2">
                                <span className="text-gray-400 min-w-[60px]">Output:</span>
                                <span className="text-gray-300">{example.output}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Constraints */}
                  {parseConstraints(selectedProblem).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-white mb-2">Constraints</h3>
                      <ul className="space-y-1">
                        {parseConstraints(selectedProblem).map((constraint, idx) => (
                          <li key={idx} className="text-xs text-gray-400 flex gap-2">
                            <span className="text-gray-500">ΓÇó</span>
                            <span className="font-mono">{constraint}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Hints */}
                  {selectedProblem.hints && (
                    <div>
                      <button
                        onClick={() => setShowHints(!showHints)}
                        className="text-sm font-semibold text-white mb-2 flex items-center gap-2"
                      >
                        <svg className={`w-4 h-4 transition-transform ${showHints ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        Hint{selectedProblem.hints.includes('|') ? 's' : ''}
                      </button>
                      {showHints && (
                        <div className="space-y-2">
                          {selectedProblem.hints.split('|').map((hint, idx) => (
                            <div key={idx} className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                              <span className="text-xs text-yellow-400 font-medium">Hint {idx + 1}</span>
                              <p className="text-sm text-gray-300 mt-1">{hint.trim()}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Schema Viewer */}
                  {selectedProblem.schema?.tables && Array.isArray(selectedProblem.schema.tables) && typeof selectedProblem.schema.tables[0] === 'object' && (
                    <div>
                      <h3 className="text-sm font-semibold text-white mb-2 mt-4">Database Schema</h3>
                      <div className="space-y-3">
                        {(selectedProblem.schema.tables as DatabaseTable[]).map((table, ti) => (
                          <div key={ti} className="bg-white/5 rounded-lg p-3 border border-white/10">
                            <div className="text-xs font-bold text-[var(--accent-yellow)] uppercase tracking-wider mb-2">
                              {table.name}
                            </div>
                            <div className="space-y-1">
                              {table.columns?.map((col, ci) => (
                                <div key={ci} className="flex items-center gap-2 text-xs">
                                  <span className="text-white font-medium">{col.name}</span>
                                  <span className="text-gray-500">{col.type}</span>
                                  {col.constraints && (
                                    <span className="text-gray-600 italic">{col.constraints}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                            {table.sampleData && table.sampleData.length > 0 && (
                              <div className="mt-2 text-[10px] text-gray-500">
                                {table.sampleData.length} sample rows
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : playMode === "problem" ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm mb-4">No problem selected</p>
                  <button
                    onClick={() => setShowProblems(true)}
                    className="px-4 py-2 bg-[var(--accent-blue)] text-white rounded-lg text-sm hover:opacity-90 transition-opacity"
                  >
                    Select Problem
                  </button>
                </div>
              ) : null}
            </div>

            {/* Left Resize Handle */}
            <div
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-transparent hover:bg-[var(--accent-blue)] transition-colors z-20 group"
              onMouseDown={startResizeLeft}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-12 bg-white/20 rounded-full group-hover:bg-[var(--accent-blue)] transition-colors" />
            </div>
          </div>
        )}

        {/* Right Panel - Editor and Output */}
        <div ref={rightPanelRef} className="flex-1 flex flex-col min-w-0">
          {/* Toolbar */}
          <div className="flex items-start gap-2 p-2 bg-[var(--bg-card)] border-b border-white/10 flex-shrink-0 flex-wrap">
            {/* Toggle problem panel */}
            {playMode !== "free" && !showLeftPanel && (
              <button
                onClick={() => setShowLeftPanel(true)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all shrink-0"
                title="Show problem"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* End Contest Button */}
            {contestId && (
              <button
                onClick={async () => {
                  const ok = window.confirm('Are you sure you want to end the contest and exit?');
                  if (ok) {
                    if (document.fullscreenElement) {
                      document.exitFullscreen().catch(e => console.error(e));
                    }
                    navigate('/contests');
                  }
                }}
                className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold rounded-lg transition-all text-sm shrink-0"
                title="End Contest"
              >
                End Contest
              </button>
            )}

            {/* Free Mode / Problems toggle + Settings */}
            <div className="flex items-center gap-2">
              {!contestId && (
                <>
                  <button
                    onClick={() => {
                      setPlayMode("free");
                      setSqlCode(DEFAULT_CODE.sql);
                      setSqlFreeSchema(SQL_FREE_SCHEMA);
                      setSqlResult(null);
                      setSqlTestResults(null);
                      setSqlTestSummary(null);
                      setSelectedProblem(null);
                      window.history.pushState({}, '', '/playground/sql');
                    }}
                    className={`px-3 py-1.5 text-sm rounded-md transition-all ${playMode === "free" ? "bg-green-500 text-white" : "text-gray-400 hover:text-white"
                      }`}
                  >
                    Free Mode
                  </button>
                  <button
                    onClick={() => {
                      setPlayMode("problem");
                      setSqlCode(DEFAULT_CODE.sql);
                      setSqlResult(null);
                      setSqlTestResults(null);
                      setSqlTestSummary(null);
                    }}
                    className={`px-3 py-1.5 text-sm rounded-md transition-all ${playMode === "problem" ? "bg-[var(--accent-blue)] text-white" : "text-gray-400 hover:text-white"
                      }`}
                  >
                    Problems
                  </button>
                </>
              )}

              {/* Settings button */}
              <div className="relative" ref={settingsRef}>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                  title="Editor Settings"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                {showSettings && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-[var(--bg-card)] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/10 bg-white/5">
                      <span className="text-sm font-semibold text-white">Editor Settings</span>
                    </div>
                    <div className="py-2">
                      <div className="px-4 py-3 hover:bg-white/5 transition-colors">
                        <label className="text-xs text-gray-400 uppercase tracking-wider font-medium">Font Size</label>
                        <select
                          value={editorFontSize}
                          onChange={(e) => setEditorFontSize(Number(e.target.value))}
                          className="w-full mt-2 px-3 py-2 bg-[var(--bg-primary)] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[var(--accent-blue)]"
                        >
                          <option value={12} className="bg-[var(--bg-card)] text-white">12px</option>
                          <option value={14} className="bg-[var(--bg-card)] text-white">14px</option>
                          <option value={16} className="bg-[var(--bg-card)] text-white">16px</option>
                          <option value={18} className="bg-[var(--bg-card)] text-white">18px</option>
                          <option value={20} className="bg-[var(--bg-card)] text-white">20px</option>
                        </select>
                      </div>
                      <div className="px-4 py-3 hover:bg-white/5 transition-colors">
                        <label className="text-xs text-gray-400 uppercase tracking-wider font-medium">Tab Size</label>
                        <select
                          value={editorTabSize}
                          onChange={(e) => setEditorTabSize(Number(e.target.value))}
                          className="w-full mt-2 px-3 py-2 bg-[var(--bg-primary)] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[var(--accent-blue)]"
                        >
                          <option value={2} className="bg-[var(--bg-card)] text-white">2 spaces</option>
                          <option value={4} className="bg-[var(--bg-card)] text-white">4 spaces</option>
                        </select>
                      </div>
                      <div className="px-4 py-3 hover:bg-white/5 transition-colors">
                        <label className="flex items-center justify-between cursor-pointer">
                          <span className="text-xs text-gray-300 font-medium">Word Wrap</span>
                          <input
                            type="checkbox"
                            checked={editorWordWrap}
                            onChange={(e) => setEditorWordWrap(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-500 bg-[var(--bg-primary)] accent-[var(--accent-blue)]"
                          />
                        </label>
                      </div>
                      <div className="px-4 py-3 hover:bg-white/5 transition-colors border-t border-white/10">
                        <label className="flex items-center justify-between cursor-pointer">
                          <span className="text-xs text-gray-300 font-medium">Show Minimap</span>
                          <input
                            type="checkbox"
                            checked={editorMinimap}
                            onChange={(e) => setEditorMinimap(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-500 bg-[var(--bg-primary)] accent-[var(--accent-blue)]"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* SQL mode action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSqlCode(DEFAULT_CODE.sql);
                  setSqlResult(null);
                }}
                className="px-3 py-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all text-sm"
              >
                Reset
              </button>
              <button
                onClick={runSqlCode}
                disabled={isRunning}
                className="px-4 py-1.5 bg-[var(--accent-green)] hover:bg-green-500 text-black font-bold rounded-lg transition-all flex items-center gap-2 text-sm disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {isRunning ? "Running..." : "Run"}
              </button>
              {contestId && (
                <button
                  onClick={async () => {
                    if (!selectedProblem) return;
                    setIsSubmitting(true);
                    setSubmitStatus('running');
                    setShowOutput(true);
                    setBottomPanelHeight(35);
                    try {
                      const res = await api.submitContestCode(contestId!, {
                        problemId: selectedProblem.id,
                        code: sqlCode,
                        language: "sql"
                      });

                      if (res.passed) {
                        setSubmitStatus('success');
                        setContestSubmitToast({
                          status: 'success',
                          message: 'All test cases passed!'
                        });
                        setTimeout(() => setContestSubmitToast(null), 3000);
                        setPendingLockProblem({
                          id: selectedProblem.id,
                          title: selectedProblem.title,
                          score: res.currentScore ?? 0
                        });
                        setShowFinalLockModal(true);
                      } else {
                        setSubmitStatus('error');
                        setContestSubmitToast({
                          status: 'error',
                          message: `Wrong Answer: ${res.passedTests}/${res.totalTests} test cases passed. Keep trying!`
                        });
                        setTimeout(() => setContestSubmitToast(null), 5000);
                      }
                    } catch (err) {
                      console.error("SQL submission error:", err);
                      setSubmitStatus('error');
                      setContestSubmitToast({ status: 'error', message: 'Γ¥î Submission error. Please try again.' });
                      setTimeout(() => setContestSubmitToast(null), 5000);
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={isRunning || isSubmitting}
                  className="px-4 py-1.5 bg-[var(--accent-blue)] hover:bg-blue-500 text-white font-bold rounded-lg transition-all flex items-center gap-2 text-sm disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {isSubmitting ? "Submitting..." : "Submit"}
                </button>
              )}
              {selectedProblem && (
                <span className={`text-xs px-2 py-1 rounded ${isSaved ? 'text-green-400 bg-green-500/10' : 'text-yellow-400 bg-yellow-500/10'}`}>
                  {isSaved ? 'Saved' : 'Saving...'}
                </span>
              )}
            </div>
          </div>

          {/* Editor */}
          <div
            className="min-h-0 transition-all duration-75"
            style={{ flex: showOutput ? `1 1 ${100 - bottomPanelHeight}%` : '1 1 100%' }}
          >
            <Editor
              key="sql-contest-editor"
              height="100%"
              language="sql"
              defaultValue={sqlCode}
              onChange={(value) => setSqlCode(value || "")}
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
              }}
            />
          </div>

          {/* Output Panel */}
          {showOutput && (
            <div
              ref={outputPanelRef}
              className="bg-[var(--bg-card)] border-t border-white/10 flex flex-col flex-shrink-0 relative"
              style={{ flex: `0 0 ${bottomPanelHeight}%`, minHeight: "120px" }}
            >
              {/* Bottom Resize Handle */}
              <div
                className="absolute left-0 right-0 -top-2 h-3 cursor-row-resize bg-transparent hover:bg-white/10 transition-colors z-20 group flex items-center justify-center"
                onMouseDown={startResizeBottom}
              >
                <div className="w-16 h-1 rounded-full bg-white/20 group-hover:bg-[var(--accent-blue)] transition-colors" />
              </div>

              {/* Output Header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 flex-shrink-0 mt-1">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {runStatus === 'running' && (
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 animate-spin text-yellow-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span className="text-sm text-yellow-400 font-medium">Running...</span>
                      </div>
                    )}
                    {runStatus === 'success' && (
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm text-green-400 font-medium">Ran Successfully</span>
                        {sqlTestResults && sqlTestSummary ? (
                          <span className={`ml-2 text-xs px-2 py-0.5 rounded font-bold ${sqlTestSummary.failed === 0
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                            }`}>
                            {sqlTestSummary.passed}/{sqlTestSummary.total} passed
                          </span>
                        ) : sqlTestResult ? (
                          <span className={`ml-2 text-xs px-2 py-0.5 rounded font-bold ${sqlTestResult.passed
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                            }`}>
                            {sqlTestResult.passed ? 'PASSED' : 'FAILED'}
                          </span>
                        ) : null}
                      </div>
                    )}
                    {runStatus === 'error' && (
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="text-sm text-red-400 font-medium">Error</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setActiveSqlTab("results")}
                    className={`px-3 py-1 text-sm font-medium transition-all ${activeSqlTab === "results"
                        ? "text-white border-b-2 border-[var(--accent-green)]"
                        : "text-gray-400 hover:text-white"
                      }`}
                  >
                    Results
                    {sqlResult && !sqlResult.error && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                        {sqlResult.rowCount} rows
                      </span>
                    )}
                  </button>
                  {sqlTestResults && (
                    <button
                      onClick={() => setActiveSqlTab("tests")}
                      className={`px-3 py-1 text-sm font-medium transition-all ${activeSqlTab === "tests"
                          ? "text-white border-b-2 border-[var(--accent-green)]"
                          : "text-gray-400 hover:text-white"
                        }`}
                    >
                      Tests
                      {sqlTestSummary && (
                        <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${sqlTestSummary.failed === 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                          {sqlTestSummary.passed}/{sqlTestSummary.total}
                        </span>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => setActiveSqlTab("schema")}
                    className={`px-3 py-1 text-sm font-medium transition-all ${activeSqlTab === "schema"
                        ? "text-white border-b-2 border-[var(--accent-green)]"
                        : "text-gray-400 hover:text-white"
                      }`}
                  >
                    Schema
                  </button>
                  <button
                    onClick={() => setActiveSqlTab("messages")}
                    className={`px-3 py-1 text-sm font-medium transition-all ${activeSqlTab === "messages"
                        ? "text-white border-b-2 border-[var(--accent-green)]"
                        : "text-gray-400 hover:text-white"
                      }`}
                  >
                    Messages
                    {sqlResult?.error && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Error</span>
                    )}
                  </button>
                </div>
                <button
                  onClick={() => {
                    setShowOutput(false);
                    setRunStatus('idle');
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Output Content */}
              <div className="flex-1 overflow-auto p-4">
                {activeSqlTab === "results" && sqlResult && (
                  <div className="space-y-3">
                    {sqlResult.error ? (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <pre className="text-sm text-red-400 font-mono whitespace-pre-wrap">{sqlResult.error}</pre>
                      </div>
                    ) : sqlResult.columns.length === 0 ? (
                      <div className="text-gray-500 text-sm text-center py-8">Query executed successfully. No rows returned.</div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-white/10">
                                {sqlResult.columns.map((col, _i) => (
                                  <th key={col} className="px-4 py-2 text-xs font-bold text-[var(--accent-yellow)] uppercase tracking-wider whitespace-nowrap bg-white/5">
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {sqlResult.rows.map((row, ri) => (
                                <tr key={ri} className="hover:bg-white/5 transition-colors">
                                  {sqlResult.columns.map((col, ci) => (
                                    <td key={ci} className="px-4 py-2 text-sm text-gray-300 font-mono whitespace-nowrap">
                                      {row[col] ?? <span className="text-gray-600 italic">NULL</span>}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {sqlResult.executionTime !== undefined && (
                            <div className="mt-2 text-xs text-gray-500">
                              {sqlResult.rowCount} row{sqlResult.rowCount !== 1 ? 's' : ''} returned in {sqlResult.executionTime}ms
                            </div>
                          )}
                        </div>
                        {sqlTestResults && sqlTestSummary && (
                          <div className="space-y-2 pt-3 border-t border-white/10">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-sm font-semibold text-white">Test Cases</span>
                              <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">
                                {sqlTestSummary.passed}/{sqlTestSummary.total} passed
                              </span>
                              {sqlTestSummary.failed > 0 && (
                                <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                                  {sqlTestSummary.failed} failed
                                </span>
                              )}
                            </div>
                            {sqlTestResults.map((tr: any, idx: number) => (
                              <div key={idx} className={`p-3 rounded-lg border ${tr.passed ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'
                                }`}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`text-xs font-bold ${tr.passed ? 'text-green-400' : 'text-red-400'}`}>
                                    {tr.passed ? 'PASSED' : 'FAILED'} ΓÇö Case {idx + 1}
                                  </span>
                                  {tr.executionTime && (
                                    <span className="text-[10px] text-gray-500">{tr.executionTime}ms</span>
                                  )}
                                </div>
                                {tr.input ? (
                                  <div className="text-xs text-gray-500 font-mono mb-1">Input: {tr.input}</div>
                                ) : null}
                                <div className="space-y-1 text-xs font-mono mt-1">
                                  {tr.expectedOutput !== undefined && (
                                    <div className="flex gap-2">
                                      <span className="text-gray-400 min-w-[70px] shrink-0">Expected:</span>
                                      <pre className={`whitespace-pre-wrap flex-1 ${tr.passed ? 'text-gray-300' : 'text-red-300'}`}>{tr.expectedOutput || '(empty)'}</pre>
                                    </div>
                                  )}
                                  <div className="flex gap-2">
                                    <span className="text-gray-400 min-w-[70px] shrink-0">Actual:</span>
                                    <pre className={`whitespace-pre-wrap flex-1 ${tr.passed ? 'text-gray-300' : 'text-yellow-300'}`}>{tr.actualOutput || '(empty)'}</pre>
                                  </div>
                                  {tr.error && (
                                    <div className="text-red-400 mt-1">{tr.error}</div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {!sqlTestResults && sqlTestResult && (
                          <div className={`p-3 rounded-lg border ${sqlTestResult.passed
                              ? 'bg-green-500/10 border-green-500/20'
                              : 'bg-red-500/10 border-red-500/20'
                            }`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-sm font-bold ${sqlTestResult.passed ? 'text-green-400' : 'text-red-400'
                                }`}>
                                {sqlTestResult.passed ? 'Test Passed' : 'Test Failed'}
                              </span>
                            </div>
                            <div className="space-y-1 text-xs font-mono">
                              <div className="flex gap-2">
                                <span className="text-gray-400 min-w-[80px] shrink-0">Expected:</span>
                                <pre className={`whitespace-pre-wrap flex-1 ${sqlTestResult.passed ? 'text-gray-300' : 'text-red-300'}`}>{sqlTestResult.expectedOutput}</pre>
                              </div>
                              <div className="flex gap-2">
                                <span className="text-gray-400 min-w-[80px] shrink-0">Actual:</span>
                                <pre className={`whitespace-pre-wrap flex-1 ${sqlTestResult.passed ? 'text-gray-300' : 'text-yellow-300'}`}>{sqlTestResult.actualOutput}</pre>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {activeSqlTab === "tests" && sqlTestResults && sqlTestSummary && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-sm font-semibold text-white">Test Results</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">
                        {sqlTestSummary.passed}/{sqlTestSummary.total} passed
                      </span>
                      {sqlTestSummary.failed > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                          {sqlTestSummary.failed} failed
                        </span>
                      )}
                    </div>
                    {sqlTestResults.map((tr: any, idx: number) => (
                      <div key={idx} className={`p-3 rounded-lg border ${tr.passed ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'
                        }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-bold ${tr.passed ? 'text-green-400' : 'text-red-400'}`}>
                            {tr.passed ? 'PASSED' : 'FAILED'} ΓÇö Test Case {idx + 1}
                          </span>
                          {tr.executionTime && (
                            <span className="text-[10px] text-gray-500">{tr.executionTime}ms</span>
                          )}
                        </div>
                        {tr.input ? (
                          <div className="text-xs text-gray-500 font-mono mb-1">Input: {tr.input}</div>
                        ) : null}
                        <div className="space-y-1 text-xs font-mono mt-1">
                          {tr.expectedOutput !== undefined && (
                            <div className="flex gap-2">
                              <span className="text-gray-400 min-w-[70px] shrink-0">Expected:</span>
                              <pre className={`whitespace-pre-wrap flex-1 ${tr.passed ? 'text-gray-300' : 'text-red-300'}`}>{tr.expectedOutput || '(empty)'}</pre>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <span className="text-gray-400 min-w-[70px] shrink-0">Actual:</span>
                            <pre className={`whitespace-pre-wrap flex-1 ${tr.passed ? 'text-gray-300' : 'text-yellow-300'}`}>{tr.actualOutput || '(empty)'}</pre>
                          </div>
                          {tr.error && (
                            <div className="text-red-400 mt-1">{tr.error}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {activeSqlTab === "schema" && (
                  <div className="space-y-3">
                    {playMode === "free" ? (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-white">Current Schema</h4>
                          <button
                            onClick={() => setSqlFreeSchema(SQL_FREE_SCHEMA)}
                            className="text-xs text-gray-400 hover:text-white underline"
                          >
                            Reset to default
                          </button>
                        </div>
                        <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap bg-white/[0.02] p-3 rounded-lg border border-white/10">
                          {sqlFreeSchema}
                        </pre>
                      </div>
                    ) : selectedProblem?.schema?.tables ? (
                      <div className="space-y-3">
                        {selectedProblem.schema.tables.map((table, ti) => (
                          <div key={ti} className="bg-white/5 rounded-lg p-3 border border-white/10">
                            <div className="text-xs font-bold text-[var(--accent-yellow)] uppercase tracking-wider mb-2">{table.name}</div>
                            <div className="space-y-1">
                              {table.columns.map((col, ci) => (
                                <div key={ci} className="flex items-center gap-2 text-xs">
                                  <span className="text-white font-medium">{col.name}</span>
                                  <span className="text-gray-500">{col.type}</span>
                                  {col.constraints && <span className="text-gray-600 italic">{col.constraints}</span>}
                                </div>
                              ))}
                            </div>
                            {table.sampleData && table.sampleData.length > 0 && (
                              <div className="mt-2 text-[10px] text-gray-500">{table.sampleData.length} sample rows</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-500 text-sm text-center py-8">No schema available</div>
                    )}
                  </div>
                )}

                {activeSqlTab === "messages" && (
                  <div className="space-y-3">
                    {!sqlResult ? (
                      <div className="text-gray-500 text-sm text-center py-8">Run your SQL query to see results...</div>
                    ) : sqlResult.error ? (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <pre className="text-sm text-red-400 font-mono whitespace-pre-wrap">{sqlResult.error}</pre>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm text-green-400 font-medium">
                          Query executed successfully ΓÇö {sqlResult.rowCount} row{sqlResult.rowCount !== 1 ? 's' : ''} returned
                          {sqlResult.executionTime !== undefined ? ` in ${sqlResult.executionTime}ms` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Keyboard Shortcuts */}
              <div className="px-4 py-2 border-t border-white/10 text-xs text-gray-500 flex gap-4 flex-shrink-0">
                <span><kbd className="px-1 py-0.5 bg-white/10 rounded">Ctrl</kbd> + <kbd className="px-1 py-0.5 bg-white/10 rounded">'</kbd> Run</span>
                <span><kbd className="px-1 py-0.5 bg-white/10 rounded">Ctrl</kbd> + <kbd className="px-1 py-0.5 bg-white/10 rounded">Shift</kbd> + <kbd className="px-1 py-0.5 bg-white/10 rounded">Enter</kbd> Submit</span>
              </div>
            </div>
          )}
        </div>

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

        {/* Contest submission toast */}
        {contestSubmitToast && (
          <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-xl shadow-2xl border flex items-center gap-3 text-sm font-semibold ${contestSubmitToast.status === 'success'
              ? 'bg-green-500/20 border-green-500 text-green-300'
              : 'bg-red-500/20 border-red-500 text-red-300'
            }`}>
            {contestSubmitToast.status === 'success' ? (
              <svg className="w-5 h-5 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {contestSubmitToast.message}
            <button onClick={() => setContestSubmitToast(null)} className="ml-2 text-gray-400 hover:text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>{/* end inner flex row */}
    </div>
  );

  if (contestId && contestFlags && !embeddedInContest) {
    return (
      <SecureContestWrapper contestId={contestId} flags={contestFlags}>
        {playgroundLayout}

        {/* Final Lock Confirmation Modal */}
        {showFinalLockModal && pendingLockProblem && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl space-y-4">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 mx-auto bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-black text-white">Problem Solved!</h3>
                <p className="text-sm text-gray-400">
                  Do you want to <span className="text-amber-400 font-bold">final lock</span> <span className="text-white font-bold">"{pendingLockProblem.title}"</span>?
                </p>
                <p className="text-xs text-gray-500">Once locked, you cannot edit this problem again.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowFinalLockModal(false);
                    setPendingLockProblem(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-bold rounded-xl border border-white/10 transition-all"
                >
                  Keep Editing
                </button>
                <button
                  onClick={() => {
                    if (!pendingLockProblem || !contestId) return;
                    const newSolved = new Set([...solvedProblems, pendingLockProblem.id]);
                    setSolvedProblems(newSolved);
                    sessionStorage.setItem(`solvedProblems_${contestId}`, JSON.stringify([...newSolved]));
                    const newLocked = new Set([...lockedProblems, pendingLockProblem.id]);
                    setLockedProblems(newLocked);
                    sessionStorage.setItem(`lockedProblems_${contestId}`, JSON.stringify([...newLocked]));
                    setShowFinalLockModal(false);
                    setPendingLockProblem(null);
                    navigate(`/contests/${contestId}`);
                  }}
                  className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Lock &amp; Go Back
                </button>
              </div>
            </div>
          </div>
        )}
      </SecureContestWrapper>
    );
  }

  return playgroundLayout;
}
