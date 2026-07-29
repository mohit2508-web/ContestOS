import { useState, useRef } from "react";
import { api } from "../services/api";
import Popover from "./Popover";
import { fetchYoutubeVideo } from "../services/youtube";

export function getDifficultyBadgeClass(difficulty: string) {
  switch (difficulty?.toLowerCase()) {
    case 'easy':
      return 'bg-green-500/20 text-green-400';
    case 'medium':
      return 'bg-yellow-500/20 text-yellow-400';
    case 'hard':
      return 'bg-red-500/20 text-red-400';
    default:
      return 'bg-[#333] text-gray-300';
  }
}

export function ProblemDescription({ problem, currentProblemId, onProblemChange, allProblems, isAccepted, hideHeader }: any) {
  // Video popover
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const videoBtnRef = useRef<any>(null);

  // Hint popover
  const [hintPopoverOpen, setHintPopoverOpen] = useState(false);
  const [hintLoading, setHintLoading] = useState(false);
  const [hints, setHints] = useState<string[]>([]);
  const [hintError, setHintError] = useState("");
  const [openHint, setOpenHint] = useState<number | null>(null);
  const hintBtnRef = useRef<any>(null);

  const handleVideoClick = async (e: any) => {
    e.preventDefault();
    if (popoverOpen) {
      setPopoverOpen(false);
      return;
    }
    setPopoverOpen(true);
    setLoading(true);
    setError("");
    setVideoUrl("");
    try {
      const url = await fetchYoutubeVideo(problem.title + " programming tutorial");
      if (url) setVideoUrl(url);
      else setError("No video found.");
    } catch (err) {
      setError("Failed to fetch video.");
    }
    setLoading(false);
  };

  const handleHintClick = async (e: any) => {
    e.preventDefault();
    if (hintPopoverOpen) {
      setHintPopoverOpen(false);
      return;
    }
    setHintPopoverOpen(true);
    setHintLoading(true);
    setHintError("");
    setHints([]);
    setOpenHint(null);
    try {
      const desc = typeof problem.description === 'string' ? problem.description : problem?.description?.text || "";
      if (!desc) throw new Error("No description available");
      const result = await api.getHint(desc);
      if (result && result.hints) {
        setHints(result.hints);
      } else {
        setHints(["No hint available."]);
      }
    } catch (err) {
      setHintError("Failed to fetch hint.");
    }
    setHintLoading(false);
  };

  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0a]">
      {!hideHeader && (
      <div className="p-6 bg-[#111] border-b border-[#333]">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full font-semibold text-sm">
              #{problem.id?.substring(0, 4) || 'P'}
            </span>
            <h1 className="text-3xl font-bold text-white">{problem.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {isAccepted && (
              <span className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full font-semibold text-sm gap-2">
                ✓ Accepted
              </span>
            )}
            <span className={`px-3 py-1.5 rounded-full font-semibold text-sm ${getDifficultyBadgeClass(problem.difficulty)}`}>
              {problem.difficulty}
            </span>
            <a
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(problem.title + ' programming tutorial')}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Search YouTube for help"
              className="ml-2 flex items-center"
            >
              <button
                ref={videoBtnRef}
                className="w-8 h-8 flex items-center justify-center bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                onClick={handleVideoClick}
                title="Show YouTube help video"
              >
                <img
                  src="/play-circle.svg"
                  alt="YouTube Video"
                  className="w-5 h-5 invert"
                />
              </button>
              <Popover open={popoverOpen} anchorRef={videoBtnRef} onClose={() => setPopoverOpen(false)}>
                <div className="flex flex-col items-center gap-2">
                  <h3 className="text-base font-bold text-white">YouTube Video</h3>
                  {loading && <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>}
                  {error && <span className="text-red-400">{error}</span>}
                  {videoUrl && (
                    <>
                      <div className="aspect-video w-full">
                        <iframe
                          width="100%"
                          height="180"
                          src={videoUrl.replace("watch?v=", "embed/")}
                          title="YouTube video player"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        ></iframe>
                      </div>
                      <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 mt-1 hover:underline">Watch on YouTube</a>
                    </>
                  )}
                </div>
              </Popover>
            </a>
            {/* Hint button right of video button */}
            <button
              ref={hintBtnRef}
              className="w-8 h-8 flex items-center justify-center bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors ml-2"
              onClick={handleHintClick}
              title="Show a hint for this problem"
            >
              <span role="img" aria-label="Hint">💡</span>
            </button>
            <Popover open={hintPopoverOpen} anchorRef={hintBtnRef} onClose={() => setHintPopoverOpen(false)}>
              <div className="flex flex-col gap-2 w-full min-w-[300px]">
                <h3 className="text-base font-bold text-white">Hints</h3>
                {hintLoading && <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>}
                {hintError && <span className="text-red-400">{hintError}</span>}
                {!hintLoading && !hintError && hints.length > 0 && (
                  <div className="flex flex-col w-full">
                    {hints.map((hint, idx) => (
                      <div key={idx} className="border-b border-[#333] last:border-b-0">
                        <button
                          className="flex items-center w-full px-2 py-3 text-left gap-2 hover:bg-[#222] focus:bg-[#222]"
                          onClick={() => setOpenHint(openHint === idx ? null : idx)}
                        >
                          <span role="img" aria-label="Hint">💡</span>
                          <span className="font-medium text-white">Hint {idx + 1}/3</span>
                          <span className="ml-auto text-lg text-white">{openHint === idx ? '▾' : '▸'}</span>
                        </button>
                        {openHint === idx && (
                          <div className="px-6 pb-3 text-gray-300 whitespace-pre-line">
                            {hint}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Popover>
          </div>
        </div>

        {/* Problem selector */}
        {allProblems && allProblems.length > 0 && (
          <div className="mt-4">
            <select
              className="w-full px-3 py-2 text-sm bg-[#1a1a1a] border border-[#333] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500/50"
              value={currentProblemId}
              onChange={(e) => onProblemChange && onProblemChange(e.target.value)}
            >
              {allProblems.map((p: any) => (
                <option key={p.id} value={p.id}>
                  #{p.id?.substring(0, 4)} - {p.title} - {p.difficulty}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      )}

      <div className="p-6 space-y-6">
        {/* PROBLEM DESC */}
        <div className="bg-[#111] rounded-xl shadow-sm p-5 border border-[#333]">
          <h2 className="text-xl font-bold text-white mb-3">Description</h2>
          <div className="space-y-3 text-base leading-relaxed text-gray-300">
            <p>{typeof problem.description === 'string' ? problem.description : problem.description?.text}</p>
            {problem.description?.notes?.map((note: string, idx: number) => (
              <p key={idx} className="text-gray-400">
                {note}
              </p>
            ))}
          </div>
        </div>

        {/* EXAMPLES SECTION */}
        {problem.examples && problem.examples.length > 0 && (
          <div className="bg-[#111] rounded-xl shadow-sm p-5 border border-[#333]">
            <h2 className="text-xl font-bold mb-4 text-white">Examples</h2>
            <div className="space-y-4">
              {problem.examples.map((example: any, idx: number) => (
                <div key={idx}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 text-xs bg-[#333] text-white rounded-full">{idx + 1}</span>
                    <p className="font-semibold text-white">Example {idx + 1}</p>
                  </div>
                  <div className="bg-[#1a1a1a] rounded-lg p-4 font-mono text-sm space-y-1.5 border border-[#333]">
                    <div className="flex gap-2">
                      <span className="text-green-400 font-bold min-w-[70px]">Input:</span>
                      <span className="text-gray-300">{example.input}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-blue-400 font-bold min-w-[70px]">Output:</span>
                      <span className="text-gray-300">{example.output}</span>
                    </div>
                    {example.explanation && (
                      <div className="pt-2 border-t border-[#333] mt-2">
                        <span className="text-gray-400 font-sans text-xs">
                          <span className="font-semibold text-gray-300">Explanation:</span> {example.explanation}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONSTRAINTS */}
        {problem.constraints && problem.constraints.length > 0 && (
          <div className="bg-[#111] rounded-xl shadow-sm p-5 border border-[#333]">
            <h2 className="text-xl font-bold mb-4 text-white">Constraints</h2>
            <ul className="space-y-2 text-gray-300">
              {problem.constraints.map((constraint: string, idx: number) => (
                <li key={idx} className="flex gap-2">
                  <span className="text-green-400">•</span>
                  <code className="text-sm bg-[#1a1a1a] px-2 py-0.5 rounded text-gray-300 border border-[#333]">{constraint}</code>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
