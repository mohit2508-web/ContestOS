import { useState, useEffect, useRef } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useNotify } from './notifications';
import { api } from '../services/api';

export function NotificationBell({ position = 'right' }: { position?: 'left' | 'right' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead, refresh } = useNotifications();
  const notify = useNotify();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleAccept = async (n: any) => {
    const invId = n.data?.invitationId;
    if (!invId) return;
    setActingId(n.id);
    try {
      const res = await api.acceptInvitationById(invId);
      notify.toast.success(res.message || 'Joined organization successfully!');
      markAsRead(n.id);
      refresh();
      setIsOpen(false);
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
      setIsOpen(false);
    } catch (err: any) {
      notify.toast.error(err?.response?.data?.error || 'Failed to decline invitation');
    } finally {
      setActingId(null);
    }
  };

  const positionClasses = position === 'left' ? 'left-0 mt-2' : 'right-0 mt-2';

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) refresh(); }}
        className="relative p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer border border-white/10"
        title="Notifications"
      >
        <span className="text-base">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-zinc-950 animate-bounce">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={`absolute ${positionClasses} w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden space-y-2 p-3`}>
          <div className="flex justify-between items-center px-2 py-1.5 border-b border-white/10">
            <span className="font-extrabold text-xs text-white flex items-center gap-1.5">
              <span>🔔 Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 text-[10px] rounded-md font-bold">
                  {unreadCount} new
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold transition cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2 custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-xs">
                <span>✨ No notifications yet.</span>
              </div>
            ) : (
              notifications.map((n) => {
                const isInvite = n.type === 'TEAM_INVITATION';
                return (
                  <div
                    key={n.id}
                    className={`p-3 rounded-xl border transition ${
                      !n.isRead ? 'bg-white/5 border-white/15' : 'bg-black/40 border-white/5 opacity-75'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-white leading-tight">{n.title}</h4>
                      <span className="text-[9px] text-gray-500 font-mono shrink-0">
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-300 mt-1 leading-snug">{n.message}</p>

                    {/* Team Invitation Interactive Card Actions */}
                    {isInvite && n.data && !n.isRead && n.data.status !== 'ACCEPTED' && n.data.status !== 'DECLINED' && (
                      <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center gap-2">
                        <button
                          onClick={() => handleAccept(n)}
                          disabled={actingId === n.id}
                          className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-lg transition shadow-md flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>{actingId === n.id ? 'Joining...' : '✅ Accept'}</span>
                        </button>
                        <button
                          onClick={() => handleDecline(n)}
                          disabled={actingId === n.id}
                          className="flex-1 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>❌ Decline</span>
                        </button>
                      </div>
                    )}

                    {isInvite && (n.isRead || n.data?.status === 'ACCEPTED') && (
                      <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
                        <span>✅ Joined & Accepted</span>
                      </div>
                    )}

                    {n.type === 'OFFBOARDING_NOTICE' && n.data && (
                      <div className="mt-2 pt-1.5 border-t border-rose-500/20 text-[10px] text-rose-300 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold uppercase tracking-wider text-rose-400">Exit Report: {n.data.reasonCategory}</span>
                          <span className="font-mono text-zinc-500">By {n.data.adminName}</span>
                        </div>
                        <p className="text-[10px] text-zinc-400 italic line-clamp-2">"{n.data.detailedNotes}"</p>
                      </div>
                    )}

                    {n.type === 'CONTEST_ASSIGNMENT' && n.data && (
                      <div className="mt-2 pt-2 border-t border-amber-500/20 text-[10px] space-y-1.5 bg-amber-500/5 p-2.5 rounded-xl border border-amber-500/20 text-left">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-amber-400 uppercase tracking-widest text-[9px] flex items-center gap-1">
                            <span>🏛️ APPOINTMENT WARRANT</span>
                          </span>
                          <span className="font-mono text-zinc-500 text-[9px]">{new Date(n.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-white font-bold text-xs">{n.data.contestTitle || 'Contest Drive'}</p>
                        <p className="text-zinc-400 text-[10px]">
                          Position: <span className="text-amber-300 font-bold">{n.data.assignedRole}</span> · By <span className="text-zinc-300 font-bold">{n.data.assignedByName}</span>
                        </p>
                        {Array.isArray(n.data.guidelines) && n.data.guidelines.length > 0 && (
                          <div className="space-y-1 bg-black/60 p-2 rounded-lg border border-amber-500/10 text-[9.5px] text-zinc-300">
                            <span className="font-bold text-amber-400 block text-[9px] uppercase tracking-wider">⚖️ Mandated Rules:</span>
                            {n.data.guidelines.slice(0, 2).map((g: string, i: number) => (
                              <p key={i} className="line-clamp-1 text-zinc-300">0{i + 1}. {g}</p>
                            ))}
                          </div>
                        )}
                        <a
                          href="/notifications"
                          onClick={() => setIsOpen(false)}
                          className="inline-block mt-1 text-[9px] text-amber-400 hover:underline font-bold"
                        >
                          View Full Official Warrant & Directives →
                        </a>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
