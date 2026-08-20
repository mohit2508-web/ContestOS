import React, { useState, useEffect } from 'react';
import {
  Video,
  Plus,
  Calendar,
  Clock,
  Key,
  Users,
  Sparkles,
  ArrowRight,
  Copy,
  Check,
  Shield,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { InterviewLoader } from '../components/interview/InterviewLoader';
import { InterviewScheduleModal } from '../components/interview/InterviewScheduleModal';
import api from '../services/api';

interface InterviewSession {
  id: string;
  title: string;
  description?: string;
  scheduledAt: string;
  durationMinutes: number;
  status: 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED';
  accessCodePlain?: string;
  interviewer: { id: string; name: string; email: string };
  candidate?: { id: string; name: string; email: string };
  problem?: { id: string; title: string; difficulty: string };
  feedback?: { recommendation: string; evaluatedAt: string };
}

export const InterviewDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Success Toast state
  const [createdSessionInfo, setCreatedSessionInfo] = useState<{
    session: any;
    passcode: string;
    joinUrl: string;
  } | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setAuthError(null);
      const data = await api.get('/interviews/my-sessions');
      if (data.success) {
        setSessions(data.sessions || []);
      }
    } catch (err: any) {
      console.error('Failed to fetch sessions:', err);
      if (err?.response?.status === 401) {
        setAuthError('Your login session has expired. Please log in again to access live interviews.');
      } else {
        setAuthError(err?.response?.data?.error || 'Failed to retrieve interview sessions.');
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const isTeacherRole = ['SUPER_ADMIN', 'ORG_ADMIN', 'ORG_MEMBER', 'PROCTOR', 'EVALUATOR'].includes(user?.role || '');

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Video className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Live 1-on-1 Mock Interview System</h1>
              <p className="text-xs text-zinc-400">Real-time collaborative pair-programming & evaluation portal</p>
            </div>
          </div>
        </div>

        {isTeacherRole && (
          <button
            onClick={() => setIsScheduleOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-semibold transition-all text-sm shadow-lg shadow-cyan-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule New Interview</span>
          </button>
        )}
      </div>

      {/* Auth Error Banner */}
      {authError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-rose-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{authError}</span>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-semibold text-xs transition-colors shrink-0"
          >
            Log In Again
          </button>
        </div>
      )}

      {/* Success Banner if new session created */}
      {createdSessionInfo && (
        <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>Interview Session Created Successfully!</span>
            </div>
            <button
              onClick={() => setCreatedSessionInfo(null)}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-zinc-950/80 p-3.5 rounded-xl border border-zinc-800">
            <div>
              <span className="text-zinc-400 block mb-1">Secret Access Passcode:</span>
              <span className="font-mono text-base font-bold text-cyan-400 tracking-wider">
                {createdSessionInfo.passcode}
              </span>
            </div>

            <div>
              <span className="text-zinc-400 block mb-1">Candidate Invite Link:</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={createdSessionInfo.joinUrl}
                  className="flex-1 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono text-[11px]"
                />
                <button
                  onClick={() => copyToClipboard(createdSessionInfo.joinUrl, 'created_url')}
                  className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-cyan-400"
                >
                  {copiedCodeId === 'created_url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sessions Grid */}
      {loading ? (
        <InterviewLoader mode="skeleton" message="Loading interview sessions..." />
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl text-center space-y-4">
          <div className="p-4 rounded-full bg-zinc-800/50 text-zinc-500">
            <Video className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-medium text-white">No Mock Interviews Scheduled</h3>
            <p className="text-xs text-zinc-400 max-w-md mt-1">
              Create your first live 1-on-1 interview session to conduct side-by-side pair programming with candidates.
            </p>
          </div>
          {isTeacherRole && (
            <button
              onClick={() => setIsScheduleOpen(true)}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-cyan-400 text-xs font-semibold transition-colors"
            >
              + Schedule Interview
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="bg-zinc-900/80 border border-zinc-800 hover:border-cyan-500/40 rounded-2xl p-5 space-y-4 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Status Badge & Date */}
                <div className="flex items-center justify-between text-xs gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-semibold ${
                      session.status === 'LIVE'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse'
                        : session.status === 'COMPLETED'
                        ? 'bg-zinc-800 text-zinc-400'
                        : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    }`}
                  >
                    {session.status === 'LIVE' ? '🔴 LIVE NOW' : session.status}
                  </span>
                  <span className="text-zinc-400 text-[11px] flex items-center gap-1 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>
                      {new Date(session.scheduledAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </span>
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-base font-semibold text-white line-clamp-1">{session.title}</h3>

                {/* Meta details */}
                <div className="text-xs text-zinc-400 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Host: {session.interviewer.name}</span>
                  </div>

                  {session.candidate && (
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Candidate: {session.candidate.name}</span>
                    </div>
                  )}

                  {session.problem && (
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-cyan-300">Problem: {session.problem.title}</span>
                    </div>
                  )}
                </div>

                {/* Passcode preview for host */}
                {session.accessCodePlain && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950 border border-zinc-800/80 text-xs">
                    <span className="text-zinc-500">Passcode:</span>
                    <span className="font-mono font-bold text-cyan-400 tracking-wider">
                      {session.accessCodePlain}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  onClick={() => navigate(`/interview/room/${session.id}`)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 hover:text-zinc-950 font-semibold transition-all text-xs border border-cyan-500/20"
                >
                  <span>{session.status === 'LIVE' ? 'Join Live Room' : 'Open Interview Workspace'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <InterviewScheduleModal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        onSuccess={(session, passcode, joinUrl) => {
          setCreatedSessionInfo({ session, passcode, joinUrl });
          fetchSessions();
        }}
      />
    </div>
  );
};
