import React, { useState } from 'react';
import { Lock, Key, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

interface InterviewJoinModalProps {
  sessionId: string;
  sessionTitle?: string;
  interviewerName?: string;
  onSuccess?: (token: string, session: any) => void;
}

export const InterviewJoinModal: React.FC<InterviewJoinModalProps> = ({
  sessionId,
  sessionTitle = 'Live Technical Interview',
  interviewerName = 'Interviewer',
  onSuccess,
}) => {
  const navigate = useNavigate();
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode || passcode.trim().length !== 6) {
      setError('Please enter the 6-character secret passcode.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await api.post('/interviews/verify-code', {
        sessionId,
        accessCode: passcode.trim().toUpperCase(),
      });

      if (!data.success && !data.token) {
        throw new Error(data.error || 'Invalid passcode');
      }

      // Save room token
      sessionStorage.setItem(`interview_token_${sessionId}`, data.token);

      if (onSuccess) {
        onSuccess(data.token, data.session);
      } else {
        navigate(`/interview/room/${sessionId}`);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Passcode verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-6 text-center">
        {/* Lock Icon Badge */}
        <div className="inline-flex p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
          <ShieldCheck className="w-8 h-8" />
        </div>

        {/* Title */}
        <div>
          <h2 className="text-xl font-bold text-white">{sessionTitle}</h2>
          <p className="text-xs text-zinc-400 mt-1">Host: {interviewerName}</p>
        </div>

        {/* Info Banner */}
        <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-left text-xs text-zinc-400 space-y-1">
          <p className="font-semibold text-zinc-300">Protected Interview Session</p>
          <p>Please enter the 6-character passcode provided by your interviewer to unlock room access.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleVerify} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-left">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">
              ENTER SECRET PASSCODE
            </label>
            <input
              type="text"
              maxLength={6}
              autoFocus
              placeholder="e.g. A8K9M2"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value.toUpperCase())}
              className="w-full text-center text-2xl font-mono font-bold tracking-[0.3em] py-3 rounded-xl bg-zinc-950 border border-cyan-500/40 text-cyan-400 focus:outline-none focus:border-cyan-400 transition-all uppercase placeholder:tracking-normal placeholder:text-zinc-700"
            />
          </div>

          <button
            type="submit"
            disabled={loading || passcode.trim().length !== 6}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-semibold transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
          >
            {loading ? (
              <span>Verifying Passcode...</span>
            ) : (
              <>
                <span>Enter Interview Room</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
