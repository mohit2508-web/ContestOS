import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ModalVariant = 'success' | 'error' | 'warning' | 'info' | 'danger';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

export interface ModalOptions {
  description?: string;
  variant?: ModalVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  defaultValue?: string;
  placeholder?: string;
}

export interface ModalAlert {
  id: string;
  title: string;
  description?: string;
  variant?: ModalVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  type: 'alert' | 'confirm' | 'prompt';
  defaultValue?: string;
  placeholder?: string;
  inputValue?: string;
  resolve: (value: any) => void;
}

interface NotificationContextType {
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    warning: (msg: string) => void;
    info: (msg: string) => void;
  };
  confirm: (title: string, options?: ModalOptions) => Promise<boolean>;
  alert: (title: string, options?: ModalOptions) => Promise<void>;
  prompt: (title: string, options?: ModalOptions) => Promise<string | null>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [modals, setModals] = useState<ModalAlert[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const confirm = useCallback((title: string, options?: ModalOptions) => {
    return new Promise<boolean>((resolve) => {
      const id = Math.random().toString(36).substring(2, 9);
      setModals((prev) => [
        ...prev,
        {
          id,
          title,
          description: options?.description,
          variant: options?.variant || 'warning',
          confirmLabel: options?.confirmLabel || 'Confirm',
          cancelLabel: options?.cancelLabel || 'Cancel',
          type: 'confirm',
          resolve: (val: boolean) => {
            setModals((m) => m.filter((x) => x.id !== id));
            resolve(val);
          },
        },
      ]);
    });
  }, []);

  const alert = useCallback((title: string, options?: ModalOptions) => {
    return new Promise<void>((resolve) => {
      const id = Math.random().toString(36).substring(2, 9);
      setModals((prev) => [
        ...prev,
        {
          id,
          title,
          description: options?.description,
          variant: options?.variant || 'info',
          confirmLabel: options?.confirmLabel || 'Acknowledge',
          type: 'alert',
          resolve: () => {
            setModals((m) => m.filter((x) => x.id !== id));
            resolve();
          },
        },
      ]);
    });
  }, []);

  const prompt = useCallback((title: string, options?: ModalOptions) => {
    return new Promise<string | null>((resolve) => {
      const id = Math.random().toString(36).substring(2, 9);
      setModals((prev) => [
        ...prev,
        {
          id,
          title,
          description: options?.description,
          variant: options?.variant || 'info',
          confirmLabel: options?.confirmLabel || 'Submit',
          cancelLabel: options?.cancelLabel || 'Cancel',
          defaultValue: options?.defaultValue || '',
          placeholder: options?.placeholder || '',
          inputValue: options?.defaultValue || '',
          type: 'prompt',
          resolve: (val: string | null) => {
            setModals((m) => m.filter((x) => x.id !== id));
            resolve(val);
          },
        },
      ]);
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
    prompt,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}

      {/* Floating Toasts Container */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-md w-full pointer-events-none px-4 sm:px-0">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, x: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className={`pointer-events-auto flex items-center justify-between gap-3 p-4 rounded-2xl shadow-2xl backdrop-blur-2xl border border-white/10 ${
                t.type === 'success'
                  ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40 shadow-emerald-500/10'
                  : t.type === 'error'
                  ? 'bg-rose-950/90 text-rose-200 border-rose-500/40 shadow-rose-500/10'
                  : t.type === 'warning'
                  ? 'bg-amber-950/90 text-amber-200 border-amber-500/40 shadow-amber-500/10'
                  : 'bg-sky-950/90 text-sky-200 border-sky-500/40 shadow-sky-500/10'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0">
                  {t.type === 'success' && (
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  {t.type === 'error' && (
                    <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  )}
                  {t.type === 'warning' && (
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                  )}
                  {t.type === 'info' && (
                    <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  )}
                </div>
                <p className="text-xs font-bold text-white leading-relaxed break-words">{t.message}</p>
              </div>

              <button
                onClick={() => removeToast(t.id)}
                className="text-zinc-400 hover:text-white transition p-1 rounded-lg hover:bg-white/10 shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 3D Animated Modal Dialog (Alert / Confirm / Prompt) */}
      <AnimatePresence>
        {modals.map((m) => {
          const variant = m.variant || (m.type === 'confirm' ? 'warning' : 'info');
          const isDanger = variant === 'danger' || variant === 'error';
          const isWarning = variant === 'warning';
          const isSuccess = variant === 'success';

          const accentColor = isDanger
            ? '#f43f5e'
            : isWarning
            ? '#f59e0b'
            : isSuccess
            ? '#10b981'
            : '#38bdf8';

          const buttonBg = isDanger
            ? 'from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white shadow-rose-500/20'
            : isWarning
            ? 'from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-amber-500/20 font-black'
            : isSuccess
            ? 'from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black shadow-emerald-500/20 font-black'
            : 'from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-black shadow-sky-500/20 font-black';

          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl"
              style={{ perspective: '1200px' }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.85, rotateX: 18, y: 30 }}
                animate={{ opacity: 1, scale: 1, rotateX: 0, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, rotateX: -12, y: -20 }}
                transition={{ type: 'spring', damping: 22, stiffness: 320 }}
                className="relative bg-zinc-950/95 border border-white/10 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 overflow-hidden"
                style={{
                  boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.9), 0 0 40px ${accentColor}22`,
                }}
              >
                {/* 3D Ambient Neon Glow Header Blob */}
                <div
                  aria-hidden
                  className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-48 rounded-full pointer-events-none blur-3xl"
                  style={{ background: `radial-gradient(circle, ${accentColor}44 0%, ${accentColor}00 70%)` }}
                />

                {/* 3D Badge Header Icon */}
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-lg border"
                    style={{
                      backgroundColor: `${accentColor}15`,
                      borderColor: `${accentColor}40`,
                      color: accentColor,
                    }}
                  >
                    {isDanger && '🛡️'}
                    {isWarning && '⚠️'}
                    {isSuccess && '✅'}
                    {!isDanger && !isWarning && !isSuccess && 'ℹ️'}
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest block" style={{ color: accentColor }}>
                      {isDanger ? 'SECURITY DIRECTIVE' : isWarning ? 'ACTION CONFIRMATION' : isSuccess ? 'SUCCESS NOTIFICATION' : 'PORTAL DIRECTIVE'}
                    </span>
                    <h3 className="text-base font-black text-white tracking-tight leading-snug mt-0.5">{m.title}</h3>
                  </div>
                </div>

                {/* Description Body */}
                {m.description && (
                  <p className="text-xs text-zinc-300 leading-relaxed font-sans bg-black/40 p-3.5 rounded-2xl border border-white/5">
                    {m.description}
                  </p>
                )}

                {/* Input box for PROMPT type */}
                {m.type === 'prompt' && (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      autoFocus
                      defaultValue={m.defaultValue || ''}
                      placeholder={m.placeholder || 'Enter input value...'}
                      onChange={(e) => {
                        m.inputValue = e.target.value;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') m.resolve(m.inputValue || '');
                        if (e.key === 'Escape') m.resolve(null);
                      }}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 font-mono transition"
                    />
                  </div>
                )}

                {/* Action CTA Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  {(m.type === 'confirm' || m.type === 'prompt') && (
                    <button
                      onClick={() => m.resolve(m.type === 'prompt' ? null : false)}
                      className="px-4 py-2.5 text-xs font-bold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition cursor-pointer"
                    >
                      {m.cancelLabel || 'Cancel'}
                    </button>
                  )}
                  <button
                    onClick={() => m.resolve(m.type === 'prompt' ? m.inputValue || '' : true)}
                    className={`px-5 py-2.5 text-xs font-black rounded-xl bg-gradient-to-r ${buttonBg} transition transform active:scale-95 cursor-pointer shadow-lg`}
                  >
                    {m.confirmLabel || (m.type === 'alert' ? 'Acknowledge' : 'Confirm')}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })}
      </AnimatePresence>
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
      confirm: async (title: string, options?: ModalOptions) => {
        return window.confirm(`${title}\n${options?.description || ''}`);
      },
      alert: async (title: string, options?: ModalOptions) => {
        window.alert(`${title}\n${options?.description || ''}`);
      },
      prompt: async (title: string, options?: ModalOptions) => {
        return window.prompt(`${title}\n${options?.description || ''}`, options?.defaultValue || '');
      },
    };
  }
  return context;
}
