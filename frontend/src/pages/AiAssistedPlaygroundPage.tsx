import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { VibeAssistantPanel } from '../components/assistant/VibeAssistantPanel';
import { KryptaviaLogo } from '../components/common/KryptaviaLogo';
import { useAuth } from '../contexts/AuthContext';
import { useNotify } from '../components/notifications';
import { api } from '../services/api';
import MarkdownRenderer from '../components/MarkdownRenderer';

const DEFAULT_STARTER_TEMPLATES: Record<string, string> = {
  c: `struct TreeNode
{
    int data;
    int val;
    struct TreeNode* left;
    struct TreeNode* right;
};

static long long gcd_c(long long a, long long b) {
    while (b) { long long t = a % b; a = b; b = t; }
    return a;
}

static long long lcm_c(long long a, long long b) {
    if (a == 0 || b == 0) return 0;
    return (a / gcd_c(a, b)) * b;
}

struct TreeNode* LCMOfTrees(struct TreeNode* root1, struct TreeNode* root2)
{
    if (root1 == NULL && root2 == NULL) return NULL;

    int v1 = root1 ? (root1->data != 0 ? root1->data : root1->val) : 0;
    int v2 = root2 ? (root2->data != 0 ? root2->data : root2->val) : 0;
    int resVal = 0;

    if (root1 != NULL && root2 != NULL) resVal = (int)lcm_c(v1, v2);
    else if (root1 != NULL) resVal = v1;
    else resVal = v2;

    struct TreeNode* newNode = (struct TreeNode*)malloc(sizeof(struct TreeNode));
    newNode->data = resVal;
    newNode->val = resVal;
    newNode->left = LCMOfTrees(root1 ? root1->left : NULL, root2 ? root2->left : NULL);
    newNode->right = LCMOfTrees(root1 ? root1->right : NULL, root2 ? root2->right : NULL);
    return newNode;
}`,
  cpp: `#include <iostream>
#include <algorithm>
using namespace std;

struct TreeNode {
    int data;
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode() : data(0), val(0), left(nullptr), right(nullptr) {}
    TreeNode(int x) : data(x), val(x), left(nullptr), right(nullptr) {}
};

static long long gcd_cpp(long long a, long long b) {
    while (b) { long long t = a % b; a = b; b = t; }
    return a;
}

static long long lcm_cpp(long long a, long long b) {
    if (a == 0 || b == 0) return 0;
    return (a / gcd_cpp(a, b)) * b;
}

TreeNode* LCMOfTrees(TreeNode* root1, TreeNode* root2) {
    if (!root1 && !root2) return nullptr;

    int v1 = root1 ? (root1->data != 0 ? root1->data : root1->val) : 0;
    int v2 = root2 ? (root2->data != 0 ? root2->data : root2->val) : 0;
    int resVal = 0;

    if (root1 && root2) resVal = (int)lcm_cpp(v1, v2);
    else if (root1) resVal = v1;
    else resVal = v2;

    TreeNode* newNode = new TreeNode(resVal);
    newNode->left = LCMOfTrees(root1 ? root1->left : nullptr, root2 ? root2->left : nullptr);
    newNode->right = LCMOfTrees(root1 ? root1->right : nullptr, root2 ? root2->right : nullptr);
    return newNode;
}`,
  java: `public class Solution {
    static class TreeNode {
        int data;
        int val;
        TreeNode left;
        TreeNode right;
        TreeNode(int x) { this.data = x; this.val = x; }
    }

    private static long gcd(long a, long b) {
        while (b != 0) { long t = a % b; a = b; b = t; }
        return a;
    }

    private static long lcm(long a, long b) {
        if (a == 0 || b == 0) return 0;
        return (a / gcd(a, b)) * b;
    }

    public TreeNode LCMOfTrees(TreeNode root1, TreeNode root2) {
        if (root1 == null && root2 == null) return null;

        int v1 = root1 != null ? (root1.data != 0 ? root1.data : root1.val) : 0;
        int v2 = root2 != null ? (root2.data != 0 ? root2.data : root2.val) : 0;
        int resVal = 0;

        if (root1 != null && root2 != null) resVal = (int)lcm(v1, v2);
        else if (root1 != null) resVal = v1;
        else resVal = v2;

        TreeNode newNode = new TreeNode(resVal);
        newNode.left = LCMOfTrees(root1 != null ? root1.left : null, root2 != null ? root2.left : null);
        newNode.right = LCMOfTrees(root1 != null ? root1.right : null, root2 != null ? root2.right : null);
        return newNode;
    }
}`,
  python: `import math

class TreeNode:
    def __init__(self, data=0, left=None, right=None):
        self.data = data
        self.val = data
        self.left = left
        self.right = right

def LCMOfTrees(root1: TreeNode, root2: TreeNode) -> TreeNode:
    if not root1 and not root2:
        return None

    v1 = getattr(root1, 'data', getattr(root1, 'val', 0)) if root1 else 0
    v2 = getattr(root2, 'data', getattr(root2, 'val', 0)) if root2 else 0

    if root1 and root2:
        if v1 == 0 or v2 == 0:
            res_val = 0
        elif hasattr(math, 'lcm'):
            res_val = math.lcm(v1, v2)
        else:
            g = math.gcd(v1, v2)
            res_val = (v1 * v2) // g if g != 0 else 0
    elif root1:
        res_val = v1
    else:
        res_val = v2

    new_node = TreeNode(res_val)
    new_node.left = LCMOfTrees(root1.left if root1 else None, root2.left if root2 else None)
    new_node.right = LCMOfTrees(root1.right if root1 else None, root2.right if root2 else None)
    return new_node`,
  javascript: `function TreeNode(data, left, right) {
    this.data = (data === undefined ? 0 : data);
    this.val = (data === undefined ? 0 : data);
    this.left = (left === undefined ? null : left);
    this.right = (right === undefined ? null : right);
}

function gcd(a, b) {
    while (b) { let t = a % b; a = b; b = t; }
    return a;
}

function lcm(a, b) {
    if (a === 0 || b === 0) return 0;
    return (a / gcd(a, b)) * b;
}

function LCMOfTrees(root1, root2) {
    if (!root1 && !root2) return null;

    let v1 = root1 ? (root1.data !== undefined ? root1.data : root1.val) : 0;
    let v2 = root2 ? (root2.data !== undefined ? root2.data : root2.val) : 0;
    let resVal = 0;

    if (root1 && root2) resVal = lcm(v1, v2);
    else if (root1) resVal = v1;
    else resVal = v2;

    let newNode = new TreeNode(resVal);
    newNode.left = LCMOfTrees(root1 ? root1.left : null, root2 ? root2.left : null);
    newNode.right = LCMOfTrees(root1 ? root1.right : null, root2 ? root2.right : null);
    return newNode;
}`
};

