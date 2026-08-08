import Editor from "@monaco-editor/react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from 'react-router-dom';

import { api } from "../services/api";
import { FREE_MODE_DEFAULT } from "./playground/constants";
import { formatInputDisplay, getWebCodeStorageKey, getSelectedProblemStorageKey, getPreviewDeviceStorageKey, PREVIEW_DEVICES, WEB_FILES } from "./playground/helpers";
import type { PreviewDevice, WebFileId } from "./playground/helpers";
import { ProblemsModal } from "./playground/ProblemsModal";
import MarkdownRenderer from "../components/MarkdownRenderer";
import type { TestCase, TestResult, Problem } from "./playground/types";
import { useSidebar } from '../contexts/SidebarContext';
import { useNotify } from '../components/notifications';
import { SecureContestWrapper } from '../components/SecureContestWrapper';
import { ProblemLockModal } from '../components/participant/ProblemLockModal';
import { ProblemLockConfirmationModal } from '../components/ExamFlowModals';
import { formatProblemDescriptionWithImages } from '../utils/formatProblemDescription';

function parseWebDevTestDisplay(inputStr: string, idx: number) {
  if (!inputStr || typeof inputStr !== 'string') {
    return { title: `Test Case ${idx + 1}`, steps: '', assert: '' };
  }
  try {
    const json = JSON.parse(inputStr);
    if (json && (json.steps || json.assert)) {
      const stepSummary = (json.steps || []).map((s: any) => {
        if (s.action === 'type') return `Type "${s.value}" into ${s.selector}`;
        if (s.action === 'click') return `Click ${s.selector}`;
        if (s.action === 'press') return `Press ${s.key} on ${s.selector}`;
        if (s.action === 'drag') return `Drag ${s.selector} to ${s.targetSelector}`;
        return `${s.action} on ${s.selector}`;
      }).join(' → ');

      const assertSummary = json.assert
        ? `Check ${json.assert.selector} [${json.assert.property}] = "${json.assert.expected}"`
        : '';

      return {
        title: `Test ${idx + 1}: ${json.assert?.selector || 'DOM Assertion'}`,
        steps: stepSummary || 'DOM Interaction Scenario',
        assert: assertSummary
      };
    }
  } catch {}

  return { title: `Test Case ${idx + 1}`, steps: inputStr, assert: '' };
}

interface NetworkRequest {
  id: number;
  method: string;
  url: string;
  status: number;
  type: 'fetch' | 'xhr';
  size: number;
  duration: number;
}

import { useAuth } from '../contexts/AuthContext';

