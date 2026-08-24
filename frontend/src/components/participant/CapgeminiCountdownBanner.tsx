import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const TARGET_DATE = new Date('2026-08-25T09:00:00+05:30').getTime();

function PreRegisterSuccessModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-gradient-to-b from-zinc-900 via-zinc-950 to-black border border-amber-500/40 p-8 shadow-[0_0_50px_rgba(245,166,35,0.25)] text-white text-center space-y-6">
        
        {/* Background Ambient Glow */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-amber-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/20 via-amber-500/20 to-purple-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-black uppercase tracking-widest shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>🎉 PRE-REGISTRATION SUCCESSFUL!</span>
        </div>

        {/* Hero Check Icon & Title */}
        <div className="space-y-3 relative z-10">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-emerald-500 via-amber-500 to-purple-500 p-0.5 shadow-xl shadow-amber-500/30 flex items-center justify-center">
            <div className="w-full h-full bg-zinc-950 rounded-[22px] flex items-center justify-center text-4xl">
              📩
            </div>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Pre-Registration Confirmed!
          </h2>
          <p className="text-xs text-amber-300 font-mono font-bold">
            Drive Date: Tuesday, 25 August 2026
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-5 text-left space-y-3.5 relative z-10">
          <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-400 uppercase tracking-wider">
            <span>📧 Test Credentials & Access Link Info</span>
          </div>
          
          <p className="text-xs text-gray-300 leading-relaxed">
            Aapki registration note kar li gayi hai! Test abhi map nahi hua hai — <strong className="text-white">Exam Link, Secret Access Code, aur Setup Guide aapko test date se pehle aapke email par bhej diya jayega.</strong>
          </p>

          <div className="p-3 bg-purple-950/40 border border-purple-500/30 rounded-xl space-y-1.5 text-[11px] text-purple-200">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">📅 Test Date:</span>
              <span className="font-bold text-amber-300">25 August 2026 (09:00 AM IST)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">🎯 Challenge Modules:</span>
              <span className="font-bold text-cyan-300">AI Questioning, Debugging, DSA</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">📩 Notification Mode:</span>
              <span className="font-bold text-emerald-300">Registered Email Address</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="w-full py-3.5 px-6 bg-gradient-to-r from-emerald-500 via-amber-500 to-purple-600 hover:from-emerald-400 hover:to-purple-500 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition cursor-pointer"
        >
          Got It, Thanks! 👍
        </button>
      </div>
    </div>
  );
}

