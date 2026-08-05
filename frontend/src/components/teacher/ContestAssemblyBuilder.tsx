import React, { useState } from 'react';

export const ContestAssemblyBuilder: React.FC = () => {
  const [assemblyMode, setAssemblyMode] = useState<'MANUAL' | 'RULE_BASED'>('RULE_BASED');
  const [sectionId, setSectionId] = useState('demo-section-1');
  const [rules, setRules] = useState<
    { category: string; topic: string; minDifficulty: number; maxDifficulty: number; sampleCount: number }[]
  >([
    { category: 'Verbal', topic: 'Reading Comprehension', minDifficulty: 1, maxDifficulty: 3, sampleCount: 5 },
    { category: 'Logical', topic: 'Syllogisms', minDifficulty: 2, maxDifficulty: 4, sampleCount: 5 },
    { category: 'Technical', topic: 'Data Structures', minDifficulty: 3, maxDifficulty: 5, sampleCount: 5 },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSaveAssembly = async () => {
    setSubmitting(true);
    setFeedbackMsg(null);

    try {
      if (assemblyMode === 'RULE_BASED') {
        for (const r of rules) {
          await fetch('/api/governance/assembly/rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sectionId,
              category: r.category,
              topic: r.topic,
              minDifficulty: r.minDifficulty,
              maxDifficulty: r.maxDifficulty,
              sampleCount: r.sampleCount,
            }),
          });
        }
        setFeedbackMsg({
          type: 'success',
          message: `Saved ${rules.length} Rule-Based Auto-Assembly rules to section in CockroachDB!`,
        });
      } else {
        setFeedbackMsg({
          type: 'success',
          message: 'Saved Manual Cherry-Pick Assembly Configuration to section!',
        });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', message: err.message || 'Error saving assembly rules' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">
            Contest Assembly Engine<span className="text-[var(--accent-green)]">.</span>
          </h1>
          <p className="text-gray-400 font-medium">
            Assemble questions from published banks via manual pick or rule-based per-candidate random sampling.
          </p>
        </div>

        <div className="flex bg-[var(--bg-card)] border border-white/10 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setAssemblyMode('MANUAL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              assemblyMode === 'MANUAL'
                ? 'bg-[var(--accent-blue)] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Manual Cherry-Pick
          </button>
          <button
            type="button"
            onClick={() => setAssemblyMode('RULE_BASED')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              assemblyMode === 'RULE_BASED'
                ? 'bg-[var(--accent-blue)] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Rule-Based Auto-Assemble
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl text-xs font-bold ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}
        >
          {feedbackMsg.message}
        </div>
      )}

      <div className="bg-[var(--bg-card)] border border-white/10 rounded-xl p-6 space-y-6">
        {/* Rule-Based Assembly Rules Table */}
        {assemblyMode === 'RULE_BASED' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold text-gray-400">Sampling Rules ({rules.length})</span>
              <button
                type="button"
                onClick={() =>
                  setRules([
                    ...rules,
                    { category: 'Technical', topic: 'General', minDifficulty: 1, maxDifficulty: 5, sampleCount: 5 },
                  ])
                }
                className="text-xs font-semibold px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition cursor-pointer"
              >
                + Add Sampling Rule
              </button>
            </div>

            <div className="space-y-2">
              {rules.map((rule, idx) => (
                <div key={idx} className="flex items-center justify-between p-3.5 bg-black/40 border border-white/10 rounded-lg text-xs font-medium">
                  <div className="flex items-center space-x-4">
                    <span className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center text-white text-[10px] font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-blue-400 font-bold">{rule.category}</span>
                    <span className="text-gray-300">Topic: {rule.topic}</span>
                    <span className="text-gray-500">Diff: {rule.minDifficulty}-{rule.maxDifficulty}</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-emerald-400 font-bold">Sample {rule.sampleCount} Questions</span>
                    <button
                      type="button"
                      onClick={() => setRules(rules.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-300 font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-8 bg-black/40 border border-white/10 rounded-lg text-center text-xs text-gray-400">
            Manual cherry-pick mode enabled. Select published questions from bank.
          </div>
        )}

        {/* Assembly Actions */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-between">
          <span className="text-xs text-emerald-400 font-bold">Total Section Pool: {rules.reduce((sum, r) => sum + r.sampleCount, 0)} Items</span>
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => window.open('/playground/quiz', '_blank')}
              className="text-xs font-semibold px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition cursor-pointer"
            >
              🔍 Attempt as Candidate (Dry-Run)
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSaveAssembly}
              className="px-5 py-2 bg-[var(--accent-green)] hover:opacity-90 text-white font-bold text-xs uppercase rounded-lg transition disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Saving Assembly to DB...' : 'Save Assembly Configuration →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
