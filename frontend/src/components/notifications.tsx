import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

export interface ModalAlert {
  id: string;
  title: string;
  description?: string;
  type: 'alert' | 'confirm';
  resolve: (value: boolean) => void;
}

interface NotificationContextType {
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    warning: (msg: string) => void;
    info: (msg: string) => void;
  };
  confirm: (msg: string, options?: { description?: string }) => Promise<boolean>;
  alert: (title: string, options?: { description?: string }) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [modals, setModals] = useState<ModalAlert[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const confirm = useCallback((title: string, options?: { description?: string }) => {
    return new Promise<boolean>((resolve) => {
      const id = Math.random().toString(36).substring(2, 9);
      setModals(prev => [...prev, {
        id,
        title,
        description: options?.description,
        type: 'confirm',
        resolve: (val: boolean) => {
          setModals(m => m.filter(x => x.id !== id));
          resolve(val);
        }
      }]);
    });
  }, []);

  const alert = useCallback((title: string, options?: { description?: string }) => {
    return new Promise<void>((resolve) => {
      const id = Math.random().toString(36).substring(2, 9);
      setModals(prev => [...prev, {
        id,
        title,
        description: options?.description,
        type: 'alert',
        resolve: () => {
          setModals(m => m.filter(x => x.id !== id));
          resolve();
        }
      }]);
    });
  }, []);

  const contextValue: NotificationContextType = {
    toast: {
      success: (msg: string) => addToast('success', msg),
      error: (msg: string) => addToast('error', msg),
      warning: (msg: string) => addToast('warning', msg),
      info: (msg: string) => addToast('info', msg),
    },
    confirm,
    alert,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}

      {/* Floating Toasts Container */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-md w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 p-4 rounded-xl shadow-2xl backdrop-blur-xl border border-white/10 transform transition-all duration-300 animate-slide-in ${
              t.type === 'success'
                ? 'bg-emerald-950/80 text-emerald-200 border-emerald-500/30'
                : t.type === 'error'
                ? 'bg-rose-950/80 text-rose-200 border-rose-500/30'
                : t.type === 'warning'
                ? 'bg-amber-950/80 text-amber-200 border-amber-500/30'
                : 'bg-sky-950/80 text-sky-200 border-sky-500/30'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0">
                {t.type === 'success' && (
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                {t.type === 'error' && (
                  <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
                {t.type === 'warning' && (
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                )}
                {t.type === 'info' && (
                  <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
              </div>
              <p className="text-sm font-medium text-white leading-snug break-words">{t.message}</p>
            </div>

            <button
              onClick={() => removeToast(t.id)}
              className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Modal Dialog (Alert / Confirm) */}
      {modals.length > 0 && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          {modals.map((m) => (
            <div
              key={m.id}
              className="bg-neutral-900/90 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-up"
            >
              <h3 className="text-lg font-bold text-white">{m.title}</h3>
              {m.description && <p className="text-sm text-gray-300">{m.description}</p>}
              <div className="flex items-center justify-end gap-3 pt-2">
                {m.type === 'confirm' && (
                  <button
                    onClick={() => m.resolve(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={() => m.resolve(true)}
                  className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-xl shadow-lg transition-all"
                >
                  OK
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotify(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    // Fallback if rendered outside NotificationProvider
    return {
      toast: {
        success: (msg: string) => alert(`[SUCCESS] ${msg}`),
        error: (msg: string) => alert(`[ERROR] ${msg}`),
        warning: (msg: string) => alert(`[WARNING] ${msg}`),
        info: (msg: string) => alert(`[INFO] ${msg}`),
      },
      confirm: async (msg: string) => window.confirm(msg),
      alert: async (title: string, options?: any) => window.alert(`${title}\n${options?.description || ''}`),
    };
  }
  return context;
}
