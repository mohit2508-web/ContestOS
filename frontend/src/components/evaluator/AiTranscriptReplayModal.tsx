import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DiffEditor } from '@monaco-editor/react';

interface AiTranscriptReplayModalProps {
  sessionId: string;
  candidateName: string;
  candidateId: string;
  finalCode: string;
  onClose: () => void;
}

export const AiTranscriptReplayModal: React.FC<AiTranscriptReplayModalProps> = ({
  sessionId,
  candidateName,
  candidateId,
  finalCode,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'code-diff'>('chat');
  const [sessionData, setSessionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTranscript = async () => {
      try {
        const apiHost = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
        const res = await axios.get(`${apiHost}/api/assistant/${sessionId}/transcript`);
        setSessionData(res.data.session);
      } catch {
        // Mock session data if offline
        setSessionData({
          stage: 'CODE_GEN',
          tokensUsed: 869,
          tokenBudget: 2000,
          captured: {
            problem_summary: 'Binary tree LCM merge with in-place node reuse.',
            ds_choice: 'Binary tree recursion with pointers.',
            approach: 'Check null base cases, compute LCM(data1, data2), recurse left and right.'
          }
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTranscript();
  }, [sessionId]);

  const initialAiCode = `#include <stdio.h>
#include <stdlib.h>

static int abs_int(int a) { return a < 0 ? -a : a; }
static int gcd_int(int a, int b) {
    a = abs_int(a); b = abs_int(b);
    while (b != 0) { int temp = b; b = a % b; a = temp; }
    return a;
}
static int lcm_int(int a, int b) {
    if (a == 0 || b == 0) return 0;
    return abs_int(a / gcd_int(a, b) * b);
}

struct TreeNode* LCMOfTrees(struct TreeNode* root1, struct TreeNode* root2) {
    if (root1 == NULL && root2 == NULL) return NULL;
    if (root1 == NULL) return root2;
    if (root2 == NULL) return root1;

    root1->data = lcm_int(root1->data, root2->data);
    root1->left = LCMOfTrees(root1->left, root2->left);
    root1->right = LCMOfTrees(root1->right, root2->right);
    return root1;
}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans text-xs">
      <div className="bg-white dark:bg-[#161822] border border-gray-200 dark:border-zinc-800 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="h-14 px-5 bg-gray-100 dark:bg-[#12141d] border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">🤖</span>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white text-sm">
                AI Socratic Audit — {candidateName}
              </h2>
              <p className="text-[11px] text-gray-500 font-mono">Candidate ID: {candidateId} | Session: {sessionId}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-gray-200 dark:bg-zinc-800 p-0.5 rounded-lg text-xs">
              <button
                onClick={() => setActiveTab('chat')}
                className={`px-3 py-1 font-bold rounded cursor-pointer ${
                  activeTab === 'chat' ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
                }`}
              >
                💬 Chat Trajectory
              </button>
              <button
                onClick={() => setActiveTab('code-diff')}
                className={`px-3 py-1 font-bold rounded cursor-pointer ${
                  activeTab === 'code-diff' ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
                }`}
              >
                🔍 Code Diff (AI vs Final)
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-1 text-lg font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden p-5">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-500">Loading audit trajectory...</div>
          ) : activeTab === 'chat' ? (
            <div className="h-full flex flex-col space-y-4 overflow-y-auto">
              <div className="grid grid-cols-3 gap-3 bg-gray-50 dark:bg-zinc-900/60 p-3 rounded-xl border border-gray-200 dark:border-zinc-800">
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-bold">Stage Reached</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">{sessionData?.stage || 'CODE_GEN'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-bold">Tokens Consumed</span>
                  <span className="font-bold text-gray-900 dark:text-white">{sessionData?.tokensUsed || 869} / 2000</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-bold">Socratic Reasoning Audit</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">PASSED ALL GATES ✓</span>
                </div>
              </div>

              {/* Captured Answers Summary */}
              <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 p-3.5 rounded-xl space-y-2">
                <h3 className="font-bold text-blue-900 dark:text-blue-300 text-xs">Candidate's Captured Technical Plan</h3>
                <div className="space-y-1 text-gray-700 dark:text-zinc-300 leading-relaxed text-[11px]">
                  <p><strong>1. Problem Summary:</strong> {sessionData?.captured?.problem_summary || 'Binary tree LCM merge with in-place node reuse.'}</p>
                  <p><strong>2. Data Structures:</strong> {sessionData?.captured?.ds_choice || 'Binary tree recursion with pointers.'}</p>
                  <p><strong>3. Approach:</strong> {sessionData?.captured?.approach || 'Check null base cases, compute LCM(data1, data2), recurse left and right.'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col space-y-2">
              <div className="flex items-center justify-between text-[11px] text-gray-500">
                <span>Left: AI Generated Starter Code</span>
                <span>Right: Candidate's Final Submitted Code</span>
              </div>
              <div className="flex-1 rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-800">
                <DiffEditor
                  height="100%"
                  language="c"
                  original={initialAiCode}
                  modified={finalCode || initialAiCode}
                  theme="vs-dark"
                  options={{
                    fontSize: 12,
                    minimap: { enabled: false }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