export function WebPlaygroundPage({ embeddedInContest }: { embeddedInContest?: boolean } = {}) {
  const notify = useNotify();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userStorageId = user?.id || (user as any)?.userId || 'guest';
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
        } catch (err) {
          console.error("Failed to load contest details:", err);
        }
      };
      fetchFlags();

      return () => {
        setSidebarHidden(false);
      };
    }
  }, [setSidebarHidden]);

  const [playMode, setPlayMode] = useState<"free" | "problem">(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('contestId')) return 'problem';
    const saved = localStorage.getItem('web_playground_playMode');
    return (saved === 'free' || saved === 'problem') ? saved : 'problem';
  });

  const [htmlCode, setHtmlCode] = useState(FREE_MODE_DEFAULT);
  const [cssCode, setCssCode] = useState("");
  const [jsCode, setJsCode] = useState("");
  const [webLanguage, setWebLanguage] = useState<WebFileId>("html");

  // Last known "saved" snapshot of each file — used to derive dirty indicators
  const [savedCode, setSavedCode] = useState<{ html: string; css: string; js: string }>({ html: "", css: "", js: "" });
  const dirtyFiles: Record<WebFileId, boolean> = {
    html: htmlCode !== savedCode.html,
    css: cssCode !== savedCode.css,
    javascript: jsCode !== savedCode.js,
  };

  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testSummary, setTestSummary] = useState<{ passed: number; failed: number; total: number } | null>(null);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [networkRequests, setNetworkRequests] = useState<NetworkRequest[]>([]);
  const networkCounterRef = useRef(0);

  const [showLockConfirmModal, setShowLockConfirmModal] = useState(false);
  const [lockConfirmData, setLockConfirmData] = useState({
    problemTitle: '',
    scoreEarned: 0,
    maxScore: 100,
    passedTests: 0,
    totalTests: 0,
  });

  const handleConfirmLockProblem = async () => {
    if (!contestId || !selectedProblem) return;
    setIsSubmitting(true);
    try {
      // 1. Submit tri-file payload to backend contest submissions
      const fullCode = JSON.stringify({ html: htmlCode, css: cssCode, js: jsCode });
      await api.submitContestCode(contestId, {
        problemId: selectedProblem.id,
        code: fullCode,
        language: 'web-dev'
      }).catch(() => {});

      // 2. Also submit to webdev endpoint
      await api.post("/webdev/submit", {
        htmlCode, cssCode, jsCode,
        problemId: selectedProblem.id,
        contestId
      }).catch(() => {});

      // 3. Mark problem as locked locally for this user
      sessionStorage.setItem(`locked_prob_${userStorageId}_${contestId}_${selectedProblem.id}`, '1');
      localStorage.setItem(`locked_prob_${userStorageId}_${contestId}_${selectedProblem.id}`, '1');
      notify.toast.success('🔒 Web problem submitted & locked successfully!');
      setShowLockConfirmModal(false);
      navigate(`/contests/${contestId}`);
    } catch (err) {
      notify.toast.error('Failed to lock problem. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState("");

  const [problems, setProblems] = useState<Problem[]>([]);
  const [totalProblems, setTotalProblems] = useState(0);
  const [problemSearchQuery, setProblemSearchQuery] = useState("");
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [showProblems, setShowProblems] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [isLoadingProblems, setIsLoadingProblems] = useState(false);
  const [activeTab, setActiveTab] = useState<"tests" | "output" | "console" | "network">("tests");
  const [showSettings, setShowSettings] = useState(false);
  const [problemStatuses, setProblemStatuses] = useState<Record<string, 'solved' | 'attempted' | 'none'>>({});

  const [editorFontSize, setEditorFontSize] = useState(() => {
    const saved = localStorage.getItem('web_playground_fontSize');
    return saved ? parseInt(saved) : 14;
  });
  const [editorTabSize, setEditorTabSize] = useState(() => {
    const saved = localStorage.getItem('web_playground_tabSize');
    return saved ? parseInt(saved) : 4;
  });
  const [editorWordWrap, setEditorWordWrap] = useState(() => {
    const saved = localStorage.getItem('web_playground_wordWrap');
    return saved === 'true';
  });
  const [editorMinimap, setEditorMinimap] = useState(() => {
    const saved = localStorage.getItem('web_playground_minimap');
    return saved !== 'false';
  });

  const [leftPanelWidth, setLeftPanelWidth] = useState(24);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(30);
  const [showOutput, setShowOutput] = useState(true);
  const [showWebPreview, setShowWebPreview] = useState(true);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewSnapshot, setPreviewSnapshot] = useState<{htmlCode: string; cssCode: string; jsCode: string} | null>(null);
  type ViewMode = 'split' | 'editor' | 'preview' | 'rubric' | 'problem';
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [isInspectActive, setIsInspectActive] = useState(false);
  const [inspectedElement, setInspectedElement] = useState<{
    tagName: string; id: string; className: string;
    width: number; height: number; color: string;
    backgroundColor: string; fontSize: string; fontFamily: string;
    display: string; margin: string; padding: string;
  } | null>(null);
  const [rubricData, setRubricData] = useState<{ functionality: number; styling: number; accessibility: number; codeQuality: number; total: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isProblemLocked = Boolean(
    contestId && selectedProblem?.id && (
      sessionStorage.getItem(`locked_prob_${userStorageId}_${contestId}_${selectedProblem.id}`) === '1' ||
      localStorage.getItem(`locked_prob_${userStorageId}_${contestId}_${selectedProblem.id}`) === '1'
    )
  );

  const highlightLinkedCode = (selectorOrInput: string) => {
    if (!htmlCode) return;

    let lineNumber = 1;
    const lines = htmlCode.split('\n');
    const cleanTarget = selectorOrInput.replace(/^count:/, '').replace(/@.*$/, '').replace(/\..*$/, '');
    const idMatch = cleanTarget.match(/#([\w-]+)/);
    const classMatch = cleanTarget.match(/\.([\w-]+)/);
    const tagMatch = cleanTarget.match(/^([a-zA-Z1-6]+)/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (idMatch && line.includes(`id="${idMatch[1]}"`)) {
        lineNumber = i + 1;
        break;
      }
      if (classMatch && line.includes(`class="${classMatch[1]}"`)) {
        lineNumber = i + 1;
        break;
      }
      if (tagMatch && line.includes(`<${tagMatch[1]}`)) {
        lineNumber = i + 1;
        break;
      }
    }

    if (editorRef.current) {
      editorRef.current.revealLineInCenter(lineNumber);
      editorRef.current.setSelection({
        startLineNumber: lineNumber,
        startColumn: 1,
        endLineNumber: lineNumber,
        endColumn: (lines[lineNumber - 1]?.length || 50) + 1,
      });
    }

    const iframe = document.querySelector('iframe[title="Web Preview"]') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'highlight-selector',
        selector: cleanTarget
      }, '*');
    }

    notify.toast.info(`Linked: Line ${lineNumber} & '${cleanTarget}' highlighted`);
  };

  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>(() => {
    const saved = localStorage.getItem(getPreviewDeviceStorageKey());
    return saved === 'tablet' || saved === 'mobile' ? saved : 'desktop';
  });

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
      try {
        model.pushEditOperations([], [{ range: model.getFullModelRange(), text: value }], () => null);
      } finally {
        isProgrammaticUpdateRef.current = false;
      }
    }
  };

  const modelsRef = useRef<Map<string, any>>(new Map());
  const getOrCreateModel = (problemId: string, codeVal: string, langVal: string) => {
    if (!monacoRef.current) return null;
    const modelKey = `${problemId}_${langVal}`;
    const monacoLang = langVal === 'javascript' ? 'javascript' : langVal === 'css' ? 'css' : 'html';
    
    let model = modelsRef.current.get(modelKey);
    if (!model) {
      let ext = 'html';
      if (langVal === 'css') ext = 'css';
      else if (langVal === 'javascript') ext = 'js';
      
      const uri = monacoRef.current.Uri.parse(`inmemory://model/${problemId}_${langVal}.${ext}`);
      model = monacoRef.current.editor.getModel(uri);
      if (!model) {
        model = monacoRef.current.editor.createModel(codeVal, monacoLang, uri);
      }
      modelsRef.current.set(modelKey, model);
    } else {
      if (monacoRef.current.editor.setModelLanguage) {
        monacoRef.current.editor.setModelLanguage(model, monacoLang);
      }
    }
    return model;
  };

  useEffect(() => {
    if (editorRef.current && monacoRef.current && selectedProblem) {
      const activeCode = webLanguage === "html" ? htmlCode : webLanguage === "css" ? cssCode : jsCode;
      const model = getOrCreateModel(selectedProblem.id, activeCode, webLanguage);
      if (model) {
        editorRef.current.setModel(model);
        // Clear any stale markers/diagnostics when switching between HTML/CSS/JS tabs
        if (monacoRef.current.editor.setModelMarkers) {
          monacoRef.current.editor.setModelMarkers(model, 'typescript', []);
          monacoRef.current.editor.setModelMarkers(model, 'javascript', []);
          monacoRef.current.editor.setModelMarkers(model, 'css', []);
          monacoRef.current.editor.setModelMarkers(model, 'html', []);
        }
      }
    }
  }, [selectedProblem?.id, webLanguage]);

  useEffect(() => {
    const activeCode = webLanguage === "html" ? htmlCode : webLanguage === "css" ? cssCode : jsCode;
    setEditorValue(activeCode);
  }, [htmlCode, cssCode, jsCode, webLanguage]);

  useEffect(() => {
    localStorage.setItem('web_playground_playMode', playMode);
  }, [playMode]);

  useEffect(() => {
    localStorage.setItem('web_playground_fontSize', editorFontSize.toString());
  }, [editorFontSize]);

  useEffect(() => {
    localStorage.setItem('web_playground_tabSize', editorTabSize.toString());
  }, [editorTabSize]);

  useEffect(() => {
    localStorage.setItem('web_playground_wordWrap', editorWordWrap.toString());
  }, [editorWordWrap]);

  useEffect(() => {
    localStorage.setItem('web_playground_minimap', editorMinimap.toString());
  }, [editorMinimap]);

  useEffect(() => {
    localStorage.setItem(getPreviewDeviceStorageKey(), previewDevice);
  }, [previewDevice]);

  const fetchAllProblems = async (problemType?: string, opts?: { skip?: number; search?: string }) => {
    try {
      setIsLoadingProblems(true);
      const cid = new URLSearchParams(window.location.search).get('contestId');
      if (cid) {
        const cRes = await api.getContest(cid).catch(() => null);
        if (cRes?.contest?.problems?.length > 0) {
          const contestProbs = cRes.contest.problems
            .map((cp: any) => ({ ...cp.problem, points: cp.points || 100 }))
            .filter((p: any) => p && (p.problemType === 'web' || p.problemType === 'web-dev'));
          if (contestProbs.length > 0) {
            setProblems(contestProbs);
            setIsLoadingProblems(false);
            return;
          }
        }
      }

      const params = new URLSearchParams({ type: problemType || "web-dev", take: "200" });
      if (opts?.skip) params.set('skip', opts.skip.toString());
      if (opts?.search) params.set('search', opts.search);
      const response = await api.get(`/problems?${params}`);
      const newProblems = (response.problems || []).filter((p: any) => p.problemType === 'web' || p.problemType === 'web-dev');
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

  const loadProblemStatuses = async () => {
    try {
      const res = await api.get("/submissions");
      const subs = res.submissions || [];
      const statuses: Record<string, 'solved' | 'attempted' | 'none'> = {};
      subs.forEach((s: any) => {
        if (!s.problemId) return;
        if (s.status === "ACCEPTED" || s.passed) {
          statuses[s.problemId] = 'solved';
        } else if (!statuses[s.problemId]) {
          statuses[s.problemId] = 'attempted';
        }
      });
      setProblemStatuses(statuses);
    } catch (err) {
      console.error("Failed to load problem statuses:", err);
    }
  };

  useEffect(() => {
    const init = async () => {
      await fetchAllProblems("web-dev");
      loadProblemStatuses();
    };
    init();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const problemId = params.get('problem');
    const cid = params.get('contestId');
    const savedProblemId = localStorage.getItem(getSelectedProblemStorageKey(cid || contestId));

    if (playMode === "free" && !cid) {
      setHtmlCode(FREE_MODE_DEFAULT);
      setCssCode("");
      setJsCode("");
      setSavedCode({ html: FREE_MODE_DEFAULT, css: "", js: "" });
      return;
    }

    const targetProblemId = problemId || savedProblemId;

    if (targetProblemId) {
      if (selectedProblem && selectedProblem.id === targetProblemId && selectedProblem.description) {
        return;
      }

      const existingProblem = problems.find(p => p.id === targetProblemId);
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
            localStorage.removeItem(getSelectedProblemStorageKey(cid));
            selectProblem(problems[0]);
          }
        } catch (err) {
          console.error("Failed to fetch target web-dev problem:", err);
          if (!cid && problems.length > 0) {
            localStorage.removeItem(getSelectedProblemStorageKey(cid));
            selectProblem(problems[0]);
          }
        }
      };
      fetchTargetProblem();
    } else if (!selectedProblem && problems.length > 0) {
      selectProblem(problems[0]);
    }
  }, [problems, playMode, selectedProblem]);

  useEffect(() => {
    if (!selectedProblem || playMode === "free") return;
    if (selectedProblem.problemType === "web-dev") {
      const savedKey = getWebCodeStorageKey(selectedProblem.id, contestId);
      const savedWebCode = localStorage.getItem(savedKey);
      const htmlStarter = selectedProblem.starterCode?.html || "";
      const cssStarter = selectedProblem.starterCode?.css || "";
      const jsStarter = selectedProblem.starterCode?.javascript || selectedProblem.starterCode?.js || "";

      if (savedWebCode) {
        try {
          const parsed = JSON.parse(savedWebCode);
          // If stored JS code is empty or has uncompleted TODO stubs, prefer embedded solution jsStarter
          const isTodoStub = !parsed.jsCode || parsed.jsCode.includes('// TODO:');
          const finalJs = isTodoStub && jsStarter ? jsStarter : (parsed.jsCode || jsStarter || "");

          const loaded = {
            html: parsed.htmlCode || htmlStarter || "",
            css: parsed.cssCode || cssStarter || "",
            js: finalJs
          };
          setHtmlCode(loaded.html);
          setCssCode(loaded.css);
          setJsCode(loaded.js);
          setSavedCode(loaded);
        } catch (err) { console.error('Operation failed:', err); }
      } else {
        if (htmlStarter) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlStarter, 'text/html');
          const styleTag = doc.querySelector('style');
          const scriptTag = doc.querySelector('script');
          const bodyContent = doc.body.innerHTML;
          const builtHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Web Page</title>
</head>
<body>
${bodyContent}
</body>
</html>`;
          const builtCss = styleTag ? styleTag.innerHTML : cssStarter;
          const builtJs = scriptTag ? scriptTag.innerHTML : jsStarter;
          setHtmlCode(builtHtml);
          setCssCode(builtCss);
          setJsCode(builtJs);
          setSavedCode({ html: builtHtml, css: builtCss, js: builtJs });
        } else {
          const defaultHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Web Page</title>
    <style>
        /* Add your CSS here */
    </style>
</head>
<body>
    <!-- Add your HTML here -->
    <script>
        // Add your JavaScript here
    </script>
</body>
</html>`;
          setHtmlCode(defaultHtml);
          setCssCode("");
          setJsCode("");
          setSavedCode({ html: defaultHtml, css: "", js: "" });
        }
      }
    }
  }, [selectedProblem?.id, contestId]);

  useEffect(() => {
    if (!selectedProblem) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const key = getWebCodeStorageKey(selectedProblem.id, contestId);
      localStorage.setItem(key, JSON.stringify({ htmlCode, cssCode, jsCode }));
      setSavedCode({ html: htmlCode, css: cssCode, js: jsCode });
      saveDraftToServer();
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [htmlCode, cssCode, jsCode, selectedProblem, contestId]);

  const saveDraftToServer = useCallback(async () => {
    if (!selectedProblem?.id) return;
    try {
      await api.post("/playground/draft", {
        mode: "web",
        problemId: selectedProblem.id,
        htmlCode, cssCode, jsCode,
        savedAt: Date.now()
      });
    } catch (err) {
      console.error("Failed to save draft to server:", err);
    }
  }, [htmlCode, cssCode, jsCode, selectedProblem]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        if (!selectedProblem) return;
        setIsSubmitting(true);
        setSubmitStatus('running');
        setShowOutput(true);
        setActiveTab('tests');
        (async () => {
          try {
            const key = getWebCodeStorageKey(selectedProblem.id, contestId);
            localStorage.setItem(key, JSON.stringify({ htmlCode, cssCode, jsCode }));
            const res = await api.post("/webdev/submit", {
              htmlCode, cssCode, jsCode,
              problemId: selectedProblem.id,
              contestId
            });
            const evaluation = res.evaluation;
            if (evaluation?.results) {
              setTestResults(evaluation.results);
              setTestSummary(evaluation.summary);
              if (evaluation.rubric) setRubricData(evaluation.rubric);
            }
            setSubmitStatus(evaluation?.summary?.failed === 0 ? 'success' : 'error');
          } catch (err) {
            console.error("Web submission error:", err);
            setSubmitStatus('error');
          } finally {
            setIsSubmitting(false);
          }
        })();
      } else if (e.ctrlKey && !e.shiftKey && e.key === "'") {
        e.preventDefault();
        runWebCode();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      } else if (e.key === "Escape") {
        setShowOutput(false);
        setIsInspectActive(false);
        setInspectedElement(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [htmlCode, cssCode, jsCode, selectedProblem, isRunning, isSubmitting]);

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

  const handleEditorMount = (editor: any, monaco: any) => {
    monacoRef.current = monaco;
    editorRef.current = editor;

    // Disable semantic validation for JS/TS so browser globals like document, window, e.dataTransfer don't trigger false red error marks
    if (monaco.languages.typescript) {
      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: false,
      });
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: false,
      });
    }

    // Disable strict CSS validation so valid modern CSS properties and comments don't show red squiggly lines
    if (monaco.languages.css) {
      monaco.languages.css.cssDefaults.setOptions({
        validate: false,
      });
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
  };

  const loadMoreProblems = () => {
    fetchAllProblems("web-dev", { skip: problems.length, search: problemSearchQuery || undefined });
  };

  const debounceSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (value: string) => {
    setProblemSearchQuery(value);
    if (debounceSearchRef.current) clearTimeout(debounceSearchRef.current);
    debounceSearchRef.current = setTimeout(() => {
      fetchAllProblems("web-dev", { skip: 0, search: value || undefined });
    }, 400);
  };

  const selectProblem = async (problem: Problem) => {
    if (playMode === "free") {
      setHtmlCode(FREE_MODE_DEFAULT);
      setCssCode("");
      setJsCode("");
      window.history.pushState({}, '', '/playground/web-dev');
      return;
    }

    setShowWebPreview(false);
    setConsoleOutput([]);
    setNetworkRequests([]);
    setPreviewSnapshot(null);
    setHtmlCode("");
    setCssCode("");
    setJsCode("");

    setSelectedProblem(problem);
    localStorage.setItem(getSelectedProblemStorageKey(contestId), problem.id);
    setRunStatus('idle');
    setSubmitStatus('idle');

    const params = new URLSearchParams(window.location.search);
    params.set('problem', problem.id);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newUrl);

    if (problem.problemType === "web-dev") {
      const savedKey = getWebCodeStorageKey(problem.id, contestId);
      const savedWebCode = localStorage.getItem(savedKey);

      if (savedWebCode) {
        try {
          const parsed = JSON.parse(savedWebCode);
          const loaded = { html: parsed.htmlCode || "", css: parsed.cssCode || "", js: parsed.jsCode || "" };
          setHtmlCode(loaded.html);
          setCssCode(loaded.css);
          setJsCode(loaded.js);
          setSavedCode(loaded);
        } catch (err) { console.error('Operation failed:', err); }
      } else {
        const htmlStarter = problem.starterCode?.html || "";
        const cssStarter = problem.starterCode?.css || "";
        const jsStarter = problem.starterCode?.js || "";

        if (htmlStarter) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlStarter, 'text/html');
          const styleTag = doc.querySelector('style');
          const scriptTag = doc.querySelector('script');
          const bodyContent = doc.body.innerHTML;
          const extractedCss = styleTag ? styleTag.innerHTML : cssStarter;
          const extractedJs = scriptTag ? scriptTag.innerHTML : jsStarter;
          const builtHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Web Page</title>
</head>
<body>
${bodyContent}
</body>
</html>`;
          setHtmlCode(builtHtml);
          setCssCode(extractedCss);
          setJsCode(extractedJs);
          setSavedCode({ html: builtHtml, css: extractedCss, js: extractedJs });
        } else {
          const defaultHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Web Page</title>
    <style>
        /* Add your CSS here */
    </style>
</head>
<body>
    <!-- Add your HTML here -->
    <script>
        // Add your JavaScript here
    </script>
</body>
</html>`;
          setHtmlCode(defaultHtml);
          setCssCode("");
          setJsCode("");
          setSavedCode({ html: defaultHtml, css: "", js: "" });
        }
      }
    }

    setConsoleOutput([]);
    setTestResults([]);
    setTestSummary(null);
    setShowProblems(false);
  };

  const runWebCode = async () => {
    setConsoleOutput([]);
    setNetworkRequests([]);
    setShowWebPreview(true);
    setPreviewKey(prev => prev + 1);
    setPreviewSnapshot({ htmlCode, cssCode, jsCode });
    setIsRunning(true);
    setRunStatus('running');

    if (selectedProblem?.id) {
      try {
        const res = await api.post('/webdev/evaluate', {
          htmlCode,
          cssCode,
          jsCode,
          problemId: selectedProblem.id,
        });
        if (res?.results) {
          setTestResults(res.results);
          setTestSummary(res.summary);
          if (res.rubric) setRubricData(res.rubric);
        }
      } catch (e) {
        console.warn('Live test evaluation failed:', e);
      }
    }

    setIsRunning(false);
    setRunStatus('success');
  };

  const getWebPreview = () => {
    const htmlToUse = previewSnapshot?.htmlCode ?? htmlCode;
    const cssToUse = previewSnapshot?.cssCode ?? cssCode;
    const jsToUse = previewSnapshot?.jsCode ?? jsCode;

    let html = htmlToUse;

    html = html.replace(/<a href="/g, '<a target="_self" href="');

    const anchorFixScript = `
      <script>
        document.querySelectorAll('a[href^="#"]').forEach(function(link) {
          link.addEventListener('click', function(e) {
            e.preventDefault();
            var targetId = this.getAttribute('href').substring(1);
            var target = document.getElementById(targetId);
            if (target) {
              target.scrollIntoView({behavior: 'smooth'});
            }
          });
        });
      </script>
    `;
    html = html.replace('</body>', () => `${anchorFixScript}</body>`);

    const blockExternalLinksScript = `
      <script>
        document.querySelectorAll('a[href^="http"]').forEach(function(link) {
          link.addEventListener('click', function(e) {
            e.preventDefault();
            console.warn('External links are not allowed in this exercise.');
          });
          link.setAttribute('target', '_self');
        });
      </script>
    `;
    html = html.replace('</body>', () => `${blockExternalLinksScript}</body>`);

    const consoleCapture = `
      <script>
        (function() {
          const originalLog = console.log;
          const originalError = console.error;
          const originalWarn = console.warn;
          const originalInfo = console.info;

          function sendToParent(type, args) {
            try {
              window.parent.postMessage({
                type: 'console',
                method: type,
                args: args.map(arg => {
                  try {
                    return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
                  } catch(e) {
                    return String(arg);
                  }
                })
              }, '*');
            } catch(e) {
              console.error('Failed to send console message to parent:', e);
            }
          }

          console.log = function() {
            originalLog.apply(console, arguments);
            sendToParent('log', Array.from(arguments));
          };
          console.error = function() {
            originalError.apply(console, arguments);
            sendToParent('error', Array.from(arguments));
          };
          console.warn = function() {
            originalWarn.apply(console, arguments);
            sendToParent('warn', Array.from(arguments));
          };
          console.info = function() {
            originalInfo.apply(console, arguments);
            sendToParent('info', Array.from(arguments));
          };

          window.onerror = function(msg, url, lineNo, columnNo, error) {
            sendToParent('error', [msg + ' (line ' + lineNo + ')']);
            return false;
          };
        })();
      </script>
    `;

    const networkCapture = `
      <script>
        (function() {
          function sendReq(method, url, status, type, size, duration) {
            try {
              window.parent.postMessage({
                type: 'network',
                method: String(method || 'GET'),
                url: String(url || ''),
                status: status || 0,
                requestType: type,
                size: size || 0,
                duration: duration || 0
              }, '*');
            } catch(e) {}
          }
          try {
            var origFetch = window.fetch;
            if (origFetch) {
              window.fetch = function(input, init) {
                var url = typeof input === 'string' ? input : (input && input.url) || String(input);
                var method = (init && init.method) || (input && input.method) || 'GET';
                var start = performance.now();
                return origFetch.apply(this, arguments).then(function(res) {
                  var size = 0;
                  try { var ct = res.headers.get('content-length'); size = ct ? parseInt(ct, 10) : 0; } catch(e) {}
                  sendReq(method, url, res.status, 'fetch', size, Math.round(performance.now() - start));
                  return res;
                }, function(err) {
                  sendReq(method, url, 0, 'fetch', 0, Math.round(performance.now() - start));
                  throw err;
                });
              };
            }
          } catch(e) {}
          try {
            var origOpen = XMLHttpRequest.prototype.open;
            var origSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.open = function(method, url) {
              this.__netMethod = method;
              this.__netUrl = url;
              this.__netStart = performance.now();
              return origOpen.apply(this, arguments);
            };
            XMLHttpRequest.prototype.send = function() {
              var xhr = this;
              xhr.addEventListener('load', function() {
                var size = 0;
                try { var ct = xhr.getResponseHeader('content-length'); size = ct ? parseInt(ct, 10) : 0; } catch(e) {}
                sendReq(xhr.__netMethod, xhr.__netUrl, xhr.status, 'xhr', size, Math.round(performance.now() - (xhr.__netStart || performance.now())));
              });
              xhr.addEventListener('error', function() {
                sendReq(xhr.__netMethod, xhr.__netUrl, 0, 'xhr', 0, Math.round(performance.now() - (xhr.__netStart || performance.now())));
              });
              return origSend.apply(this, arguments);
            };
          } catch(e) {}
        })();
      </script>
    `;

    const inspectorCapture = `
      <script>
        (function() {
          var active = false;
          var highlightBox = document.createElement('div');
          highlightBox.style.position = 'fixed';
          highlightBox.style.pointerEvents = 'none';
          highlightBox.style.border = '2px solid #3b82f6';
          highlightBox.style.backgroundColor = 'rgba(59, 130, 246, 0.25)';
          highlightBox.style.zIndex = '9999999';
          highlightBox.style.display = 'none';
          highlightBox.style.borderRadius = '3px';
          highlightBox.style.transition = 'all 0.05s ease';
          
          if (document.body) {
            document.body.appendChild(highlightBox);
          } else {
            document.addEventListener('DOMContentLoaded', function() {
              document.body.appendChild(highlightBox);
            });
          }

          window.addEventListener('message', function(e) {
            if (e.data && e.data.type === 'toggle-inspector') {
              active = Boolean(e.data.active);
              if (!active) highlightBox.style.display = 'none';
            } else if (e.data && e.data.type === 'highlight-selector') {
              var sel = e.data.selector;
              try {
                var el = document.querySelector(sel);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  var rect = el.getBoundingClientRect();
                  highlightBox.style.left = rect.left + 'px';
                  highlightBox.style.top = rect.top + 'px';
                  highlightBox.style.width = rect.width + 'px';
                  highlightBox.style.height = rect.height + 'px';
                  highlightBox.style.display = 'block';
                  highlightBox.style.border = '3px solid #f59e0b';
                  highlightBox.style.backgroundColor = 'rgba(245, 158, 11, 0.35)';
                  setTimeout(function() {
                    highlightBox.style.display = 'none';
                    highlightBox.style.border = '2px solid #3b82f6';
                    highlightBox.style.backgroundColor = 'rgba(59, 130, 246, 0.25)';
                  }, 2500);
                }
              } catch(err) {}
            }
          });

          // Capture phase listener to prevent candidate handler conflicts
          document.addEventListener('mousemove', function(e) {
            if (!active) return;
            var el = document.elementFromPoint(e.clientX, e.clientY);
            if (!el || el === highlightBox || el === document.body || el === document.documentElement) {
              highlightBox.style.display = 'none';
              return;
            }
            var rect = el.getBoundingClientRect();
            highlightBox.style.left = rect.left + 'px';
            highlightBox.style.top = rect.top + 'px';
            highlightBox.style.width = rect.width + 'px';
            highlightBox.style.height = rect.height + 'px';
            highlightBox.style.display = 'block';
          }, true);

          document.addEventListener('click', function(e) {
            if (!active) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            var el = document.elementFromPoint(e.clientX, e.clientY);
            if (el) {
              var computed = window.getComputedStyle(el);
              var rect = el.getBoundingClientRect();
              window.parent.postMessage({
                type: 'element-inspected',
                tagName: el.tagName.toLowerCase(),
                id: el.id || '',
                className: typeof el.className === 'string' ? el.className : '',
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                color: computed.color,
                backgroundColor: computed.backgroundColor,
                fontSize: computed.fontSize,
                fontFamily: computed.fontFamily,
                display: computed.display,
                margin: computed.margin,
                padding: computed.padding
              }, '*');
            }
          }, true);
        })();
      </script>
    `;

    if (cssToUse) {
      html = html.replace('</head>', () => `<style>${cssToUse}</style></head>`);
    }

    html = html.replace('<head>', () => `<head>${consoleCapture}${networkCapture}${inspectorCapture}`);

    if (jsToUse) {
      const safeJs = `
        (function() {
          function runUserScript() {
            try {
              ${jsToUse}
            } catch(err) {
              console.error('[Runtime Error] ' + (err && err.message ? err.message : String(err)));
            }
          }
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', runUserScript);
          } else {
            runUserScript();
          }
        })();
      `;
      html = html.replace('</body>', () => `<script>${safeJs}</script></body>`);
    }

    return html;
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;
      if (event.data.type === 'console') {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = `[${timestamp}]`;
        const method = event.data.method;
        const args = event.data.args.join(' ');
        setConsoleOutput(prev => [...prev.slice(-99), `${prefix} ${method === 'log' ? '' : method.toUpperCase()}: ${args}`]);
      } else if (event.data.type === 'network') {
        networkCounterRef.current += 1;
        setNetworkRequests(prev => [
          ...prev.slice(-199),
          {
            id: networkCounterRef.current,
            method: event.data.method,
            url: event.data.url,
            status: event.data.status,
            type: event.data.requestType === 'xhr' ? 'xhr' : 'fetch',
            size: event.data.size || 0,
            duration: event.data.duration || 0,
          },
        ]);
      } else if (event.data.type === 'element-inspected') {
        setInspectedElement({
          tagName: event.data.tagName,
          id: event.data.id,
          className: event.data.className,
          width: event.data.width,
          height: event.data.height,
          color: event.data.color,
          backgroundColor: event.data.backgroundColor,
          fontSize: event.data.fontSize,
          fontFamily: event.data.fontFamily,
          display: event.data.display,
          margin: event.data.margin,
          padding: event.data.padding,
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const parseExamples = (problem: Problem): { input: string; output: string; explanation?: string }[] => {
    try {
      const testCases = problem.testCases;
      if (!testCases || testCases.length === 0) return [];
      return testCases.map(tc => ({ input: tc.input, output: tc.expectedOutput }));
    } catch {
      return [];
    }
  };

  const parseConstraints = (problem: Problem): string[] => {
    if (problem.constraints) return problem.constraints;
    return [];
  };

  const playgroundLayout = (
    <div ref={containerRef} className="h-screen md:h-[calc(100vh-4rem)] flex flex-col bg-[var(--bg-primary)] select-none">
      {/* Contest Top Header Bar */}
      {contestId && (
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-950 border-b border-white/10 flex-shrink-0 overflow-x-auto">
          <button
            onClick={() => navigate(`/contests/${contestId}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-all shrink-0 cursor-pointer"
            title="Back to Contest Overview"
          >
            <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            <span>← Back to Contest</span>
          </button>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-bold text-gray-300 hidden sm:inline">{selectedProblem?.title}</span>
            <button
              onClick={() => {
                const earned = rubricData?.total !== undefined ? rubricData.total : (testSummary ? Math.round((testSummary.passed / testSummary.total) * (selectedProblem?.points || 100)) : 0);
                setLockConfirmData({
                  problemTitle: selectedProblem?.title || 'Web Dev Problem',
                  scoreEarned: earned,
                  maxScore: selectedProblem?.points || 100,
                  passedTests: testSummary?.passed || 0,
                  totalTests: testSummary?.total || 0,
                });
                setShowLockConfirmModal(true);
              }}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-400 text-black text-xs font-black rounded-xl transition-all shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-300 flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Final lock and submit this problem"
            >
              🔒 Lock &amp; Submit Problem
            </button>
          </div>
        </div>
      )}
      
      <div className="flex flex-1 min-h-0">
        {/* Left Panel - Problem Description */}
        {playMode !== "free" && (
        <div
          ref={leftPanelRef}
          className={`flex-col border-r border-white/10 relative overflow-hidden ${
            showLeftPanel ? "flex" : "hidden"
          } flex-shrink-0`}
          style={{ width: showLeftPanel ? `${leftPanelWidth}%` : "0%" }}
        >
          {/* Problem Header */}
          <div className="p-3 border-b border-white/10 bg-[var(--bg-card)] flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              {!contestId ? (
                <>
                  <button
                    onClick={() => navigate('/playground')}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-gray-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-md transition-all border border-white/10"
                    title="Back to Playgrounds Hub"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Back to Hub</span>
                  </button>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition-all"
                    title="Back to Dashboard"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => navigate(`/contests/${contestId}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-all shadow-sm"
                  title="Back to Contest Overview"
                >
                  <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>← Back to Contest</span>
                </button>
              )}
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
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    selectedProblem.difficulty === "Easy" ? "bg-green-500/20 text-green-400" :
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
                  <MarkdownRenderer content={formatProblemDescriptionWithImages(selectedProblem.description || '', selectedProblem.images)} />
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
                          <span className="text-gray-500">•</span>
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

      {/* Right Panel - IDE and Output */}
      <div ref={rightPanelRef} className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-start gap-2 p-2 bg-[var(--bg-card)] border-b border-white/10 flex-shrink-0 flex-wrap">
          {/* Free Mode / Problems toggle + Settings */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/playground')}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-gray-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-md transition-all border border-white/10"
              title="Back to Playgrounds Hub"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Hub</span>
            </button>
            {contestId && (
              <button
                onClick={() => navigate(`/contests/${contestId}`)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-md transition-all shrink-0 cursor-pointer"
                title="Back to Contest Overview"
              >
                <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
                <span>← Back to Contest</span>
              </button>
            )}
            {contestId && selectedProblem && (
              <button
                onClick={() => {
                  const earned = rubricData?.total !== undefined ? rubricData.total : (testSummary ? Math.round((testSummary.passed / testSummary.total) * (selectedProblem.points || 100)) : 0);
                  setLockConfirmData({
                    problemTitle: selectedProblem.title,
                    scoreEarned: earned,
                    maxScore: selectedProblem.points || 100,
                    passedTests: testSummary?.passed || 0,
                    totalTests: testSummary?.total || 0,
                  });
                  setShowLockConfirmModal(true);
                }}
                className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-400 text-black text-xs font-black rounded-xl transition-all shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-300 flex items-center gap-1.5 cursor-pointer shrink-0 ml-1"
                title="Final lock and submit this problem"
              >
                🔒 Lock Problem
              </button>
            )}
            {!contestId && (
              <>
                <button
                  onClick={() => {
                    setPlayMode("free");
                    setHtmlCode(FREE_MODE_DEFAULT);
                    setCssCode("");
                    setJsCode("");
                    setSavedCode({ html: FREE_MODE_DEFAULT, css: "", js: "" });
                    setSelectedProblem(null);
                    window.history.pushState({}, '', '/playground/web-dev');
                  }}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                    playMode === "free" ? "bg-green-500 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Free Mode
                </button>
                <button
                  onClick={() => {
                    setPlayMode("problem");
                    setHtmlCode("");
                    setCssCode("");
                    setJsCode("");
                    setSavedCode({ html: "", css: "", js: "" });
                  }}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                    playMode === "problem" ? "bg-[var(--accent-blue)] text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Problems
                </button>
              </>
            )}
            {playMode === "problem" && (
              <button
                onClick={() => setShowLeftPanel((prev) => !prev)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                  showLeftPanel ? "bg-white/10 text-white" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                }`}
                title="Toggle Problem Statement Panel"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                {showLeftPanel ? "Hide Problem" : "Show Problem"}
              </button>
            )}

            {/* Segmented View Switcher */}
            <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10 ml-auto">
              {[
                { id: 'split', label: 'Split View', icon: '⚡' },
                { id: 'editor', label: 'Code Focus', icon: '💻' },
                { id: 'preview', label: 'Live Canvas', icon: '🌐' },
                { id: 'rubric', label: '4D Rubric', icon: '📊' },
              ].map((mode) => {
                const active = viewMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => {
                      setViewMode(mode.id as ViewMode);
                      if (mode.id === 'editor') {
                        setShowWebPreview(false);
                        setShowLeftPanel(false);
                      } else if (mode.id === 'preview') {
                        setShowWebPreview(true);
                        setShowLeftPanel(false);
                      } else if (mode.id === 'split') {
                        setShowWebPreview(true);
                        setShowLeftPanel(true);
                      } else if (mode.id === 'rubric') {
                        setShowOutput(true);
                        setActiveTab('tests');
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      active
                        ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20 font-black'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>{mode.icon}</span>
                    <span className="hidden sm:inline">{mode.label}</span>
                  </button>
                );
              })}
            </div>
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

          {/* Web mode action buttons */}
          <div className="flex items-center gap-2">
            {/* Reset button */}
            <button
              onClick={() => {
                if (selectedProblem?.starterCode) {
                  const htmlVal = selectedProblem.starterCode.html || "";
                  const cssVal = selectedProblem.starterCode.css || "";
                  const jsVal = selectedProblem.starterCode.js || "";
                  setHtmlCode(htmlVal);
                  setCssCode(cssVal);
                  setJsCode(jsVal);
                  setSavedCode({ html: htmlVal, css: cssVal, js: jsVal });
                } else {
                  setHtmlCode(FREE_MODE_DEFAULT);
                  setCssCode("");
                  setJsCode("");
                  setSavedCode({ html: FREE_MODE_DEFAULT, css: "", js: "" });
                }
              }}
              className="px-3 py-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all text-sm"
            >
              Reset
            </button>

            {/* Run Preview */}
            <button
              onClick={runWebCode}
              disabled={isRunning || isSubmitting}
              className="px-4 py-1.5 bg-[var(--accent-green)] hover:bg-green-500 text-black font-bold rounded-lg transition-all flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {isRunning ? "Running..." : "Run Preview"}
            </button>

            {/* Submit button */}
            <button
              onClick={async () => {
                if (!selectedProblem) return;
                setIsSubmitting(true);
                setSubmitStatus('running');
                setShowOutput(true);
                setActiveTab('tests');
                try {
                  const key = getWebCodeStorageKey(selectedProblem.id, contestId);
                  localStorage.setItem(key, JSON.stringify({ htmlCode, cssCode, jsCode }));
                  const res = await api.post("/webdev/submit", {
                    htmlCode, cssCode, jsCode,
                    problemId: selectedProblem.id,
                    contestId
                  });
                  const evaluation = res.evaluation;
                  if (evaluation?.results) {
                    setTestResults(evaluation.results);
                    setTestSummary(evaluation.summary);
                    if (evaluation.rubric) setRubricData(evaluation.rubric);
                  }
                  const passedCount = evaluation?.summary?.passed ?? (res.passed ? res.passedTests : 0);
                  const totalCount = evaluation?.summary?.total ?? (res.passed ? res.totalTests : 1);
                  const allPassed = passedCount === totalCount && totalCount > 0;
                  setSubmitStatus(allPassed ? 'success' : 'error');

                  if (contestId) {
                    const points = Math.round((passedCount / Math.max(1, totalCount)) * (selectedProblem.points || 100));
                    setLockConfirmData({
                      problemTitle: selectedProblem.title,
                      scoreEarned: points,
                      maxScore: selectedProblem.points || 100,
                      passedTests: passedCount,
                      totalTests: totalCount,
                    });
                    setShowLockConfirmModal(true);
                  } else {
                    if (allPassed) notify.toast.success("🎉 ACCEPTED! Solution submitted successfully.");
                    else notify.toast.error(`Passed ${passedCount}/${totalCount} tests.`);
                  }
                } catch (err) {
                  console.error("Web submission error:", err);
                  setSubmitStatus('error');
                  notify.toast.error("Submission error. Please try again.");
                } finally {
                  setIsSubmitting(false);
                }
              }}
              disabled={isRunning || isSubmitting}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-lg transition-all flex items-center gap-2 text-sm shadow-md shadow-amber-500/20 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {isSubmitting ? "Submitting..." : "Submit"}
            </button>

            {/* Share button */}
            {!contestId && (
              <button
                onClick={() => {
                  const problemId = selectedProblem?.id || '';
                  const url = `${window.location.origin}/playground/web-dev?problem=${problemId}`;
                  navigator.clipboard.writeText(url);
                }}
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
        </div>

        {/* Editor */}
        <div
          className="min-h-0 transition-all duration-75 flex flex-col"
          style={{ flex: showOutput ? `1 1 ${100 - bottomPanelHeight}%` : '1 1 100%' }}
        >
          {/* File explorer tabs */}
          <div className="flex items-stretch bg-[var(--bg-card)] border-b border-white/10 overflow-x-auto flex-shrink-0">
            {WEB_FILES.map((file) => {
              const active = webLanguage === file.id;
              return (
                <button
                  key={file.id}
                  onClick={() => setWebLanguage(file.id)}
                  title={file.label}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-r border-white/10 whitespace-nowrap transition-colors ${
                    active ? "bg-[var(--bg-primary)] text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${file.dotColor}`} />
                  {file.label}
                  {dirtyFiles[file.id] && (
                    <span className="w-2 h-2 rounded-full bg-amber-400" title="Unsaved changes" />
                  )}
                </button>
              );
            })}
            <div className="ml-auto flex items-center gap-2 px-2">
              <button
                onClick={() => {
                  if (!showWebPreview) {
                    setShowWebPreview(true);
                    runWebCode();
                  } else {
                    setShowWebPreview(false);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md font-medium transition-all ${
                  showWebPreview
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                    : "bg-white/5 text-gray-400 hover:text-white border border-white/10"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {showWebPreview ? "Hide Preview" : "Show Preview"}
              </button>
            </div>
          </div>
          <div className="flex-1 flex min-h-0">
          {/* Code Editor - half width in web mode with preview */}
          <div
            className={`flex-1 min-h-0 min-w-[380px] md:min-w-[420px] ${showWebPreview ? "w-1/2 border-r border-white/10" : ""}`}
          >
            <Editor
              key="web-contest-editor"
              height="100%"
              language={webLanguage}
              value={webLanguage === "html" ? htmlCode : webLanguage === "css" ? cssCode : jsCode}
              onChange={(value) => {
                if (webLanguage === "html") setHtmlCode(value || "");
                else if (webLanguage === "css") setCssCode(value || "");
                else setJsCode(value || "");
              }}
              theme="vs-dark"
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: editorMinimap },
                fontSize: editorFontSize,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: editorTabSize,
                wordWrap: editorWordWrap ? "on" : "off",
                padding: { top: 16 },
                contextmenu: !contestId,
              }}
            />
          </div>

          {/* Web Preview Panel - appears next to editor when visible */}
          {showWebPreview && (
            <div className="flex-1 flex flex-col bg-[var(--bg-card)]">
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
                <h3 className="text-sm font-semibold text-white">Live Preview</h3>
                <div className="flex items-center gap-2">
                  {/* Device viewport switcher */}
                  <div className="flex items-center bg-white/5 rounded-lg p-0.5">
                    {(Object.keys(PREVIEW_DEVICES) as PreviewDevice[]).map((device) => {
                      const active = previewDevice === device;
                      const cfg = PREVIEW_DEVICES[device];
                      return (
                        <button
                          key={device}
                          onClick={() => setPreviewDevice(device)}
                          title={`${cfg.label}${cfg.width ? ` (${cfg.width}px)` : ' (Full width)'}`}
                          className={`p-1.5 rounded-md transition-all ${
                            active ? "bg-[var(--accent-blue)] text-white" : "text-gray-400 hover:text-white"
                          }`}
                        >
                          {device === "desktop" && (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          )}
                          {device === "tablet" && (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          )}
                          {device === "mobile" && (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => {
                      setShowWebPreview(false);
                      setConsoleOutput([]);
                      setNetworkRequests([]);
                      setPreviewSnapshot(null);
                    }}
                    className="text-gray-400 hover:text-white ml-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex-1 m-2 mb-2 overflow-auto rounded-lg bg-[#1c1c26] min-h-0">
                <div
                  className="bg-white h-full rounded-lg overflow-hidden"
                  style={{ width: PREVIEW_DEVICES[previewDevice].width ? `${PREVIEW_DEVICES[previewDevice].width}px` : "100%", marginInline: "auto" }}
                >
                  <iframe
                    key={previewKey}
                    srcDoc={getWebPreview()}
                    className="w-full h-full block"
                    sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
                    title="Web Preview"
                  />
                </div>
              </div>
              {/* Console Output */}
              <div className="mx-2 mb-2 flex flex-col border border-white/10 rounded-lg bg-black/90 max-h-32">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 bg-white/5">
                  <span className="text-xs font-medium text-gray-400">Console</span>
                  <button
                    onClick={() => setConsoleOutput([])}
                    className="text-xs text-gray-500 hover:text-white"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-2 font-mono text-xs">
                  {consoleOutput.length === 0 ? (
                    <span className="text-gray-600">Console output will appear here...</span>
                  ) : (
                    consoleOutput.map((line, idx) => (
                      <div key={idx} className={`${line.includes('error') ? 'text-red-400' : line.includes('warn') ? 'text-yellow-400' : line.includes('info') ? 'text-blue-400' : 'text-gray-300'}`}>
                        {line}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Output Panel - test results / console / network for web mode */}
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
                      <span className="text-sm text-red-400 font-medium">Compilation Error</span>
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
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab("tests")}
                    className={`px-3 py-1 text-sm font-medium transition-all ${
                      activeTab === "tests"
                        ? "text-white border-b-2 border-[var(--accent-green)]"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Testcase
                    {testSummary && (
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                        testSummary.passed === testSummary.total
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }`}>
                        {testSummary.passed}/{testSummary.total}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab("output")}
                    className={`px-3 py-1 text-sm font-medium transition-all ${
                      activeTab === "output"
                        ? "text-white border-b-2 border-[var(--accent-green)]"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Test Result
                  </button>
                  <button
                    onClick={() => setActiveTab("console")}
                    className={`px-3 py-1 text-sm font-medium transition-all ${
                      activeTab === "console"
                        ? "text-white border-b-2 border-[var(--accent-green)]"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Console
                    {consoleOutput.length > 0 && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-gray-500/20 text-gray-400">
                        {consoleOutput.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab("network")}
                    className={`px-3 py-1 text-sm font-medium transition-all ${
                      activeTab === "network"
                        ? "text-white border-b-2 border-[var(--accent-green)]"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Network
                    {networkRequests.length > 0 && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-gray-500/20 text-gray-400">
                        {networkRequests.length}
                      </span>
                    )}
                  </button>
                </div>
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
                  {rubricData && (
                    <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 border border-white/15 rounded-xl p-3.5 space-y-2.5 shadow-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-white uppercase tracking-wider">4D Evaluation Rubric</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                            Grade: {rubricData.total}/100
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono">Weighted Assessment Score</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div onClick={() => highlightLinkedCode('body')} title="Click to inspect Functionality" className="bg-white/5 border border-white/10 p-2 rounded-lg space-y-1 cursor-pointer hover:border-emerald-400/50 transition-all">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-emerald-400">🟢 Functionality (40%)</span>
                            <span className="text-white">{Math.round(rubricData.functionality * 100)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${rubricData.functionality * 100}%` }} />
                          </div>
                        </div>
                        <div onClick={() => highlightLinkedCode('style')} title="Click to inspect Styling" className="bg-white/5 border border-white/10 p-2 rounded-lg space-y-1 cursor-pointer hover:border-blue-400/50 transition-all">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-blue-400">🔵 Styling (20%)</span>
                            <span className="text-white">{Math.round(rubricData.styling * 100)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-400 transition-all duration-500" style={{ width: `${rubricData.styling * 100}%` }} />
                          </div>
                        </div>
                        <div onClick={() => highlightLinkedCode('img')} title="Click to inspect Accessibility" className="bg-white/5 border border-white/10 p-2 rounded-lg space-y-1 cursor-pointer hover:border-purple-400/50 transition-all">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-purple-400">🟣 Accessibility (20%)</span>
                            <span className="text-white">{Math.round(rubricData.accessibility * 100)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-400 transition-all duration-500" style={{ width: `${rubricData.accessibility * 100}%` }} />
                          </div>
                        </div>
                        <div onClick={() => highlightLinkedCode('script')} title="Click to inspect Code Quality" className="bg-white/5 border border-white/10 p-2 rounded-lg space-y-1 cursor-pointer hover:border-amber-400/50 transition-all">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-amber-400">🟡 Code Quality (20%)</span>
                            <span className="text-white">{Math.round(rubricData.codeQuality * 100)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${rubricData.codeQuality * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {testSummary && (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                      testSummary.passed === testSummary.total
                        ? "bg-green-500/10 border border-green-500/20"
                        : "bg-red-500/10 border border-red-500/20"
                    }`}>
                      {testSummary.passed === testSummary.total ? (
                        <>
                          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-sm text-green-400 font-medium">
                            Accepted · {testSummary.passed}/{testSummary.total} test cases passed
                          </span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span className="text-sm text-red-400 font-medium">
                            Wrong Answer · {testSummary.passed}/{testSummary.total} test cases passed
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {testResults.length > 0 ? (
                    <>
                      {testResults.some(r => r.isHidden) && <div className="text-xs text-gray-500 px-1">Hidden test results:</div>}
                      {testResults.map((result, idx) => {
                        const parsedInfo = parseWebDevTestDisplay(result.input, idx);

                        return (
                          <div
                            key={idx}
                            onClick={() => highlightLinkedCode(result.input)}
                            title="Click to reveal line in Code Editor & highlight DOM element in Live Preview"
                            className={`rounded-lg border cursor-pointer hover:border-amber-400/60 transition-all ${
                              result.passed
                                ? "bg-green-500/5 border-green-500/20"
                                : "bg-red-500/5 border-red-500/20"
                            }`}
                          >
                            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white">
                                  {result.isHidden ? `Hidden Test ${idx + 1}` : parsedInfo.title}
                                </span>
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                                result.passed
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-red-500/20 text-red-400"
                              }`}>
                                {result.passed ? "✓ Passed" : "✕ Failed"}
                              </span>
                            </div>
                            <div className="p-3 space-y-1.5 font-mono text-xs">
                              {parsedInfo.steps && (
                                <div>
                                  <span className="text-gray-500 font-bold block text-[10px] uppercase">Scenario Steps:</span>
                                  <span className="text-gray-300 leading-relaxed block">{parsedInfo.steps}</span>
                                </div>
                              )}
                              {parsedInfo.assert && (
                                <div>
                                  <span className="text-gray-500 font-bold block text-[10px] uppercase">Assertion:</span>
                                  <span className="text-amber-400 leading-relaxed block">{parsedInfo.assert}</span>
                                </div>
                              )}
                              {!result.passed && result.actualOutput !== undefined && (
                                <div className="flex items-center gap-3 mt-2 text-[11px] pt-1.5 border-t border-white/10">
                                  <span className="text-red-400 font-bold">
                                    Actual Read: <span className="bg-red-500/20 text-red-200 px-1.5 py-0.5 rounded font-mono">"{result.actualOutput}"</span>
                                  </span>
                                  <span className="text-emerald-400 font-bold">
                                    Expected: <span className="bg-emerald-500/20 text-emerald-200 px-1.5 py-0.5 rounded font-mono">"{result.expectedOutput}"</span>
                                  </span>
                                </div>
                              )}
                              {!parsedInfo.assert && (
                                <div>
                                  <span className="text-gray-500">Expected: </span>
                                  <span className="text-green-400 font-bold">{result.expectedOutput}</span>
                                </div>
                              )}
                              {result.error && (
                                <div className="text-red-400 font-bold mt-1 bg-red-500/10 p-2 rounded border border-red-500/20">
                                  Error: {result.error}
                                </div>
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
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-500/20 text-gray-400">Not run</span>
                            </div>
                            <div className="p-3 font-mono text-xs">
                              <div className="text-gray-300 whitespace-pre-wrap">{formatInputDisplay(tc.input)}</div>
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
                <div className="text-gray-500 text-sm text-center py-4">
                  Select a test case to view details.
                </div>
              )}

              {activeTab === "console" && (
                <div className="font-mono text-xs space-y-0.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">Console output from the preview</span>
                    <button
                      onClick={() => setConsoleOutput([])}
                      className="text-xs text-gray-500 hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                  {consoleOutput.length === 0 ? (
                    <div className="text-gray-600 text-sm text-center py-6">
                      Console output will appear here when you run the preview...
                    </div>
                  ) : (
                    consoleOutput.map((line, idx) => (
                      <div key={idx} className={`${line.includes('error') ? 'text-red-400' : line.includes('warn') ? 'text-yellow-400' : line.includes('info') ? 'text-blue-400' : 'text-gray-300'}`}>
                        {line}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === "network" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">
                      {networkRequests.length === 0
                        ? "Requests made by the preview (fetch/XHR) will appear here"
                        : `${networkRequests.length} request${networkRequests.length === 1 ? '' : 's'}`}
                    </span>
                    <button
                      onClick={() => setNetworkRequests([])}
                      className="text-xs text-gray-500 hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                  {networkRequests.length === 0 ? (
                    <div className="text-gray-600 text-sm text-center py-6">
                      No network activity detected.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-gray-500 border-b border-white/10">
                            <th className="py-2 pr-4 font-medium">Status</th>
                            <th className="py-2 pr-4 font-medium">Method</th>
                            <th className="py-2 pr-4 font-medium">Type</th>
                            <th className="py-2 pr-4 font-medium">URL</th>
                            <th className="py-2 pr-4 font-medium text-right">Size</th>
                            <th className="py-2 pr-4 font-medium text-right">Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {networkRequests.map((req) => (
                            <tr key={req.id} className="border-b border-white/5 hover:bg-white/5">
                              <td className="py-1.5 pr-4">
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                  req.status >= 200 && req.status < 300
                                    ? "bg-green-500/20 text-green-400"
                                    : req.status >= 400
                                      ? "bg-red-500/20 text-red-400"
                                      : req.status === 0
                                        ? "bg-gray-500/20 text-gray-400"
                                        : "bg-yellow-500/20 text-yellow-400"
                                }`}>
                                  {req.status || "—"}
                                </span>
                              </td>
                              <td className="py-1.5 pr-4 text-gray-300 font-medium">{req.method}</td>
                              <td className="py-1.5 pr-4 text-gray-500">{req.type}</td>
                              <td className="py-1.5 pr-4 text-gray-300 max-w-[320px] truncate" title={req.url}>{req.url}</td>
                              <td className="py-1.5 pr-4 text-right text-gray-400">
                                {req.size > 0 ? `${(req.size / 1024).toFixed(1)} KB` : "—"}
                              </td>
                              <td className="py-1.5 pr-4 text-right text-gray-400">{req.duration} ms</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
      {/* Floating Glassmorphic HUD Action Dock */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[8000] bg-zinc-900/90 backdrop-blur-md border border-white/15 shadow-2xl rounded-full px-5 py-2 flex items-center gap-3 select-none">
        {/* Run Preview */}
        <button
          onClick={runWebCode}
          disabled={isRunning || isSubmitting}
          className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-full transition-all flex items-center gap-2 text-xs shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          title="Run Preview (Ctrl + ')"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          </svg>
          {isRunning ? "Running..." : "Run Preview"}
        </button>

        {/* Submit Solution */}
        {selectedProblem && (
          <button
            onClick={async () => {
              if (!selectedProblem) return;
              setIsSubmitting(true);
              setSubmitStatus('running');
              setShowOutput(true);
              setActiveTab('tests');
              try {
                if (contestId) {
                  const res = await api.submitContestCode(contestId, {
                    problemId: selectedProblem.id,
                    code: htmlCode, htmlCode, cssCode, jsCode,
                    language: "web-dev"
                  });
                  if (res.passed) {
                    setSubmitStatus('success');
                    setPendingLockProblem({ id: selectedProblem.id, title: selectedProblem.title, score: res.currentScore ?? 0 });
                    setShowFinalLockModal(true);
                  } else {
                    setSubmitStatus('error');
                    notify.toast.error(`Submission Failed: Passed ${res.passedTests}/${res.totalTests} tests.`);
                  }
                } else {
                  const key = getWebCodeStorageKey(selectedProblem.id, contestId);
                  localStorage.setItem(key, JSON.stringify({ htmlCode, cssCode, jsCode }));
                  const res = await api.post("/webdev/submit", { htmlCode, cssCode, jsCode, problemId: selectedProblem.id, contestId });
                  const evaluation = res.evaluation;
                  if (evaluation?.results) {
                    setTestResults(evaluation.results);
                    setTestSummary(evaluation.summary);
                    if (evaluation.rubric) setRubricData(evaluation.rubric);
                  }
                  setSubmitStatus(evaluation?.summary?.failed === 0 ? 'success' : 'error');
                }
              } catch (err) {
                console.error("Web submission error:", err);
                setSubmitStatus('error');
              } finally {
                setIsSubmitting(false);
              }
            }}
            disabled={isSubmitting || isRunning}
            className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-black rounded-full transition-all flex items-center gap-2 text-xs shadow-lg shadow-amber-500/20 disabled:opacity-50"
            title="Submit Solution (Ctrl + Shift + Enter)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            {isSubmitting ? "Submitting..." : "Submit Solution"}
          </button>
        )}

        <div className="w-px h-5 bg-white/15 mx-1" />

        {/* Device Viewport Toggle */}
        <div className="flex items-center bg-white/5 rounded-full p-0.5 border border-white/10">
          {(Object.keys(PREVIEW_DEVICES) as PreviewDevice[]).map((device) => {
            const active = previewDevice === device;
            const cfg = PREVIEW_DEVICES[device];
            return (
              <button
                key={device}
                onClick={() => {
                  setPreviewDevice(device);
                  if (!showWebPreview) setShowWebPreview(true);
                }}
                title={`${cfg.label}${cfg.width ? ` (${cfg.width}px)` : ' (Full width)'}`}
                className={`p-1.5 rounded-full transition-all ${
                  active ? "bg-blue-500 text-white shadow-md shadow-blue-500/30" : "text-gray-400 hover:text-white"
                }`}
              >
                {device === "desktop" && (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )}
                {device === "tablet" && (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                )}
                {device === "mobile" && (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {/* Live Element Inspector Toggle */}
        <button
          onClick={() => {
            const nextState = !isInspectActive;
            setIsInspectActive(nextState);
            const iframe = document.querySelector('iframe[title="Web Preview"]') as HTMLIFrameElement;
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage({ type: 'toggle-inspector', active: nextState }, '*');
            }
          }}
          className={`p-1.5 rounded-full transition-all flex items-center gap-1 text-xs font-bold ${
            isInspectActive ? "bg-blue-500 text-white animate-pulse" : "text-gray-400 hover:text-white hover:bg-white/10"
          }`}
          title="Toggle Element Inspector"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="hidden lg:inline">{isInspectActive ? "Inspecting..." : "Inspect"}</span>
        </button>
      </div>

      {/* Live Element Inspector Card */}
      {inspectedElement && isInspectActive && (
        <div className="fixed top-20 right-6 z-[8500] bg-zinc-900/95 border border-blue-500/40 rounded-xl p-3 shadow-2xl max-w-xs text-xs font-mono text-white space-y-1.5 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/10 pb-1">
            <span className="font-bold text-blue-400">&lt;{inspectedElement.tagName}&gt;</span>
            <button onClick={() => setInspectedElement(null)} className="text-gray-400 hover:text-white text-xs">✕</button>
          </div>
          {inspectedElement.id && <div><span className="text-gray-400">id:</span> <span className="text-amber-300">#{inspectedElement.id}</span></div>}
          {inspectedElement.className && <div><span className="text-gray-400">class:</span> <span className="text-green-300">.{inspectedElement.className}</span></div>}
          <div><span className="text-gray-400">bounds:</span> <span className="text-white">{inspectedElement.width}px × {inspectedElement.height}px</span></div>
          <div><span className="text-gray-400">display:</span> <span className="text-purple-300">{inspectedElement.display}</span></div>
          <div><span className="text-gray-400">color:</span> <span className="text-white">{inspectedElement.color}</span></div>
          <div><span className="text-gray-400">font:</span> <span className="text-white">{inspectedElement.fontSize} ({inspectedElement.fontFamily.split(',')[0]})</span></div>
        </div>
      )}

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
                  const newLocked = new Set([...lockedProblems, pendingLockProblem.id]);
                  setLockedProblems(newLocked);
                  sessionStorage.setItem(`lockedProblems_${contestId}`, JSON.stringify([...newLocked]));
                  setShowFinalLockModal(false);
                  setPendingLockProblem(null);
                  notify.toast.success("Problem locked! Returning to contest.");
                  setTimeout(() => navigate(`/contests/${contestId}`), 500);
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

      {/* Command Palette Modal (Ctrl+K) */}
      {showCommandPalette && (
        <div
          className="fixed inset-0 z-[9999] flex items-start justify-center pt-20 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowCommandPalette(false)}
        >
          <div
            className="bg-zinc-900 border border-white/10 rounded-2xl max-w-lg w-full mx-4 shadow-2xl overflow-hidden space-y-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center px-4 py-3 border-b border-white/10 bg-white/5">
              <svg className="w-5 h-5 text-gray-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                autoFocus
                placeholder="Type a command or action (Ctrl+K)..."
                value={commandPaletteQuery}
                onChange={(e) => setCommandPaletteQuery(e.target.value)}
                className="w-full bg-transparent text-white text-sm focus:outline-none placeholder-gray-500"
              />
              <kbd className="px-2 py-0.5 text-xs bg-white/10 text-gray-400 rounded flex-shrink-0">ESC</kbd>
            </div>
            <div className="max-h-72 overflow-auto p-2 space-y-1">
              {[
                { title: 'Run Web Preview', shortcut: "Ctrl + '", action: () => { runWebCode(); setShowCommandPalette(false); } },
                { title: 'Switch to HTML Editor Tab', shortcut: 'HTML', action: () => { setWebLanguage('html'); setShowCommandPalette(false); } },
                { title: 'Switch to CSS Editor Tab', shortcut: 'CSS', action: () => { setWebLanguage('css'); setShowCommandPalette(false); } },
                { title: 'Switch to JavaScript Editor Tab', shortcut: 'JS', action: () => { setWebLanguage('javascript'); setShowCommandPalette(false); } },
                { title: 'Viewport: Desktop (100% Fluid)', shortcut: 'Desktop', action: () => { setPreviewDevice('desktop'); setShowCommandPalette(false); } },
                { title: 'Viewport: Tablet (768px)', shortcut: '768px', action: () => { setPreviewDevice('tablet'); setShowCommandPalette(false); } },
                { title: 'Viewport: Mobile (375px)', shortcut: '375px', action: () => { setPreviewDevice('mobile'); setShowCommandPalette(false); } },
                { title: 'Toggle Editor Settings', shortcut: 'Settings', action: () => { setShowSettings((prev) => !prev); setShowCommandPalette(false); } },
                { title: 'Reset Code to Problem Starter', shortcut: 'Reset', action: () => { if (selectedProblem?.starterCode) { setHtmlCode(selectedProblem.starterCode.html || ''); setCssCode(selectedProblem.starterCode.css || ''); setJsCode(selectedProblem.starterCode.js || ''); } setShowCommandPalette(false); } },
              ]
                .filter((cmd) => cmd.title.toLowerCase().includes(commandPaletteQuery.toLowerCase()))
                .map((cmd, idx) => (
                  <button
                    key={idx}
                    onClick={cmd.action}
                    className="w-full flex items-center justify-between px-3 py-2 text-left rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <span>{cmd.title}</span>
                    <span className="text-xs text-gray-500 font-mono">{cmd.shortcut}</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
      {/* Submit & Lock Problem Confirmation Modal */}
      <ProblemLockConfirmationModal
        isOpen={showLockConfirmModal}
        problemTitle={lockConfirmData.problemTitle || selectedProblem?.title || 'Web Problem'}
        scoreEarned={lockConfirmData.scoreEarned}
        maxPoints={lockConfirmData.maxScore}
        onConfirm={handleConfirmLockProblem}
        onCancel={() => setShowLockConfirmModal(false)}
      />
      </div>
    </div>
  );

  if (contestId && !contestFlags) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--bg-primary)] text-white">
        <div className="flex flex-col items-center gap-4">
          <svg className="w-8 h-8 animate-spin text-[var(--accent-blue)]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-medium">Entering Secure Environment...</span>
        </div>
      </div>
    );
  }

  if (contestId && contestFlags && !embeddedInContest) {
    return (
      <SecureContestWrapper contestId={contestId} flags={contestFlags}>
        {playgroundLayout}
      </SecureContestWrapper>
    );
  }

  return playgroundLayout;
}