interface TestCaseResult {
  id: number;
  name: string;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  executionTime: string;
  memoryUsage: string;
  exitCode: number;
  error?: string;
  isHidden?: boolean;
}

interface AiAssistedPlaygroundPageProps {
  isContestMode?: boolean;
  candidateId?: string;
  candidateName?: string;
}

const DEFAULT_PROBLEM_TEST_CASES = [
  {
    id: 1,
    name: 'Test Case #1',
    input: 'root1: [2, 3, 5, null, null, 1, 7]\nroot2: [5, 6, 3, null, null, 2, 8]',
    expectedOutput: '[10, 6, 15, null, null, 2, 56]',
    isHidden: false,
  },
  {
    id: 2,
    name: 'Test Case #2',
    input: 'root1: [4, 9, 2]\nroot2: [8, 3, 6]',
    expectedOutput: '[8, 9, 6]',
    isHidden: false,
  },
  {
    id: 3,
    name: 'Hidden Test Case #3',
    input: 'root1: [1, 12, 15]\nroot2: [7, 4, 5]',
    expectedOutput: '[7, 12, 15]',
    isHidden: true,
  },
  {
    id: 4,
    name: 'Hidden Test Case #4',
    input: 'root1: [6, 14, 20]\nroot2: [9, 21, 10]',
    expectedOutput: '[18, 42, 20]',
    isHidden: true,
  },
  {
    id: 5,
    name: 'Hidden Test Case #5',
    input: 'root1: [3, null, 8]\nroot2: [12, null, 4]',
    expectedOutput: '[12, null, 8]',
    isHidden: true,
  }
];

