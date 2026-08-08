import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

interface ContestDetails {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  duration: number;
  difficulty: string;
  organization: { name: string; logoUrl: string | null };
}

export function GuestContestEntry() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [contest, setContest] = useState<ContestDetails | null>(null);
  const [invitee, setInvitee] = useState<{ email: string; name: string | null } | null>(null);
  const [candidateName, setCandidateName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    validateToken();
  }, [token]);

  const validateToken = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/guest/invite/${token}`);
      const c = res?.contest || res?.data?.contest;
      const inv = res?.invite || res?.data?.invite;
      setContest(c);
      setInvitee(inv);
      if (inv?.name) {
        setCandidateName(inv.name);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Invalid or expired invite link.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !contest) return;

    setSubmitting(true);
    try {
      const res = await api.post(`/guest/join/${token}`, { name: candidateName });
      const accessToken = res?.accessToken || res?.data?.accessToken;
      const contestId = res?.contestId || res?.data?.contestId;

      // Save token in localStorage and redirect directly into ContestZone
      if (accessToken) localStorage.setItem('accessToken', accessToken);
      navigate(`/contests/${contestId}`);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to enter contest');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-950 border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-black tracking-tight text-white">
            Contest<span className="text-amber-400">OS</span> Candidate Portal
          </h1>
          <p className="text-xs text-gray-400">Guest Invitation Entrance</p>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500 animate-pulse">Validating invite link...</div>
        ) : error ? (
          <div className="p-4 bg-red-950/50 border border-red-500/30 rounded-xl text-red-400 text-xs text-center">
            {error}
          </div>
        ) : contest ? (
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  {contest.organization?.name || 'Invited Drive'}
                </span>
                <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  {contest.difficulty}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white">{contest.title}</h2>
              <p className="text-xs text-gray-400 line-clamp-2">{contest.description}</p>
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
                <span>⏱️ {contest.duration} minutes</span>
                <span>📅 {new Date(contest.startTime).toLocaleDateString()}</span>
              </div>
            </div>

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Your Invited Email</label>
                <input
                  type="email"
                  value={invitee?.email || ''}
                  disabled
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-gray-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Enter your full name"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  className="w-full bg-black border border-white/20 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
              >
                {submitting ? 'Entering Contest...' : '🚀 Start Assessment Now'}
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default GuestContestEntry;
