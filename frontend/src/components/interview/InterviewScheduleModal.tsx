import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  Key,
  Copy,
  Check,
  Code2,
  Sparkles,
  RefreshCw,
  Users,
  BrainCircuit,
  Lock,
  LogOut,
  Globe,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

interface ProblemOption {
  id: string;
  title: string;
  difficulty: string;
  category: string;
}

interface InterviewScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: any, passcode: string, joinUrl: string) => void;
}

export const InterviewScheduleModal: React.FC<InterviewScheduleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [candidateEmail, setCandidateEmail] = useState('');
  const [selectedProblemId, setSelectedProblemId] = useState('');
  const [problems, setProblems] = useState<ProblemOption[]>([]);
  const [loadingProblems, setLoadingProblems] = useState(false);

  // Secret passcode state
  const [customPasscode, setCustomPasscode] = useState('');
  const [allowHints, setAllowHints] = useState(true);
  const [allowObservers, setAllowObservers] = useState(false);

  // Phase breakdown (mins)
  const [understandMins, setUnderstandMins] = useState(5);
  const [planMins, setPlanMins] = useState(10);
  const [codeMins, setCodeMins] = useState(25);
  const [optimizeMins, setOptimizeMins] = useState(5);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTokenExpired, setIsTokenExpired] = useState(false);

  // Local Timezone name
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local Time';

  // Helper to format Date object into local HTML datetime-local string (YYYY-MM-DDTHH:mm)
  const formatLocalDatetime = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const mins = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${mins}`;
  };

  // Helper to generate 6-char random code
  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCustomPasscode(code);
  };

  useEffect(() => {
    if (isOpen) {
      generateRandomCode();
      fetchProblems();
      
      // Default to 30 minutes from NOW in LOCAL time (not UTC)
      const defaultStartTime = new Date();
      defaultStartTime.setMinutes(defaultStartTime.getMinutes() + 30);
      setScheduledAt(formatLocalDatetime(defaultStartTime));
      setIsTokenExpired(false);
      setError(null);
    }
  }, [isOpen]);

  const fetchProblems = async () => {
    try {
      setLoadingProblems(true);
      const data = await api.get('/problems');
      setProblems(data.problems || data || []);
    } catch (err) {
      console.error('Failed to fetch problems:', err);
    } finally {
      setLoadingProblems(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !scheduledAt) {
      setError('Please provide a title and valid date/time.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setIsTokenExpired(false);

      const data = await api.post('/interviews/schedule', {
        title,
        description,
        scheduledAt: new Date(scheduledAt).toISOString(), // Convert local selection to ISO for server
        durationMinutes,
        candidateEmail: candidateEmail.trim() || undefined,
        problemId: selectedProblemId || undefined,
        customPasscode: customPasscode.trim().toUpperCase(),
        allowHints,
        allowObservers,
        phaseUnderstandMins: understandMins,
        planMins,
        codeMins,
        optimizeMins,
      });

      if (!data.success) {
        throw new Error(data.error || 'Failed to schedule interview');
      }

      onSuccess(data.session, data.passcode, data.joinUrl);
      onClose();
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.message?.toLowerCase().includes('token')) {
        setIsTokenExpired(true);
        setError('Your login session has expired. Please log in again to schedule interviews.');
      } else {
        setError(err?.response?.data?.error || err.message || 'An unexpected error occurred.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReLogin = () => {
    logout();
    onClose();
    navigate('/login');
  };

  // User-friendly display of selected date
  const getFormattedScheduledPreview = () => {
    if (!scheduledAt) return null;
    try {
      const d = new Date(scheduledAt);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Schedule Live 1-on-1 Mock Interview</h2>
              <p className="text-xs text-zinc-400">Pair programming room with secret passcode gate & real-time IDE</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm space-y-2">
              <p>{error}</p>
              {isTokenExpired && (
                <button
                  type="button"
                  onClick={handleReLogin}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-semibold text-xs transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log In Again</span>
                </button>
              )}
            </div>
          )}

          {/* Session Title */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Interview Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. SDE-1 Technical Round: Data Structures & Algorithms"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors text-sm"
            />
          </div>

          {/* Candidate Email & Date/Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Target Candidate Email (Optional)
              </label>
              <input
                type="email"
                placeholder="student@example.com"
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors text-sm"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-300 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Start Date & Time</span>
                  <span className="text-rose-400">*</span>
                </label>
                <span className="text-[10px] text-cyan-400 flex items-center gap-1 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                  <Globe className="w-3 h-3" />
                  <span>{userTimezone}</span>
                </span>
              </div>

              <input
                type="datetime-local"
                required
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-cyan-500 transition-colors text-sm font-mono"
              />

              {getFormattedScheduledPreview() && (
                <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span>Starts: {getFormattedScheduledPreview()}</span>
                </p>
              )}
            </div>
          </div>

          {/* Problem Selector */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Assigned Coding Problem (Optional)
            </label>
            <select
              value={selectedProblemId}
              onChange={(e) => setSelectedProblemId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-cyan-500 transition-colors text-sm"
            >
              <option value="">-- Pick Problem from Problem Bank --</option>
              {problems.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.difficulty}) - {p.category}
                </option>
              ))}
            </select>
          </div>

          {/* Secret Access Code Gate Setup */}
          <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold">
                <Lock className="w-4 h-4" />
                <span>Secret Passcode Gate</span>
              </div>
              <button
                type="button"
                onClick={generateRandomCode}
                className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Regenerate Code</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="text"
                maxLength={6}
                value={customPasscode}
                onChange={(e) => setCustomPasscode(e.target.value.toUpperCase())}
                className="w-40 px-3 py-2 text-center text-lg font-mono font-bold tracking-widest rounded-lg bg-zinc-950 border border-cyan-500/30 text-cyan-400 focus:outline-none focus:border-cyan-500 uppercase"
              />
              <p className="text-xs text-zinc-400 flex-1">
                Candidate must enter this exact 6-character secret code to join the live room.
              </p>
            </div>
          </div>

          {/* Settings Toggles */}
          <div className="grid grid-cols-2 gap-4 pt-1">
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 cursor-pointer">
              <input
                type="checkbox"
                checked={allowHints}
                onChange={(e) => setAllowHints(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-cyan-500 focus:ring-cyan-500/20"
              />
              <div>
                <span className="block text-xs font-medium text-white">Enable AI Hints</span>
                <span className="block text-[10px] text-zinc-400">Candidate can request progressive hints</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 cursor-pointer">
              <input
                type="checkbox"
                checked={allowObservers}
                onChange={(e) => setAllowObservers(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-cyan-500 focus:ring-cyan-500/20"
              />
              <div>
                <span className="block text-xs font-medium text-white">Observer Mode</span>
                <span className="block text-[10px] text-zinc-400">Allow silent 3rd-party evaluators</span>
              </div>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-semibold transition-all text-sm shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Scheduling...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Create Interview Room</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