export function AiAssistedPlaygroundPage({
  isContestMode = false,
  candidateId = '17100641',
  candidateName
}: AiAssistedPlaygroundPageProps) {
  const { user } = useAuth();
  const notify = useNotify();
  const [problemsList, setProblemsList] = useState<any[]>([]);
  const [selectedProblem, setSelectedProblem] = useState<any>(null);
  const [showProblemsModal, setShowProblemsModal] = useState(false);
  const [problemSearchQuery, setProblemSearchQuery] = useState('');

  useEffect(() => {
    const fetchVibeProblems = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const problemIdParam = params.get('problem');

        let res = await api.get('/problems?type=vibe-code&take=200').catch(() => null);
        let list = res?.problems || [];

        if (list.length === 0) {
          res = await api.get('/problems?take=200').catch(() => null);
          list = res?.problems || [];
        }
        setProblemsList(list);

        if (problemIdParam) {
          const detailRes = await api.getProblem(problemIdParam).catch(() => null);
          if (detailRes?.problem) {
            setSelectedProblem(detailRes.problem);
            return;
          }
        }
        if (list.length > 0) {
          const detailRes = await api.getProblem(list[0].id).catch(() => null);
          setSelectedProblem(detailRes?.problem || list[0]);
        }
      } catch (err) {
        console.error("Failed to load vibe problems:", err);
      }
    };
    fetchVibeProblems();
  }, []);

  const [showAssistant, setShowAssistant] = useState(true);
  const [layoutMode, setLayoutMode] = useState<'3-column' | 'tabbed'>('tabbed');
  const [activeRightTab, setActiveRightTab] = useState<'coding' | 'assistant'>('assistant');
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  const [language, setLanguage] = useState<string>(() => {
    const saved = localStorage.getItem('kryptavia_playground_lang');
    return (saved && ['cpp', 'java', 'python'].includes(saved)) ? saved : 'cpp';
  });

  const [code, setCode] = useState<string>(() => {
    const savedLang = localStorage.getItem('kryptavia_playground_lang') || 'cpp';
    const activeLang = ['cpp', 'java', 'python'].includes(savedLang) ? savedLang : 'cpp';
    const savedCode = localStorage.getItem(`kryptavia_code_${activeLang}`);
    return savedCode || (DEFAULT_STARTER_TEMPLATES[activeLang] || DEFAULT_STARTER_TEMPLATES.cpp);
  });

  const [isDayMode, setIsDayMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem('kryptavia_playground_theme');
    return savedTheme ? savedTheme === 'day' : true;
  });

  // Persist code changes in localStorage per language
  useEffect(() => {
    if (code) {
      localStorage.setItem(`kryptavia_code_${language}`, code);
    }
  }, [code, language]);

  // Persist language selection in localStorage
  useEffect(() => {
    localStorage.setItem('kryptavia_playground_lang', language);
  }, [language]);

  // Persist Day/Dark mode theme selection in localStorage
  useEffect(() => {
    localStorage.setItem('kryptavia_playground_theme', isDayMode ? 'day' : 'dark');
  }, [isDayMode]);
  const [isRunning, setIsRunning] = useState(false);
  const [executionStatus, setExecutionStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [customInput, setCustomInput] = useState('root1: [2, 3, 5, null, null, 1, 7]\nroot2: [5, 6, 3, null, null, 2, 8]');
  const [testAgainstCustomInput, setTestAgainstCustomInput] = useState(false);
  const [output, setOutput] = useState('');
  const [showOutputPanel, setShowOutputPanel] = useState(false);
  const [activeTestTab, setActiveTestTab] = useState<string>('tc1');
  const [timerSeconds, setTimerSeconds] = useState(1230);
  const [cursorPos, setCursorPos] = useState({ line: 11, column: 2 });
  const [previousCodeVersion, setPreviousCodeVersion] = useState('Select');

  // Dynamic Mouse Drag Resizing Heights & Widths (Candidate Controlled)
  const [problemPanelHeight, setProblemPanelHeight] = useState(200); // vertical height px
  const [assistantWidthPercent, setAssistantWidthPercent] = useState(50); // horizontal width %
  const [resultsPanelHeight, setResultsPanelHeight] = useState(240); // vertical height px

  // Submission Result Modal State
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [submissionDetails, setSubmissionDetails] = useState<{
    score: number;
    totalMarks: number;
    samplePassed: number;
    sampleTotal: number;
    hiddenPassed: number;
    hiddenTotal: number;
    totalPassed: number;
    totalCount: number;
    isAccepted: boolean;
  } | null>(null);

  // Real Test Case Results State
  const [testResults, setTestResults] = useState<TestCaseResult[]>(
    DEFAULT_PROBLEM_TEST_CASES.map(tc => ({
      id: tc.id,
      name: tc.name,
      passed: false,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      actualOutput: 'Not Executed',
      executionTime: '0 ms',
      memoryUsage: '1804 bytes',
      exitCode: 1,
      isHidden: tc.isHidden
    }))
  );
  const [testSummary, setTestSummary] = useState<{ passed: number; total: number }>({ passed: 0, total: 5 });

  useEffect(() => {
    if (!isContestMode) return;
    const timer = setInterval(() => {
      setTimerSeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isContestMode]);

  // ── Drag Resizing Handlers ──────────────────────────────────────────────────
  const handleProblemResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = problemPanelHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const maxAllowed = Math.min(380, window.innerHeight - 280);
      const newHeight = Math.max(80, Math.min(maxAllowed, startHeight + deltaY));
      setProblemPanelHeight(newHeight);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleHorizontalSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const container = document.getElementById('main-workspace-container');
    if (!container) return;
    const containerWidth = container.clientWidth;
    const startPercent = assistantWidthPercent;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / containerWidth) * 100;
      const newAssistantPercent = Math.max(20, Math.min(80, startPercent - deltaPercent));
      setAssistantWidthPercent(newAssistantPercent);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleResultsResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = resultsPanelHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY; // dragging up increases height
      const newHeight = Math.max(100, Math.min(420, startHeight + deltaY));
      setResultsPanelHeight(newHeight);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    localStorage.setItem('kryptavia_playground_lang', newLang);
    const savedCode = localStorage.getItem(`kryptavia_code_${newLang}`);
    const template = savedCode || (DEFAULT_STARTER_TEMPLATES[newLang] || DEFAULT_STARTER_TEMPLATES.c);
    setCode(template);
    setExecutionStatus('idle');
    setShowOutputPanel(false);
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return {
      mins: String(mins).padStart(2, '0'),
      secs: String(secs).padStart(2, '0')
    };
  };

  const timer = formatTimer(timerSeconds);

  const handleInsertCodeFromAI = (newCode: string) => {
    setCode(newCode);
    setExecutionStatus('idle');
  };

  const handleRunCode = async (isCustom: boolean = false, isSubmission: boolean = false) => {
    setIsRunning(true);
    setShowOutputPanel(true);
    if (isCustom || testAgainstCustomInput) {
      setActiveTestTab('custom');
    } else {
      setActiveTestTab('tc1');
    }

    // Determine test suite to execute
    const testCasesToRun = isSubmission
      ? DEFAULT_PROBLEM_TEST_CASES
      : (isCustom || testAgainstCustomInput ? [] : DEFAULT_PROBLEM_TEST_CASES.filter(tc => !tc.isHidden));

    try {
      if (isCustom || testAgainstCustomInput) {
        const res = await api.post('/code/run', {
          language,
          code,
          input: customInput
        });
        const rawOutput = res.output || res.stdout || 'Code executed successfully.';
        setOutput(rawOutput);
        setExecutionStatus(res.success ? 'success' : 'failed');
      } else {
        // REAL Backend Test Suite Execution via Docker Piston API Engine
        const response = await api.post('/code/run-tests', {
          language,
          code,
          testCases: testCasesToRun
        });

        const backendResults = response.results || [];
        const summary = response.summary || { passed: 0, total: testCasesToRun.length };

        const updatedTestCases: TestCaseResult[] = testCasesToRun.map((tc, idx) => {
          const res = backendResults[idx] || {};
          const isPassed = Boolean(res.passed);
          return {
            id: tc.id,
            name: tc.name,
            passed: isPassed,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: res.actualOutput || res.error || (isPassed ? tc.expectedOutput : 'No Output / Compilation Error'),
            executionTime: `${res.executionTime || 18} ms`,
            memoryUsage: `${res.memoryUsed || 1804} bytes`,
            exitCode: isPassed ? 0 : 1,
            error: res.error,
            isHidden: tc.isHidden
          };
        });

        setTestResults(updatedTestCases);
        setTestSummary({ passed: summary.passed || 0, total: summary.total || testCasesToRun.length });
        const allPassed = summary.passed === summary.total && summary.total > 0;
        setExecutionStatus(allPassed ? 'success' : 'failed');
        setOutput(backendResults.map((r: any, i: number) => `Test Case #${i+1}: ${r.passed ? 'PASSED' : 'FAILED'} | ${r.error || r.actualOutput || ''}`).join('\n'));
        setPreviousCodeVersion(`Compiled at ${new Date().toLocaleTimeString()}`);

        if (isSubmission) {
          const sampleCases = updatedTestCases.filter(tc => !tc.isHidden);
          const hiddenCases = updatedTestCases.filter(tc => tc.isHidden);
          const samplePassed = sampleCases.filter(tc => tc.passed).length;
          const hiddenPassed = hiddenCases.filter(tc => tc.passed).length;
          const totalPassed = updatedTestCases.filter(tc => tc.passed).length;
          const totalCount = updatedTestCases.length;
          const finalScore = Math.round((totalPassed / totalCount) * 50);

          setSubmissionDetails({
            score: finalScore,
            totalMarks: 50,
            samplePassed,
            sampleTotal: sampleCases.length,
            hiddenPassed,
            hiddenTotal: hiddenCases.length,
            totalPassed,
            totalCount,
            isAccepted: totalPassed === totalCount
          });
          setShowSubmissionModal(true);

          if (totalPassed === totalCount) {
            notify.success(`🎉 SUBMISSION ACCEPTED! Score: ${finalScore}/50 Marks (100% Passed)`);
          } else {
            notify.warning(`Submission Evaluated: Score ${finalScore}/50 Marks (${totalPassed}/${totalCount} Test Cases Passed)`);
          }
        }
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || 'Execution error';
      setOutput(errMsg);
      setExecutionStatus('failed');
      notify.error(`Execution failed: ${errMsg}`);
    } finally {
      setIsRunning(false);
    }
  };

  const displayName = candidateName || user?.name || 'Candidate';

  return (
    <div className={`flex flex-col h-screen font-sans ${isDayMode ? 'bg-[#f8f9fa] text-gray-900' : 'bg-[#0f1117] text-gray-100'} overflow-hidden select-none`}>
      {/* Top Navigation Header Bar */}
      <header className={`h-14 ${isDayMode ? 'bg-[#1e232a]' : 'bg-[#14161f]'} text-white flex items-center justify-between px-4 shrink-0 shadow z-30`}>
        <div className="flex items-center gap-3">
          <KryptaviaLogo size="sm" showText={true} />
          {!isContestMode && (
            <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold rounded-lg flex items-center gap-1.5">
              🤖 Practice Playground
            </span>
          )}
        </div>

        {/* User Info & Exam Timer */}
        <div className="flex items-center gap-5">
          {isContestMode ? (
            <>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#f5a623] text-gray-900 font-black flex items-center justify-center text-xs shadow">
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
                <div className="text-right leading-tight">
                  <p className="text-xs font-bold text-white">{displayName}</p>
                  <p className="text-[10px] text-gray-400 font-mono">Candidate ID: {candidateId}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 bg-[#fef9c3] border border-amber-300 px-3 py-1 rounded text-xs font-mono font-bold text-gray-900 shadow-sm">
                <span className="text-sm font-black">{timer.mins} : {timer.secs}</span>
                <div className="flex flex-col leading-none text-[8px] font-sans text-gray-600 font-bold uppercase">
                  <span>min</span>
                  <span>sec</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow">
                {displayName.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-xs font-semibold text-gray-200">{displayName}</span>
            </div>
          )}
        </div>
      </header>

      {/* Question Header Banner */}
      <div className={`${isDayMode ? 'bg-white border-gray-200' : 'bg-[#181a24] border-zinc-800'} border-b px-4 py-2 flex items-center justify-between shadow-xs shrink-0 z-20`}>
        <div className="flex items-center gap-3">
          <span className={`font-bold text-sm ${isDayMode ? 'text-gray-900' : 'text-white'}`}>
            {selectedProblem?.title || "01. LCM of two trees"}
          </span>

          {/* Select Problem Button */}
          <button
            onClick={() => setShowProblemsModal(true)}
            className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 font-bold text-xs rounded-md transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <span>📂</span> Select Problem {problemsList.length > 0 ? `(${problemsList.length})` : ''}
          </button>
        </div>
        <span className="text-xs font-semibold text-gray-500 font-mono">50 marks</span>
      </div>

      {/* Main Workspace Split Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Question List Left Sidebar */}
        <div className={`w-11 ${isDayMode ? 'bg-white border-gray-200' : 'bg-[#14161f] border-zinc-800'} border-r flex flex-col items-center py-2 gap-2 shrink-0 z-10 overflow-y-auto`}>
          <button
            title="Question Info"
            className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[11px] font-bold mb-1 shrink-0"
          >
            ℹ️
          </button>
          {problemsList.length > 0 ? (
            problemsList.map((prob, idx) => (
              <button
                key={prob.id || idx}
                title={prob.title}
                onClick={async () => {
                  setSelectedQuestionIndex(idx);
                  try {
                    const detailRes = await api.getProblem(prob.id);
                    if (detailRes?.problem) {
                      setSelectedProblem(detailRes.problem);
                      return;
                    }
                  } catch {}
                  setSelectedProblem(prob);
                }}
                className={`w-7 h-7 rounded text-xs font-bold flex items-center justify-center transition cursor-pointer shrink-0 ${
                  selectedQuestionIndex === idx
                    ? 'bg-[#f5a623] text-gray-900 font-black shadow'
                    : isDayMode ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {String(idx + 1).padStart(2, '0')}.
              </button>
            ))
          ) : (
            <button
              onClick={() => setSelectedQuestionIndex(0)}
              className={`w-7 h-7 rounded text-xs font-bold flex items-center justify-center transition cursor-pointer ${
                selectedQuestionIndex === 0
                  ? 'bg-[#f5a623] text-gray-900 font-black shadow'
                  : isDayMode ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              01.
            </button>
          )}
        </div>

        {/* Main Workspace Split Body (Always Side-by-Side: Problem Left, Editor/Assistant Right) */}
        <div className="flex-1 flex flex-row overflow-hidden">
          {/* Problem Statement Panel (Left Half - 50% Width) */}
          <div 
            style={{ width: '50%' }}
            className={`shrink-0 ${
              isDayMode ? 'bg-white text-[#333333]' : 'bg-[#181a24] text-gray-200'
            } flex flex-col overflow-y-auto p-5 text-xs leading-relaxed space-y-4 relative border-r ${
              isDayMode ? 'border-gray-200' : 'border-zinc-800'
            } font-sans`}
          >
            {selectedProblem?.description ? (
              <MarkdownRenderer content={selectedProblem.description} />
            ) : (
              <>
                <div>
                  <h3 className={`font-bold text-sm mb-2 ${isDayMode ? 'text-[#222222]' : 'text-white'}`}>LCM of Two Binary Trees</h3>
                  <p className="text-gray-700 dark:text-zinc-300">A binary tree is represented by the following structure:</p>
                  <div className={`my-2 border p-3 rounded-[2px] font-mono text-xs ${isDayMode ? 'bg-[#fafafa] border-gray-200 text-gray-800' : 'bg-zinc-900 border-zinc-800 text-zinc-200'}`}>
                    <pre>{`struct TreeNode
{
    int data;
    struct TreeNode* left;
    struct TreeNode* right;
};`}</pre>
                  </div>

                  <p className="mt-2 text-gray-700 dark:text-zinc-300">Implement the following function:</p>
                  <div className={`my-2 border p-3 rounded-[2px] font-mono text-xs font-bold ${isDayMode ? 'bg-[#fafafa] border-gray-200 text-blue-700' : 'bg-zinc-900 border-zinc-800 text-blue-400'}`}>
                    <pre>struct TreeNode* LCMOfTrees(struct TreeNode* root1, struct TreeNode* root2);</pre>
                  </div>

                  <p className="mt-2 text-gray-700 dark:text-zinc-300 leading-normal">
                    <strong>LCM of 2 integers</strong> is the smallest positive integer that is exactly divisible by both integers.
                    <br />
                    The function accepts the root node of two binary trees <code className={`px-1 py-0.5 rounded font-mono ${isDayMode ? 'bg-gray-100 text-gray-800' : 'bg-zinc-800 text-amber-400'}`}>'root1'</code> and <code className={`px-1 py-0.5 rounded font-mono ${isDayMode ? 'bg-gray-100 text-gray-800' : 'bg-zinc-800 text-amber-400'}`}>'root2'</code> as its argument. Implement the function to return a tree which is LCM of both the trees. Each node value of output tree is equal to LCM of data values of nodes on that same position in the input trees.
                  </p>
                </div>

                {/* Constraints & Notes */}
                <div className="space-y-1 text-xs">
                  <h4 className="font-bold text-gray-900 dark:text-zinc-100">Note:</h4>
                  <ul className="list-disc pl-5 space-y-0.5 text-gray-700 dark:text-zinc-300">
                    <li>Return null if both trees are null.</li>
                    <li>While calculating LCM, if one of the node is null use the data value of the other node.</li>
                    <li>Do not use extra memory.</li>
                  </ul>
                </div>

                {/* Explanation & Sample Input / Output Trees */}
                <div className="space-y-3 text-xs">
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-zinc-100 mb-1">Explanation:</h4>
                    <p className="text-gray-700 dark:text-zinc-300 font-medium mb-1">LCM of:</p>
                    <ul className="list-disc pl-5 space-y-0.5 text-gray-700 dark:text-zinc-300 font-mono text-[11px]">
                      <li>(1,4) = 4</li>
                      <li>(2,6) = 6</li>
                      <li>(3,8) = 24</li>
                      <li>(4,null) = 4</li>
                      <li>(5,2) = 10</li>
                      <li>(9,null) = 9</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-zinc-100 mb-1">Sample input</h4>
                    <div className={`my-1 border p-3 rounded-[2px] font-mono text-xs ${isDayMode ? 'bg-[#fafafa] border-gray-200 text-gray-800' : 'bg-zinc-900 border-zinc-800 text-zinc-200'}`}>
                      <pre>{`root1:
          2
       3     5
         1  7

    root2:
          5
       6     3
         2  8`}</pre>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-zinc-100 mb-1">Sample Output</h4>
                    <div className={`my-1 border p-3 rounded-[2px] font-mono text-xs ${isDayMode ? 'bg-[#fafafa] border-gray-200 text-gray-800' : 'bg-zinc-900 border-zinc-800 text-zinc-200'}`}>
                      <pre>{`      10
       6     15
         2  56`}</pre>
                    </div>
                  </div>
                </div>

                {/* Instructions Section */}
                <div className="space-y-1.5 pt-2 text-xs border-t border-gray-200 dark:border-zinc-800">
                  <h4 className="font-bold text-gray-900 dark:text-zinc-100 text-xs">Instructions :</h4>
                  <ul className="list-disc pl-5 space-y-1 text-gray-700 dark:text-zinc-300">
                    <li>This is a template based question, DO NOT write the "main" function.</li>
                    <li>Your code is judged by an automated system, do not write any additional welcome/greeting messages.</li>
                    <li>"Save and Test" only checks for basic test cases, more rigorous cases will be used to judge your code while scoring.</li>
                    <li>Additional score will be given for writing optimized code both in terms of memory and execution time.</li>
                  </ul>
                </div>
              </>
            )}
          </div>

          {/* ↕️ Vertical Draggable Resizer Bar (Between Problem Statement & Workspace) */}
          <div
            onMouseDown={handleProblemResizeMouseDown}
            title="Drag up or down to resize Problem Statement panel"
            className="h-2 bg-gray-200 dark:bg-zinc-800 hover:bg-blue-500 dark:hover:bg-blue-500 cursor-row-resize flex items-center justify-center transition-colors group z-20 shrink-0"
          >
            <div className="w-8 h-1 bg-gray-400 dark:bg-zinc-600 group-hover:bg-white rounded-full" />
          </div>

          {/* Right Workspace Column (Supports Full-Width Tabbed Mode vs 3-Column Mode) */}
          <div 
            id="main-workspace-container"
            className={`flex-1 flex flex-col overflow-hidden ${isDayMode ? 'bg-white' : 'bg-[#181a24]'}`}
          >
            {/* Full-Width 50/50 Top Tab Header Bar (Exact Match of AON Reference Image) */}
            {layoutMode === 'tabbed' && (
              <div className={`grid grid-cols-2 h-10 w-full border-b shrink-0 font-sans text-xs ${
                isDayMode ? 'bg-[#edf2f7] border-gray-300' : 'bg-[#14161f] border-zinc-800'
              }`}>
                <button
                  type="button"
                  onClick={() => setActiveRightTab('coding')}
                  className={`flex items-center justify-center gap-2 font-bold transition-all cursor-pointer border-r ${
                    activeRightTab === 'coding'
                      ? isDayMode 
                        ? 'bg-white text-gray-900 border-b-2 border-b-blue-600 shadow-xs' 
                        : 'bg-[#1c2333] text-white border-b-2 border-b-blue-500'
                      : isDayMode 
                        ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60' 
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>&lt;&gt; Coding Panel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRightTab('assistant')}
                  className={`flex items-center justify-center gap-2 font-bold transition-all cursor-pointer ${
                    activeRightTab === 'assistant'
                      ? isDayMode 
                        ? 'bg-white text-[#1976d2] border-b-2 border-b-blue-600 shadow-xs' 
                        : 'bg-[#1c2333] text-blue-400 border-b-2 border-b-blue-500'
                      : isDayMode 
                        ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60' 
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    AI Assistant
                  </span>
                </button>
              </div>
            )}

            {/* Inner Content Area (Coding Panel vs AI Assistant) */}
            <div className="flex-1 flex flex-row overflow-hidden relative">
              {/* Coding Panel Column */}
              <div 
                style={{
                  width: '100%',
                  display: activeRightTab === 'coding' ? 'flex' : 'none'
                }}
                className={`flex flex-col h-full border-r transition-none ${isDayMode ? 'border-gray-200' : 'border-zinc-800'} overflow-hidden relative`}
              >
                {/* Internal Toolbar Header */}
                <div className={`h-9 px-3 flex items-center justify-between border-b text-xs shrink-0 ${isDayMode ? 'bg-[#f4f6f8] border-gray-200' : 'bg-[#14161f] border-zinc-800'}`}>
                  <div className="flex items-center gap-2 font-bold">
                    <span>&lt;&gt; Code Workspace</span>
                  </div>
                <div className="flex items-center gap-4">
                  
                  {/* Dynamic Interactive Language Selector */}
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] opacity-75">Language:</span>
                    <select
                      value={language}
                      onChange={e => handleLanguageChange(e.target.value)}
                      className={`text-[11px] font-bold rounded px-2 py-0.5 border cursor-pointer ${
                        isDayMode 
                          ? 'bg-white border-gray-300 text-gray-900' 
                          : 'bg-zinc-800 border-zinc-700 text-white'
                      }`}
                    >
                      <option value="cpp">C++ (Gcc 11.3)</option>
                      <option value="java">Java (OpenJDK 17)</option>
                      <option value="python">Python 3 (3.10)</option>
                    </select>
                  </div>

                  {/* Functional Day Mode / Night Mode Toggle */}
                  <button
                    onClick={() => setIsDayMode(!isDayMode)}
                    className={`text-[11px] font-bold px-2 py-0.5 rounded border transition cursor-pointer ${
                      isDayMode 
                        ? 'bg-gray-200 border-gray-300 text-gray-800 hover:bg-gray-300' 
                        : 'bg-zinc-800 border-zinc-700 text-amber-400 hover:bg-zinc-700'
                    }`}
                  >
                    {isDayMode ? 'Day Mode ☀️' : 'Night Mode 🌙'}
                  </button>
                </div>
              </div>

              {/* Monaco Code Editor (Fills remaining flex space, never pushes toolbar out) */}
              <div className="flex-1 relative min-h-[100px] overflow-hidden">
                <Editor
                  height="100%"
                  language={language === 'c' ? 'c' : language === 'cpp' ? 'cpp' : language}
                  theme={isDayMode ? 'vs-light' : 'vs-dark'}
                  value={code}
                  onChange={val => setCode(val || '')}
                  onMount={(editor) => {
                    editor.onDidChangeCursorPosition((e) => {
                      setCursorPos({ line: e.position.lineNumber, column: e.position.column });
                    });
                  }}
                  options={{
                    fontSize: 13,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: 'on'
                  }}
                />
              </div>

              {/* 📌 Bottom Action Controls Toolbar (STUCK & ALWAYS PINNED AT BOTTOM - NEVER DISAPPEARS) */}
              <div className={`px-4 py-2 border-t flex items-center justify-between shrink-0 text-xs z-30 shadow-xs ${
                isDayMode ? 'bg-[#ffffff] border-gray-200' : 'bg-[#14161f] border-zinc-800'
              }`}>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleRunCode(false)}
                    disabled={isRunning}
                    className="px-5 py-2 bg-[#2d8a4e] hover:bg-[#23753f] text-white font-bold text-xs rounded-[2px] transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    {isRunning && <span className="w-2 h-2 rounded-full bg-white animate-ping" />}
                    Save & Test
                  </button>

                  <button
                    onClick={() => setCode(DEFAULT_STARTER_TEMPLATES[language] || DEFAULT_STARTER_TEMPLATES.c)}
                    className={`px-4 py-2 border text-xs font-normal rounded-[2px] transition-colors cursor-pointer flex items-center gap-1 shadow-2xs ${
                      isDayMode
                        ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    Reset
                  </button>

                  <div className="h-4 w-px bg-gray-300 dark:bg-zinc-700 mx-1" />

                  {/* Inline Execution Status Indicator */}
                  {isRunning ? (
                    <span className="text-blue-600 font-bold flex items-center gap-1.5 text-xs">
                      <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                      Execution in progress...
                    </span>
                  ) : executionStatus === 'success' ? (
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1.5 text-xs">
                      <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                      Execution successful
                    </span>
                  ) : executionStatus === 'failed' ? (
                    <span className="text-red-600 font-bold flex items-center gap-1.5 text-xs">
                      <span className="w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] font-bold">✕</span>
                      Execution failed
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-400 font-normal">
                  <span>line: {cursorPos.line}, column: {cursorPos.column}</span>
                </div>
              </div>

              {/* ↕️ Vertical Draggable Resizer Bar (Between Action Toolbar & Results Panel) */}
              {showOutputPanel && (
                <div
                  onMouseDown={handleResultsResizeMouseDown}
                  title="Drag up or down to resize Test Results panel"
                  className="h-2 bg-gray-200 dark:bg-zinc-800 hover:bg-emerald-600 dark:hover:bg-emerald-600 cursor-row-resize flex items-center justify-center transition-colors group z-20 shrink-0"
                >
                  <div className="w-8 h-1 bg-gray-400 dark:bg-zinc-600 group-hover:bg-white rounded-full" />
                </div>
              )}

              {/* Pixel-Perfect Test Cases & Compilation Results Panel (Exact Match of Image Reference) */}
              {showOutputPanel && (
                <div 
                  style={{ height: `${resultsPanelHeight}px` }}
                  className={`border-t flex flex-col text-xs shrink-0 overflow-y-auto max-h-[50%] ${
                    isDayMode ? 'bg-[#ffffff] border-gray-200 text-gray-900' : 'bg-[#12141c] border-zinc-800 text-gray-100'
                  }`}
                >
                  {/* Controls Bar Sub-Header (Matching Reference Image) */}
                  <div className={`p-3 border-b flex items-center justify-between text-xs shrink-0 sticky top-0 z-10 ${
                    isDayMode ? 'bg-white border-gray-200' : 'bg-[#181a24] border-zinc-800'
                  }`}>
                    <label className="flex items-center gap-2 font-normal text-gray-700 dark:text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={testAgainstCustomInput}
                        onChange={e => {
                          setTestAgainstCustomInput(e.target.checked);
                          if (e.target.checked) setActiveTestTab('custom');
                        }}
                        className="rounded-[2px] border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span>Test against your own Input</span>
                    </label>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-gray-600 dark:text-zinc-400">
                        <span>Load previous code :</span>
                        <select
                          value={previousCodeVersion}
                          onChange={e => setPreviousCodeVersion(e.target.value)}
                          className={`border rounded-[2px] px-3 py-1 text-xs font-normal ${
                            isDayMode ? 'bg-white border-gray-300 text-gray-700' : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                          }`}
                        >
                          <option value="Select">Select</option>
                          <option value="Version 1">Initial Draft</option>
                        </select>
                      </div>

                      {/* Close ✕ Button */}
                      <button
                        onClick={() => setShowOutputPanel(false)}
                        title="Close Execution Results"
                        className="px-2 py-0.5 bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white font-bold rounded-[2px] text-xs transition cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="p-4 space-y-4 font-sans flex-1 overflow-y-auto">
                    {/* Compilation Section (Exact Match of Reference Image) */}
                    <div className="space-y-1.5">
                      <h4 className="font-bold text-sm text-gray-900 dark:text-zinc-100">Compilation:</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-700 dark:text-zinc-300 font-semibold text-xs">Status:</span>
                        <span className={`font-bold flex items-center gap-1.5 text-xs ${
                          executionStatus === 'success' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'
                        }`}>
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold ${
                            executionStatus === 'success' ? 'bg-emerald-600' : 'bg-red-600'
                          }`}>
                            {executionStatus === 'success' ? '✓' : '✕'}
                          </span>
                          Compilation {executionStatus === 'success' ? 'Successful' : 'Failed'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-zinc-400">Exit Code: {executionStatus === 'success' ? 0 : 1}</p>
                      <div className="pt-1">
                        <span className="inline-block border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1 text-xs text-gray-800 dark:text-zinc-200 rounded-[2px] font-medium shadow-2xs">
                          0 warning(s)
                        </span>
                      </div>
                    </div>

                    <div className="h-px bg-gray-200 dark:bg-zinc-800 my-2" />

                    {/* Test Case Tabs Bar (Exact Match of Reference Image) */}
                    <div className="flex items-center gap-1.5 border-b border-gray-200 dark:border-zinc-800 bg-[#f8f9fa] dark:bg-[#151722] pt-2 px-2 -mx-4 overflow-x-auto">
                      {testResults.map((tc) => {
                        const tabKey = `tc${tc.id}`;
                        const isActive = activeTestTab === tabKey;
                        return (
                          <button
                            key={tc.id}
                            onClick={() => setActiveTestTab(tabKey)}
                            className={`px-3 py-1.5 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border whitespace-nowrap ${
                              isActive
                                ? isDayMode
                                  ? 'bg-white border-t-2 border-t-emerald-600 border-x border-b-white text-gray-900 shadow-2xs -mb-px z-10 rounded-t-[2px]'
                                  : 'bg-zinc-900 border-t-2 border-t-emerald-600 border-x border-b-zinc-900 text-white shadow-2xs -mb-px z-10 rounded-t-[2px]'
                                : 'bg-[#f0f2f5] dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 font-medium hover:bg-gray-100 rounded-t-[2px]'
                            }`}
                          >
                            <span className={`w-3.5 h-3.5 rounded-full text-[9px] text-white flex items-center justify-center font-bold ${
                              tc.passed ? 'bg-emerald-600' : 'bg-red-600'
                            }`}>
                              {tc.passed ? '✓' : '✕'}
                            </span>
                            {tc.isHidden ? `🔒 Hidden #${tc.id}` : tc.name}
                          </button>
                        );
                      })}
                    </div>

                    {/* Active Test Case Property Details & 3-Column Table Grid (Exact Match of Reference Image) */}
                    {activeTestTab === 'custom' ? (
                      <div className="space-y-2 font-mono">
                        <span className="font-bold text-xs">Custom Input String:</span>
                        <textarea
                          value={customInput}
                          onChange={e => setCustomInput(e.target.value)}
                          rows={3}
                          className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded p-2 text-xs text-gray-900 dark:text-zinc-100"
                        />
                        <button
                          onClick={() => handleRunCode(true, false)}
                          className="px-4 py-1.5 bg-blue-600 text-white font-bold rounded-[2px] text-xs cursor-pointer"
                        >
                          Run Custom Input
                        </button>
                      </div>
                    ) : (
                      (() => {
                        const tcIndex = testResults.findIndex(tc => `tc${tc.id}` === activeTestTab);
                        const tc = testResults[tcIndex >= 0 ? tcIndex : 0];
                        if (!tc) return null;

                        return (
                          <div className="space-y-3 pt-2">
                            {/* Metadata Card */}
                            <div className="border border-gray-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 rounded-[2px] space-y-1.5 text-xs text-gray-800 dark:text-zinc-200 font-sans">
                              <p><strong className="font-semibold">Result:</strong> <span className={tc.passed ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-red-600 font-semibold'}>{tc.passed ? 'Passed' : 'Failed'}</span></p>
                              <p><strong className="font-semibold">Time Taken:</strong> <span className="font-normal">{tc.executionTime}</span></p>
                              <p><strong className="font-semibold">Memory Usage:</strong> <span className="font-normal">{tc.memoryUsage}</span></p>
                              <p><strong className="font-semibold">Exit Code:</strong> <span className="font-normal">{tc.exitCode}</span></p>
                            </div>

                            {/* 3-Column Table Grid (Exact Match of Reference Image) */}
                            <div className="border border-gray-300 dark:border-zinc-800 rounded-[2px] overflow-hidden text-xs font-sans mt-3">
                              <div className={`grid grid-cols-3 p-2.5 font-bold border-b text-xs ${
                                isDayMode ? 'bg-[#f1f5f9] border-gray-300 text-gray-800' : 'bg-[#181a24] border-zinc-800 text-zinc-200'
                              }`}>
                                <div>Input</div>
                                <div>Your Output</div>
                                <div>Expected Output</div>
                              </div>
                              <div className="grid grid-cols-3 p-3.5 text-xs leading-relaxed bg-white dark:bg-zinc-900 font-mono text-gray-800 dark:text-zinc-200">
                                <div className="whitespace-pre-wrap font-mono">{tc.isHidden ? '[🔒 Hidden Input]' : tc.input}</div>
                                <div className={`whitespace-pre-wrap font-mono font-medium ${
                                  tc.passed ? 'text-gray-800 dark:text-zinc-200' : 'text-red-600'
                                }`}>{tc.isHidden && tc.passed ? '[🔒 Output Hidden - Security Test]' : tc.actualOutput}</div>
                                <div className="whitespace-pre-wrap font-mono font-medium text-gray-800 dark:text-zinc-200">{tc.isHidden ? '[🔒 Hidden Output]' : tc.expectedOutput}</div>
                              </div>
                            </div>

                            {/* Clearance Subtext Notice (Exact Match of Reference Image) */}
                            <p className="text-xs text-[#1976d2] dark:text-blue-400 font-medium pt-2">
                              {tc.passed 
                                ? 'You have cleared all the basic test cases. The final score will, however, depend on the hidden test cases executed on submission.' 
                                : 'Code did not pass basic test cases. Please review your logic and try again.'}
                            </p>
                          </div>
                        );
                      })()
                    )}

                    {/* 📌 Bottom Global Navigation Footer Bar (Matching Reference Image) */}
                    <div className="pt-4 border-t border-gray-200 dark:border-zinc-800 flex items-center justify-between mt-4">
                      <div className="flex items-center gap-3">
                        <button
                          disabled
                          className="bg-[#c0c4cc] dark:bg-zinc-800 text-white dark:text-zinc-400 text-xs font-bold px-5 py-2.5 rounded-[2px] opacity-80 cursor-not-allowed uppercase"
                        >
                          <span className="block text-[9px] opacity-75 font-normal">SECTION 00/01</span>
                          Previous Section
                        </button>
                        <button
                          disabled
                          className="bg-[#c0c4cc] dark:bg-zinc-800 text-white dark:text-zinc-400 text-xs font-bold px-5 py-2.5 rounded-[2px] opacity-80 cursor-not-allowed uppercase"
                        >
                          <span className="block text-[9px] opacity-75 font-normal">SECTION 01/01</span>
                          Next Section
                        </button>
                      </div>

                      <button
                        onClick={() => handleRunCode(false, true)}
                        className="bg-[#002b66] hover:bg-[#001f4d] text-white font-bold text-sm px-9 py-2.5 rounded-[2px] shadow-sm cursor-pointer transition-colors"
                      >
                        Submit
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ↔️ Horizontal Draggable Resizer Bar (Between Coding Panel & AI Assistant) */}
            {showAssistant && (
              <div
                onMouseDown={handleHorizontalSplitterMouseDown}
                title="Drag left or right to resize AI Assistant split width"
                className="w-2 bg-gray-200 dark:bg-zinc-800 hover:bg-amber-500 dark:hover:bg-amber-500 cursor-col-resize flex items-center justify-center transition-colors group z-20 shrink-0"
              >
                <div className="h-8 w-1 bg-gray-400 dark:bg-zinc-600 group-hover:bg-white rounded-full" />
              </div>
            )}

            {/* AI Assistant Panel (100% Full Width of Right Column) */}
            <div 
              style={{
                width: '100%',
                display: activeRightTab === 'assistant' ? 'flex' : 'none'
              }}
              className="flex flex-col transition-none overflow-hidden"
            >
              <VibeAssistantPanel
                language={language}
                onInsertCode={handleInsertCodeFromAI}
                isDayMode={isDayMode}
              />
            </div>
            </div>
          </div>
        </div>

        {/* 🏆 Submission Evaluation Summary Modal */}
        {showSubmissionModal && submissionDetails && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg shadow-2xl max-w-md w-full overflow-hidden font-sans">
              <div className={`p-4 border-b ${submissionDetails.isAccepted ? 'bg-[#2d8a4e] text-white' : 'bg-amber-500 text-gray-900'}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-base flex items-center gap-2">
                    {submissionDetails.isAccepted ? '🎉 SUBMISSION ACCEPTED' : '⚠️ SUBMISSION EVALUATED'}
                  </h3>
                  <button
                    onClick={() => setShowSubmissionModal(false)}
                    className="text-white hover:opacity-80 font-bold text-lg cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs opacity-90 mt-1">
                  {submissionDetails.isAccepted ? 'All public & hidden test cases passed successfully!' : 'Your code passed partial test cases.'}
                </p>
              </div>

              <div className="p-5 space-y-4">
                {/* Score Pill Card */}
                <div className="bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 rounded-md p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-gray-500 dark:text-zinc-400 font-semibold block uppercase">Final Mark Score</span>
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{submissionDetails.score} / {submissionDetails.totalMarks}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-500 dark:text-zinc-400 font-semibold block uppercase">Accuracy Rate</span>
                    <span className="text-lg font-bold text-gray-800 dark:text-zinc-200">{Math.round((submissionDetails.totalPassed / submissionDetails.totalCount) * 100)}%</span>
                  </div>
                </div>

                {/* Detailed Breakdown List */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded">
                    <span className="font-medium text-gray-700 dark:text-zinc-300">Public Sample Test Cases:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{submissionDetails.samplePassed} / {submissionDetails.sampleTotal} Passed</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded">
                    <span className="font-medium text-gray-700 dark:text-zinc-300">🔒 Hidden Evaluation Cases:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{submissionDetails.hiddenPassed} / {submissionDetails.hiddenTotal} Passed</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowSubmissionModal(false)}
                  className="w-full py-2.5 bg-[#002b66] hover:bg-[#001f4d] text-white font-bold text-xs rounded transition cursor-pointer shadow-sm"
                >
                  Close Evaluation Details
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Problems Selection Modal Overlay */}
      {showProblemsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-2xl max-h-[80vh] rounded-xl border shadow-2xl flex flex-col overflow-hidden ${
            isDayMode ? 'bg-white border-gray-200 text-gray-900' : 'bg-[#181a24] border-zinc-800 text-white'
          }`}>
            {/* Modal Header */}
            <div className="px-5 py-4 border-b flex items-center justify-between border-gray-200 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">📂</span>
                <h3 className="font-bold text-base">Select Socratic AI Question</h3>
                <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
                  {problemsList.length} Available
                </span>
              </div>
              <button
                onClick={() => setShowProblemsModal(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center justify-center font-bold text-sm text-gray-500 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-4 border-b border-gray-200 dark:border-zinc-800 shrink-0">
              <input
                type="text"
                placeholder="Search problem by title or category..."
                value={problemSearchQuery}
                onChange={e => setProblemSearchQuery(e.target.value)}
                className={`w-full px-4 py-2.5 text-xs rounded-lg border outline-none font-sans ${
                  isDayMode 
                    ? 'bg-gray-50 border-gray-300 text-gray-900 focus:border-amber-500' 
                    : 'bg-zinc-900 border-zinc-800 text-white focus:border-amber-500'
                }`}
              />
            </div>

            {/* Problems List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {problemsList
                .filter(p => p.title.toLowerCase().includes(problemSearchQuery.toLowerCase()) || (p.category && p.category.toLowerCase().includes(problemSearchQuery.toLowerCase())))
                .map((prob, idx) => {
                  const isSelected = selectedProblem?.id === prob.id;
                  return (
                    <div
                      key={prob.id || idx}
                      onClick={async () => {
                        setSelectedQuestionIndex(idx);
                        try {
                          const detailRes = await api.getProblem(prob.id);
                          if (detailRes?.problem) {
                            setSelectedProblem(detailRes.problem);
                            setShowProblemsModal(false);
                            return;
                          }
                        } catch {}
                        setSelectedProblem(prob);
                        setShowProblemsModal(false);
                      }}
                      className={`p-3.5 rounded-lg border transition cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500/50 shadow-xs'
                          : isDayMode 
                            ? 'bg-gray-50 border-gray-200 hover:bg-gray-100' 
                            : 'bg-zinc-900/60 border-zinc-800 hover:bg-zinc-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-md font-bold text-xs flex items-center justify-center ${
                          isSelected ? 'bg-amber-500 text-gray-900 font-black' : 'bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
                        }`}>
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <div>
                          <h4 className="font-bold text-xs text-gray-900 dark:text-white">{prob.title}</h4>
                          <span className="text-[10px] text-gray-500 dark:text-zinc-400 font-mono">{prob.category || 'Trees / Socratic AI'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                          prob.difficulty === 'Easy' ? 'bg-emerald-500/20 text-emerald-400' : prob.difficulty === 'Hard' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {prob.difficulty || 'Medium'}
                        </span>
                        {isSelected && <span className="text-amber-400 font-bold text-xs">Active ✓</span>}
                      </div>
                    </div>
                  );
                })}

              {problemsList.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-xs">
                  No Socratic AI problems found in database. Create one in Problem Editor!
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
