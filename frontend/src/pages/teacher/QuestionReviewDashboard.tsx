import React, { useEffect, useState } from 'react';
import { apiAxios } from '../../services/api';

// ───────── Types ─────────
type ItemType = 'CODING_DSA' | 'SQL' | 'WEB_DEV' | 'MCQ_TECHNICAL' | 'APTITUDE_NUMERICAL' | 'VERBAL_REASONING' | 'LOGICAL_ABSTRACT' | 'PSYCHOMETRIC' | 'SJT' | 'SUBJECTIVE_ESSAY';

interface ReviewQueueItem {
  id: string;
  title: string;
  content: string;
  type: ItemType;
  category: string;
  topic?: string;
  authorName?: string;
  submittedAt?: string;
  hoursInReview: number;
  reviewStatus: 'UNDER_REVIEW' | 'DRAFT' | 'APPROVED' | 'PUBLISHED' | 'REJECTED';
  // Type-specific preview data
  options?: { text: string; isCorrect: boolean }[];
  testCasesCount?: number;
  passageWordCount?: number;
  scenarioText?: string;
  minWords?: number;
  construct?: string;
}

const TYPE_META: Record<ItemType, { label: string; icon: string; color: string; bg: string; border: string }> = {
  CODING_DSA: { label: 'DSA Coding', icon: '💻', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
  SQL: { label: 'SQL', icon: '🗃️', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  WEB_DEV: { label: 'Web Dev', icon: '🌐', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  MCQ_TECHNICAL: { label: 'Technical MCQ', icon: '📝', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  APTITUDE_NUMERICAL: { label: 'Numerical', icon: '🔢', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  VERBAL_REASONING: { label: 'Verbal', icon: '📖', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
  LOGICAL_ABSTRACT: { label: 'Logical', icon: '🧩', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  PSYCHOMETRIC: { label: 'Psychometric', icon: '🧠', color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/30' },
  SJT: { label: 'SJT', icon: '⚖️', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
  SUBJECTIVE_ESSAY: { label: 'Essay', icon: '✍️', color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/30' },
};

// ───────── Reviewer Checklist ─────────
const REVIEWER_CHECKLIST = [
  { id: 'accurate', label: 'Factually Accurate & Up-to-Date' },
  { id: 'no_bias', label: 'Free of Cultural / Gender Bias' },
  { id: 'distractor', label: 'Distractors Are Plausible (Not Obvious)' },
  { id: 'solution', label: 'Reference Solution / Answer Key Verified' },
];

// ───────── SLA Badge ─────────
function SlaBadge({ hours }: { hours: number }) {
  if (hours > 72) return (
    <span className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/30 px-2 py-0.5 rounded-full animate-pulse">
      ⚠ {Math.floor(hours / 24)}d {hours % 24}h — SLA Breach
    </span>
  );
  if (hours > 24) return (
    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
      ⏱ {Math.floor(hours / 24)}d {hours % 24}h
    </span>
  );
  return (
    <span className="text-[10px] text-zinc-500">{hours}h ago</span>
  );
}

// ───────── Type-Specific Preview Panel ─────────
function TypePreviewPanel({ item }: { item: ReviewQueueItem }) {
  const meta = TYPE_META[item.type];
  return (
    <div className="space-y-3">
      {/* Question Prompt */}
      <div className="text-sm text-white leading-relaxed p-4 bg-black/40 border border-white/10 rounded-xl">
        {item.content}
      </div>

      {/* MCQ Options */}
      {item.type === 'MCQ_TECHNICAL' && item.options && (
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-zinc-500 uppercase">Options & Key</span>
          {item.options.map((opt, i) => (
            <div key={i} className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs ${
              opt.isCorrect
                ? 'border-emerald-500/30 bg-emerald-500/8 text-emerald-300'
                : 'border-white/8 bg-zinc-900 text-zinc-400'
            }`}>
              <span className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-[10px] font-black bg-white/5">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1">{opt.text || <span className="text-zinc-600 italic">Option {String.fromCharCode(65 + i)} (empty)</span>}</span>
              {opt.isCorrect && <span className="text-emerald-400 font-bold text-[10px]">✓ CORRECT</span>}
            </div>
          ))}
        </div>
      )}

      {/* Coding DSA */}
      {item.type === 'CODING_DSA' && (
        <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
          <p className="text-[11px] text-indigo-400 font-bold">Coding Problem — {item.testCasesCount || 0} Test Cases</p>
          <p className="text-[10px] text-zinc-500 mt-1">DSA Coding item. Review test case coverage, solution correctness, and time/space complexity claims.</p>
        </div>
      )}

      {/* SQL */}
      {item.type === 'SQL' && (
        <div className="p-3 bg-orange-500/5 border border-orange-500/20 rounded-xl">
          <p className="text-[11px] text-orange-400 font-bold">SQL Challenge — Verify schema, query, and expected output table.</p>
        </div>
      )}

      {/* Verbal Reasoning */}
      {item.type === 'VERBAL_REASONING' && (
        <div className="p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-xl">
          <p className="text-[11px] text-cyan-400 font-bold">Passage Bundle — {item.passageWordCount || 0} words</p>
          <p className="text-[10px] text-zinc-500 mt-1">Check passage length (300–500 words), absence of bias, and factual accuracy of linked questions.</p>
        </div>
      )}

      {/* Psychometric */}
      {item.type === 'PSYCHOMETRIC' && (
        <div className="p-3 bg-pink-500/5 border border-pink-500/20 rounded-xl">
          <p className="text-[11px] text-pink-400 font-bold">Psychometric · {item.construct}</p>
          <p className="text-[10px] text-zinc-500 mt-1">Verify construct alignment, reverse-score flags, and absence of social desirability bias.</p>
        </div>
      )}

      {/* SJT */}
      {item.type === 'SJT' && item.scenarioText && (
        <div className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-xl">
          <p className="text-[11px] text-rose-400 font-bold">Scenario Context</p>
          <p className="text-xs text-zinc-400 mt-1">{item.scenarioText}</p>
        </div>
      )}

      {/* Essay */}
      {item.type === 'SUBJECTIVE_ESSAY' && (
        <div className="p-3 bg-zinc-500/5 border border-zinc-500/20 rounded-xl">
          <p className="text-[11px] text-zinc-400 font-bold">Essay Prompt · Min {item.minWords || 150} words</p>
          <p className="text-[10px] text-zinc-500 mt-1">Check rubric completeness. Confirm evaluator queue routing is configured.</p>
        </div>
      )}

      {/* Numerical / Logical */}
      {(item.type === 'APTITUDE_NUMERICAL' || item.type === 'LOGICAL_ABSTRACT' || item.type === 'WEB_DEV') && (
        <div className={`p-3 rounded-xl border ${meta.bg} ${meta.border}`}>
          <p className={`text-[11px] font-bold ${meta.color}`}>{meta.icon} {meta.label} — Verify data accuracy and correctness of all options.</p>
        </div>
      )}
    </div>
  );
}

// ───────── Main Component ─────────
export const QuestionReviewDashboard: React.FC = () => {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ReviewQueueItem | null>(null);
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [filterType, setFilterType] = useState<ItemType | 'ALL'>('ALL');

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await apiAxios.get('/governance/questions/review-queue');
      const data = res.data;
      if (data.success && Array.isArray(data.questions) && data.questions.length > 0) {
        const mapped: ReviewQueueItem[] = data.questions.map((q: any) => ({
          id: q.id,
          title: q.title || q.content?.slice(0, 60),
          content: q.content,
          type: q.type || 'MCQ_TECHNICAL',
          category: q.category || 'General',
          topic: q.topic || 'General',
          authorName: q.authorName || 'Question Setter',
          submittedAt: new Date(q.createdAt).toLocaleDateString(),
          hoursInReview: Math.floor((Date.now() - new Date(q.createdAt).getTime()) / 3600000),
          reviewStatus: q.reviewStatus,
          options: q.options ? q.options.map((o: any) => ({ text: o.text, isCorrect: o.isCorrect })) : undefined,
        }));
        setItems(mapped);
        if (mapped.length > 0) setSelectedItem(mapped[0]);
        else setSelectedItem(null);
      } else {
        setItems([]);
        setSelectedItem(null);
      }
    } catch {
      setItems([]);
      setSelectedItem(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQueue(); }, []);

  // Reset checklist when selected item changes
  useEffect(() => {
    setChecklist({});
    setComments('');
  }, [selectedItem?.id]);

  const allChecked = REVIEWER_CHECKLIST.every((c) => checklist[c.id]);

  const handleReviewAction = async (id: string, targetStatus: 'PUBLISHED' | 'REJECTED') => {
    setActionLoading(true);
    const userStr = localStorage.getItem('user');
    let reviewerId = 'user-reviewer-id';
    try { if (userStr) reviewerId = JSON.parse(userStr).id || reviewerId; } catch {}
    try {
      await apiAxios.post(`/governance/questions/${id}/review`, {
        reviewerId,
        targetStatus,
        comments: comments || `Status → ${targetStatus}`,
      });
    } catch {}
    // Optimistic update always
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelectedItem(null);
    setComments('');
    setActionLoading(false);
  };

  const visibleItems = items.filter((i) => filterType === 'ALL' || i.type === filterType);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase tracking-wider">
              Four-Eyes · Mandatory Peer Audit
            </span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Peer Review Queue<span className="text-amber-400">.</span>
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Mandatory 2nd-person peer review before publication to live contests. Reviewer ≠ Author.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg">
            {items.length} Pending
          </span>
          {items.filter((i) => i.hoursInReview > 72).length > 0 && (
            <span className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/30 px-2 py-1 rounded-lg animate-pulse">
              ⚠ {items.filter((i) => i.hoursInReview > 72).length} SLA Breach
            </span>
          )}
        </div>
      </div>

      {/* Type Filter Tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        <button
          onClick={() => setFilterType('ALL')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${filterType === 'ALL' ? 'bg-amber-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-white/10'}`}
        >
          All Types ({items.length})
        </button>
        {(Object.keys(TYPE_META) as ItemType[]).map((t) => {
          const count = items.filter((i) => i.type === t).length;
          if (count === 0) return null;
          const m = TYPE_META[t];
          return (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition border ${
                filterType === t ? `${m.bg} ${m.color} ${m.border}` : 'bg-zinc-900 text-zinc-400 hover:text-white border-white/10'
              }`}
            >
              {m.icon} {m.label} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="bg-white/5 rounded-xl h-64 animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: Queue List */}
          <div className="space-y-2">
            <h2 className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-3">
              Pending Items ({visibleItems.length})
            </h2>
            {visibleItems.length === 0 ? (
              <div className="p-8 bg-black/30 border border-white/8 rounded-xl text-center">
                <div className="text-3xl mb-2">✅</div>
                <p className="text-xs text-zinc-500 font-medium">All items approved! Queue is clear.</p>
              </div>
            ) : (
              visibleItems.map((item) => {
                const m = TYPE_META[item.type];
                const isSla = item.hoursInReview > 72;
                return (
                  <div key={item.id} onClick={() => setSelectedItem(item)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-2 ${
                      selectedItem?.id === item.id
                        ? 'bg-zinc-900 border-amber-500/50 ring-1 ring-amber-500/30'
                        : `bg-zinc-950 border-white/8 hover:border-white/20 ${isSla ? 'border-red-500/20' : ''}`
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${m.bg} ${m.color} ${m.border}`}>
                        {m.icon} {m.label}
                      </span>
                      <SlaBadge hours={item.hoursInReview} />
                    </div>
                    <p className="text-xs text-white font-semibold line-clamp-2 leading-snug">
                      {item.title || item.content.slice(0, 70)}
                    </p>
                    <p className="text-[10px] text-zinc-500">By {item.authorName}</p>
                  </div>
                );
              })
            )}
          </div>

          {/* Right: Inspection Panel */}
          {selectedItem ? (() => {
            const m = TYPE_META[selectedItem.type];
            return (
              <div className="lg:col-span-2 bg-zinc-950 border border-white/10 rounded-2xl p-5 space-y-5">
                {/* Panel Header */}
                <div className="flex items-start justify-between border-b border-white/8 pb-4 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${m.bg} ${m.color} ${m.border}`}>
                        {m.icon} {m.label}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">ID: {selectedItem.id}</span>
                      <SlaBadge hours={selectedItem.hoursInReview} />
                    </div>
                    <h3 className="text-base font-bold text-white leading-snug">
                      {selectedItem.title || selectedItem.content.slice(0, 80)}
                    </h3>
                    <p className="text-[10px] text-zinc-500">
                      Authored by <span className="text-zinc-300 font-semibold">{selectedItem.authorName}</span>
                      {' · '}{selectedItem.submittedAt}
                    </p>
                  </div>
                </div>

                {/* Type-Specific Preview */}
                <div>
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Candidate Preview</h4>
                  <TypePreviewPanel item={selectedItem} />
                </div>

                {/* Reviewer Checklist */}
                <div className="bg-black/40 border border-white/8 rounded-xl p-4 space-y-2">
                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    Reviewer Quality Checklist
                  </h4>
                  {REVIEWER_CHECKLIST.map((c) => (
                    <label key={c.id} className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={!!checklist[c.id]}
                        onChange={(e) => setChecklist((prev) => ({ ...prev, [c.id]: e.target.checked }))}
                        className="accent-emerald-500 w-4 h-4 flex-shrink-0"
                      />
                      <span className={`text-xs transition ${checklist[c.id] ? 'text-emerald-400 font-medium line-through opacity-70' : 'text-zinc-400 group-hover:text-white'}`}>
                        {c.label}
                      </span>
                    </label>
                  ))}
                  {!allChecked && (
                    <p className="text-[10px] text-amber-400 mt-2">
                      ⚠ Complete all checklist items before approving.
                    </p>
                  )}
                </div>

                {/* Reviewer Notes */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1.5">
                    Reviewer Notes / Feedback (sent to author on rejection)
                  </label>
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Add approval notes or detailed feedback for the author on what to fix..."
                    className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-xs text-white outline-none focus:border-amber-500/50 h-20 resize-none"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 border-t border-white/8 pt-4">
                  <button
                    type="button"
                    disabled={actionLoading || !allChecked}
                    onClick={() => handleReviewAction(selectedItem.id, 'PUBLISHED')}
                    title={!allChecked ? 'Complete the reviewer checklist first' : ''}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase rounded-xl transition shadow-lg shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {actionLoading ? 'Publishing...' : '✓ Approve & Publish to Bank'}
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleReviewAction(selectedItem.id, 'REJECTED')}
                    className="flex-1 py-3 bg-red-700/80 hover:bg-red-600 text-white font-black text-xs uppercase rounded-xl transition disabled:opacity-40 cursor-pointer"
                  >
                    {actionLoading ? 'Rejecting...' : '✕ Reject & Revert to Draft'}
                  </button>
                </div>
                {!allChecked && (
                  <p className="text-center text-[10px] text-zinc-600">Approve button is locked until all 4 checklist items are checked.</p>
                )}
              </div>
            );
          })() : (
            <div className="lg:col-span-2 flex items-center justify-center py-20 text-zinc-600">
              <div className="text-center space-y-2">
                <div className="text-4xl">👆</div>
                <p className="text-sm font-medium">Select an item from the queue to inspect & review</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
