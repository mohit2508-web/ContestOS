import Editor from "@monaco-editor/react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from 'react-router-dom';

import { api } from "../services/api";
import { FREE_MODE_DEFAULT } from "./playground/constants";
import { formatInputDisplay } from "./playground/helpers";
import { ProblemsModal } from "./playground/ProblemsModal";
import MarkdownRenderer from "../components/MarkdownRenderer";
import type { TestCase, TestResult, Problem } from "./playground/types";
import { useSidebar } from '../contexts/SidebarContext';
import { useNotify } from '../components/notifications';
import { SecureContestWrapper } from '../components/SecureContestWrapper';
import { formatProblemDescriptionWithImages } from '../utils/formatProblemDescription';

export function WebPlaygroundPage({ embeddedInContest }: { embeddedInContest?: boolean } = {}) {
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
  const [webLanguage, setWebLanguage] = useState<"html" | "css" | "javascript">("html");

  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testSummary, setTestSummary] = useState<{ passed: number; failed: number; total: number } | null>(null);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);

  const [problems, setProblems] = useState<Problem[]>([]);
  const [totalProblems, setTotalProblems] = useState(0);
  const [problemSearchQuery, setProblemSearchQuery] = useState("");
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [showProblems, setShowProblems] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [isLoadingProblems, setIsLoadingProblems] = useState(false);
  const [activeTab, setActiveTab] = useState<"tests" | "output">("tests");
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

  const [leftPanelWidth, setLeftPanelWidth] = useState(35);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(30);
  const [showOutput, setShowOutput] = useState(false);
  const [showWebPreview, setShowWebPreview] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewSnapshot, setPreviewSnapshot] = useState<{htmlCode: string; cssCode: string; jsCode: string} | null>(null);

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
    if (!modelsRef.current.has(modelKey)) {
      let ext = 'html';
      if (langVal === 'css') ext = 'css';
      else if (langVal === 'javascript') ext = 'js';
      
      const uri = monacoRef.current.Uri.parse(`file:///${problemId}_${langVal}.${ext}`);
      let model = monacoRef.current.editor.getModel(uri);
      if (!model) {
        model = monacoRef.current.editor.createModel(codeVal, langVal, uri);
      }
      modelsRef.current.set(modelKey, model);
    }
    return modelsRef.current.get(modelKey);
  };

  useEffect(() => {
    if (editorRef.current && monacoRef.current && selectedProblem) {
      const activeCode = webLanguage === "html" ? htmlCode : webLanguage === "css" ? cssCode : jsCode;
      const model = getOrCreateModel(selectedProblem.id, activeCode, webLanguage);
      if (model) {
        editorRef.current.setModel(model);
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
    const savedProblemId = localStorage.getItem('web_playground_selected_problem');

    if (playMode === "free" && !cid) {
      setHtmlCode(FREE_MODE_DEFAULT);
      setCssCode("");
      setJsCode("");
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
            localStorage.removeItem('web_playground_selected_problem');
            selectProblem(problems[0]);
          }
        } catch (err) {
          console.error("Failed to fetch target web-dev problem:", err);
          if (!cid && problems.length > 0) {
            localStorage.removeItem('web_playground_selected_problem');
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
      const savedKey = `web_playground_${selectedProblem.id}_web`;
      const savedWebCode = localStorage.getItem(savedKey);
      if (savedWebCode) {
        try {
          const parsed = JSON.parse(savedWebCode);
          setHtmlCode(parsed.htmlCode || "");
          setCssCode(parsed.cssCode || "");
          setJsCode(parsed.jsCode || "");
        } catch (err) { console.error('Operation failed:', err); }
      } else {
        const htmlStarter = selectedProblem.starterCode?.html || "";
        const cssStarter = selectedProblem.starterCode?.css || "";
        const jsStarter = selectedProblem.starterCode?.js || "";
        if (htmlStarter) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlStarter, 'text/html');
          const styleTag = doc.querySelector('style');
          const scriptTag = doc.querySelector('script');
          const bodyContent = doc.body.innerHTML;
          setHtmlCode(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Web Page</title>
</head>
<body>
${bodyContent}
</body>
</html>`);
          setCssCode(styleTag ? styleTag.innerHTML : cssStarter);
          setJsCode(scriptTag ? scriptTag.innerHTML : jsStarter);
        } else {
          setHtmlCode(`<!DOCTYPE html>
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
</html>`);
          setCssCode("");
          setJsCode("");
        }
      }
    }
  }, [selectedProblem?.id]);

  useEffect(() => {
    if (!selectedProblem) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const key = `web_playground_${selectedProblem.id}_web`;
      localStorage.setItem(key, JSON.stringify({ htmlCode, cssCode, jsCode }));
      saveDraftToServer();
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [htmlCode, cssCode, jsCode, selectedProblem]);

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
        (async () => {
          try {
            const key = `web_playground_${selectedProblem.id}_web`;
            localStorage.setItem(key, JSON.stringify({ htmlCode, cssCode, jsCode }));
            const res = await api.post("/webdev/submit", {
              htmlCode, cssCode, jsCode,
              problemId: selectedProblem.id
            });
            const evaluation = res.evaluation;
            if (evaluation?.results) {
              setTestResults(evaluation.results);
              setTestSummary(evaluation.summary);
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

  const fetchAllProblems = async (problemType?: string, opts?: { skip?: number; search?: string }) => {
    try {
      setIsLoadingProblems(true);
      const params = new URLSearchParams({ type: problemType || "web-dev", take: "200" });
      if (opts?.skip) params.set('skip', opts.skip.toString());
      if (opts?.search) params.set('search', opts.search);
      const response = await api.get(`/problems?${params}`);
      // Strictly filter for web/web-dev problems only — never show code or SQL problems
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
    setPreviewSnapshot(null);
    setHtmlCode("");
    setCssCode("");
    setJsCode("");

    setSelectedProblem(problem);
    localStorage.setItem('web_playground_selected_problem', problem.id);
    setRunStatus('idle');
    setSubmitStatus('idle');

    const params = new URLSearchParams(window.location.search);
    params.set('problem', problem.id);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newUrl);

    if (problem.problemType === "web-dev") {
      const savedKey = `web_playground_${problem.id}_web`;
      const savedWebCode = localStorage.getItem(savedKey);

      if (savedWebCode) {
        try {
          const parsed = JSON.parse(savedWebCode);
          setHtmlCode(parsed.htmlCode || "");
          setCssCode(parsed.cssCode || "");
          setJsCode(parsed.jsCode || "");
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
          setHtmlCode(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Web Page</title>
</head>
<body>
${bodyContent}
</body>
</html>`);
          setCssCode(extractedCss);
          setJsCode(extractedJs);
        } else {
          setHtmlCode(`<!DOCTYPE html>
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
</html>`);
          setCssCode("");
          setJsCode("");
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
    setShowWebPreview(true);
    setPreviewKey(prev => prev + 1);
    setPreviewSnapshot({ htmlCode, cssCode, jsCode });
    setIsRunning(true);
    setRunStatus('running');

    if (selectedProblem?.id) {
      setShowOutput(true);
      try {
        const res = await api.post("/webdev/evaluate", {
          htmlCode, cssCode, jsCode,
          problemId: selectedProblem.id
        });
        setTestResults(res.results || []);
        setTestSummary(res.summary || null);
        setSubmitStatus(res.summary?.failed === 0 ? 'success' : 'error');
        setRunStatus('success');
      } catch (err) {
        console.error("Web evaluation error:", err);
        setRunStatus('error');
      } finally {
        setIsRunning(false);
      }
    } else {
      setIsRunning(false);
      setRunStatus('success');
    }
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
    html = html.replace('</body>', `${anchorFixScript}</body>`);

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
    html = html.replace('</body>', `${blockExternalLinksScript}</body>`);

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

    if (cssToUse) {
      html = html.replace('</head>', `<style>${cssToUse}</style></head>`);
    }

    html = html.replace('<head>', `<head>${consoleCapture}`);

    if (jsToUse) {
      const wrappedJs = `
        try {
          document.addEventListener('DOMContentLoaded', function() {
            ${jsToUse}
          });
        } catch(e) {
          console.warn('[JS Error] ' + e.message);
        }
      `;
      html = html.replace('</body>', `<script>${wrappedJs}</script></body>`);
    }

    return html;
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'console') {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = `[${timestamp}]`;
        const method = event.data.method;
        const args = event.data.args.join(' ');
        setConsoleOutput(prev => [...prev.slice(-99), `${prefix} ${method === 'log' ? '' : method.toUpperCase()}: ${args}`]);
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
    <div ref={containerRef} className="h-screen md:h-[calc(100vh-4rem)] flex bg-[var(--bg-primary)] select-none">
      {/* Left Panel - Problem Description */}
      {playMode !== "free" && (
        <div
          ref={leftPanelRef}
          className={`flex-col border-r border-white/10 relative overflow-hidden ${
            showLeftPanel ? "flex" : "hidden"
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
            {!contestId && (
              <>
                <button
                  onClick={() => {
                    setPlayMode("free");
                    setHtmlCode(FREE_MODE_DEFAULT);
                    setCssCode("");
                    setJsCode("");
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
                  }}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                    playMode === "problem" ? "bg-[var(--accent-blue)] text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Problems
                </button>
              </>
            )}
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
                  setHtmlCode(selectedProblem.starterCode.html || "");
                  setCssCode(selectedProblem.starterCode.css || "");
                  setJsCode(selectedProblem.starterCode.js || "");
                } else {
                  setHtmlCode(FREE_MODE_DEFAULT);
                  setCssCode("");
                  setJsCode("");
                }
              }}
              className="px-3 py-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all text-sm"
            >
              Reset
            </button>

            {/* HTML/CSS/JS file selector */}
            <div className="flex items-center bg-white/5 rounded-lg p-1">
              <button
                onClick={() => setWebLanguage("html")}
                className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                  webLanguage === "html"
                    ? "bg-orange-500 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                HTML
              </button>
              <button
                onClick={() => setWebLanguage("css")}
                className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                  webLanguage === "css"
                    ? "bg-blue-500 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                CSS
              </button>
              <button
                onClick={() => setWebLanguage("javascript")}
                className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                  webLanguage === "javascript"
                    ? "bg-yellow-500 text-black"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                JS
              </button>
            </div>

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
                try {
                  if (contestId) {
                    const res = await api.submitContestCode(contestId, {
                      problemId: selectedProblem.id,
                      code: htmlCode,
                      htmlCode,
                      cssCode,
                      jsCode,
                      language: "web-dev"
                    });
                    
                    if (res.passed) {
                      setSubmitStatus('success');
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
                  } else {
                    const key = `web_playground_${selectedProblem.id}_web`;
                    localStorage.setItem(key, JSON.stringify({ htmlCode, cssCode, jsCode }));
                    const res = await api.post("/webdev/submit", {
                      htmlCode, cssCode, jsCode,
                      problemId: selectedProblem.id
                    });
                    const evaluation = res.evaluation;
                    if (evaluation?.results) {
                      setTestResults(evaluation.results);
                      setTestSummary(evaluation.summary);
                    }
                    setSubmitStatus(evaluation?.summary?.failed === 0 ? 'success' : 'error');
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
              className="px-4 py-1.5 bg-[var(--accent-blue)] hover:bg-blue-500 text-white font-bold rounded-lg transition-all flex items-center gap-2 text-sm disabled:opacity-50"
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
          className="min-h-0 transition-all duration-75 flex"
          style={{ flex: showOutput ? `1 1 ${100 - bottomPanelHeight}%` : '1 1 100%' }}
        >
          {/* Code Editor - half width in web mode with preview */}
          <div
            className={`flex-1 min-h-0 ${showWebPreview ? "w-1/2 border-r border-white/10" : ""}`}
          >
            <Editor
              key="web-contest-editor"
              height="100%"
              language={webLanguage}
              defaultValue={webLanguage === "html" ? htmlCode : webLanguage === "css" ? cssCode : jsCode}
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
                  <button
                    onClick={() => {
                      setShowWebPreview(false);
                      setConsoleOutput([]);
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
              <div className="flex-1 bg-white rounded-lg m-2 overflow-hidden mb-2">
                <iframe
                  key={previewKey}
                  srcDoc={getWebPreview()}
                  className="w-full h-full"
                  sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
                  title="Web Preview"
                />
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

        {/* Output Panel - test results for web mode */}
        {showOutput && testResults.length > 0 && (
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
                        return (
                          <div
                            key={idx}
                            className={`rounded-lg border ${
                              result.passed
                                ? "bg-green-500/5 border-green-500/20"
                                : "bg-red-500/5 border-red-500/20"
                            }`}
                          >
                            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
                              <span className="text-sm font-medium text-white">
                                {result.isHidden ? `Hidden ${idx + 1}` : `Case ${idx + 1}`}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                result.passed
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-red-500/20 text-red-400"
                              }`}>
                                {result.passed ? "Passed" : "Failed"}
                              </span>
                            </div>
                            <div className="p-3 space-y-2 font-mono text-xs">
                              <div>
                                <span className="text-gray-500">Input: </span>
                                <span className="text-gray-300 whitespace-pre-wrap">{formatInputDisplay(result.input)}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Output: </span>
                                <span className={result.passed ? "text-green-400" : "text-red-400"}>{result.actualOutput}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Expected: </span>
                                <span className="text-green-400">{result.expectedOutput}</span>
                              </div>
                              {result.error && (
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
            </div>

            {/* Keyboard Shortcuts */}
            <div className="px-4 py-2 border-t border-white/10 text-xs text-gray-500 flex gap-4 flex-shrink-0">
              <span><kbd className="px-1 py-0.5 bg-white/10 rounded">Ctrl</kbd> + <kbd className="px-1 py-0.5 bg-white/10 rounded">'</kbd> Run</span>
              <span><kbd className="px-1 py-0.5 bg-white/10 rounded">Ctrl</kbd> + <kbd className="px-1 py-0.5 bg-white/10 rounded">Shift</kbd> + <kbd className="px-1 py-0.5 bg-white/10 rounded">Enter</kbd> Submit</span>
            </div>
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