export function CapgeminiCountdownBanner({
  onRegister,
}: {
  onRegister?: () => void;
}) {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isExpired, setIsExpired] = useState(false);
  const [showPreRegisterModal, setShowPreRegisterModal] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = TARGET_DATE - Date.now();
      if (difference <= 0) {
        setIsExpired(true);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRegisterClick = () => {
    setShowPreRegisterModal(true);
    if (onRegister) {
      onRegister();
    }
  };

  return (
    <>
      <PreRegisterSuccessModal
        isOpen={showPreRegisterModal}
        onClose={() => setShowPreRegisterModal(false)}
      />

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-950 via-zinc-900 to-black border border-purple-500/30 p-6 md:p-8 shadow-[0_0_50px_rgba(168,85,247,0.15)] text-white">
        {/* Background Ambient Glow Effects */}
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/5 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 space-y-6">
          {/* Top Header Badge */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-500/20 via-indigo-500/20 to-amber-500/20 border border-purple-400/40 text-purple-300 text-xs font-black uppercase tracking-widest shadow-lg">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-ping" />
              <span>🚀 EXCLUSIVE RECRUITMENT ASSESSMENT DRIVE</span>
            </div>

            <div className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full flex items-center gap-1.5">
              <span>📅 Tuesday, 25 August 2026</span>
            </div>
          </div>

          {/* Title & Detailed Description */}
          <div className="space-y-3">
            <h2 className="text-2xl md:text-4xl font-black tracking-tight text-white leading-tight">
              Capgemini Exclusive Mock Test{' '}
              <span className="bg-gradient-to-r from-purple-400 via-amber-400 to-cyan-300 bg-clip-text text-transparent">
                — Powered by Kryptavia OS
              </span>
            </h2>
            <p className="text-xs md:text-sm text-gray-300 max-w-3xl leading-relaxed">
              An industry-aligned recruitment mock assessment engineered to mirror official Capgemini campus hiring evaluations, testing real-world architectural thinking, algorithmic debugging, and coding precision.
            </p>

            {/* Rich Detailed Student Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="bg-zinc-950/80 border border-purple-500/30 p-3.5 rounded-2xl space-y-1">
                <span className="text-[10px] font-black text-purple-400 uppercase tracking-wider block font-mono">Module 1 · Socratic AI</span>
                <p className="font-bold text-white text-xs">🤖 AI-Assisted Questioning</p>
                <p className="text-[11px] text-gray-400 leading-snug">Interactive architectural dialogue & AI-driven design thinking evaluation.</p>
              </div>

              <div className="bg-zinc-950/80 border border-amber-500/30 p-3.5 rounded-2xl space-y-1">
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block font-mono">Module 2 · Code Repair</span>
                <p className="font-bold text-white text-xs">🐞 Algorithmic Debugging</p>
                <p className="text-[11px] text-gray-400 leading-snug">Locate, analyze, and repair hidden bugs and logic flaws in broken codebases.</p>
              </div>

              <div className="bg-zinc-950/80 border border-cyan-500/30 p-3.5 rounded-2xl space-y-1">
                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider block font-mono">Module 3 · DSA Core</span>
                <p className="font-bold text-white text-xs">⚡ Data Structures & Algorithms</p>
                <p className="text-[11px] text-gray-400 leading-snug">Solve core algorithmic problems evaluated across automated testcase suites.</p>
              </div>
            </div>
          </div>

          {/* Challenge Pillars Badges */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {[
              { icon: '🤖', label: 'AI-Assisted Questioning', color: 'from-purple-500/20 to-indigo-500/20 text-purple-300 border-purple-500/30' },
              { icon: '🐞', label: 'Debugging Questions', color: 'from-amber-500/20 to-yellow-500/20 text-amber-300 border-amber-500/30' },
              { icon: '⚡', label: 'Data Structures & Algorithms (DSA)', color: 'from-cyan-500/20 to-blue-500/20 text-cyan-300 border-cyan-500/30' },
            ].map((pillar, idx) => (
              <div
                key={idx}
                className={`px-3.5 py-1.5 rounded-xl bg-gradient-to-r ${pillar.color} border text-xs font-bold flex items-center gap-2 shadow-sm`}
              >
                <span>{pillar.icon}</span>
                <span>{pillar.label}</span>
              </div>
            ))}
          </div>

          {/* Live Countdown & CTA Container */}
          <div className="pt-2 flex flex-col md:flex-row items-center justify-between gap-6 border-t border-white/10">
            
            {/* Countdown Clock Units */}
            <div className="space-y-1 text-center md:text-left w-full md:w-auto">
              <span className="text-[10px] font-black text-purple-300 uppercase tracking-widest block font-mono">
                {isExpired ? 'ASSESSMENT DRIVE IS LIVE' : '⏰ REGISTRATION COUNTDOWN TO 25 AUGUST 2026'}
              </span>

              <div className="flex items-center justify-center md:justify-start gap-2.5">
                {[
                  { label: 'DAYS', value: timeLeft.days },
                  { label: 'HOURS', value: timeLeft.hours },
                  { label: 'MINS', value: timeLeft.minutes },
                  { label: 'SECS', value: timeLeft.seconds },
                ].map((unit, i) => (
                  <React.Fragment key={unit.label}>
                    <div className="flex flex-col items-center bg-zinc-950 border border-purple-500/40 rounded-2xl px-3.5 py-2 min-w-[64px] shadow-lg">
                      <span className="text-xl md:text-2xl font-black font-mono text-white tabular-nums">
                        {String(unit.value).padStart(2, '0')}
                      </span>
                      <span className="text-[9px] font-bold text-gray-400 font-mono tracking-wider">
                        {unit.label}
                      </span>
                    </div>
                    {i < 3 && <span className="text-xl font-bold text-purple-500 animate-pulse">:</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Action CTA & Tagline */}
            <div className="flex flex-col items-center md:items-end gap-2 w-full md:w-auto">
              <span className="text-[11px] font-extrabold italic text-amber-300 font-mono tracking-wider">
                Think. Code. Debug. Solve. Succeed.
              </span>
              <button
                onClick={handleRegisterClick}
                className="w-full md:w-auto px-7 py-3.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white font-black text-sm rounded-2xl shadow-xl shadow-purple-600/30 transition transform hover:scale-105 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>🚀 Register for Capgemini Drive</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
