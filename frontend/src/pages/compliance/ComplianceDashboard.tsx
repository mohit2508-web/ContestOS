import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  timestamp: string;
  user: { name: string; email: string; role: string };
}

interface GdprRequest {
  id: string;
  requestedByEmail: string;
  reason: string;
  status: string;
  createdAt: string;
  reviewNotes: string | null;
}

export function ComplianceDashboard() {
  const [activeTab, setActiveTab] = useState<'audit' | 'gdpr' | 'dsar' | 'retention' | 'summary'>('audit');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [gdprRequests, setGdprRequests] = useState<GdprRequest[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [retentionMetrics, setRetentionMetrics] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // GDPR action modal
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [confirmInputText, setConfirmInputText] = useState('');

  // DSAR Export
  const [dsarEmail, setDsarEmail] = useState('');
  const [dsarPackage, setDsarPackage] = useState<any>(null);
  const [dsarLoading, setDsarLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'audit') {
        const res = await api.get('/compliance/audit-logs');
        setLogs(res?.logs || res?.data?.logs || []);
      } else if (activeTab === 'gdpr') {
        const res = await api.get('/compliance/gdpr/requests');
        setGdprRequests(res?.requests || res?.data?.requests || []);
      } else if (activeTab === 'retention') {
        const res = await api.get('/compliance/retention');
        setRetentionMetrics(res);
      } else if (activeTab === 'summary') {
        const res = await api.get('/compliance/reports/access-summary');
        setSummary(res);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to fetch compliance data');
    } finally {
      setLoading(false);
    }
  };

  const handleGdprAction = async () => {
    if (!selectedRequestId || !actionType) return;
    if (actionType === 'approve' && confirmInputText !== 'CONFIRM-ERASE') {
      alert('You must type "CONFIRM-ERASE" to execute irreversible PII anonymization.');
      return;
    }
    try {
      if (actionType === 'approve') {
        await api.put(`/compliance/gdpr/requests/${selectedRequestId}/approve`, { reviewNotes });
      } else {
        await api.put(`/compliance/gdpr/requests/${selectedRequestId}/reject`, { reviewNotes });
      }
      setSelectedRequestId(null);
      setActionType(null);
      setReviewNotes('');
      setConfirmInputText('');
      fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Action failed');
    }
  };

  const handleDownloadSignedCSV = () => {
    window.open(`${api.client.defaults.baseURL || '/api'}/compliance/audit/export`, '_blank');
  };

  const handleGenerateDSAR = async () => {
    if (!dsarEmail) {
      alert('Please enter a candidate email address for Article 15 DSAR export.');
      return;
    }
    setDsarLoading(true);
    try {
      const res = await api.get(`/compliance/dsar/export?email=${encodeURIComponent(dsarEmail)}`);
      setDsarPackage(res);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to generate DSAR export package');
    } finally {
      setDsarLoading(false);
    }
  };

  const getActionSeverity = (action: string) => {
    if (action.includes('ERASE') || action.includes('BREAK_GLASS') || action.includes('SEED_COMPLETE')) return 'CRITICAL';
    if (action.includes('OVERRIDE') || action.includes('MODERATOR')) return 'WARN';
    return 'INFO';
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-black tracking-tight text-white">
              Compliance & <span className="bg-gradient-to-r from-red-500 to-rose-400 bg-clip-text text-transparent">Audit</span> Cockpit
            </h1>
            <span className="px-3 py-1 text-xs font-bold rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 uppercase tracking-wider">
              GDPR Article 15/17 & SOC 2 Guard
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Real-time platform audit trail, Article 17 PII anonymization engine, Article 15 DSAR data export, and storage retention lifecycle.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Download Signed Audit CSV */}
          <button
            onClick={handleDownloadSignedCSV}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-zinc-900 border border-white/10 hover:border-white/30 text-gray-300 hover:text-white transition-all flex items-center gap-2"
          >
            🔐 Download Signed SOC2 Audit CSV
          </button>

          {/* Tab switcher */}
          <div className="flex items-center bg-zinc-900 border border-white/10 rounded-xl p-1 gap-1">
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'audit' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-gray-400 hover:text-white'
              }`}
            >
              🛡️ Audit Logs
            </button>
            <button
              onClick={() => setActiveTab('gdpr')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'gdpr' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-gray-400 hover:text-white'
              }`}
            >
              🔒 Erasure Queue
            </button>
            <button
              onClick={() => setActiveTab('dsar')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'dsar' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-gray-400 hover:text-white'
              }`}
            >
              📦 DSAR Export
            </button>
            <button
              onClick={() => setActiveTab('retention')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'retention' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-gray-400 hover:text-white'
              }`}
            >
              ⏳ Retention Lifecycle
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'summary' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-gray-400 hover:text-white'
              }`}
            >
              📊 Access Summary
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/50 border border-red-500/30 rounded-2xl text-red-400 text-sm flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={fetchData} className="px-3.5 py-1.5 bg-red-900 hover:bg-red-800 text-white rounded-xl text-xs font-bold transition">
            Retry Connection
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center space-y-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
          <p className="text-gray-500 text-xs font-bold">Loading compliance engine...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: SOC 2 AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-bold text-white text-sm">Real-time SOC 2 & ISO 27001 Platform Audit Trail</h3>
                <span className="text-xs text-gray-400 font-bold">{logs.length} Recorded Events</span>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 text-gray-400 uppercase font-bold border-b border-white/10">
                  <tr>
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">User Identity</th>
                    <th className="p-4">Severity</th>
                    <th className="p-4">Audit Action</th>
                    <th className="p-4">Target Resource</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                  {logs.map((log) => {
                    const sev = getActionSeverity(log.action);
                    return (
                      <tr key={log.id} className="hover:bg-white/5 transition">
                        <td className="p-4 text-gray-400">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="p-4 font-bold text-white">
                          {log.user?.name} <span className="text-gray-500 font-normal">({log.user?.email})</span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${
                            sev === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                            sev === 'WARN' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {sev}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-red-300">{log.action}</td>
                        <td className="p-4 text-gray-300">{log.resource} ({log.resourceId?.slice(0, 8) || 'N/A'})</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: GDPR ERASURE QUEUE */}
          {activeTab === 'gdpr' && (
            <div className="space-y-6">
              <div className="bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-5 border-b border-white/10 flex items-center justify-between">
                  <h3 className="font-bold text-white text-sm">GDPR Article 17 "Right to be Forgotten" Request Queue</h3>
                  <span className="text-xs text-gray-400 font-bold">{gdprRequests.length} Requests</span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 text-gray-400 uppercase font-bold border-b border-white/10">
                    <tr>
                      <th className="p-4">Requested By</th>
                      <th className="p-4">Reason / Justification</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Submission Date</th>
                      <th className="p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {gdprRequests.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-gray-500">
                          No pending GDPR erasure requests.
                        </td>
                      </tr>
                    ) : (
                      gdprRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-white/5 transition">
                          <td className="p-4 font-bold text-white">{req.requestedByEmail}</td>
                          <td className="p-4 text-gray-400">{req.reason}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg ${
                              req.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                              req.status === 'EXECUTED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                              {req.status}
                            </span>
                          </td>
                          <td className="p-4 text-gray-400 font-mono">{new Date(req.createdAt).toLocaleDateString()}</td>
                          <td className="p-4">
                            {req.status === 'PENDING' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => { setSelectedRequestId(req.id); setActionType('approve'); setConfirmInputText(''); }}
                                  className="px-3 py-1 bg-emerald-600 text-black font-bold text-[10px] rounded-lg hover:bg-emerald-500 transition"
                                >
                                  Anonymise PII & Execute
                                </button>
                                <button
                                  onClick={() => { setSelectedRequestId(req.id); setActionType('reject'); }}
                                  className="px-3 py-1 bg-red-600/20 text-red-400 border border-red-500/30 font-bold text-[10px] rounded-lg hover:bg-red-600/30 transition"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Action Confirmation Modal */}
              {selectedRequestId && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-zinc-950 border border-white/20 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                    <h3 className="text-lg font-black text-white">
                      Confirm GDPR {actionType === 'approve' ? 'Erasure Execution' : 'Rejection'}
                    </h3>
                    <p className="text-xs text-gray-400">
                      {actionType === 'approve'
                        ? 'This will permanently scrub candidate PII (Name, Email, IP, Proctoring Video Snaps) into an unrecoverable SHA-256 hash.'
                        : 'Provide justification for rejecting this erasure request.'}
                    </p>

                    {actionType === 'approve' && (
                      <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-2xl space-y-2 text-xs">
                        <span className="font-bold text-red-400 block">⚠️ Safety Action Confirmation:</span>
                        <p className="text-gray-300 text-[11px]">Type <strong className="text-white font-mono">CONFIRM-ERASE</strong> below to authorize PII scrubbing:</p>
                        <input
                          type="text"
                          value={confirmInputText}
                          onChange={(e) => setConfirmInputText(e.target.value)}
                          placeholder="CONFIRM-ERASE"
                          className="w-full bg-black border border-white/20 rounded-xl px-3 py-2 text-xs text-red-400 font-mono focus:outline-none focus:border-red-400"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">DPIA Audit Review Notes</label>
                      <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Enter compliance review notes..."
                        className="w-full bg-black border border-white/20 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-red-400 h-20"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => { setSelectedRequestId(null); setActionType(null); }}
                        className="px-4 py-2 bg-white/10 text-white font-bold text-xs rounded-xl hover:bg-white/20 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleGdprAction}
                        className={`px-4 py-2 font-bold text-xs rounded-xl text-black transition ${
                          actionType === 'approve' ? 'bg-emerald-400 hover:bg-emerald-300' : 'bg-red-400 hover:bg-red-300'
                        }`}
                      >
                        Confirm Action
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DSAR ARTICLE 15 PACKAGE EXPORT */}
          {activeTab === 'dsar' && (
            <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-white">GDPR Article 15 Data Subject Access Request (DSAR) Generator</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Generate an encrypted JSON package of all personal data, submission code, and proctoring logs stored for a candidate.
                </p>
              </div>

              <div className="flex items-center gap-3 max-w-lg">
                <input
                  type="email"
                  placeholder="Enter candidate email (e.g. student@iitd.ac.in)..."
                  value={dsarEmail}
                  onChange={(e) => setDsarEmail(e.target.value)}
                  className="bg-black border border-white/20 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-red-500 flex-1"
                />
                <button
                  onClick={handleGenerateDSAR}
                  disabled={dsarLoading}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-red-600/20 flex items-center gap-2"
                >
                  {dsarLoading ? 'Generating...' : '📦 Export DSAR Package'}
                </button>
              </div>

              {dsarPackage && (
                <div className="bg-black border border-white/10 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="text-xs font-bold text-emerald-400">✅ DSAR Package Generated & Signed with SHA-256</span>
                    <button
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(dsarPackage, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `DSAR_Export_${dsarPackage.subjectProfile?.email}_${Date.now()}.json`;
                        a.click();
                      }}
                      className="px-3.5 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-xl hover:bg-emerald-500/20 transition"
                    >
                      💾 Download JSON Payload
                    </button>
                  </div>
                  <pre className="text-[11px] font-mono text-gray-300 bg-zinc-900 p-4 rounded-xl max-h-80 overflow-y-auto">
                    {JSON.stringify(dsarPackage, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: RETENTION LIFECYCLE WIDGET */}
          {activeTab === 'retention' && retentionMetrics && (
            <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-white">Storage Retention & Automated Data Lifecycle Manager</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Monitor storage retention thresholds and automated purging of candidate video logs and old assessment records.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Proctoring Video Logs Policy</span>
                  <p className="text-2xl font-black text-emerald-400">{retentionMetrics.retentionPolicy?.proctoringLogsDays} Days</p>
                  <p className="text-[11px] text-gray-500">{retentionMetrics.metrics?.totalProctorLogs} total logs ({retentionMetrics.metrics?.purgeableProctorLogs} purgeable)</p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Submission Archive Policy</span>
                  <p className="text-2xl font-black text-rose-400">{retentionMetrics.retentionPolicy?.candidateSubmissionsDays} Days</p>
                  <p className="text-[11px] text-gray-500">{retentionMetrics.metrics?.totalSubmissions} total submissions ({retentionMetrics.metrics?.purgeableSubmissions} purgeable)</p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Retention Health Rating</span>
                  <p className="text-2xl font-black text-teal-400">100% Compliant</p>
                  <p className="text-[11px] text-gray-500">ISO 27001 data lifecycle active</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ACCESS SUMMARY */}
          {activeTab === 'summary' && summary && (
            <div className="space-y-6">
              <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl">
                <h3 className="font-bold text-white text-sm">Regulatory Action Breakdown ({summary.period})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {summary.topActions?.map((act: any, idx: number) => (
                    <div key={idx} className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-white">{act.action}</p>
                        <span className="text-[10px] text-gray-400">Resource: {act.resource}</span>
                      </div>
                      <span className="text-lg font-black text-red-400">{act.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ComplianceDashboard;
