import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ────────── All 10 Assessment Types ──────────
const ASSESSMENT_TYPES = [
  {
    id: 'CODING_DSA',
    label: 'DSA Coding',
    icon: '💻',
    color: 'indigo',
    badge: 'Algorithmic',
    description: 'Algorithm & Data Structure problems with multi-language sandboxed execution and hidden test cases.',
    examples: 'Two Sum, LRU Cache, Graph Traversal',
    platforms: 'HackerRank · LeetCode',
  },
  {
    id: 'SQL',
    label: 'SQL Challenge',
    icon: '🗃️',
    color: 'orange',
    badge: 'Database',
    description: 'SQL query writing with schema definition, sample data, and expected output table validation.',
    examples: 'Window Functions, CTEs, JOINs',
    platforms: 'HackerRank · iMocha',
  },
  {
    id: 'WEB_DEV',
    label: 'Web Dev',
    icon: '🌐',
    color: 'purple',
    badge: 'Frontend',
    description: 'Live HTML/CSS/JavaScript/React sandboxed challenges with visual expected output comparison.',
    examples: 'React Hooks, CSS Grid, REST Fetch',
    platforms: 'iMocha · CoderPad',
  },
  {
    id: 'MCQ_TECHNICAL',
    label: 'Technical MCQ',
    icon: '📝',
    color: 'blue',
    badge: 'Knowledge',
    description: 'Multiple-choice questions for language syntax, debugging, architecture, and system design concepts.',
    examples: 'Java OOP, OS Concepts, REST APIs',
    platforms: 'Mettl · TestGorilla',
  },
  {
    id: 'APTITUDE_NUMERICAL',
    label: 'Numerical Aptitude',
    icon: '🔢',
    color: 'emerald',
    badge: 'Cognitive',
    description: 'Data interpretation, graphs, ratio, percentage, and quantitative reasoning with timed sections.',
    examples: 'Bar Charts, Profit & Loss, Speed-Time',
    platforms: 'SHL · Mettl · AssessFirst',
  },
  {
    id: 'VERBAL_REASONING',
    label: 'Verbal Reasoning',
    icon: '📖',
    color: 'cyan',
    badge: 'Language',
    description: 'Passage-based comprehension, argument evaluation, and critical reading. Supports passage bundles.',
    examples: 'Critical Arguments, Synonyms, Fill Blanks',
    platforms: 'SHL · CEB · Mettl',
  },
  {
    id: 'LOGICAL_ABSTRACT',
    label: 'Logical / Abstract',
    icon: '🧩',
    color: 'amber',
    badge: 'Reasoning',
    description: 'Pattern recognition, series completion, spatial reasoning with image-based question support.',
    examples: 'Number Series, Matrix Patterns, Odd One Out',
    platforms: 'SHL · AssessFirst',
  },
  {
    id: 'PSYCHOMETRIC',
    label: 'Psychometric / Personality',
    icon: '🧠',
    color: 'pink',
    badge: 'Behavioral',
    description: 'Likert-scale items mapped to Big-5 / OCEAN traits with reverse-score and construct configuration.',
    examples: 'OCEAN Conscientiousness, Agreeableness',
    platforms: 'SHL OPQ32 · Mettl · AssessFirst',
  },
  {
    id: 'SJT',
    label: 'Situational Judgement (SJT)',
    icon: '⚖️',
    color: 'rose',
    badge: 'Behavioural',
    description: 'Workplace scenario dilemmas with ranked response options. Candidates choose most/least effective.',
    examples: 'Team Conflict, Deadline Pressure, Ethical Choices',
    platforms: 'SHL · Cubiks · Mettl',
  },
  {
    id: 'SUBJECTIVE_ESSAY',
    label: 'Subjective / Essay',
    icon: '✍️',
    color: 'zinc',
    badge: 'Open-Ended',
    description: 'Open-ended descriptive or analytical questions. Routed to EVALUATOR queue with rubric templates.',
    examples: 'Case Study Analysis, Essay on AI Ethics',
    platforms: 'Mettl · Adaface',
  },
];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  indigo: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', text: 'text-indigo-400', glow: 'hover:border-indigo-500/60 hover:shadow-indigo-500/10' },
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', glow: 'hover:border-orange-500/60 hover:shadow-orange-500/10' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', glow: 'hover:border-purple-500/60 hover:shadow-purple-500/10' },
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', glow: 'hover:border-blue-500/60 hover:shadow-blue-500/10' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', glow: 'hover:border-emerald-500/60 hover:shadow-emerald-500/10' },
  cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', glow: 'hover:border-cyan-500/60 hover:shadow-cyan-500/10' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', glow: 'hover:border-amber-500/60 hover:shadow-amber-500/10' },
  pink: { bg: 'bg-pink-500/10', border: 'border-pink-500/30', text: 'text-pink-400', glow: 'hover:border-pink-500/60 hover:shadow-pink-500/10' },
  rose: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400', glow: 'hover:border-rose-500/60 hover:shadow-rose-500/10' },
  zinc: { bg: 'bg-zinc-500/10', border: 'border-zinc-500/30', text: 'text-zinc-400', glow: 'hover:border-zinc-400/60 hover:shadow-zinc-500/10' },
};

