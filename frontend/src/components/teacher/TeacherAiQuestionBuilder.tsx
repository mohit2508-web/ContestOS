import React, { useState } from 'react';

interface TeacherAiQuestionBuilderProps {
  questionData: {
    readonlyBoilerplate: string;
    functionSignature: string;
    stage1Rules: string;
    stage2Rules: string;
    stage3Rules: string;
    tokenBudget: number;
  };
  onChange: (updated: any) => void;
}

export const TeacherAiQuestionBuilder: React.FC<TeacherAiQuestionBuilderProps> = ({
  questionData,
  onChange
}) => {
  const [data, setData] = useState(questionData);

  const updateField = (key: string, value: any) => {
    const updated = { ...data, [key]: value };
    setData(updated);
    onChange(updated);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5 space-y-5 text-xs">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-zinc-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">🤖 AI-Assisted Socratic Question Rules</h3>
          <p className="text-gray-500 text-[11px]">Configure candidate read-only code boilerplate, required signature, and reasoning gates.</p>
        </div>
        <span className="px-2.5 py-1 bg-amber-500/10 text-amber-500 font-bold text-[10px] uppercase rounded">
          Capgemini Stage 4 Format
        </span>
      </div>

      {/* Boilerplate & Signature */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block font-bold text-gray-700 dark:text-zinc-300 mb-1">
            Read-only Code Boilerplate (e.g. struct definitions):
          </label>
          <textarea
            value={data.readonlyBoilerplate}
            onChange={e => updateField('readonlyBoilerplate', e.target.value)}
            rows={5}
            className="w-full font-mono bg-gray-50 dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 rounded-lg p-2.5 text-xs text-gray-900 dark:text-zinc-200"
            placeholder={`struct TreeNode {\n  int data;\n  struct TreeNode* left;\n  struct TreeNode* right;\n};`}
          />
        </div>

        <div>
          <label className="block font-bold text-gray-700 dark:text-zinc-300 mb-1">
            Required Function Signature:
          </label>
          <input
            type="text"
            value={data.functionSignature}
            onChange={e => updateField('functionSignature', e.target.value)}
            className="w-full font-mono bg-gray-50 dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 rounded-lg p-2.5 text-xs text-gray-900 dark:text-zinc-200 mb-3"
            placeholder="struct TreeNode* LCMOfTrees(struct TreeNode* root1, struct TreeNode* root2)"
          />

          <label className="block font-bold text-gray-700 dark:text-zinc-300 mb-1">
            Max Token Budget per Candidate Session:
          </label>
          <input
            type="number"
            value={data.tokenBudget}
            onChange={e => updateField('tokenBudget', parseInt(e.target.value) || 2000)}
            className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 rounded-lg p-2.5 text-xs text-gray-900 dark:text-zinc-200"
          />
        </div>
      </div>

      {/* Socratic Stage Rules */}
      <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-zinc-800">
        <h4 className="font-bold text-gray-900 dark:text-white">Stage Gating Requirements (Evaluator Criteria)</h4>

        <div>
          <label className="block font-semibold text-gray-700 dark:text-zinc-300 mb-1">
            Stage 1: Problem Description Criteria (Inputs, Expected Output, Constraints)
          </label>
          <input
            type="text"
            value={data.stage1Rules}
            onChange={e => updateField('stage1Rules', e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 rounded-lg p-2 text-xs text-gray-900 dark:text-zinc-200"
            placeholder="Requires candidate to state inputs (tree roots), LCM merged output, and in-place node reuse constraint."
          />
        </div>

        <div>
          <label className="block font-semibold text-gray-700 dark:text-zinc-300 mb-1">
            Stage 2: Data Structure Selection Criteria
          </label>
          <input
            type="text"
            value={data.stage2Rules}
            onChange={e => updateField('stage2Rules', e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 rounded-lg p-2 text-xs text-gray-900 dark:text-zinc-200"
            placeholder="Requires candidate to specify binary tree pointers + recursion."
          />
        </div>

        <div>
          <label className="block font-semibold text-gray-700 dark:text-zinc-300 mb-1">
            Stage 3: Algorithm Approach Criteria
          </label>
          <input
            type="text"
            value={data.stage3Rules}
            onChange={e => updateField('stage3Rules', e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 rounded-lg p-2 text-xs text-gray-900 dark:text-zinc-200"
            placeholder="Requires null handling, LCM math calculation, and recursive left/right subtree traversal."
          />
        </div>
      </div>
    </div>
  );
};
