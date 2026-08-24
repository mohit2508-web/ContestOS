import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Lock, ShieldCheck, ShieldAlert, X, Loader2, KeyRound, ShieldQuestion } from 'lucide-react';
import { KryptaviaLogo } from '../common/KryptaviaLogo';

const MAX_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 30;

function useReferenceCode(examTitle?: string) {
  return useMemo(() => {
    const seed = Array.from(examTitle || 'EXAM').reduce((a, ch) => a + ch.charCodeAt(0), 0);
    const n = (1000 + ((seed * 97) % 9000)).toString().padStart(5, '0');
    return `TOS-${n}`;
  }, [examTitle]);
}

export interface AccessCodeGateProps {
  examTitle?: string;
  orgLabel?: string;
  codeLength?: number;
  onClose?: () => void;
  onVerify: (code: string) => Promise<{ valid: boolean; sessionToken?: string; error?: string }>;
  onSuccess?: (sessionToken?: string) => void;
  supportHint?: string;
}

export function AccessCodeGate({
  examTitle = 'Cognizant GenC Campus Drive 2026',
  orgLabel = 'Kryptavia OS Assessment Portal',
  codeLength = 6,
  onClose = () => {},
  onVerify,
  onSuccess = () => {},
  supportHint = 'Contact your instructor or proctor for the code.',
}: AccessCodeGateProps) {
  const [digits, setDigits] = useState<string[]>(Array(codeLength).fill(''));
  const [status, setStatus] = useState<'idle' | 'checking' | 'error' | 'success' | 'locked'>('idle');
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [lockSeconds, setLockSeconds] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const refCode = useReferenceCode(examTitle);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (status !== 'locked' || lockSeconds <= 0) return;
    const t = setTimeout(() => setLockSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [status, lockSeconds]);

  useEffect(() => {
    if (status === 'locked' && lockSeconds === 0) {
      setStatus('idle');
      setAttemptsLeft(MAX_ATTEMPTS);
      setDigits(Array(codeLength).fill(''));
      inputRefs.current[0]?.focus();
    }
  }, [lockSeconds, status, codeLength]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && status !== 'checking' && status !== 'success') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, onClose]);

  const isComplete = digits.every((d) => d !== '');

  const handleChange = (index: number, raw: string) => {
    if (status === 'checking' || status === 'locked' || status === 'success') return;
    const value = raw.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    if (status === 'error') setStatus('idle');
    if (value && index < codeLength - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!text) return;
    const next = Array(codeLength).fill('');
    for (let i = 0; i < Math.min(text.length, codeLength); i++) next[i] = text[i];
    setDigits(next);
    inputRefs.current[Math.min(text.length, codeLength - 1)]?.focus();
  };

  const handleSubmit = useCallback(async () => {
    if (!isComplete || status === 'checking' || status === 'locked') return;
    setStatus('checking');
    const code = digits.join('');
    try {
      const result = await onVerify(code);
      if (result?.valid) {
        setStatus('success');
        setTimeout(() => onSuccess(result.sessionToken), 950);
      } else {
        const remaining = attemptsLeft - 1;
        setAttemptsLeft(remaining);
        if (remaining <= 0) {
          setStatus('locked');
          setLockSeconds(LOCKOUT_SECONDS);
        } else setStatus('error');
        setDigits(Array(codeLength).fill(''));
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
      }
    } catch (_err) {
      setStatus('error');
      setDigits(Array(codeLength).fill(''));
    }
  }, [digits, isComplete, status, attemptsLeft, onVerify, onSuccess, codeLength]);

  useEffect(() => {
    if (isComplete && status === 'idle') handleSubmit();
  }, [isComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  // Kryptavia OS palette
  const c = {
    void: '#0A0C10',
    panel: '#111318',
    panelTop: '#15181E',
    border: '#23262D',
    borderSoft: '#1B1E24',
    green: '#17C97E',
    greenDim: '#0F9E63',
    greenText: '#06140D',
    amber: '#E3A73B',
    teal: '#2DD4BF',
    text: '#F3F5F7',
    muted: '#8A93A3',
    mutedDim: '#565F6E',
    error: '#F0546B',
  };

  const stateColor = status === 'error' ? c.error : status === 'success' ? c.green : status === 'locked' ? c.amber : c.green;

  const statusLine =
    status === 'success' ? { label: 'Verified · launching session', color: c.green } :
    status === 'locked' ? { label: `Locked · retry in ${lockSeconds}s`, color: c.amber } :
    status === 'checking' ? { label: 'Verifying access code', color: c.teal } :
    { label: 'Awaiting verification', color: c.muted };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(6,7,10,0.88)', backdropFilter: 'blur(6px)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && status !== 'checking' && status !== 'success') onClose();
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');

        @keyframes acg-pop-in { 0% { opacity: 0; transform: scale(0.96) translateY(8px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes acg-shake { 10%,90% { transform: translateX(-1px); } 20%,80% { transform: translateX(2px); } 30%,50%,70% { transform: translateX(-4px); } 40%,60% { transform: translateX(4px); } }
        @keyframes acg-scan { 0% { transform: translateY(-100%); opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { transform: translateY(520%); opacity: 0; } }
        @keyframes acg-pulse-dot { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

        .acg-shell { animation: acg-pop-in 0.3s cubic-bezier(0.16,1,0.3,1); font-family: 'Inter', sans-serif; }
        .acg-shake { animation: acg-shake 0.42s cubic-bezier(.36,.07,.19,.97); }
        .acg-mono { font-family: 'JetBrains Mono', monospace; }

        .acg-digit { transition: border-color 0.15s ease, box-shadow 0.15s ease; caret-color: #17C97E; }
        .acg-digit:focus { outline: none; border-color: #17C97E !important; box-shadow: 0 0 0 3px rgba(23,201,126,0.15); }
        .acg-digit:disabled { cursor: not-allowed; }

        .acg-btn { transition: filter 0.15s ease, transform 0.08s ease, box-shadow 0.15s ease; }
        .acg-btn:not(:disabled):hover { filter: brightness(1.08); }
        .acg-btn:not(:disabled):active { transform: scale(0.985); }
        .acg-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(23,201,126,0.25); }

        .acg-close:hover { background: rgba(255,255,255,0.06); }
        .acg-link { transition: color 0.15s ease; }
        .acg-link:hover { color: #17C97E; }
      `}</style>

      <div
        className={`acg-shell relative w-full ${codeLength > 10 ? 'max-w-[520px]' : codeLength > 8 ? 'max-w-[460px]' : codeLength > 6 ? 'max-w-[430px]' : 'max-w-[404px]'} rounded-2xl overflow-hidden ${status === 'error' ? 'acg-shake' : ''}`}
        style={{
          background: `linear-gradient(180deg, ${c.panelTop} 0%, ${c.panel} 40%)`,
          border: `1px solid ${c.border}`,
          boxShadow: `0 1px 0 rgba(255,255,255,0.02) inset, 0 30px 70px -12px rgba(0,0,0,0.65)`,
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Exam access code required"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${stateColor}, transparent)`, transition: 'background 0.3s ease' }} />

        {status === 'checking' && (
          <div className="absolute left-0 right-0 h-20 pointer-events-none" style={{ top: 0, background: `linear-gradient(180deg, transparent, ${c.green}1F, ${c.green}3D, ${c.green}1F, transparent)`, animation: 'acg-scan 1.5s linear infinite' }} />
        )}

        {/* brand strip, matches sidebar wordmark style */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: `1px solid ${c.borderSoft}` }}>
          <KryptaviaLogo size="sm" />
          <button onClick={onClose} disabled={status === 'checking' || status === 'success'} className="acg-close p-1.5 rounded-lg" style={{ color: c.mutedDim, opacity: status === 'checking' || status === 'success' ? 0.25 : 1 }} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* status pill row */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: c.void, border: `1px solid ${c.borderSoft}` }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusLine.color, animation: status === 'idle' ? 'acg-pulse-dot 1.8s ease-in-out infinite' : 'none' }} />
            <span className="text-[9.5px] tracking-[0.14em] uppercase shrink-0" style={{ color: c.mutedDim, fontWeight: 600 }}>Access control</span>
            <span className="acg-mono text-[11px] font-semibold ml-auto truncate" style={{ color: statusLine.color }}>{statusLine.label}</span>
          </div>
        </div>

        <div className="px-6 pt-5 pb-6 relative z-10">
          <div className="inline-flex items-center px-2 py-0.5 rounded-md mb-4" style={{ background: `${c.amber}20`, border: `1px solid ${c.amber}45` }}>
            <span className="text-[10px] tracking-[0.1em] uppercase font-bold" style={{ color: c.amber }}>Restricted</span>
          </div>

          <div className="flex items-start gap-3.5 mb-1">
            <div className="shrink-0 w-11 h-11 rounded-[12px] flex items-center justify-center" style={{ background: status === 'locked' ? `${c.amber}18` : `${c.green}16`, border: `1px solid ${stateColor}40` }}>
              {status === 'success' ? <ShieldCheck size={20} color={c.green} /> : status === 'locked' ? <ShieldAlert size={20} color={c.amber} /> : <Lock size={19} color={c.green} />}
            </div>
            <div className="pt-0.5 flex-1 min-w-0">
              <h2 className="text-[18px] font-bold leading-tight" style={{ color: c.text }}>
                {status === 'success' ? 'Access granted' : status === 'locked' ? 'Too many attempts' : 'Enter access code'}
              </h2>
              <p className="text-[12.5px] mt-1 truncate" style={{ color: c.muted }}>{examTitle}</p>
            </div>
          </div>

          <p className="text-[10px] tracking-wide uppercase mb-5 truncate" style={{ color: c.mutedDim, fontWeight: 600 }}>{orgLabel}</p>

          {status !== 'success' && (
            <>
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-3 flex-wrap" onPaste={handlePaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    value={d}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    disabled={status === 'checking' || status === 'locked'}
                    inputMode="text"
                    autoComplete="off"
                    maxLength={1}
                    aria-label={`Access code digit ${i + 1} of ${codeLength}`}
                    className="acg-digit acg-mono text-center rounded-[10px] shrink-0"
                    style={{
                      width: codeLength > 10 ? 28 : codeLength > 8 ? 33 : codeLength > 6 ? 37 : 42,
                      height: 52,
                      fontSize: codeLength > 10 ? 14 : codeLength > 8 ? 16 : codeLength > 6 ? 17 : 19,
                      fontWeight: 700,
                      color: status === 'error' ? c.error : c.text,
                      background: c.void,
                      border: `1.5px solid ${d ? c.greenDim : c.border}`,
                      opacity: status === 'locked' ? 0.35 : 1,
                    }}
                  />
                ))}
              </div>

              <div className="flex items-center justify-center gap-1.5 h-4 mb-5">
                {status === 'error' ? (
                  <p className="text-[12px]" style={{ color: c.error }}>Incorrect code — {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} left</p>
                ) : (
                  <p className="acg-mono text-[11px] tracking-wider" style={{ color: c.teal }}>REF · {refCode}</p>
                )}
              </div>

              <button
                onClick={handleSubmit}
                disabled={!isComplete || status === 'checking' || status === 'locked'}
                className="acg-btn w-full h-[46px] rounded-lg flex items-center justify-center gap-2 text-[13.5px] font-bold"
                style={{
                  background: isComplete && status !== 'checking' && status !== 'locked' ? c.green : 'transparent',
                  color: isComplete && status !== 'checking' && status !== 'locked' ? c.greenText : c.mutedDim,
                  border: `1.5px solid ${isComplete && status !== 'locked' ? c.green : c.border}`,
                  cursor: !isComplete || status === 'checking' || status === 'locked' ? 'not-allowed' : 'pointer',
                  opacity: status === 'locked' ? 0.5 : 1,
                }}
              >
                {status === 'checking' ? (<><Loader2 size={16} className="animate-spin" />Verifying</>) : status === 'locked' ? (`Locked · ${lockSeconds}s`) : (<><KeyRound size={15} />Authorize</>)}
              </button>

              <div className="flex items-center justify-center gap-1.5 mt-4">
                <ShieldQuestion size={12} color={c.mutedDim} />
                <span className="acg-link text-[11.5px] cursor-pointer" style={{ color: c.mutedDim }}>{supportHint}</span>
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-3 flex items-center justify-center gap-1.5" style={{ borderTop: `1px solid ${c.borderSoft}`, background: 'rgba(0,0,0,0.2)' }}>
          <Lock size={10} color={c.mutedDim} />
          <span className="text-[10px] tracking-wide uppercase" style={{ color: c.mutedDim, fontWeight: 600 }}>Verified server-side · Session encrypted</span>
        </div>
      </div>
    </div>
  );
}

export default AccessCodeGate;
