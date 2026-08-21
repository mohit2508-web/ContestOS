import React, { useState, useRef } from 'react';
import { Lock, Unlock, Key, X, Sparkles, CheckCircle2, ShieldAlert } from 'lucide-react';
import { CompanyVaultItem } from './CompanyVaultCard';

interface SecretPasscodeModalProps {
  vault: CompanyVaultItem;
  isOpen: boolean;
  onClose: () => void;
  onUnlockSuccess: (slug: string) => void;
  onVerifyCode: (vaultId: string, code: string) => Promise<boolean>;
}

export const SecretPasscodeModal: React.FC<SecretPasscodeModalProps> = ({
  vault,
  isOpen,
  onClose,
  onUnlockSuccess,
  onVerifyCode,
}) => {
  const [passcode, setPasscode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [unlockedSuccess, setUnlockedSuccess] = useState(false);
  const [shake, setShake] = useState(false);

  const color = vault.brandColor || '#FF9900';

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setErrorMsg('Please enter the secret access code');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const success = await onVerifyCode(vault.id, passcode);
      if (success) {
        setUnlockedSuccess(true);
        setTimeout(() => {
          onUnlockSuccess(vault.slug);
        }, 1200);
      } else {
        setShake(true);
        setErrorMsg('Invalid Secret Access Code. Please ask your instructor/placement coordinator for the correct code.');
        setTimeout(() => setShake(false), 600);
      }
    } catch (err: any) {
      setShake(true);
      setErrorMsg(err.response?.data?.error || 'Invalid Secret Code.');
      setTimeout(() => setShake(false), 600);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div
        className={`relative w-full max-w-md p-6 rounded-3xl backdrop-blur-2xl bg-slate-900/90 border border-slate-800 shadow-2xl overflow-hidden transition-transform duration-300 ${
          shake ? 'animate-bounce' : ''
        }`}
        style={{
          boxShadow: unlockedSuccess
            ? '0 0 50px rgba(16,185,129,0.4)'
            : `0 20px 50px -10px ${color}30`,
        }}
      >
        {/* Ambient Top Glow */}
        <div
          className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ backgroundColor: unlockedSuccess ? '#10b981' : color }}
        />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/50 hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {unlockedSuccess ? (
          <div className="py-8 text-center animate-fadeIn">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.3)] animate-pulse">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-white tracking-tight mb-2">
              Vault Unlocked! 🎉
            </h3>
            <p className="text-sm text-emerald-400 font-medium">
              Access granted to {vault.companyName} Exclusive Placement Materials.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
              <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" /> Entering Company Vault...
            </div>
          </div>
        ) : (
          <div>
            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center p-2 bg-slate-800 border"
                style={{ borderColor: `${color}40` }}
              >
                {vault.logoUrl ? (
                  <img src={vault.logoUrl} alt={vault.companyName} className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xl font-bold text-white">{vault.companyName.charAt(0)}</span>
                )}
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-400" /> Protected Placement Vault
                </div>
                <h3 className="text-xl font-bold text-white">{vault.companyName} Access Gate</h3>
              </div>
            </div>

            {/* Instruction Callout */}
            <div className="p-3.5 mb-6 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300 flex items-start gap-2.5">
              <Key className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                Enter the secret passcode provided by your training coordinator to unlock {vault.companyName} curated sheets, mock tests, and interview transcripts.
              </span>
            </div>

            {/* Passcode Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Secret Access Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value.toUpperCase())}
                    placeholder="e.g. AMZ2026"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-lg font-mono font-bold tracking-widest text-center text-cyan-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                    maxLength={16}
                    autoFocus
                  />
                  <div className="absolute right-3 top-3.5 text-slate-500">
                    <Lock className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 flex items-start gap-2 animate-fadeIn">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !passcode.trim()}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-slate-950 transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: color,
                  boxShadow: `0 8px 25px -5px ${color}60`,
                }}
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span>Unlock Vault Access</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
