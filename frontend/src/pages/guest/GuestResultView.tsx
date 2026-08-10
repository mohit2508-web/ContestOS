import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../services/api';

export function GuestResultView() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchResult();
  }, [token]);

  const fetchResult = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/guest/result/${token}`);
      setData(res);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to fetch result');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12 flex flex-col items-center justify-center">
      <div className="max-w-xl w-full bg-zinc-950 border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-black tracking-tight text-white">
            Assessment <span className="text-amber-400">Scorecard</span>
          </h1>
          <p className="text-xs text-gray-400">Official Candidate Result</p>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500 animate-pulse">Retrieving scorecard...</div>
        ) : error ? (
          <div className="p-4 bg-red-950/50 border border-red-500/30 rounded-xl text-red-400 text-xs text-center">
            {error}
          </div>
        ) : data ? (
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center space-y-3">
              <h2 className="text-lg font-bold text-white">{data.contest?.title}</h2>
              <p className="text-xs text-gray-400">Candidate: {data.candidate?.name} ({data.candidate?.email})</p>

              <div className="pt-4 border-t border-white/10 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">Total Score</span>
                  <p className="text-3xl font-black text-amber-400">{data.result?.score} pts</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">Rank</span>
                  <p className="text-3xl font-black text-teal-400">#{data.result?.rank} / {data.result?.totalParticipants}</p>
                </div>
              </div>
            </div>

            {/* Submissions list */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Submissions Summary</h3>
              <div className="divide-y divide-white/5 bg-zinc-900 rounded-xl border border-white/5 overflow-hidden">
                {data.submissions?.map((s: any, idx: number) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-white">{s.problem?.title}</p>
                      <span className="text-[10px] text-gray-400">{s.language}</span>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                      s.status === 'ACCEPTED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {s.status} ({s.score} pts)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 text-center">
              <Link to="/register" className="inline-block px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition">
                Register Full Account on Kryptavia OS
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default GuestResultView;
