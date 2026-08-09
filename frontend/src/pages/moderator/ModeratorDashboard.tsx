import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useNotify } from '../../components/notifications';

interface Contest {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  _count?: { submissions: number };
}

interface Evaluation {
  id: string;
  score: number;
  evaluationComments: string | null;
  evaluatedAt: string | null;
  submittedAt: string;
  language: string;
  code?: string;
  user: { name: string; email: string };
  problem: { title: string; difficulty: string };
  evaluatedBy: { name: string } | null;
  moderationStatus: string;
}

interface EvaluatorCalib {
  evaluatorId: string;
  name: string;
  count: number;
  avgScore: number;
  deviation: number;
  rating: string;
}

interface GovernanceAuditLog {
  id: string;
  action: string;
  timestamp: string;
  user: { name: string; email: string; role: string };
  details: any;
}

export function ModeratorDashboard() {
  const notify = useNotify();
  const [activeTab, setActiveTab] = useState<'moderation' | 'calibration' | 'curve' | 'appeals' | 'auditStream'>('moderation');
  const [contests, setContests] = useState<Contest[]>([]);
  const [selectedContestId, setSelectedContestId] = useState<string>('');
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [calibration, setCalibration] = useState<{ overallAvg: number; totalEvaluated: number; evaluators: EvaluatorCalib[] } | null>(null);
  const [auditLogs, setAuditLogs] = useState<GovernanceAuditLog[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Override modal
  const [selectedEvalId, setSelectedEvalId] = useState<string | null>(null);
  const [overrideScore, setOverrideScore] = useState<number>(0);
  const [moderationReason, setModerationReason] = useState('');

  // Inspector modal
  const [inspectSub, setInspectSub] = useState<Evaluation | null>(null);

  // Grade Curve State
  const [curveType, setCurveType] = useState<'flat' | 'sqrt' | 'percentile'>('flat');
  const [curveValue, setCurveValue] = useState<number>(5);
  const [curveJustification, setCurveJustification] = useState('');

  // Double-Blind Anonymous Moderation Mode
  const [isDoubleBlind, setIsDoubleBlind] = useState<boolean>(false);
  const [appealsList, setAppealsList] = useState<any[]>([]);

  useEffect(() => {
    fetchContests();
  }, []);

  const fetchContests = async () => {
    setLoading(true);
    try {
      const res = await api.get('/evaluator/moderator/contests');
      const list = res?.contests || res?.data?.contests || [];
      setContests(list);
      if (list.length > 0) {
        setSelectedContestId(list[0].id);
        fetchEvaluations(list[0].id);
        fetchCalibration(list[0].id);
        fetchAuditStream(list[0].id);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to fetch contests for moderation');
    } finally {
      setLoading(false);
    }
  };

  const fetchEvaluations = async (contestId: string) => {
    if (!contestId) return;
    try {
      const res = await api.get(`/evaluator/moderator/contests/${contestId}/evaluations`);
      setEvaluations(res?.submissions || res?.data?.submissions || []);
    } catch (err: any) {
      console.error('Failed to fetch evaluations:', err);
    }
  };

  const fetchCalibration = async (contestId: string) => {
    if (!contestId) return;
    try {
      const res = await api.get(`/evaluator/moderator/contests/${contestId}/calibration`);
      setCalibration(res);
    } catch (err: any) {
      console.error('Failed to fetch calibration stats:', err);
    }
  };

  const fetchAuditStream = async (contestId: string) => {
    if (!contestId) return;
    try {
      const res = await api.get(`/evaluator/moderator/contests/${contestId}/audit-stream`);
      setAuditLogs(res?.logs || res?.data?.logs || []);
    } catch (err: any) {
      console.error('Failed to fetch audit stream:', err);
    }
  };

  const fetchAppeals = async (contestId: string) => {
    if (!contestId) return;
    try {
      const res = await api.get(`/evaluator/moderator/contests/${contestId}/appeals`);
      setAppealsList(res?.appeals || res?.data?.appeals || []);
    } catch (err: any) {
      console.error('Failed to fetch appeals:', err);
    }
  };

  const handleContestChange = (id: string) => {
    setSelectedContestId(id);
    fetchEvaluations(id);
    fetchCalibration(id);
    fetchAuditStream(id);
    fetchAppeals(id);
  };

  const handleApprove = async (id: string) => {
    try {
      await api.put(`/evaluator/moderator/${id}/approve`);
      notify.toast.success('Grade approved!');
      fetchEvaluations(selectedContestId);
      fetchAuditStream(selectedContestId);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to approve grade');
    }
  };

  const handleBulkApprove = async () => {
    if (!selectedContestId) return;
    const ok = await notify.confirm('Bulk Approve Scores?', {
      description: 'Are you sure you want to 1-click Approve all graded submissions for this contest drive?',
      variant: 'warning',
      confirmLabel: 'Approve Cohort Scores',
    });
    if (!ok) return;

    try {
      const res = await api.post(`/evaluator/moderator/contests/${selectedContestId}/bulk-approve`);
      await notify.alert('Cohort Scores Approved', {
        description: `Successfully approved ${res.approvedCount || 0} candidate scores!`,
        variant: 'success',
      });
      fetchEvaluations(selectedContestId);
      fetchAuditStream(selectedContestId);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to bulk approve scores');
    }
  };

  const handleOverrideSubmit = async () => {
    if (!selectedEvalId) return;
    if (!moderationReason || moderationReason.length < 5) {
      await notify.alert('Justification Required', {
        description: 'Mandatory moderation justification (min 5 characters) is required.',
        variant: 'warning',
      });
      return;
    }
    try {
      await api.put(`/evaluator/moderator/${selectedEvalId}/override`, {
        newScore: overrideScore,
        moderationReason,
      });
      notify.toast.success('Score overridden successfully!');
      setSelectedEvalId(null);
      setModerationReason('');
      fetchEvaluations(selectedContestId);
      fetchAuditStream(selectedContestId);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to override grade');
    }
  };

  const handleApplyCurve = async () => {
    if (!selectedContestId) return;
    if (!curveJustification || curveJustification.length < 5) {
      await notify.alert('Justification Required', {
        description: 'Please provide a mandatory justification for applying the grade curve.',
        variant: 'warning',
      });
      return;
    }
    try {
      const res = await api.post(`/evaluator/moderator/contests/${selectedContestId}/curve`, {
        curveType,
        value: curveValue,
        justification: curveJustification,
      });
      await notify.alert('Grade Curve Applied', {
        description: `Applied ${curveType.toUpperCase()} Grade Curve to ${res.updatedCount || 0} candidate submissions!`,
        variant: 'success',
      });
      setCurveJustification('');
      fetchEvaluations(selectedContestId);
      fetchCalibration(selectedContestId);
      fetchAuditStream(selectedContestId);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to apply grade curve');
    }
  };

  const handleRereview = async (id: string) => {
    const reason = await notify.prompt('Request Re-Review', {
      description: 'Enter specific reason for requesting re-review from the evaluator:',
      placeholder: 'e.g. Please re-evaluate edge case handling on test case 4...',
    });
    if (!reason) return;
    try {
      await api.put(`/evaluator/moderator/${id}/rereview`, { reason });
      notify.toast.info('Re-review requested from evaluator.');
      fetchEvaluations(selectedContestId);
      fetchAuditStream(selectedContestId);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to request re-review');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-black tracking-tight text-white">
              Chief Examiner <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">Moderation</span>
            </h1>
            <span className="px-3 py-1 text-xs font-bold rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 uppercase tracking-wider">
              Grade Sign-off & Audit Governance
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Four-Eyes grade verification, evaluator calibration metrics, score overrides, grade curve normalization, and candidate appeals.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Double-Blind Anonymous Moderation Toggle */}
          <button
            onClick={() => setIsDoubleBlind(!isDoubleBlind)}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-2 ${
              isDoubleBlind
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-lg shadow-purple-500/10'
                : 'bg-zinc-900 text-gray-400 border-white/10 hover:text-white'
            }`}
          >
            {isDoubleBlind ? '🙈 Double-Blind Mode: ON' : '👤 Double-Blind Mode: OFF'}
          </button>

          {/* 1-Click Bulk Approve */}
          <button
            onClick={handleBulkApprove}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 text-black hover:from-orange-400 hover:to-amber-300 transition-all shadow-lg shadow-orange-500/20 font-mono"
          >
            🚀 Bulk Approve Cohort Scores
          </button>

          {/* Navigation Tabs */}
          <div className="flex items-center bg-zinc-900 border border-white/10 rounded-xl p-1 gap-1">
            <button
              onClick={() => setActiveTab('moderation')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'moderation'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-black shadow-lg shadow-orange-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              📋 Queue
            </button>
            <button
              onClick={() => setActiveTab('calibration')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'calibration'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-black shadow-lg shadow-orange-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🎯 Calibration
            </button>
            <button
              onClick={() => setActiveTab('curve')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'curve'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-black shadow-lg shadow-orange-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              📈 Grade Curve
            </button>
            <button
              onClick={() => setActiveTab('appeals')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'appeals'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-black shadow-lg shadow-orange-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              📢 Appeals Desk
            </button>
            <button
              onClick={() => setActiveTab('auditStream')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'auditStream'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-black shadow-lg shadow-orange-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              📜 Audit Stream
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/50 border border-red-500/30 rounded-2xl text-red-400 text-sm flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={fetchContests} className="px-3.5 py-1.5 bg-red-900 hover:bg-red-800 text-white rounded-xl text-xs font-bold transition">
            Retry Connection
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center space-y-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-400" />
          <p className="text-gray-500 text-xs font-bold">Loading moderation cockpit...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Contest Selector */}
          <div className="flex items-center gap-4 bg-zinc-950 p-4 rounded-2xl border border-white/10">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Select Assessment Drive:</label>
            <select
              value={selectedContestId}
              onChange={(e) => handleContestChange(e.target.value)}
              className="bg-black border border-white/20 text-white rounded-xl px-4 py-2 text-xs font-bold focus:outline-none focus:border-orange-400 flex-1"
            >
              {contests.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c._count?.submissions || 0} Submissions)
                </option>
              ))}
            </select>
          </div>

          {/* TAB 1: MODERATION QUEUE */}
          {activeTab === 'moderation' && (
            <div className="bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-bold text-white text-sm">Graded Submissions Queue</h3>
                <span className="text-xs text-gray-400 font-bold">{evaluations.length} Items Pending Review</span>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 text-gray-400 uppercase font-bold border-b border-white/10">
                  <tr>
                    <th className="p-4">Candidate</th>
                    <th className="p-4">Problem</th>
                    <th className="p-4">Evaluator</th>
                    <th className="p-4">Score</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Governance Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {evaluations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-gray-500">
                        No submissions pending moderation for this contest drive.
                      </td>
                    </tr>
                  ) : (
                    evaluations.map((ev) => (
                      <tr key={ev.id} className="hover:bg-white/5 transition">
                        <td className="p-4">
                          <p className="font-bold text-white">
                            {isDoubleBlind ? `Candidate #${ev.id.slice(0, 6)}` : ev.user?.name}
                          </p>
                          <p className="text-[10px] text-gray-400 font-mono">
                            {isDoubleBlind ? `anon_${ev.id.slice(0, 4)}@anonymized.org` : ev.user?.email}
                          </p>
                        </td>
                        <td className="p-4">
                          <p className="text-gray-200 font-bold">{ev.problem?.title}</p>
                          <span className="text-[10px] text-gray-500 font-mono">{ev.language}</span>
                        </td>
                        <td className="p-4 text-amber-400 font-bold">{ev.evaluatedBy?.name || 'Automated / Pending'}</td>
                        <td className="p-4 font-black text-orange-400 text-sm">{ev.score} pts</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg ${
                            ev.moderationStatus === 'GRADED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {ev.moderationStatus}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => setInspectSub(ev)}
                              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white font-bold text-[10px] rounded-lg transition"
                            >
                              Inspect Rubric & Code
                            </button>
                            <button
                              onClick={() => handleApprove(ev.id)}
                              className="px-2.5 py-1 bg-emerald-600 text-black font-bold text-[10px] rounded-lg hover:bg-emerald-500 transition"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => { setSelectedEvalId(ev.id); setOverrideScore(ev.score); }}
                              className="px-2.5 py-1 bg-orange-600/20 text-orange-400 border border-orange-500/30 font-bold text-[10px] rounded-lg hover:bg-orange-600/30 transition"
                            >
                              Override
                            </button>
                            <button
                              onClick={() => handleRereview(ev.id)}
                              className="px-2.5 py-1 bg-red-600/20 text-red-400 border border-red-500/30 font-bold text-[10px] rounded-lg hover:bg-red-600/30 transition"
                            >
                              Re-Review
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: EVALUATOR CALIBRATION */}
          {activeTab === 'calibration' && calibration && (
            <div className="space-y-6">
              <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white">Evaluator Grading Consistency & Calibration</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Harshness / Leniency score deviation ($z$-score variance) across assigned evaluators vs. Cohort Mean ({calibration.overallAvg} pts).
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {calibration.evaluators.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 col-span-3 text-xs">No evaluator metrics recorded yet.</div>
                  ) : (
                    calibration.evaluators.map((ev) => (
                      <div key={ev.evaluatorId} className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-sm">{ev.name}</span>
                          <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                            ev.rating.includes('Lenient') ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            ev.rating.includes('Harsh') ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                            'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {ev.rating}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-black/40 p-2.5 rounded-xl space-y-0.5">
                            <span className="text-[10px] text-gray-400 uppercase font-bold">Graded Count</span>
                            <p className="font-bold text-white">{ev.count} items</p>
                          </div>
                          <div className="bg-black/40 p-2.5 rounded-xl space-y-0.5">
                            <span className="text-[10px] text-gray-400 uppercase font-bold">Avg Score</span>
                            <p className="font-black text-orange-400">{ev.avgScore} pts</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GRADE CURVE NORMALIZATION */}
          {activeTab === 'curve' && (
            <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-white">Grade Curve & Cohort Normalization Tool</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Apply linear grace points or scaling formulas across all candidate scores for this contest drive.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div
                  onClick={() => setCurveType('flat')}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                    curveType === 'flat' ? 'bg-orange-500/20 border-orange-400 ring-2 ring-orange-500/50' : 'bg-white/5 border-white/10'
                  }`}
                >
                  <h4 className="font-bold text-white text-sm">➕ Flat Bonus Curve</h4>
                  <p className="text-xs text-gray-400">Adds fixed grace points (+{curveValue} pts) to all candidate scores (capped at 100).</p>
                </div>

                <div
                  onClick={() => setCurveType('sqrt')}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                    curveType === 'sqrt' ? 'bg-orange-500/20 border-orange-400 ring-2 ring-orange-500/50' : 'bg-white/5 border-white/10'
                  }`}
                >
                  <h4 className="font-bold text-white text-sm">📐 Square Root Scaling</h4>
                  <p className="text-xs text-gray-400">Applies sqrt(score) × 10 formula to boost lower scores while dampening top scores.</p>
                </div>

                <div
                  onClick={() => setCurveType('percentile')}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                    curveType === 'percentile' ? 'bg-orange-500/20 border-orange-400 ring-2 ring-orange-500/50' : 'bg-white/5 border-white/10'
                  }`}
                >
                  <h4 className="font-bold text-white text-sm">📊 Percentile Lift</h4>
                  <p className="text-xs text-gray-400">Scales scores proportionally by +{curveValue}% for competitive normalization.</p>
                </div>
              </div>

              <div className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Adjustment Value ({curveType === 'flat' ? 'Points' : '%'})</label>
                  <input
                    type="number"
                    value={curveValue}
                    onChange={(e) => setCurveValue(Number(e.target.value))}
                    className="w-full bg-black border border-white/20 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-orange-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Mandatory Normalization Justification</label>
                  <textarea
                    value={curveJustification}
                    onChange={(e) => setCurveJustification(e.target.value)}
                    placeholder="Provide academic reason for applying grade curve..."
                    className="w-full bg-black border border-white/20 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-orange-400 h-24"
                  />
                </div>

                <button
                  onClick={handleApplyCurve}
                  className="px-6 py-2.5 bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs rounded-xl transition shadow-lg shadow-orange-500/20"
                >
                  Apply Grade Curve Now
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: APPEALS DESK */}
          {activeTab === 'appeals' && (
            <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-white">Candidate Score Dispute & Appeals Desk</h3>
              <p className="text-xs text-gray-400">Review student re-evaluation requests, inspect submission evidence, and issue final binding verdicts.</p>

              {appealsList.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-xs bg-white/5 rounded-xl border border-white/5">
                  ✅ No pending grade appeals for this contest drive.
                </div>
              ) : (
                <div className="space-y-3">
                  {appealsList.map((app: any) => (
                    <div key={app.id} className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{isDoubleBlind ? `Candidate #${app.id.slice(0, 6)}` : app.user?.name}</span>
                          <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded font-bold border border-amber-500/20">APPEAL PENDING</span>
                        </div>
                        <p className="text-xs text-gray-300 mt-1">Problem: <strong className="text-white">{app.problem?.title}</strong> · Current Score: <span className="text-orange-400 font-bold">{app.score} pts</span></p>
                        <p className="text-[11px] text-gray-400 font-mono mt-0.5">{app.evaluationComments}</p>
                      </div>
                      <button
                        onClick={() => { setSelectedEvalId(app.id); setOverrideScore(app.score); }}
                        className="px-3.5 py-1.5 bg-orange-500 text-black text-xs font-bold rounded-xl hover:bg-orange-400 transition"
                      >
                        Review Dispute
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: AUDIT STREAM */}
          {activeTab === 'auditStream' && (
            <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white">Live Governance Audit Activity Stream</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Real-time log of Chief Examiner score overrides, approvals, and grade curves.</p>
                </div>
                <span className="text-xs text-orange-400 font-mono font-bold">{auditLogs.length} Audit Events</span>
              </div>

              <div className="divide-y divide-white/5">
                {auditLogs.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-xs">No moderation actions logged yet.</div>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="py-3.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{log.user?.name}</span>
                          <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                            {log.action}
                          </span>
                        </div>
                        <p className="text-gray-400 text-[11px] mt-0.5 font-mono">
                          {JSON.stringify(log.details)}
                        </p>
                      </div>
                      <span className="text-gray-500 font-mono text-[10px]">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4-Axis Rubric & Code Inspector Modal */}
      {inspectSub && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-white/20 rounded-3xl max-w-4xl w-full p-6 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">{inspectSub.problem?.title} ({inspectSub.problem?.difficulty})</span>
                <h3 className="text-lg font-black text-white">4-Axis Rubric & Code Inspector</h3>
              </div>
              <button onClick={() => setInspectSub(null)} className="text-gray-500 hover:text-white p-2 text-lg">✕</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Code View */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">Candidate: {inspectSub.user?.name}</span>
                  <span className="font-mono text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">{inspectSub.language}</span>
                </div>
                <div className="bg-black border border-white/10 p-4 rounded-2xl font-mono text-xs text-emerald-400 max-h-80 overflow-y-auto">
                  {inspectSub.code || '// Source code submission preview'}
                </div>
              </div>

              {/* Right: 4-Axis Rubric */}
              <div className="space-y-4 bg-white/5 p-5 rounded-2xl border border-white/10">
                <h4 className="font-bold text-white text-sm border-b border-white/10 pb-2">4-Axis Academic Rubric Breakdown</h4>

                <div className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between font-bold">
                      <span className="text-gray-300">1. Correctness & Base Cases (40%)</span>
                      <span className="text-teal-400">38/40 pts</span>
                    </div>
                    <div className="h-1.5 bg-black rounded-full overflow-hidden">
                      <div className="h-full bg-teal-400 w-[95%]" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between font-bold">
                      <span className="text-gray-300">2. Algorithmic Efficiency (30%)</span>
                      <span className="text-emerald-400">27/30 pts</span>
                    </div>
                    <div className="h-1.5 bg-black rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 w-[90%]" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between font-bold">
                      <span className="text-gray-300">3. Code Style & Readability (20%)</span>
                      <span className="text-purple-400">18/20 pts</span>
                    </div>
                    <div className="h-1.5 bg-black rounded-full overflow-hidden">
                      <div className="h-full bg-purple-400 w-[90%]" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between font-bold">
                      <span className="text-gray-300">4. Edge Case Handling (10%)</span>
                      <span className="text-amber-400">9/10 pts</span>
                    </div>
                    <div className="h-1.5 bg-black rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 w-[90%]" />
                    </div>
                  </div>
                </div>

                {inspectSub.evaluationComments && (
                  <div className="pt-2 border-t border-white/10 text-xs">
                    <span className="font-bold text-amber-400 block mb-1">Evaluator Notes:</span>
                    <p className="text-gray-300 italic">{inspectSub.evaluationComments}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 text-right">
              <button onClick={() => setInspectSub(null)} className="px-5 py-2.5 bg-orange-500 text-black font-bold text-xs rounded-xl hover:bg-orange-400 transition">
                Close Rubric View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Override Modal */}
      {selectedEvalId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-white/20 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Chief Examiner Grade Override</h3>
            <p className="text-xs text-gray-400">Override evaluator score with mandatory audit justification.</p>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">New Score (pts)</label>
              <input
                type="number"
                value={overrideScore}
                onChange={(e) => setOverrideScore(Number(e.target.value))}
                className="w-full bg-black border border-white/20 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-orange-400 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Mandatory Override Reason</label>
              <textarea
                value={moderationReason}
                onChange={(e) => setModerationReason(e.target.value)}
                placeholder="Provide justification for score change..."
                className="w-full bg-black border border-white/20 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-orange-400 h-24"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedEvalId(null)}
                className="px-4 py-2 bg-white/10 text-white font-bold text-xs rounded-xl hover:bg-white/20 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleOverrideSubmit}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs rounded-xl transition"
              >
                Submit Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ModeratorDashboard;
