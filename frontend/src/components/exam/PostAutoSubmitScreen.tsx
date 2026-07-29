import React, { useState } from 'react';
import { api } from '../../services/api';

interface PostAutoSubmitScreenProps {
  contestId: string;
  contestTitle: string;
  maxWarnings: number;
  onReturn: () => void;
}

export const PostAutoSubmitScreen: React.FC<PostAutoSubmitScreenProps> = ({
  contestId,
  contestTitle,
  maxWarnings,
  onReturn
}) => {
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await api.client.post(`/contests/${contestId}/attempts/request-review`, { note });
      setSubmitted(true);
    } catch (err: any) {
      console.error(err);
      setError('Failed to submit review request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-red-500/10 rounded-full filter blur-[100px]" />

        <div className="text-center relative">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto text-red-400 mb-4 animate-pulse">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h1 className="text-xl font-black mb-2 text-white">Exam Automatically Submitted</h1>
          <p className="text-xs text-zinc-400 mb-6">
            Your attempt for <strong>{contestTitle}</strong> was finalized because the limit of {maxWarnings} proctoring warnings was exceeded. Your saved draft work has been submitted.
          </p>

          {submitted ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 mb-6">
              <svg className="w-8 h-8 text-green-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-sm font-bold text-white mb-1">Justification Submitted</h3>
              <p className="text-[10px] text-zinc-400">Your note has been appended to your exam logs for teacher review.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmitReview} className="text-left mb-6">
              <label className="block text-[10px] text-zinc-500 uppercase font-bold mb-2">Request Instructor Review</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={4}
                required
                placeholder="Describe any accidental clicks, workspace shifts, or technical connectivity issues that occurred..."
                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-red-500/50 resize-none font-sans"
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-[9px] text-zinc-600">{note.length}/500 chars</span>
                <button
                  type="submit"
                  disabled={loading || !note.trim()}
                  className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-white font-bold rounded-lg text-[10px] transition disabled:opacity-30"
                >
                  {loading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
              {error && <p className="text-[10px] text-red-400 mt-2 font-bold">{error}</p>}
            </form>
          )}

          <button
            onClick={onReturn}
            className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl text-xs transition"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
