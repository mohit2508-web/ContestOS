import Editor from "@monaco-editor/react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { api } from "../services/api";
import { DEFAULT_CODE, LANGUAGE_CONFIG } from "./playground/constants";
import { formatInputDisplay, getOrGenerateStarterCode } from "./playground/helpers";
import { ProblemsModal } from "./playground/ProblemsModal";
import MarkdownRenderer from "../components/MarkdownRenderer";
import type { TestCase, TestResult, Submission, Problem } from "./playground/types";
import { useSidebar } from '../contexts/SidebarContext';
import { useNotify } from '../components/notifications';
import { SecureContestWrapper } from '../components/SecureContestWrapper';
import { ProgressRing } from '../components/ProgressRing';

export function CodePlaygroundPage({ embeddedInContest }: { embeddedInContest?: boolean } = {}) {
  const notify = useNotify();
  const navigate = useNavigate();
  const { setSidebarHidden } = useSidebar();
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
  const [contestSubmitToast, setContestSubmitToast] = useState<{ status: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [contestProblems, setContestProblems] = useState<Array<{ order: number; points: number; problem: { id: string; title: string; difficulty: string; problemType?: string } }>>([]);
  const [solvedProblems, setSolvedProblems] = useState<Set<string>>(new Set());
  const [contestScore, setContestScore] = useState(0);
  const autoNavigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingProblemIdRef = useRef<string | null>(null);

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
          // Store the contest problems (only coding type for this playground)
          if (res.contest?.problems) {
            const codeProblems = res.contest.problems.filter((cp: any) =>
              !cp.problem.problemType || cp.problem.problemType === 'code'
            );
            setContestProblems(codeProblems);
          }

          // Load solved problems from backend participant or fallback to sessionStorage
          let solvedIds: string[] = [];
          if (res.participant?.solvedProblems) {
            solvedIds = res.participant.solvedProblems;
          } else {
            const savedSolved = sessionStorage.getItem(`solvedProblems_${cid}`);
            if (savedSolved) {
              try {
                solvedIds = JSON.parse(savedSolved) as string[];
              } catch (e) { /* ignore parse errors */ }
            }
          }
          if (solvedIds.length > 0) {
            setSolvedProblems(new Set(solvedIds));
            sessionStorage.setItem(`solvedProblems_${cid}`, JSON.stringify(solvedIds));
          }

          // Load score from sessionStorage
          const savedScore = sessionStorage.getItem(`contestScore_${cid}`);
          if (savedScore) {
            setContestScore(parseInt(savedScore, 10) || 0);
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

  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('code_playground_language');
    return saved || "java";
  });
  const [code, setCode] = useState(() => {
    const savedLang = localStorage.getItem('code_playground_language') || "java";
    return DEFAULT_CODE[savedLang] || DEFAULT_CODE.java;
  });

  useEffect(() => {
    localStorage.setItem('code_playground_language', language);
  }, [language]);

  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [customInput, setCustomInput] = useState("");

  const [testCases, setTestCases] = useState<TestCase[]>([
    { input: "", expectedOutput: "" }
  ]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testSummary, setTestSummary] = useState<{ passed: number; failed: number; total: number } | null>(null);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'running' | 'success' | 'partial' | 'error'>('idle');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [submissionTags, setSubmissionTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [customOutput, setCustomOutput] = useState("");

  const [lintErrors, setLintErrors] = useState<any[]>([]);
  const [isLinting, setIsLinting] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);

  const [problems, setProblems] = useState<Problem[]>([]);
  const [totalProblems, setTotalProblems] = useState(0);
  const [problemSearchQuery, setProblemSearchQuery] = useState("");
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [showProblems, setShowProblems] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [isLoadingProblems, setIsLoadingProblems] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [editorFontSize, setEditorFontSize] = useState(() => {
    const saved = localStorage.getItem('code_playground_fontSize');
    return saved ? parseInt(saved) : 14;
  });
  const [editorTabSize, setEditorTabSize] = useState(() => {
    const saved = localStorage.getItem('code_playground_tabSize');
    return saved ? parseInt(saved) : 4;
  });
  const [editorWordWrap, setEditorWordWrap] = useState(() => {
    const saved = localStorage.getItem('code_playground_wordWrap');
    return saved === 'true';
  });
  const [editorMinimap, setEditorMinimap] = useState(() => {
    const saved = localStorage.getItem('code_playground_minimap');
    return saved !== 'false';
  });

  const [activeTab, setActiveTab] = useState<"output" | "tests" | "custom" | "submissions" | "editorial">("tests");
  const [leftTab, setLeftTab] = useState<"description" | "problems" | "submissions">("description");
  const [problemSearch, setProblemSearch] = useState("");
  const [streak, setStreak] = useState<number>(0);


  // Fetch streak on mount
  useEffect(() => {
    const fetchStreak = async () => {
      try {
        const res = await api.get("/user/streak");
        setStreak(res.currentStreak ?? 0);
      } catch {
        setStreak(0);
      }
    };
    fetchStreak();
  }, []);

  useEffect(() => {
    if (leftTab === "submissions" && selectedProblem?.id) {
      fetchSubmissions();
    }
  }, [leftTab, selectedProblem?.id]);

  const formatRelativeTime = (isoString: string): string => {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  };

  const loadSubmissionCode = (submissionCode: string) => {
    setCode(submissionCode);
    setEditorValue(submissionCode);
  };

  const [languageAvailability, setLanguageAvailability] = useState<Record<string, boolean>>({});
  const [backendLanguageIds, setBackendLanguageIds] = useState<Set<string>>(new Set());
  const [problemStatuses, setProblemStatuses] = useState<Record<string, 'solved' | 'attempted' | 'none'>>({});

  const solvedIds = new Set(
    Object.entries(problemStatuses)
      .filter(([_, status]) => status === "solved")
      .map(([id]) => id)
  );

  const stats = {
    total: problems.length,
    solved: solvedIds.size,
    easy: {
      solved: problems.filter(p => p.difficulty === "Easy" && solvedIds.has(p.id)).length,
      total: problems.filter(p => p.difficulty === "Easy").length,
    },
    medium: {
      solved: problems.filter(p => p.difficulty === "Medium" && solvedIds.has(p.id)).length,
      total: problems.filter(p => p.difficulty === "Medium").length,
    },
    hard: {
      solved: problems.filter(p => p.difficulty === "Hard" && solvedIds.has(p.id)).length,
      total: problems.filter(p => p.difficulty === "Hard").length,
    },
  };

  const overallPercent = stats.total > 0
    ? Math.round((stats.solved / stats.total) * 100)
    : 0;

  const filteredProblems = problems.filter(p =>
    p.title.toLowerCase().includes(problemSearch.toLowerCase())
  );
  const [_showLanguageWarning, setShowLanguageWarning] = useState(false);
  const [_languageWarningMsg, setLanguageWarningMsg] = useState("");
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const editorDisposersRef = useRef<(() => void)[]>([]);
  const isProgrammaticUpdateRef = useRef(false);
  const shouldFoldRef = useRef(true);

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

  const isCodeValidForLang = (codeStr: string, l: string): boolean => {
    if (!codeStr || !codeStr.trim()) return false;
    if (l === 'java' || l === 'cpp' || l === 'c' || l === 'javascript') {
      if (codeStr.includes('def ') && !codeStr.includes('{')) return false;
    }
    if (l === 'python') {
      if (codeStr.includes('public class') || codeStr.includes('class Solution {')) return false;
    }
    return true;
  };

  const modelsRef = useRef<Map<string, any>>(new Map());
  const getOrCreateModel = (problemId: string, codeVal: string, langVal: string) => {
    if (!monacoRef.current) return null;
    const modelKey = `${problemId}_${langVal}`;
    let ext = 'py';
    if (langVal === 'java') ext = 'java';
    else if (langVal === 'cpp') ext = 'cpp';
    else if (langVal === 'c') ext = 'c';
    else if (langVal === 'javascript') ext = 'js';
    else if (langVal === 'sql') ext = 'sql';
    else if (langVal === 'html') ext = 'html';
    else if (langVal === 'css') ext = 'css';
    
    const uri = monacoRef.current.Uri.parse(`file:///${problemId}_${langVal}.${ext}`);
    let model = monacoRef.current.editor.getModel(uri);
    if (!model) {
      model = monacoRef.current.editor.createModel(codeVal, langVal, uri);
    }
    modelsRef.current.set(modelKey, model);

    const currentVal = model.getValue();
    if ((!isCodeValidForLang(currentVal, langVal) || currentVal.trim() === "") && codeVal && isCodeValidForLang(codeVal, langVal)) {
      isProgrammaticUpdateRef.current = true;
      try {
        model.setValue(codeVal);
      } finally {
        isProgrammaticUpdateRef.current = false;
      }
    }

    return model;
  };

  useEffect(() => {
    if (editorRef.current && monacoRef.current && selectedProblem) {
      const model = getOrCreateModel(selectedProblem.id, code, language);
      if (model) {
        editorRef.current.setModel(model);
      }
    }
  }, [selectedProblem?.id, language]);

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

  const lastCodeRef = useRef<string>("");
  const settingsRef2 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      editorDisposersRef.current.forEach(dispose => dispose());
      editorDisposersRef.current = [];
      if (monacoRef.current) {
        monacoRef.current.editor.getModels().forEach((m: any) => m.dispose());
      }
      editorRef.current = null;
      monacoRef.current = null;
    };
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchAllProblems("code");
      loadLanguageAvailability();
      loadProblemStatuses();
    };
    init();
    setCode(DEFAULT_CODE[language] || DEFAULT_CODE.java);
    setOutput("");
    setTestResults([]);
    setTestSummary(null);
    setRunStatus('idle');
    setSubmitStatus('idle');
    setShowOutput(false);
  }, []);

  const selectProblem = async (problem: Problem) => {
    const problemId = problem.id;
    loadingProblemIdRef.current = problemId;
    setSelectedProblem(problem);
    localStorage.setItem('code_playground_selected_problem', problemId);
    setRunStatus('idle');
    setSubmitStatus('idle');

    // Clear previous code and outputs immediately for instant UI synchronization
    setCode("");
    lastCodeRef.current = "";
    if (editorRef.current) {
      setEditorValue("");
    }
    setOutput("");
    setTestResults([]);
    setTestSummary(null);

    const params = new URLSearchParams(window.location.search);
    params.set('problem', problemId);
    params.set('language', language);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newUrl);

    const savedKey = contestId ? `code_playground_${contestId}_${problemId}_${language}` : `code_playground_${problemId}_${language}`;
    const savedCode = localStorage.getItem(savedKey);
    let validSavedCode: string | null = null;
    if (savedCode) {
      const isGenericDefault = (savedCode.trim() === (DEFAULT_CODE[language] || "").trim()) ||
                               (savedCode.trim() === (DEFAULT_CODE.java || "").trim()) ||
                               (savedCode.includes("class Solution") && savedCode.includes("public void solve()")) ||
                               (savedCode.includes("def solve(") && savedCode.includes("Write your solution here"));
      if (isCodeValidForLang(savedCode, language) && !isGenericDefault) {
        validSavedCode = savedCode;
      } else {
        localStorage.removeItem(savedKey);
      }
    }

    let starterCodeForLang = getOrGenerateStarterCode(problem, language);

    if (!starterCodeForLang && problemId) {
      try {
        const res = await api.getProblem(problemId);
        if (loadingProblemIdRef.current !== problemId) return;
        const problemData = res.problem || res;
        starterCodeForLang = getOrGenerateStarterCode(problemData, language);
      } catch {
        starterCodeForLang = getOrGenerateStarterCode(problem, language);
      }
    }

    if (loadingProblemIdRef.current !== problemId) return;

    const codeToSet = validSavedCode || starterCodeForLang || DEFAULT_CODE[language] || "";
    setCode(codeToSet);
    lastCodeRef.current = codeToSet;

    if (monacoRef.current) {
      const model = getOrCreateModel(problemId, codeToSet, language);
      if (model) {
        isProgrammaticUpdateRef.current = true;
        try {
          model.setValue(codeToSet);
        } finally {
          isProgrammaticUpdateRef.current = false;
        }
        if (editorRef.current) {
          editorRef.current.setModel(model);
        }
      }
    } else if (editorRef.current) {
      setEditorValue(codeToSet);
    }

    setTestCases(problem.testCases || [{ input: "", expectedOutput: "" }]);
    setOutput("");
    setTestResults([]);
    setTestSummary(null);
    setShowProblems(false);
    setIsSaved(true);

    if (problemId) {
      fetchSubmissions();
    }
  };

  const hasLoadedInitialProblemRef = useRef(false);

  useEffect(() => {
    if (hasLoadedInitialProblemRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const problemId = params.get('problem');
    const urlLanguage = params.get('language');
    const cid = params.get('contestId');
    const savedProblemId = localStorage.getItem('code_playground_selected_problem');

    if (urlLanguage) {
      setLanguage(urlLanguage);
    }

    const targetProblemId = problemId || (cid && contestProblems.length > 0 ? contestProblems[0].problem?.id : savedProblemId);

    if (targetProblemId) {
      hasLoadedInitialProblemRef.current = true;
      // Fetch complete problem details from backend
      const fetchTargetProblem = async () => {
        try {
          const res = await api.getProblem(targetProblemId);
          const prob = res.problem || res;
          if (prob && prob.id && prob.title) {
            setProblems(prev => {
              if (prev.some(p => p.id === prob.id)) {
                return prev.map(p => p.id === prob.id ? prob : p);
              }
              return [prob, ...prev];
            });
            selectProblem(prob);
          } else {
            const fallback = problems.find(p => p.id === targetProblemId) ||
              contestProblems.find(cp => cp.problem?.id === targetProblemId)?.problem as any;
            if (fallback) selectProblem(fallback);
          }
        } catch (err) {
          console.error("Failed to fetch target problem:", err);
          const fallback = problems.find(p => p.id === targetProblemId) ||
            contestProblems.find(cp => cp.problem?.id === targetProblemId)?.problem as any;
          if (fallback) selectProblem(fallback);
        }
      };
      fetchTargetProblem();
    } else if (!selectedProblem && problems.length > 0) {
      hasLoadedInitialProblemRef.current = true;
      selectProblem(problems[0]);
    }
  }, [contestProblems]);

  useEffect(() => {
    localStorage.setItem('code_playground_fontSize', editorFontSize.toString());
  }, [editorFontSize]);

  useEffect(() => {
    localStorage.setItem('code_playground_tabSize', editorTabSize.toString());
  }, [editorTabSize]);

  useEffect(() => {
    localStorage.setItem('code_playground_wordWrap', editorWordWrap.toString());
  }, [editorWordWrap]);

  useEffect(() => {
    localStorage.setItem('code_playground_minimap', editorMinimap.toString());
  }, [editorMinimap]);

  const saveDraftToServer = useCallback(async () => {
    if (!selectedProblem?.id) return;
    try {
      if (contestId) {
        await api.saveContestDraft(contestId, selectedProblem.id, {
          language,
          code
        });
      } else {
        await api.post("/playground/draft", {
          mode: "code",
          problemId: selectedProblem.id,
          language,
          code,
          savedAt: Date.now()
        });
      }
    } catch (err) {
      console.error("Failed to save draft to server:", err);
    }
  }, [contestId, language, code, selectedProblem]);

  const loadDraftFromServer = useCallback(async () => {
    if (!selectedProblem?.id) return;
    try {
      if (contestId) {
        const res = await api.getContestDraft(contestId, selectedProblem.id, language);
        const draft = res.draft;
        if (draft && draft.code) {
          setCode(draft.code);
          setEditorValue(draft.code);
        }
      } else {
        const res = await api.get("/playground/draft");
        const draft = res.draft;
        if (draft && draft.mode === "code" && draft.problemId === selectedProblem.id) {
          if (draft.language) setLanguage(draft.language);
          if (draft.code) {
            setCode(draft.code);
            setEditorValue(draft.code);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load draft from server:", err);
    }
  }, [contestId, selectedProblem?.id, language]);

  useEffect(() => {
    if (!selectedProblem) return;

    // Do not auto-save during problem transitions to prevent saving the old code state into the new problem's slot
    if (loadingProblemIdRef.current && loadingProblemIdRef.current !== selectedProblem.id) {
      return;
    }

    setIsSaved(false);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const key = contestId ? `code_playground_${contestId}_${selectedProblem.id}_${language}` : `code_playground_${selectedProblem.id}_${language}`;
      localStorage.setItem(key, code);
      setIsSaved(true);
      saveDraftToServer();
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [code, language, selectedProblem, contestId, saveDraftToServer]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        submitCode();
      } else if (e.ctrlKey && !e.shiftKey && e.key === "'") {
        e.preventDefault();
        runCode();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [code, language, isRunning, isSubmitting]);

  useEffect(() => {
    if (!showSettings) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const inside = settingsRef2.current?.contains(target);
      if (!inside) {
        setShowSettings(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSettings]);

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

  const fetchAllProblems = async (problemType: string, opts?: { skip?: number; search?: string }) => {
    try {
      setIsLoadingProblems(true);
      const params = new URLSearchParams({ type: problemType, take: "200" });
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
    fetchAllProblems("code", { skip: problems.length, search: problemSearchQuery || undefined });
  };

  const debounceSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (value: string) => {
    setProblemSearchQuery(value);
    if (debounceSearchRef.current) clearTimeout(debounceSearchRef.current);
    debounceSearchRef.current = setTimeout(() => {
      fetchAllProblems("code", { skip: 0, search: value || undefined });
    }, 400);
  };

  const loadLanguageAvailability = async () => {
    try {
      const response = await api.get("/code/languages");
      const langData = response.languages || [];
      const availability: Record<string, boolean> = {};
      const ids = new Set<string>();
      langData.forEach((lang: any) => {
        availability[lang.id] = lang.isAvailable;
        ids.add(lang.id);
      });
      setLanguageAvailability(availability);
      setBackendLanguageIds(ids);
    } catch (error) {
      console.error("Failed to load language availability:", error);
    }
  };

  const loadProblemStatuses = async () => {
    try {
      const res = await api.get("/submissions");
      const subs = res.submissions || [];
      const statuses: Record<string, 'solved' | 'attempted' | 'none'> = {};
      subs.forEach((sub: any) => {
        const pid = sub.problemId;
        if (!pid) return;
        const isSolved = sub.status === 'ACCEPTED' || sub.status === 'Accepted' || sub.status === 'passed';
        if (isSolved) {
          statuses[pid] = 'solved';
        } else if (statuses[pid] !== 'solved') {
          statuses[pid] = 'attempted';
        }
      });
      setProblemStatuses(statuses);
    } catch (error) {
      console.error("Failed to load problem statuses:", error);
    }
  };

  const checkLanguageAvailable = (lang: string): boolean => {
    return languageAvailability[lang] !== false;
  };

  const getLanguageWarning = (lang: string): string => {
    const warnings: Record<string, string> = {
      python: "Python is not installed. Download from https://www.python.org/downloads/",
      javascript: "Node.js is not installed. Download from https://nodejs.org/",
      typescript: "TypeScript is not installed. Install via: npm install -g tsx",
      cpp: "GCC/G++ is not installed. Install MinGW-w64 from https://www.msys2.org/",
      c: "GCC is not installed. Install MinGW-w64 from https://www.msys2.org/",
      java: "Java is not installed. Download JDK from https://www.oracle.com/java/technologies/downloads/",
      go: "Go is not installed. Download from https://go.dev/dl/",
      rust: "Rust is not installed. Install via: https://rustup.rs/",
      ruby: "Ruby is not installed. Download from https://www.ruby-lang.org/",
      csharp: "C#/.NET is not installed. Download from https://dotnet.microsoft.com/download",
      php: "PHP is not installed. Download from https://www.php.net/downloads",
      swift: "Swift is not installed. Download from https://www.swift.org/download/",
      kotlin: "Kotlin is not installed. Install via: https://kotlinlang.org/docs/command-line.html",
      scala: "Scala CLI is not installed. Install via: https://scala-cli.virtuslab.org/install",
      dart: "Dart is not installed. Download from https://dart.dev/get-dart",
    };
    return warnings[lang] || `${lang} is not installed`;
  };

  const handleLanguageChange = async (lang: string) => {
    setLanguage(lang);
    setRunStatus('idle');
    setSubmitStatus('idle');

    const currentParams = new URLSearchParams(window.location.search);
    currentParams.set('language', lang);
    const newUrl = `${window.location.pathname}?${currentParams.toString()}`;
    window.history.pushState({}, '', newUrl);

    let newCode = "";

    if (selectedProblem?.id) {
      try {
        const res = await api.getProblem(selectedProblem.id);
        const problemData = res.problem || selectedProblem;
        newCode = getOrGenerateStarterCode(problemData, lang) || DEFAULT_CODE[lang] || "";
      } catch {
        newCode = getOrGenerateStarterCode(selectedProblem, lang) || DEFAULT_CODE[lang] || "";
      }
    } else {
      newCode = DEFAULT_CODE[lang] || "";
    }

    setCode(newCode);
    if (selectedProblem?.id && monacoRef.current) {
      const model = getOrCreateModel(selectedProblem.id, newCode, lang);
      if (model) {
        isProgrammaticUpdateRef.current = true;
        try {
          model.setValue(newCode);
        } finally {
          isProgrammaticUpdateRef.current = false;
        }
        if (editorRef.current) {
          editorRef.current.setModel(model);
        }
      }
    } else if (editorRef.current) {
      setEditorValue(newCode);
    }
    setOutput("");
    setTestResults([]);
    setTestSummary(null);
    setLintErrors([]);
  };







  const runCode = async () => {
    if (!checkLanguageAvailable(language)) {
      const warning = getLanguageWarning(language);
      setLanguageWarningMsg(warning);
      setShowLanguageWarning(true);
      setOutput(`Error: ${warning}\n\nPlease install the required runtime to run ${language} code.`);
      setShowOutput(true);
      setBottomPanelHeight(30);
      return;
    }

    setIsRunning(true);
    setRunStatus('running');
    setOutput("");
    setShowOutput(true);
    setActiveTab("tests");
    setBottomPanelHeight(35);
    setTestResults([]);
    setTestSummary(null);
    setSubmitStatus('idle');

    try {
      const problemTests = selectedProblem?.testCases || testCases;
      const validTestCases = problemTests.filter((tc: TestCase) => tc.input || tc.expectedOutput);
      const sampleTests = validTestCases.filter((tc: TestCase) => !tc.isHidden);

      if (sampleTests.length === 0) {
        setOutput("No sample test cases available for this problem.");
        setCustomOutput("No sample test cases available for this problem.");
        setRunStatus('error');
        return;
      }

      const response = await api.post("/code/run-tests", {
        language,
        code,
        testCases: sampleTests,
        problemId: selectedProblem?.id
      });

      const results = response.results || [];
      const passed = results.filter((r: any) => r.passed).length;

      setTestResults(results);
      setTestSummary({ passed, failed: sampleTests.length - passed, total: sampleTests.length });
      setRunStatus(passed === sampleTests.length ? 'success' : 'error');
    } catch (err: unknown) {
      console.error("Code execution error:", err);
      const errorMsg = err instanceof Error ? (axios.isAxiosError(err) ? err.response?.data?.error || err.message : err.message) : "Failed to execute code.";
      setOutput(`Error: ${errorMsg}`);
      setCustomOutput(`Error: ${errorMsg}`);
      setRunStatus('error');
    } finally {
      setIsRunning(false);
    }
  };

  const runWithCustomInput = async () => {
    if (!checkLanguageAvailable(language)) {
      const warning = getLanguageWarning(language);
      setLanguageWarningMsg(warning);
      setShowLanguageWarning(true);
      setOutput(`Error: ${warning}\n\nPlease install the required runtime to run ${language} code.`);
      setShowOutput(true);
      setBottomPanelHeight(30);
      return;
    }

    setIsRunning(true);
    setRunStatus('running');
    setCustomOutput("");
    setOutput("");
    setShowOutput(true);
    setActiveTab("custom");
    setBottomPanelHeight(35);
    setTestResults([]);
    setTestSummary(null);
    setSubmitStatus('idle');

    try {
      const response = await api.post("/code/run", {
        language,
        code,
        input: customInput,
        problemId: selectedProblem?.id
      });

      setCustomOutput(response.output || response.error || "No output");
      setRunStatus(response.success ? 'success' : 'error');
    } catch (err: unknown) {
      console.error("Code execution error:", err);
      const errorMsg = err instanceof Error ? (axios.isAxiosError(err) ? err.response?.data?.error || err.message : err.message) : "Failed to execute code.";
      setCustomOutput(`Error: ${errorMsg}`);
      setRunStatus('error');
    } finally {
      setIsRunning(false);
    }
  };

  const fetchSubmissions = async () => {
    if (!selectedProblem?.id) return;
    try {
      const res = await api.get(`/submissions?problemId=${selectedProblem.id}`);
      const serverSubs = (res.submissions || []).map((s: any) => {
        const testResults = Array.isArray(s.testResults) ? s.testResults : [];
        const passedCount = testResults.length > 0 ? testResults.filter((t: any) => t.passed).length : (s.passedTests ?? 0);
        const totalCount = testResults.length > 0 ? testResults.length : (s.totalTests ?? 0);
        const isAccepted = s.status === 'ACCEPTED' || s.status === 'Accepted' || s.status === 'passed';
        const formattedStatus = isAccepted ? 'Accepted' : (s.status === 'WRONG_ANSWER' ? 'Wrong Answer' : s.status || 'Wrong Answer');
        const timestamp = s.submittedAt || s.createdAt || new Date().toISOString();

        return {
          id: s.id,
          status: formattedStatus,
          language: s.language,
          runtime: `${s.executionTime || 0}ms`,
          runtimeMs: s.executionTime || 0,
          memory: s.memoryUsed ? `${s.memoryUsed.toFixed(1)} MB` : 'N/A',
          memoryMB: s.memoryUsed || 0,
          timestamp: new Date(timestamp).toLocaleString(),
          rawTimestamp: timestamp,
          passedCount,
          totalCount,
          code: s.code,
          notes: s.notes || '',
          tags: s.tags || '',
          user: s.user ? { fullName: s.user.fullName, avatarUrl: s.user.avatarUrl } : undefined,
        };
      });
      setSubmissions(serverSubs);
    } catch (err) {
      console.error("Failed to fetch submissions:", err);
    }
  };



  const submitCode = async () => {
    if (!checkLanguageAvailable(language)) {
      const warning = getLanguageWarning(language);
      setOutput(`Error: ${warning}\n\nPlease install the required runtime to run ${language} code.`);
      setShowOutput(true);
      setSubmitStatus('error');
      setBottomPanelHeight(30);
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('running');
    setRunStatus('idle');
    setOutput("");
    setShowOutput(true);
    setActiveTab("tests");
    setBottomPanelHeight(35);
    setTestResults([]);
    setTestSummary(null);

    const problemTests = selectedProblem?.testCases || testCases;
      const validTestCases = problemTests.filter((tc: TestCase) => tc.input || tc.expectedOutput);

      if (validTestCases.length === 0) {
        setTestResults([{
          testCase: 1,
          passed: false,
          input: "",
          expectedOutput: "",
          actualOutput: "",
          executionTime: 0,
          error: "No test cases available"
        }]);
        setTestSummary({ passed: 0, failed: 1, total: 1 });
        setSubmitStatus('error');
        return;
      }

      if (selectedProblem?.id) {
        try {
          if (contestId) {
            // Check if already solved — prevent reattempt
            if (solvedProblems.has(selectedProblem.id)) {
              setContestSubmitToast({
                status: 'info',
                message: `✅ Problem already solved! Move to the next problem.`
              });
              setTimeout(() => setContestSubmitToast(null), 3000);
              return;
            }

            const res = await api.submitContestCode(contestId, {
              problemId: selectedProblem.id,
              code,
              language
            });

            // Set test results and summary from backend response
            const totalPassed = res.passedTests;
            const totalTests = res.totalTests;
            const isAllPassed = res.passed;

            // Generate dummy results showing only pass/fail status
            const results = Array.from({ length: totalTests }, (_, i) => ({
              testCase: i + 1,
              passed: i < totalPassed,
              input: "[Hidden]",
              expectedOutput: "[Hidden]",
              actualOutput: "[Hidden]",
              executionTime: 0
            }));

            setTestResults(results);
            setTestSummary({ passed: totalPassed, failed: totalTests - totalPassed, total: totalTests });
            setSubmitStatus(isAllPassed ? 'success' : 'partial');

            // Update score from response
            if (res.currentScore !== undefined) {
              setContestScore(res.currentScore);
              sessionStorage.setItem(`contestScore_${contestId}`, String(res.currentScore));
            }

            if (isAllPassed) {
              setContestSubmitToast({
                status: 'success',
                message: `✅ All test cases passed! Score: ${res.currentScore ?? contestScore}`
              });
              setTimeout(() => setContestSubmitToast(null), 3000);
              // Show Final Lock modal instead of auto-navigating
              setPendingLockProblem({
                id: selectedProblem.id,
                title: selectedProblem.title,
                score: res.currentScore ?? 0
              });
              setShowFinalLockModal(true);
            } else {
              // Partial pass — record submission, stay on problem, allow retry
              setContestSubmitToast({
                status: 'info',
                message: `📝 ${totalPassed}/${totalTests} test cases passed. Keep trying! (Score: ${res.currentScore ?? contestScore})`
              });
              setTimeout(() => setContestSubmitToast(null), 5000);
            }
          } else {
            // Use standard browser fetch for SSE streaming
            const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
            const rawApiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api';
            const apiUrl = rawApiUrl.replace(/\/api$/, '');
            
            // Generate dummy pending results to show immediately
            const totalTests = validTestCases.length;
            const initialResults = Array.from({ length: totalTests }, (_, i) => ({
              testCase: i + 1,
              passed: false,
              input: "Pending...",
              expectedOutput: "Pending...",
              actualOutput: "Pending...",
              executionTime: 0
            }));
            
            let currentResults = [...initialResults];
            let finalDoneSummary: { passed: number; failed: number; total: number } | null = null;
            
            setTestResults([...currentResults]);
            setTestSummary({ passed: 0, failed: 0, total: totalTests });

            try {
              const res = await fetch(`${apiUrl}/api/submissions?stream=true`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  problemId: selectedProblem.id,
                  code,
                  language
                })
              });

              if (!res.ok) {
                throw new Error("Failed to start submission stream");
              }

              const reader = res.body?.getReader();
              const decoder = new TextDecoder();
              let buffer = '';
              let lastRender = Date.now();

              if (reader) {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  
                  buffer += decoder.decode(value, { stream: true });
                  const lines = buffer.split('\n\n');
                  buffer = lines.pop() || '';
                  
                  let shouldRender = false;
                  
                  for (const line of lines) {
                    if (line.startsWith('data: ')) {
                      try {
                        const data = JSON.parse(line.slice(6));
                        if (data.type === 'progress') {
                          const tcResult = data.result;
                          currentResults[tcResult.testCase - 1] = tcResult;
                          shouldRender = true;
                        } else if (data.type === 'done') {
                          finalDoneSummary = {
                            passed: data.summary.passed,
                            failed: data.summary.failed,
                            total: data.summary.total
                          };
                          setTestSummary(finalDoneSummary);
                          setSubmitStatus(data.status === 'passed' ? 'success' : 'partial');
                          
                          if (data.status === 'passed') {
                            try {
                              const streakRes = await api.post("/user/streak/update");
                              setStreak(streakRes.currentStreak ?? 0);
                            } catch (e) {
                              console.error("Failed to update streak:", e);
                            }
                          }
                          
                          await fetchSubmissions();
                          await loadProblemStatuses();
                          shouldRender = true;
                        } else if (data.type === 'error') {
                          console.error("Stream error:", data.error);
                          setSubmitStatus('error');
                        }
                      } catch (e) {
                        console.error("Failed to parse SSE data", e);
                      }
                    }
                  }
                  
                  // Throttle re-renders to every 100ms
                  if (shouldRender && Date.now() - lastRender > 100) {
                    setTestResults([...currentResults]);
                    if (finalDoneSummary) {
                      setTestSummary(finalDoneSummary);
                    } else {
                      const curPassed = currentResults.filter(r => r?.passed).length;
                      const curTotal = Math.max(currentResults.length, totalTests);
                      setTestSummary({ passed: curPassed, failed: curTotal - curPassed, total: curTotal });
                    }
                    lastRender = Date.now();
                  }
                }
                // Final render flush
                setTestResults([...currentResults]);
                if (finalDoneSummary) {
                  setTestSummary(finalDoneSummary);
                } else {
                  const curPassed = currentResults.filter(r => r?.passed).length;
                  const curTotal = Math.max(currentResults.length, totalTests);
                  setTestSummary({ passed: curPassed, failed: curTotal - curPassed, total: curTotal });
                }
              }
            } finally {
              setIsSubmitting(false);
            }
          }
        } catch (serverErr) {
          console.error("Server save failed:", serverErr);
          setSubmitStatus('error');
        } finally {
          setIsSubmitting(false);
        }
        return;
      }

      // If not a registered database problem, run custom testcases on the generic executor
      try {
        const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
        const rawApiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api';
        const apiUrl = rawApiUrl.replace(/\/api$/, '');
        
        const totalTests = validTestCases.length;
        const initialResults = Array.from({ length: totalTests }, (_, i) => ({
          testCase: i + 1,
          passed: false,
          input: "Pending...",
          expectedOutput: "Pending...",
          actualOutput: "Pending...",
          executionTime: 0
        }));
        
        let currentResults = [...initialResults];
        let finalDoneSummary: { passed: number; failed: number; total: number } | null = null;
        
        setTestResults([...currentResults]);
        setTestSummary({ passed: 0, failed: 0, total: totalTests });

        const res = await fetch(`${apiUrl}/api/code/run-tests?stream=true`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            language,
            code,
            testCases: validTestCases,
            problemId: selectedProblem?.id
          })
        });

        if (!res.ok) {
          throw new Error("Failed to start run-tests stream");
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("Failed to get response reader");
        const decoder = new TextDecoder();
        let buffer = '';
        let lastRender = Date.now();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';
          
          let shouldRender = false;
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'progress') {
                  const tcResult = data.result;
                  currentResults[tcResult.testCase - 1] = tcResult;
                  shouldRender = true;
                } else if (data.type === 'done') {
                  finalDoneSummary = {
                    passed: data.summary.passed,
                    failed: data.summary.failed,
                    total: data.summary.total
                  };
                  setTestSummary(finalDoneSummary);
                  setSubmitStatus(data.summary.passed === data.summary.total ? 'success' : 'partial');
                  shouldRender = true;
                } else if (data.type === 'error') {
                  console.error("Stream error:", data.error);
                  setSubmitStatus('error');
                }
              } catch (e) {
                console.error("Failed to parse SSE data", e);
              }
            }
          }
          
          if (shouldRender && Date.now() - lastRender > 100) {
            setTestResults([...currentResults]);
            if (finalDoneSummary) {
              setTestSummary(finalDoneSummary);
            } else {
              const curPassed = currentResults.filter(r => r?.passed).length;
              const curTotal = Math.max(currentResults.length, totalTests);
              setTestSummary({ passed: curPassed, failed: curTotal - curPassed, total: curTotal });
            }
            lastRender = Date.now();
          }
        }
        // Final render flush
        setTestResults([...currentResults]);
        if (finalDoneSummary) {
          setTestSummary(finalDoneSummary);
        } else {
          const curPassed = currentResults.filter(r => r?.passed).length;
          const curTotal = Math.max(currentResults.length, totalTests);
          setTestSummary({ passed: curPassed, failed: curTotal - curPassed, total: curTotal });
        }
      } catch (err) {
        setTestResults([{
          testCase: 1,
          passed: false,
          input: "",
          expectedOutput: "",
          actualOutput: "",
          executionTime: 0,
          error: "Failed to submit"
        }]);
        setTestSummary({ passed: 0, failed: 1, total: 1 });
        setSubmitStatus('error');
      } finally {
        setIsSubmitting(false);
      }
  };

  const formatCode = async () => {
    setIsFormatting(true);
    try {
      const response = await api.post("/code/format", {
        language,
        code
      });

      if (response.success) {
        setCode(response.formatted);
      }
    } catch (err) {
      console.error("Format failed:", err);
    } finally {
      setIsFormatting(false);
    }
  };

  const lintCode = async () => {
    setIsLinting(true);
    setLintErrors([]);
    try {
      const response = await api.post("/code/lint", {
        language,
        code
      });

      if (response.errors) {
        setLintErrors(response.errors);
      }
    } catch (err) {
      console.error("Lint failed:", err);
    } finally {
      setIsLinting(false);
    }
  };

  const resetCode = async () => {
    shouldFoldRef.current = true;
    if (!selectedProblem?.id) return;
    const problemId = selectedProblem.id;

    setRunStatus('idle');
    setSubmitStatus('idle');

    const savedKey = contestId ? `code_playground_${contestId}_${problemId}_${language}` : `code_playground_${problemId}_${language}`;
    localStorage.removeItem(savedKey);

    let defaultCode = "";

    try {
      const res = await api.getProblem(problemId);
      const problemData = res.problem || selectedProblem;
      defaultCode = getOrGenerateStarterCode(problemData, language) || DEFAULT_CODE[language] || "";
    } catch {
      defaultCode = getOrGenerateStarterCode(selectedProblem, language) || DEFAULT_CODE[language] || "";
    }

    setCode(defaultCode);
    lastCodeRef.current = defaultCode;

    if (monacoRef.current) {
      const model = getOrCreateModel(problemId, defaultCode, language);
      if (model) {
        isProgrammaticUpdateRef.current = true;
        try {
          model.setValue(defaultCode);
        } finally {
          isProgrammaticUpdateRef.current = false;
        }
        if (editorRef.current) {
          editorRef.current.setModel(model);
        }
      }
    } else if (editorRef.current) {
      setEditorValue(defaultCode);
    }

    setOutput("");
    setTestResults([]);
    setTestSummary(null);
    setCustomInput("");
    setLintErrors([]);
  };

  const handleEditorMount = (editor: any, monaco: any) => {
    monacoRef.current = monaco;
    editorDisposersRef.current.forEach(dispose => dispose());
    editorDisposersRef.current = [];

    editorRef.current = editor;
    shouldFoldRef.current = true;

    if (selectedProblem) {
      const model = getOrCreateModel(selectedProblem.id, code, language);
      if (model) {
        editor.setModel(model);
      }
    }

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

    const contentDisposer = editor.onDidChangeModelContent(() => {
      if (isProgrammaticUpdateRef.current) return;
      const val = editor.getValue();
      lastCodeRef.current = val;
      setCode(val);
    });
    editorDisposersRef.current.push(() => contentDisposer.dispose());
  };



  const shareProblem = async () => {
    if (!selectedProblem) return;
    const url = `${window.location.origin}/playground?problem=${selectedProblem.id}`;
    try {
      await navigator.clipboard.writeText(url);
      notify.toast.success('Link copied to clipboard!');
    } catch {
      notify.toast.info(`Link copied: ${url}`);
    }
  };

  useEffect(() => {
    if (activeTab === "submissions" && selectedProblem?.id) {
      fetchSubmissions();
    }
  }, [activeTab, selectedProblem?.id]);

  useEffect(() => {
    if (selectedProblem?.id) {
      loadDraftFromServer();
    }
  }, [selectedProblem?.id]);

  const parseConstraints = (problem: Problem): string[] => {
    if (problem.constraints) return problem.constraints;
    return [];
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

  // Filter contest problems to only code type (for progress bar)
  const codeContestProblems = contestProblems.filter(cp => !cp.problem.problemType || cp.problem.problemType === 'code');

  const playgroundLayout = (
    <div ref={containerRef} className="h-screen md:h-[calc(100vh-4rem)] flex flex-col bg-[var(--bg-primary)] select-none">

      {/* Contest Progress Bar */}
      {contestId && codeContestProblems.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950 border-b border-white/10 flex-shrink-0 overflow-x-auto">
          <button
              onClick={() => navigate(`/contests/${contestId}`)}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all shrink-0"
              title="Back to Contest"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
           <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest shrink-0 mr-1">Contest</span>
          <div className="flex items-center gap-1.5">
            {codeContestProblems.map((cp, idx) => {
              const isSolved = solvedProblems.has(cp.problem.id);
              const isCurrent = selectedProblem?.id === cp.problem.id;
              return (
                <button
                  key={cp.problem.id}
                  onClick={async () => {
                    if (isSolved) {
                      setContestSubmitToast({
                        status: 'info',
                        message: `🔒 Problem "${cp.problem.title}" is solved and locked!`
                      });
                      setTimeout(() => setContestSubmitToast(null), 3000);
                      return;
                    }
                    const prob = problems.find(p => p.id === cp.problem.id);
                    if (prob) {
                      selectProblem(prob);
                    } else {
                      try {
                        const res = await api.getProblem(cp.problem.id);
                        const fetched = res.problem || res;
                        if (fetched) {
                          setProblems(prev => prev.some(p => p.id === fetched.id) ? prev : [fetched, ...prev]);
                          selectProblem(fetched);
                        }
                      } catch (e) { console.error(e); }
                    }
                  }}
                  title={`${cp.problem.title}${isSolved ? ' (Solved)' : ''}`}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all shrink-0 ${isCurrent
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : isSolved
                        ? 'bg-green-500/20 border-green-400 text-green-300 cursor-not-allowed'
                        : 'bg-white/5 border-white/20 text-gray-400 hover:border-white/40 hover:text-white'
                    }`}
                >
                  {isSolved ? (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : null}
                  {String.fromCharCode(65 + idx)}
                </button>
              );
            })}
          </div>
          <div className="ml-auto flex items-center gap-3 shrink-0">
            {/* Score display */}
            {contestScore > 0 && (
              <span className="text-xs font-bold text-amber-400">
                🏆 {contestScore} pts
              </span>
            )}
            {/* Progress text */}
            <span className="text-xs font-semibold text-gray-400 hidden sm:flex items-center gap-1">
              <span className={solvedProblems.size > 0 ? 'text-emerald-400 font-extrabold' : 'text-gray-500'}>{solvedProblems.size}</span>
              <span className="text-gray-600">/{codeContestProblems.length}</span>
              <span className="text-gray-500">solved</span>
            </span>
            {/* Enhanced progress bar */}
            <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${codeContestProblems.length > 0 ? (solvedProblems.size / codeContestProblems.length) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[10px] font-extrabold text-gray-500 tabular-nums">
              {codeContestProblems.length > 0 ? Math.round((solvedProblems.size / codeContestProblems.length) * 100) : 0}%
            </span>
          </div>
        </div>
      )}


      <div className="flex flex-1 min-h-0">
        {/* ── LEFT PANEL ── */}
        <div
          ref={leftPanelRef}
          className={`flex-col border-r border-white/10 relative overflow-hidden bg-[var(--bg-card)] h-full ${showLeftPanel ? "flex" : "hidden"
            } lg:flex flex-shrink-0`}
          style={{ width: showLeftPanel ? `${leftPanelWidth}%` : "0%" }}
        >
          {/* Panel header with streak */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-[var(--bg-card)] flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setShowLeftPanel(false)}
                className="text-gray-400 hover:text-white p-1 shrink-0 lg:hidden"
                title="Close panel"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-bold text-white truncate">
                {selectedProblem?.title ?? "Problem Details"}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {streak > 0 && !contestId && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-yellow-500/10 text-yellow-400 px-2.5 py-1 rounded-full border border-yellow-500/20 animate-pulse">
                  🔥 {streak}-day streak
                </span>
              )}
              {selectedProblem && !contestId && (
                <div className="flex items-center gap-1">
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
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-white/10 px-3 bg-[var(--bg-card)] flex-shrink-0">
            {(["description", "problems", "submissions"] as const)
              .filter((tab) => !contestId || tab === "description")
              .map((tab) => (
                <button
                  key={tab}
                  onClick={() => setLeftTab(tab)}
                  className={`px-4 py-2.5 text-[13px] font-bold border-b-2 transition-colors capitalize ${leftTab === tab
                      ? "border-[var(--accent-blue)] text-[var(--accent-blue)]"
                      : "border-transparent text-gray-400 hover:text-white"
                    }`}
                >
                  {tab === "problems" ? "All Problems" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto min-h-0 bg-[var(--bg-primary)]">
            {/* ── DESCRIPTION TAB ── */}
            {leftTab === "description" && (
              <div className="p-4 space-y-4">
                {selectedProblem ? (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded ${selectedProblem.difficulty === "Easy" ? "bg-green-500/20 text-green-400" :
                          selectedProblem.difficulty === "Medium" ? "bg-yellow-500/20 text-yellow-400" :
                            selectedProblem.difficulty === "Hard" ? "bg-red-500/20 text-red-400" :
                              "bg-green-500/20 text-green-400"
                        }`}>
                        {selectedProblem.difficulty}
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
                    {selectedProblem.companies && selectedProblem.companies.length > 0 && (
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {selectedProblem.companies.slice(0, 3).map((company, idx) => (
                          <span key={idx} className="text-xs px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded">
                            {company}
                          </span>
                        ))}
                        {selectedProblem.companies.length > 3 && (
                          <span className="text-xs text-gray-500">+{selectedProblem.companies.length - 3} more</span>
                        )}
                      </div>
                    )}

                    {/* Description */}
                    <div className={`space-y-4 ${contestId ? 'select-none' : ''}`} onContextMenu={contestId ? e => e.preventDefault() : undefined}>
                      <div>
                        <h3 className="text-sm font-semibold text-white mb-2">Description</h3>
                        <MarkdownRenderer content={(() => {
                          let desc = selectedProblem.description || '';
                          
                          // Auto-wrap Input/Output/Explanation blocks into styled blockquotes with hard line breaks
                          let lines = desc.split('\n');
                          let inExampleBlock = false;
                          let resultLines = [];
                          for (let line of lines) {
                              if (/^\s*(\*\*|\*)?(Input|Output|Explanation):/i.test(line)) {
                                  inExampleBlock = true;
                                  resultLines.push(`> ${line.replace(/\r$/, '')}  `); // two spaces force markdown hard break
                              } else if (inExampleBlock && line.trim() === '') {
                                  inExampleBlock = false;
                                  resultLines.push(line);
                              } else if (inExampleBlock) {
                                  resultLines.push(`> ${line.replace(/\r$/, '')}  `);
                              } else {
                                  resultLines.push(line);
                              }
                          }
                          desc = resultLines.join('\n');

                          let images = selectedProblem.images || {};
                          if (typeof images === 'string') {
                              try { images = JSON.parse(images); } catch (e) {}
                          }
                          const isValidImageUrl = (url: any) => {
                              if (typeof url !== 'string') return false;
                              const u = url.trim();
                              return u.length > 5 && (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:image/') || u.startsWith('/uploads/') || u.startsWith('/api/uploads/') || u.startsWith('blob:'));
                          };

                          if (typeof images === 'object' && images !== null) {
                              desc = desc.replace(/!\[(Example \d+|Main|Figure).*?\]\(.*?\)\n\n?/g, '');
                              Object.entries(images).forEach(([key, imgUrl]) => {
                                  if (isValidImageUrl(imgUrl) && !desc.includes(imgUrl as string)) {
                                      if (key === 'example1') {
                                          const regex = /(###\s*Example\s*1:?|\*\*Example\s*1:?\*\*|Example\s*1:?)/i;
                                          if (regex.test(desc)) desc = desc.replace(regex, `$1\n\n![Example 1 Figure](${imgUrl})\n\n`);
                                          else desc += `\n\n![Example 1 Figure](${imgUrl})\n\n`;
                                      } else if (key === 'example2') {
                                          const regex = /(###\s*Example\s*2:?|\*\*Example\s*2:?\*\*|Example\s*2:?)/i;
                                          if (regex.test(desc)) desc = desc.replace(regex, `$1\n\n![Example 2 Figure](${imgUrl})\n\n`);
                                          else desc += `\n\n![Example 2 Figure](${imgUrl})\n\n`;
                                      } else if (key === 'example3') {
                                          const regex = /(###\s*Example\s*3:?|\*\*Example\s*3:?\*\*|Example\s*3:?)/i;
                                          if (regex.test(desc)) desc = desc.replace(regex, `$1\n\n![Example 3 Figure](${imgUrl})\n\n`);
                                          else desc += `\n\n![Example 3 Figure](${imgUrl})\n\n`;
                                      } else if (key === 'main') {
                                          const constraintsRegex = /(###\s*Constraints:?|\*\*Constraints:?\*\*|Constraints:?)/i;
                                          if (constraintsRegex.test(desc)) desc = desc.replace(constraintsRegex, `![Main Figure](${imgUrl})\n\n$1`);
                                          else desc = `![Main Figure](${imgUrl})\n\n${desc}`;
                                      } else {
                                          desc += `\n\n![Figure](${imgUrl})\n\n`;
                                      }
                                  }
                              });
                          }
                          
                          return desc;
                        })()} />
                      </div>

                      {/* Examples rendered via description markdown if present */}

                      {/* Constraints */}
                      {parseConstraints(selectedProblem).length > 0 && (
                        <div>
                          <h3 className="text-base font-bold text-white mb-2">Constraints</h3>
                          <ul className="space-y-1.5">
                            {parseConstraints(selectedProblem).map((constraint, idx) => (
                              <li key={idx} className="text-sm text-gray-300 flex gap-2">
                                <span className="text-gray-500">•</span>
                                <span className="font-mono text-sm">{constraint}</span>
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
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm mb-4">No problem selected</p>
                  </div>
                )}
              </div>
            )}

            {/* ── ALL PROBLEMS TAB ── */}
            {leftTab === "problems" && (
              <div className="p-3 space-y-4">
                {/* Progress card */}
                <div className="border border-white/10 rounded-xl p-4 bg-white/5">
                  <div className="flex gap-4 items-center">
                    {/* Circular SVG ring */}
                    <div className="relative w-[76px] h-[76px] shrink-0">
                      <svg width="76" height="76" viewBox="0 0 76 76" className="-rotate-90">
                        {/* Track */}
                        <circle cx="38" cy="38" r="30" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                        {/* Progress */}
                        <circle
                          cx="38"
                          cy="38"
                          r="30"
                          fill="none"
                          stroke="var(--accent-blue)"
                          strokeWidth="6"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 30}`}
                          strokeDashoffset={`${2 * Math.PI * 30 * (1 - overallPercent / 100)}`}
                          style={{ transition: "stroke-dashoffset 0.6s ease" }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-base font-bold text-white leading-none">{stats.solved}</span>
                        <span className="text-[10px] text-gray-500 mt-0.5">/ {stats.total}</span>
                      </div>
                    </div>

                    {/* Difficulty bars */}
                    <div className="flex-1 flex flex-col gap-2">
                      {([
                        { label: "Easy", color: "bg-green-500", textColor: "text-green-400", s: stats.easy },
                        { label: "Medium", color: "bg-yellow-500", textColor: "text-yellow-400", s: stats.medium },
                        { label: "Hard", color: "bg-red-500", textColor: "text-red-400", s: stats.hard },
                      ] as const).map(({ label, color, textColor, s }) => (
                        <div key={label} className="flex items-center gap-2">
                          <span className={`text-[11px] w-12 font-semibold ${textColor}`}>{label}</span>
                          <div className="flex-1 h-[5px] rounded-full bg-white/10 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${color} transition-all duration-500`}
                              style={{ width: s.total > 0 ? `${(s.solved / s.total) * 100}%` : "0%" }}
                            />
                          </div>
                          <span className="text-[11px] text-gray-500 min-w-[36px] text-right">
                            {s.solved}/{s.total}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Search bar */}
                <div>
                  <input
                    type="text"
                    placeholder="Search problems..."
                    value={problemSearch}
                    onChange={(e) => setProblemSearch(e.target.value)}
                    className="w-full h-9 rounded-lg border border-white/10 bg-white/5 text-[13px] px-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                  />
                </div>

                {/* Column headers */}
                <div className="flex items-center gap-2 px-1 text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                  <span className="w-5" />
                  <span className="flex-1">Title</span>
                  <span className="w-16 text-right">Difficulty</span>
                  <span className="w-12 text-right">Acc%</span>
                </div>

                {/* Problem rows */}
                <div className="space-y-1">
                  {filteredProblems.length === 0 ? (
                    <p className="text-center text-gray-500 text-xs py-6">No problems found</p>
                  ) : (
                    filteredProblems.map((problem) => {
                      const status = problemStatuses[problem.id] ?? "none";
                      return (
                        <div
                          key={problem.id}
                          onClick={() => {
                            selectProblem(problem);
                            setLeftTab("description");
                          }}
                          className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all hover:bg-white/5 ${problem.id === selectedProblem?.id ? "bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/20" : "border border-transparent"
                            }`}
                        >
                          {/* Status dot */}
                          <div
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${status === "solved"
                                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                : status === "attempted"
                                  ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                                  : "bg-white/5 border border-white/10"
                              }`}
                          >
                            {status === "solved" ? "✓" : status === "attempted" ? "~" : ""}
                          </div>

                          {/* Title */}
                          <span className="flex-1 text-[13px] text-gray-200 truncate font-medium hover:text-white">
                            {problem.title}
                          </span>

                          {/* Difficulty */}
                          <span
                            className={`text-[11px] font-bold w-16 text-right ${problem.difficulty === "Easy"
                                ? "text-green-400"
                                : problem.difficulty === "Medium"
                                  ? "text-yellow-400"
                                  : "text-red-400"
                              }`}
                          >
                            {problem.difficulty}
                          </span>

                          {/* Acceptance */}
                          <span className="text-[11px] text-gray-500 w-12 text-right">
                            {problem.acceptanceRate !== undefined ? `${problem.acceptanceRate.toFixed(1)}%` : "—"}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* ── SUBMISSIONS TAB ── */}
            {leftTab === "submissions" && (
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Your submissions
                  </p>

                  {submissions.length === 0 ? (
                    <p className="text-center text-gray-500 text-xs py-4">No submissions yet</p>
                  ) : (
                    <div className="space-y-2">
                      {submissions.map((sub) => {
                        const isSelected = selectedSubmission?.id === sub.id;
                        return (
                          <div key={sub.id} className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
                            <div
                              onClick={() => {
                                setSelectedSubmission(sub);
                                loadSubmissionCode(sub.code);
                              }}
                              className={`p-3 cursor-pointer transition-all hover:bg-white/10 flex justify-between items-center ${isSelected ? "bg-white/10 border-b border-white/10" : ""
                                }`}
                            >
                              <div>
                                <span
                                  className={`text-[12px] font-bold ${sub.status === "Accepted" ? "text-green-400" : "text-red-400"
                                    }`}
                                >
                                  {sub.status === "Accepted" ? "✓ Accepted" : "✗ Wrong Answer"}
                                </span>
                                <p className="text-[11px] text-gray-400 mt-1">
                                  {sub.status === "Accepted"
                                    ? `Runtime: ${sub.runtime} · ${sub.language}`
                                    : sub.language}
                                </p>
                              </div>
                              <span className="text-[10px] text-gray-500">
                                {formatRelativeTime(sub.rawTimestamp ?? '')}
                              </span>
                            </div>

                            {/* Collapsible code preview */}
                            {isSelected && (
                              <div className="p-3 bg-black/40 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-gray-400">Submitted Code:</span>
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      await navigator.clipboard.writeText(sub.code);
                                      notify.toast.success('Code copied to clipboard!');
                                    }}
                                    className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 px-2 py-1 rounded transition-colors cursor-pointer"
                                  >
                                    Copy Code
                                  </button>
                                </div>
                                <pre className="p-3 bg-black/50 border border-white/5 rounded-lg text-xs font-mono text-gray-300 overflow-x-auto max-h-60 whitespace-pre scrollbar-thin">
                                  {sub.code}
                                </pre>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

          {/* Left Resize Handle */}
          <div
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-transparent hover:bg-[var(--accent-blue)] transition-colors z-20 group"
            onMouseDown={startResizeLeft}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-12 bg-white/20 rounded-full group-hover:bg-[var(--accent-blue)] transition-colors" />
          </div>
        </div>

        {/* Right Panel - IDE and Output */}
        <div ref={rightPanelRef} className="flex-1 flex flex-col min-w-0">
          {/* Toolbar */}
          <div className="flex items-start gap-2 p-2 bg-[var(--bg-card)] border-b border-white/10 flex-shrink-0 flex-wrap">
            {/* Toggle problem panel */}
            {!showLeftPanel && (
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

            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={language}
                  disabled={Boolean(contestId && selectedProblem?.id && solvedProblems.has(selectedProblem.id))}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="appearance-none px-4 py-2 pr-10 bg-[var(--bg-secondary)] border border-white/10 rounded-lg text-white text-sm cursor-pointer focus:outline-none focus:border-[var(--accent-blue)] hover:border-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {LANGUAGE_CONFIG.filter(lang => backendLanguageIds.size === 0 || backendLanguageIds.has(lang.value)).map((lang) => {
                    const isAvailable = checkLanguageAvailable(lang.value);
                    return (
                      <option key={lang.value} value={lang.value} className="bg-[var(--bg-card)] text-white">
                        {isAvailable ? lang.label : `${lang.label} (Not Installed)`}
                      </option>
                    );
                  })}
                </select>
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {!checkLanguageAvailable(language) && LANGUAGE_CONFIG.find(l => l.value === language) && (
                <a
                  href={LANGUAGE_CONFIG.find(l => l.value === language)?.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 text-xs bg-red-500/20 text-red-400 rounded-full hover:bg-red-500/30 transition-colors flex items-center gap-1"
                >
                  Not Installed
                </a>
              )}

              {/* Settings button */}
              <div className="relative" ref={settingsRef2}>
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

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={resetCode}
                disabled={Boolean(contestId && selectedProblem?.id && solvedProblems.has(selectedProblem.id))}
                className="px-3 py-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reset
              </button>
              <button
                onClick={formatCode}
                disabled={isFormatting || isRunning || isSubmitting}
                className="px-3 py-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all text-sm disabled:opacity-50"
              >
                {isFormatting ? "Formatting..." : "Format"}
              </button>
              <button
                onClick={lintCode}
                disabled={isLinting || isRunning || isSubmitting}
                className="px-3 py-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all text-sm disabled:opacity-50"
              >
                {isLinting ? "Linting..." : "Lint"}
              </button>
              <button
                onClick={runCode}
                disabled={isRunning || isSubmitting}
                className="px-4 py-1.5 bg-[var(--accent-green)] hover:bg-green-500 text-black font-bold rounded-lg transition-all flex items-center gap-2 text-sm disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {isRunning ? "Running..." : "Run Code"}
              </button>
              <button
                onClick={submitCode}
                disabled={isRunning || isSubmitting || (contestId ? solvedProblems.has(selectedProblem?.id || '') : false)}
                className={`px-4 py-1.5 rounded-lg transition-all flex items-center gap-2 text-sm disabled:opacity-50 font-bold ${contestId && selectedProblem?.id && solvedProblems.has(selectedProblem.id)
                    ? 'bg-green-500/20 text-green-400 cursor-not-allowed'
                    : 'bg-[var(--accent-blue)] hover:bg-blue-500 text-white'
                  }`}
              >
                {contestId && selectedProblem?.id && solvedProblems.has(selectedProblem.id) ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    Solved
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {isSubmitting ? "Submitting..." : "Submit"}
                  </>
                )}
              </button>
              {!contestId && (
                <button
                  onClick={shareProblem}
                  className="px-3 py-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all flex items-center gap-2 text-sm"
                  title="Share problem link"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </button>
              )}
            </div>

            {/* Saved status */}
            {selectedProblem && (
              <span className={`text-xs px-2 py-1 rounded ${isSaved ? 'text-green-400 bg-green-500/10' : 'text-yellow-400 bg-yellow-500/10'}`}>
                {isSaved ? 'Saved' : 'Saving...'}
              </span>
            )}
          </div>

          {/* Editor */}
          <div
            className="min-h-0 transition-all duration-75"
            style={{ flex: showOutput ? `1 1 ${100 - bottomPanelHeight}%` : '1 1 100%' }}
          >
            <Editor
              key="contest-monaco-editor"
              height="100%"
              language={language}
              defaultValue={code}
              onChange={(value) => setCode(value || "")}
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
                readOnly: Boolean(contestId && selectedProblem?.id && solvedProblems.has(selectedProblem.id)),
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
                      </div>
                    )}
                    {runStatus === 'error' && (
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="text-sm text-red-400 font-medium">
                          {testResults.length > 0 && testResults[0].error ? 'Compilation Error' : 'Wrong Answer'}
                        </span>
                      </div>
                    )}
                    {submitStatus === 'running' && (
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 animate-spin text-yellow-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span className="text-sm text-yellow-400 font-medium">Running Tests...</span>
                      </div>
                    )}
                    {submitStatus === 'success' && (
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm text-green-400 font-medium">All Tests Passed!</span>
                      </div>
                    )}
                    {submitStatus === 'error' && (
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="text-sm text-red-400 font-medium">Tests Failed</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setActiveTab("tests")}
                    className={`px-3 py-1 text-sm font-medium transition-all ${activeTab === "tests"
                        ? "text-white border-b-2 border-[var(--accent-green)]"
                        : "text-gray-400 hover:text-white"
                      }`}
                  >
                    Testcase
                    {testSummary && (
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${testSummary.passed === testSummary.total
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                        }`}>
                        {testSummary.passed}/{testSummary.total}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab("output")}
                    className={`px-3 py-1 text-sm font-medium transition-all ${activeTab === "output"
                        ? "text-white border-b-2 border-[var(--accent-green)]"
                        : "text-gray-400 hover:text-white"
                      }`}
                  >
                    Test Result
                  </button>
                  {!contestId && (
                    <button
                      onClick={() => setActiveTab("custom")}
                      className={`px-3 py-1 text-sm font-medium transition-all ${activeTab === "custom"
                          ? "text-white border-b-2 border-[var(--accent-green)]"
                          : "text-gray-400 hover:text-white"
                        }`}
                    >
                      Custom Input
                    </button>
                  )}
                  {!contestId && (
                    <button
                      onClick={() => setActiveTab("submissions")}
                      className={`px-3 py-1 text-sm font-medium transition-all ${activeTab === "submissions"
                          ? "text-white border-b-2 border-[var(--accent-green)]"
                          : "text-gray-400 hover:text-white"
                        }`}
                    >
                      Submissions
                      {submissions.length > 0 && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                          {submissions.length}
                        </span>
                      )}
                    </button>
                  )}
                  {selectedProblem && !contestId && (
                    <button
                      onClick={() => {
                        setActiveTab("editorial");
                        setShowOutput(true);
                        setBottomPanelHeight(40);
                      }}
                      className={`px-3 py-1 text-sm font-medium transition-all ${activeTab === "editorial"
                          ? "text-white border-b-2 border-[var(--accent-green)]"
                          : "text-gray-400 hover:text-white"
                        }`}
                    >
                      Editorial
                    </button>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowOutput(false);
                    setRunStatus('idle');
                    setSubmitStatus('idle');
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
                {activeTab === "tests" && (
                  <div className="space-y-4">
                    {testSummary && (
                      <div className={`flex items-center gap-4 px-4 py-3 rounded-xl bg-[#1a1f2e] border border-white/5`}>
                        {submitStatus === 'running' && testSummary ? (
                          <>
                            <ProgressRing 
                              radius={36} 
                              stroke={5} 
                              progress={(testSummary.passed / testSummary.total) * 100} 
                              total={testSummary.total} 
                              passed={testSummary.passed} 
                            />
                            <div className="flex flex-col justify-center">
                              <span className="text-sm font-medium text-blue-400 flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Running Test Cases...
                              </span>
                              <span className="text-xs text-gray-400 mt-0.5">Please wait while we evaluate your code</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <ProgressRing 
                              radius={36} 
                              stroke={5} 
                              progress={(testSummary.passed / testSummary.total) * 100} 
                              total={testSummary.total} 
                              passed={testSummary.passed} 
                            />
                            <div className="flex flex-col justify-center">
                              {testSummary.passed === testSummary.total ? (
                                <span className="text-lg font-bold text-green-400">Accepted</span>
                              ) : (
                                <span className="text-lg font-bold text-red-400">Wrong Answer</span>
                              )}
                              <span className="text-sm text-gray-400">
                                {testSummary.passed} out of {testSummary.total} test cases passed
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {testResults.length > 0 ? (
                      <>
                        {testResults.some(r => r?.isHidden) && <div className="text-xs text-gray-500 px-1">Hidden test results:</div>}
                        {testResults.filter(Boolean).map((result, idx) => {
                          return (
                            <div
                              key={idx}
                              className={`rounded-lg border ${result?.passed
                                  ? "bg-green-500/5 border-green-500/20"
                                  : "bg-red-500/5 border-red-500/20"
                                }`}
                            >
                              <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
                                <span className="text-sm font-medium text-white">
                                  {result?.isHidden ? `Hidden ${idx + 1}` : `Case ${idx + 1}`}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded ${result?.passed
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-red-500/20 text-red-400"
                                  }`}>
                                  {result?.passed ? "Passed" : "Failed"}
                                </span>
                              </div>
                              <div className="p-3 space-y-2 font-mono text-xs">
                                <div>
                                  <span className="text-gray-500">Input: </span>
                                  <span className="text-gray-300 whitespace-pre-wrap">{formatInputDisplay(result?.input)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Output: </span>
                                  <span className={result?.passed ? "text-green-400" : "text-red-400"}>{result?.actualOutput}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Expected: </span>
                                  <span className="text-green-400">{result?.expectedOutput}</span>
                                  {((selectedProblem?.testCases?.some((tc: TestCase) => tc?.orderIndependent)) || selectedProblem?.evaluationStrategy === 'UNORDERED_MATCH') && (
                                    <span className="text-xs text-gray-500 italic ml-2">(Any order is accepted)</span>
                                  )}
                                </div>
                                {result?.error && (
                                  <div className="text-red-400">Error: {result.error}</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    ) : selectedProblem?.testCases ? (
                      <div className="space-y-2">
                        {selectedProblem.testCases
                          .filter((tc: TestCase) => !tc.isHidden)
                          .map((tc: TestCase, idx: number) => (
                            <div key={idx} className="rounded-lg border border-white/10 bg-white/[0.02]">
                              <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
                                <span className="text-sm font-medium text-white">Case {idx + 1}</span>
                                <span className="text-xs px-2 py-0.5 rounded bg-gray-500/20 text-gray-400">
                                  Not run
                                </span>
                              </div>
                              <div className="p-3 font-mono text-xs">
                                <div className="text-gray-300 whitespace-pre-wrap">{formatInputDisplay(tc.input)}</div>
                                {((selectedProblem?.testCases?.some((t: TestCase) => t.orderIndependent)) || selectedProblem?.evaluationStrategy === 'UNORDERED_MATCH') && (
                                  <div className="text-xs text-gray-500 italic mt-1">(Any order is accepted)</div>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-gray-500 text-sm text-center py-8">
                        Run your code to see test results...
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "output" && (
                  <>
                    {lintErrors.length > 0 && (
                      <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <h4 className="text-sm font-medium text-red-400 mb-2">Lint Errors</h4>
                        {lintErrors.map((err, i) => (
                          <div key={i} className="text-xs text-red-300 mb-1">
                            Line {err.line}: {err.message}
                          </div>
                        ))}
                      </div>
                    )}
                    {output ? (
                      <pre className="text-sm text-white font-mono whitespace-pre-wrap">{output}</pre>
                    ) : (
                      <div className="text-gray-500 text-sm text-center py-4">
                        Click "Run Code" to see output here...
                      </div>
                    )}
                  </>
                )}

                {activeTab === "custom" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-white mb-2 block">Custom Input</label>
                      <textarea
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        placeholder="Enter custom input..."
                        className="w-full h-32 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono resize-none focus:outline-none focus:border-[var(--accent-blue)]"
                      />
                    </div>
                    <button
                      onClick={runWithCustomInput}
                      disabled={isRunning || isSubmitting}
                      className="px-4 py-2 bg-[var(--accent-green)] hover:bg-green-500 text-black font-bold rounded-lg text-sm disabled:opacity-50"
                    >
                      {isRunning ? "Running..." : "Run with Input"}
                    </button>
                    {customInput && (
                      <div>
                        <label className="text-sm font-medium text-white mb-2 block">Output</label>
                        <pre className="w-full h-32 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono overflow-auto">
                          {customOutput || (isRunning ? "Running..." : "Run to see output")}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "submissions" && (
                  <div className="flex flex-col h-full">
                    {selectedProblem ? (
                      <div className="flex gap-3 h-full min-h-0">
                        {/* Submissions list */}
                        <div className={`${selectedSubmission ? 'w-72 flex-shrink-0 border-r border-white/10 pr-3' : 'flex-1'} overflow-y-auto`}>
                          <div className="flex items-center justify-between mb-3 sticky top-0 bg-[var(--bg-primary)] py-2 z-10">
                            <h3 className="text-sm font-semibold text-white">All Submissions</h3>
                            <span className="text-xs text-gray-500">{submissions.length}</span>
                          </div>
                          {submissions.length > 0 ? (
                            <div className="space-y-1">
                              {submissions.map((sub) => (
                                <div
                                  key={sub.id}
                                  onClick={() => {
                                    setSelectedSubmission(sub);
                                    setSubmissionNotes(sub.notes || '');
                                    setSubmissionTags(sub.tags ? sub.tags.split(',').map(t => t.trim()).filter(Boolean) : []);
                                    setTagInput('');
                                  }}
                                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all text-xs ${selectedSubmission?.id === sub.id
                                      ? 'bg-white/10'
                                      : 'hover:bg-white/5'
                                    }`}
                                >
                                  <span className={`w-16 shrink-0 text-left font-medium ${sub.status === 'Accepted' ? 'text-green-400' : 'text-red-400'
                                    }`}>
                                    {sub.status === 'Accepted' ? 'Accepted' : 'WA'}
                                  </span>
                                  <span className="w-14 shrink-0 text-gray-400">{sub.language}</span>
                                  <span className="w-12 shrink-0 text-gray-400">{sub.runtime}</span>
                                  <span className="w-16 shrink-0 text-gray-400">{sub.memory}</span>
                                  <span className="w-5 shrink-0 text-center">
                                    {sub.notes ? (
                                      <svg className="w-3.5 h-3.5 text-gray-500 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                      </svg>
                                    ) : null}
                                  </span>
                                  <span className="flex-1 text-right text-gray-600 text-[10px]">
                                    {new Date(sub.rawTimestamp || sub.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-gray-500 text-sm text-center py-8">
                              No submissions yet.
                            </div>
                          )}
                        </div>

                        {/* Submission detail */}
                        {selectedSubmission && (() => {
                          const beatsRuntime = submissions.length > 1
                            ? ((submissions.filter(s => s.runtimeMs! < (selectedSubmission.runtimeMs || 0)).length / (submissions.length - 1)) * 100).toFixed(2)
                            : '--';
                          const beatsMemory = submissions.length > 1
                            ? ((submissions.filter(s => s.memoryMB! < (selectedSubmission.memoryMB || 0)).length / (submissions.length - 1)) * 100).toFixed(2)
                            : '--';
                          const tagList = submissionTags;
                          const formatDate = (d: string) => {
                            try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
                            catch { return d; }
                          };

                          return (
                            <div className="flex-1 overflow-y-auto space-y-4 min-w-0">
                              {/* Status banner */}
                              <div className="flex items-start gap-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${selectedSubmission.status === 'Accepted' ? 'bg-green-500/20' : 'bg-red-500/20'
                                  }`}>
                                  <svg className={`w-6 h-6 ${selectedSubmission.status === 'Accepted' ? 'text-green-400' : 'text-red-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    {selectedSubmission.status === 'Accepted' ? (
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    ) : (
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                    )}
                                  </svg>
                                </div>
                                <div>
                                  <div className={`text-lg font-bold ${selectedSubmission.status === 'Accepted' ? 'text-green-400' : 'text-red-400'}`}>
                                    {selectedSubmission.status || 'Wrong Answer'}
                                  </div>
                                  <div className="text-sm text-gray-400 mt-0.5">
                                    {selectedSubmission.passedCount ?? 0} / {selectedSubmission.totalCount ?? 0} testcases passed
                                  </div>
                                  <div className="flex items-center gap-2 mt-2">
                                    <div className="w-6 h-6 rounded-full bg-[var(--accent-blue)] flex items-center justify-center text-[10px] font-bold text-white">
                                      {(selectedSubmission.user?.fullName || 'U').charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-sm text-white font-medium">{selectedSubmission.user?.fullName || ''}</span>
                                    <span className="text-xs text-gray-500">
                                      submitted at {formatDate(selectedSubmission.rawTimestamp || selectedSubmission.timestamp)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Analysis */}
                              <div>
                                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Analysis</h4>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                                    <div className="text-xs text-gray-500 mb-1">Runtime</div>
                                    <div className="text-2xl font-bold text-white mb-1">{selectedSubmission.runtimeMs || 0}<span className="text-sm text-gray-400 font-normal ml-1">ms</span></div>
                                    <div className="text-xs text-gray-500">
                                      Beats <span className="text-[var(--accent-blue)] font-semibold">{beatsRuntime}%</span>
                                    </div>
                                  </div>
                                  <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                                    <div className="text-xs text-gray-500 mb-1">Memory</div>
                                    <div className="text-2xl font-bold text-white mb-1">{(selectedSubmission.memoryMB || 0).toFixed(1)}<span className="text-sm text-gray-400 font-normal ml-1">MB</span></div>
                                    <div className="text-xs text-gray-500">
                                      Beats <span className="text-[var(--accent-blue)] font-semibold">{beatsMemory}%</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Code */}
                              <div>
                                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Code</h4>
                                <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
                                  <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
                                    <span className="text-xs text-gray-400 font-medium">Solution</span>
                                    <span className="text-[10px] text-gray-600 uppercase">{selectedSubmission.language}</span>
                                  </div>
                                  <pre className="p-4 text-xs font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">{selectedSubmission.code}</pre>
                                </div>
                              </div>

                              {/* Notes */}
                              <div>
                                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Notes</h4>
                                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                                  <textarea
                                    value={submissionNotes}
                                    onChange={e => setSubmissionNotes(e.target.value)}
                                    onBlur={async () => {
                                      if (selectedSubmission.notes !== submissionNotes) {
                                        setSavingNotes(true);
                                        try {
                                          await api.updateSubmission(selectedSubmission.id, { notes: submissionNotes });
                                          setSelectedSubmission(prev => prev ? { ...prev, notes: submissionNotes } : null);
                                        } catch (err) {
                                          console.error('Failed to save notes:', err);
                                        }
                                        setSavingNotes(false);
                                      }
                                    }}
                                    placeholder="Write your notes here..."
                                    rows={3}
                                    className="w-full px-3 py-2.5 bg-[var(--bg-primary)] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-[var(--accent-blue)] resize-y placeholder-gray-600"
                                  />
                                  {savingNotes && <span className="text-[10px] text-gray-600 mt-1 inline-block">Saving...</span>}
                                </div>
                              </div>

                              {/* Tags */}
                              <div>
                                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Select related tags</h4>
                                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <span className="text-xs text-gray-500">{tagList.length}/5</span>
                                    {tagList.map((tag, i) => (
                                      <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] text-xs rounded-full">
                                        {tag}
                                        <button
                                          onClick={async () => {
                                            const newTags = tagList.filter((_, j) => j !== i);
                                            setSubmissionTags(newTags);
                                            setSelectedSubmission(prev => prev ? { ...prev, tags: newTags.join(', ') } : null);
                                            await api.updateSubmission(selectedSubmission.id, { tags: newTags.join(', ') });
                                          }}
                                          className="hover:text-white ml-0.5"
                                        >
                                          &times;
                                        </button>
                                      </span>
                                    ))}
                                    {tagList.length < 5 && (
                                      <form
                                        onSubmit={async (e) => {
                                          e.preventDefault();
                                          const trimmed = tagInput.trim();
                                          if (!trimmed || tagList.includes(trimmed)) return;
                                          const newTags = [...tagList, trimmed];
                                          setSubmissionTags(newTags);
                                          setTagInput('');
                                          setSelectedSubmission(prev => prev ? { ...prev, tags: newTags.join(', ') } : null);
                                          await api.updateSubmission(selectedSubmission.id, { tags: newTags.join(', ') });
                                        }}
                                        className="inline-flex"
                                      >
                                        <input
                                          value={tagInput}
                                          onChange={e => setTagInput(e.target.value)}
                                          placeholder="Add a tag"
                                          className="w-24 px-2 py-1 bg-transparent border border-dashed border-white/20 rounded text-xs text-white focus:outline-none focus:border-[var(--accent-blue)] placeholder-gray-600"
                                        />
                                      </form>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-gray-500 text-sm mb-4">No problem selected</p>
                        <button
                          onClick={() => setShowProblems(true)}
                          className="px-4 py-2 bg-[var(--accent-blue)] text-white rounded-lg text-sm hover:opacity-90 transition-opacity"
                        >
                          Select Problem
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "editorial" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">Solution & Editorial</h3>
                      <span className="text-xs text-gray-500">Official</span>
                    </div>

                    {selectedProblem?.solution ? (
                      <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                        <h4 className="text-sm font-medium text-white mb-2">Approach</h4>
                        <MarkdownRenderer content={selectedProblem.solution} />
                      </div>
                    ) : (
                      <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                        <h4 className="text-sm font-medium text-white mb-2">Approach</h4>
                        <p className="text-xs text-gray-400 italic">
                          No written editorial approach available for this problem.
                        </p>
                      </div>
                    )}

                    {selectedProblem?.referenceSolution ? (
                      <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                        <h4 className="text-sm font-medium text-white mb-2">Reference Solution</h4>
                        <pre className="text-xs text-gray-300 font-mono overflow-auto bg-black/30 p-3 rounded max-h-96 whitespace-pre-wrap">
                          {selectedProblem.referenceSolution}
                        </pre>
                      </div>
                    ) : (
                      <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                        <h4 className="text-sm font-medium text-white mb-2">Reference Solution</h4>
                        <p className="text-xs text-gray-400 italic">
                          No reference solution available for this problem.
                        </p>
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
        {/* End inner flex row (left panel + right panel) */}
      </div>

      <ProblemsModal
        isOpen={showProblems}
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

      {/* Contest submission toast notification */}
      {contestSubmitToast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-xl shadow-2xl border flex items-center gap-3 text-sm font-semibold ${contestSubmitToast.status === 'success'
            ? 'bg-green-500/20 border-green-500 text-green-300'
            : contestSubmitToast.status === 'info'
              ? 'bg-blue-500/20 border-blue-500 text-blue-300'
              : 'bg-red-500/20 border-red-500 text-red-300'
          }`}>
          {contestSubmitToast.status === 'success' ? (
            <svg className="w-5 h-5 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : contestSubmitToast.status === 'info' ? (
            <svg className="w-5 h-5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                  // Mark as solved and locked
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