interface GlobalItemTypeWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalItemTypeWizard({ isOpen, onClose }: GlobalItemTypeWizardProps) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelect = (typeId: string) => {
    onClose();
    navigate(`/governance/authoring?type=${typeId}&scope=PLATFORM_GLOBAL`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="border-b border-white/8 px-6 pt-6 pb-5 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 tracking-wider uppercase">
                SME Science Engine · Platform Global Bank
              </span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Select Item Type
              <span className="text-indigo-400">.</span>
            </h2>
            <p className="text-zinc-400 text-xs mt-1">
              Choose the assessment type you want to author. Each type has a dedicated authoring environment.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Type Grid */}
        <div className="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {ASSESSMENT_TYPES.map((type) => {
            const colors = COLOR_MAP[type.color];
            const isHovered = hovered === type.id;

            return (
              <button
                key={type.id}
                onClick={() => handleSelect(type.id)}
                onMouseEnter={() => setHovered(type.id)}
                onMouseLeave={() => setHovered(null)}
                className={`relative group text-left p-4 rounded-xl border transition-all duration-200 shadow-lg cursor-pointer ${colors.bg} ${colors.border} ${colors.glow} hover:shadow-xl`}
              >
                <div className="space-y-2">
                  <div className="text-2xl">{type.icon}</div>
                  <div>
                    <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded inline-block ${colors.bg} ${colors.text} border ${colors.border} mb-1`}>
                      {type.badge}
                    </div>
                    <h3 className={`text-sm font-black leading-tight ${isHovered ? colors.text : 'text-white'} transition`}>
                      {type.label}
                    </h3>
                  </div>
                </div>
                {/* Hover expansion */}
                {isHovered && (
                  <div className="mt-2 space-y-1 animate-in fade-in duration-150">
                    <p className="text-[10px] text-zinc-400 leading-snug">{type.description}</p>
                    <p className="text-[10px] text-zinc-600">e.g. {type.examples}</p>
                    <p className={`text-[10px] font-semibold ${colors.text}`}>→ Used by {type.platforms}</p>
                  </div>
                )}
                {/* Arrow indicator */}
                <div className={`absolute top-3 right-3 text-[10px] font-bold ${colors.text} opacity-0 group-hover:opacity-100 transition`}>
                  →
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="border-t border-white/8 px-6 py-3 flex items-center justify-between">
          <p className="text-[11px] text-zinc-600">
            All items auto-enter <span className="text-amber-400 font-bold">DRAFT</span> state and require mandatory Four-Eyes peer review before publication.
          </p>
          <button onClick={onClose} className="text-xs text-zinc-500 hover:text-white transition px-3 py-1.5">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
