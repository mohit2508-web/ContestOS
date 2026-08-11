import { useState } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useNotify } from '../components/notifications';
import { api } from '../services/api';
import { EmptyState } from '../components/common/EmptyState';

export function NotificationsPage() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, refresh } = useNotifications();
  const notify = useNotify();
  const [actingId, setActingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'invitations'>('all');

  const [preferences, setPreferences] = useState(() => {
    try {
      const saved = localStorage.getItem('kryptavia_notif_prefs');
      return saved ? JSON.parse(saved) : { emailWarnings: true, emailInvites: true, emailResults: true, inAppChime: true };
    } catch {
      return { emailWarnings: true, emailInvites: true, emailResults: true, inAppChime: true };
    }
  });
  const [showPrefModal, setShowPrefModal] = useState(false);

  const togglePref = (key: keyof typeof preferences) => {
    setPreferences((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('kryptavia_notif_prefs', JSON.stringify(next));
      notify.toast.success('Notification preferences saved!');
      return next;
    });
  };

  const handleAccept = async (n: any) => {
    const invId = n.data?.invitationId;
    if (!invId) return;
    setActingId(n.id);
    try {
      const res = await api.acceptInvitationById(invId);
      notify.toast.success(res.message || 'Joined organization successfully!');
      markAsRead(n.id);
      refresh();
      setTimeout(() => {
        window.location.href = '/org';
      }, 1000);
    } catch (err: any) {
      notify.toast.error(err?.response?.data?.error || 'Failed to accept invitation');
    } finally {
      setActingId(null);
    }
  };

  const handleDecline = async (n: any) => {
    const invId = n.data?.invitationId;
    if (!invId) return;
    setActingId(n.id);
    try {
      await api.declineInvitationById(invId);
      notify.toast.success('Invitation declined');
      markAsRead(n.id);
      refresh();
    } catch (err: any) {
      notify.toast.error(err?.response?.data?.error || 'Failed to decline invitation');
    } finally {
      setActingId(null);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'invitations') return n.type === 'TEAM_INVITATION';
    return true;
  });

  return (
    <div className="min-h-screen bg-black text-white p-6 space-y-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔔</span>
              <h1 className="text-2xl font-black tracking-tight">
                Notifications & Team Invitations<span className="text-amber-400">.</span>
              </h1>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              View live alerts, system announcements, and respond to organization access invitations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPrefModal(true)}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
            >
              <span>⚙️</span> Notification Preferences
            </button>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Mark All as Read ({unreadCount})
              </button>
            )}
          </div>
        </div>

        {/* NOTIFICATION PREFERENCES SETTINGS MODAL */}
        {showPrefModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="bg-zinc-950 border border-white/15 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">⚙️</span>
                  <div>
                    <h3 className="text-lg font-black text-white">Notification Delivery Channels</h3>
                    <p className="text-xs text-zinc-400">Configure email & real-time push preferences</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPrefModal(false)}
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Toggle 1: Warning Emails */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900 border border-white/5">
                  <div>
                    <h4 className="text-xs font-bold text-white">Proctoring Warning & Disqualification Emails</h4>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Send instant email when integrity thresholds or warnings are issued</p>
                  </div>
                  <button
                    onClick={() => togglePref('emailWarnings')}
                    className={`w-12 h-6 rounded-full transition-colors p-1 cursor-pointer ${
                      preferences.emailWarnings ? 'bg-emerald-500' : 'bg-zinc-800'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${preferences.emailWarnings ? 'translate-x-6' : ''}`} />
                  </button>
                </div>

                {/* Toggle 2: Invite Emails */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900 border border-white/5">
                  <div>
                    <h4 className="text-xs font-bold text-white">Organization & Contest Invite Alerts</h4>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Receive email invites for new contest drives and organization roles</p>
                  </div>
                  <button
                    onClick={() => togglePref('emailInvites')}
                    className={`w-12 h-6 rounded-full transition-colors p-1 cursor-pointer ${
                      preferences.emailInvites ? 'bg-emerald-500' : 'bg-zinc-800'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${preferences.emailInvites ? 'translate-x-6' : ''}`} />
                  </button>
                </div>

                {/* Toggle 3: Result Emails */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900 border border-white/5">
                  <div>
                    <h4 className="text-xs font-bold text-white">Contest Performance & Scorecard Release Emails</h4>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Email detailed PDF scorecard summary when contest leaderboard closes</p>
                  </div>
                  <button
                    onClick={() => togglePref('emailResults')}
                    className={`w-12 h-6 rounded-full transition-colors p-1 cursor-pointer ${
                      preferences.emailResults ? 'bg-emerald-500' : 'bg-zinc-800'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${preferences.emailResults ? 'translate-x-6' : ''}`} />
                  </button>
                </div>

                {/* Toggle 4: In-App Chime */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900 border border-white/5">
                  <div>
                    <h4 className="text-xs font-bold text-white">In-App Chime & Sound Alerts</h4>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Play subtle acoustic notification sound on incoming live SSE events</p>
                  </div>
                  <button
                    onClick={() => togglePref('inAppChime')}
                    className={`w-12 h-6 rounded-full transition-colors p-1 cursor-pointer ${
                      preferences.inAppChime ? 'bg-emerald-500' : 'bg-zinc-800'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${preferences.inAppChime ? 'translate-x-6' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="pt-2 text-right">
                <button
                  onClick={() => setShowPrefModal(false)}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl transition cursor-pointer"
                >
                  Save & Apply Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 border-b border-white/10 pb-3">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              filter === 'all'
                ? 'bg-amber-500 text-black font-black'
                : 'bg-white/5 text-zinc-400 hover:text-white'
            }`}
          >
            All Notifications ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              filter === 'unread'
                ? 'bg-amber-500 text-black font-black'
                : 'bg-white/5 text-zinc-400 hover:text-white'
            }`}
          >
            Unread ({unreadCount})
          </button>
          <button
            onClick={() => setFilter('invitations')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              filter === 'invitations'
                ? 'bg-amber-500 text-black font-black'
                : 'bg-white/5 text-zinc-400 hover:text-white'
            }`}
          >
            Team Invitations ({notifications.filter(n => n.type === 'TEAM_INVITATION').length})
          </button>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {filteredNotifications.length === 0 ? (
            <EmptyState
              variant="notifications"
              title="You're all caught up!"
              body="Invitations, organization approvals, and security alerts will chime in the moment there's news."
              onAction={refresh}
              actionLabel="Check for Updates"
            />
          ) : (
            filteredNotifications.map((n) => {
              const isInvite = n.type === 'TEAM_INVITATION';
              return (
                <div
                  key={n.id}
                  className={`p-5 rounded-2xl border transition space-y-3 ${
                    !n.isRead ? 'bg-zinc-950 border-amber-500/40 shadow-lg shadow-amber-500/5' : 'bg-zinc-950/60 border-white/10 opacity-80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {isInvite && (
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-black rounded uppercase">
                            Team Invitation
                          </span>
                        )}
                        <h3 className="text-sm font-black text-white">{n.title}</h3>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">{n.message}</p>
                    </div>

                    <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                      {new Date(n.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {isInvite && n.data && !n.isRead && n.data.status !== 'ACCEPTED' && n.data.status !== 'DECLINED' && (
                    <div className="pt-3 border-t border-white/10 flex items-center gap-3">
                      <button
                        onClick={() => handleAccept(n)}
                        disabled={actingId === n.id}
                        className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-xl transition shadow-lg shadow-emerald-500/20 cursor-pointer"
                      >
                        {actingId === n.id ? 'Processing...' : '✅ Accept & Join Organization'}
                      </button>
                      <button
                        onClick={() => handleDecline(n)}
                        disabled={actingId === n.id}
                        className="px-6 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 font-bold text-xs rounded-xl transition cursor-pointer"
                      >
                        ❌ Decline Invitation
                      </button>
                    </div>
                  )}

                  {isInvite && (n.isRead || n.data?.status === 'ACCEPTED') && (
                    <div className="pt-3 border-t border-white/10 flex items-center gap-2 text-xs text-emerald-400 font-bold">
                      <span>✅ Joined & Accepted Organization</span>
                    </div>
                  )}

                  {n.type === 'OFFBOARDING_NOTICE' && n.data && (
                    <div className="pt-3 border-t border-rose-500/20 bg-rose-500/5 p-4 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-rose-400 uppercase tracking-widest text-[10px]">
                          Official Exit Report — {n.data.reasonCategory}
                        </span>
                        <span className="font-mono text-zinc-500 text-[10px]">Admin: {n.data.adminName} ({n.data.adminEmail})</span>
                      </div>
                      <p className="text-zinc-300 leading-relaxed text-xs font-mono">
                        "{n.data.detailedNotes}"
                      </p>
                      {n.data.unassignedContestsCount > 0 && (
                        <p className="text-[10px] text-amber-400 font-bold">
                          ⚠️ {n.data.unassignedContestsCount} active contest drive assignments were unassigned & returned to pool.
                        </p>
                      )}
                    </div>
                  )}

                  {n.type === 'CONTEST_ASSIGNMENT' && n.data && (
                    <div className="mt-3 bg-gradient-to-b from-zinc-950 to-zinc-900 border border-amber-500/30 rounded-2xl p-5 space-y-4 shadow-2xl relative overflow-hidden text-left">
                      {/* Decorative background glow */}
                      <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

                      {/* Official Header Badge */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold text-xs">
                            🏛️
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">
                              OFFICIAL STAFF APPOINTMENT DIRECTIVE
                            </span>
                            <h4 className="text-xs font-bold text-white font-mono">
                              REF-DOC-{n.id.slice(0, 8).toUpperCase()} · KRYPTAVIA OS GOVERNANCE ENGINE
                            </h4>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono px-2.5 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-full font-bold">
                          SEAL VERIFIED ✓
                        </span>
                      </div>

                      {/* Appointment Metadata Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-black/60 border border-white/10 rounded-xl p-3.5 text-xs">
                        <div>
                          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Assigned Contest Drive</span>
                          <p className="font-black text-amber-300 mt-0.5 text-sm">{n.data.contestTitle || 'Contest Drive'}</p>
                        </div>

                        <div>
                          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Designated Official Position</span>
                          <p className="font-black text-white mt-0.5 flex items-center gap-1">
                            {n.data.assignedRole === 'PROCTOR' && '🛡️ Chief Invigilator & Proctor'}
                            {n.data.assignedRole === 'EVALUATOR' && '✍️ Lead Evaluator & Judge'}
                            {n.data.assignedRole !== 'PROCTOR' && n.data.assignedRole !== 'EVALUATOR' && `📝 ${n.data.assignedRole}`}
                          </p>
                        </div>

                        <div>
                          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Authorizing Authority</span>
                          <p className="font-bold text-zinc-300 mt-0.5">{n.data.assignedByName || 'Org Admin'}</p>
                          <p className="text-[10px] text-zinc-500 font-mono">{n.data.assignedByEmail || ''}</p>
                        </div>
                      </div>

                      {/* Code of Conduct & Statutes Accord */}
                      {Array.isArray(n.data.guidelines) && n.data.guidelines.length > 0 && (
                        <div className="bg-black/80 border border-amber-500/20 rounded-xl p-4 space-y-2.5">
                          <div className="flex items-center justify-between border-b border-white/10 pb-2">
                            <h5 className="font-black text-amber-400 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                              <span>⚖️ MANDATORY CODE OF CONDUCT & NDA STATUTES</span>
                            </h5>
                            <span className="text-[9px] font-mono text-zinc-500">Legal Accord 2026</span>
                          </div>

                          <div className="grid grid-cols-1 gap-2">
                            {n.data.guidelines.map((rule: string, idx: number) => (
                              <div key={idx} className="flex items-start gap-2.5 p-2.5 bg-white/[0.02] rounded-lg border border-white/5 text-xs">
                                <span className="w-5 h-5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                  0{idx + 1}
                                </span>
                                <p className="text-zinc-300 leading-relaxed font-sans text-xs">{rule}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Direct Action Launch Bar */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-zinc-500 font-mono">
                          Appointed on: {new Date(n.createdAt).toLocaleString()}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => window.print()}
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-300 font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1 border border-white/10"
                          >
                            <span>📄 Print Warrant</span>
                          </button>
                          {n.data.assignedRole === 'EVALUATOR' && (
                            <a
                              href="/evaluator/assigned"
                              className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs rounded-lg transition shadow-md shadow-cyan-500/20 flex items-center gap-1 cursor-pointer"
                            >
                              <span>🚀 Open Grading Queue</span>
                            </a>
                          )}
                          {n.data.assignedRole === 'PROCTOR' && (
                            <a
                              href="/proctor/live"
                              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-lg transition shadow-md shadow-amber-500/20 flex items-center gap-1 cursor-pointer"
                            >
                              <span>🚀 Open Proctor Console</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default NotificationsPage;
