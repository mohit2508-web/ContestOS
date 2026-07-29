import type { Problem } from './types';

interface ProblemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  problems: Problem[];
  selectedProblem: Problem | null;
  onSelect: (problem: Problem) => void;
  problemStatuses: Record<string, 'solved' | 'attempted' | 'none'>;
  isLoading: boolean;
  totalProblems?: number;
  onLoadMore?: () => void;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
}

export function ProblemsModal({ isOpen, onClose, problems, selectedProblem, onSelect, problemStatuses, isLoading, totalProblems, onLoadMore, searchQuery, onSearchChange }: ProblemsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-xl w-[600px] max-h-[80vh] flex flex-col border border-white/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Select Problem</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {onSearchChange && (
          <div className="px-4 pt-3">
            <input
              type="text"
              placeholder="Search problems..."
              value={searchQuery || ""}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-[var(--bg-primary)] border border-white/10 rounded text-white placeholder-gray-500 focus:outline-none focus:border-[var(--accent-blue)]"
            />
          </div>
        )}
        <div className="flex-1 overflow-auto p-4">
          {isLoading && problems.length === 0 ? (
            <div className="text-gray-500 text-sm text-center py-8">Loading...</div>
          ) : problems.length === 0 ? (
            <div className="text-gray-500 text-sm text-center py-8">
              No problems available. Create one in the backend.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {problems.map((problem) => {
                  const status = problemStatuses[problem.id] || 'none';
                  return (
                    <button
                      key={problem.id}
                      onClick={() => {
                        onSelect(problem);
                        onClose();
                      }}
                      className={`w-full p-4 bg-white/5 hover:bg-white/10 rounded-lg text-left transition-all ${
                        selectedProblem?.id === problem.id ? "ring-2 ring-[var(--accent-blue)]" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {status === 'solved' && (
                            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-green-500/20 text-green-400 text-xs" title="Solved">&#10003;</span>
                          )}
                          {status === 'attempted' && (
                            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-yellow-500/20 text-yellow-400 text-xs" title="Attempted">&#9679;</span>
                          )}
                          <span className="text-sm font-medium text-white">{problem.title}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          problem.difficulty === "Easy" ? "bg-green-500/20 text-green-400" :
                          problem.difficulty === "Medium" ? "bg-yellow-500/20 text-yellow-400" :
                          "bg-red-500/20 text-red-400"
                        }`}>
                          {problem.difficulty}
                        </span>
                      </div>
                      {problem.category && (
                        <span className="text-xs text-gray-600 mt-2 inline-block">{problem.category}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {totalProblems !== undefined && problems.length < totalProblems && onLoadMore && (
                <button
                  onClick={onLoadMore}
                  disabled={isLoading}
                  className="w-full py-3 mt-2 text-sm text-[var(--accent-blue)] hover:text-blue-300 transition-colors disabled:opacity-50"
                >
                  {isLoading ? "Loading..." : `Load more (${problems.length} / ${totalProblems})`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
