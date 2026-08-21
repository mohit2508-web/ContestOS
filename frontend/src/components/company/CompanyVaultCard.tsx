import React from 'react';
import { Lock, Unlock, Briefcase, FileText, ChevronRight, Award, Sparkles } from 'lucide-react';

export interface CompanyVaultItem {
  id: string;
  name: string;
  slug: string;
  companyName: string;
  brandColor: string;
  logoUrl?: string;
  targetCtc?: string;
  examPattern?: string;
  description?: string;
  isLocked: boolean;
  isUnlocked: boolean;
  materialsCount: number;
  transcriptsCount: number;
  accessCodePlain?: string;
}

interface CompanyVaultCardProps {
  vault: CompanyVaultItem;
  onSelect: (vault: CompanyVaultItem) => void;
}

export const CompanyVaultCard: React.FC<CompanyVaultCardProps> = ({ vault, onSelect }) => {
  const color = vault.brandColor || '#FF9900';

  return (
    <div
      onClick={() => onSelect(vault)}
      className="group relative rounded-3xl p-6 backdrop-blur-2xl transition-all duration-300 transform hover:-translate-y-2 cursor-pointer overflow-hidden flex flex-col justify-between"
      style={{
        background: `linear-gradient(145deg, rgba(15, 23, 42, 0.96) 0%, rgba(30, 41, 59, 0.85) 60%, ${color}15 100%)`,
        border: `1.5px solid ${color}45`,
        boxShadow: `0 10px 30px -10px ${color}25`,
      }}
    >
      {/* Top Accent Gradient Border Glow Line */}
      <div
        className="absolute top-0 left-0 right-0 h-1 transition-all duration-500 group-hover:h-1.5"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${color} 50%, transparent 100%)`,
        }}
      />

      {/* Ambient Brand Neon Aura */}
      <div
        className="absolute -top-16 -right-16 w-44 h-44 rounded-full blur-3xl opacity-25 group-hover:opacity-60 transition-opacity duration-500 pointer-events-none"
        style={{ backgroundColor: color }}
      />

      <div>
        {/* Top Header Row */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3.5">
            {/* Logo Badge Container with Glowing Halo */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center p-2.5 bg-slate-950/90 border shadow-xl group-hover:scale-105 transition-transform shrink-0"
              style={{
                borderColor: `${color}60`,
                boxShadow: `0 0 20px ${color}30`,
              }}
            >
              {vault.companyName.toLowerCase().includes('capgemini') ? (
                <svg viewBox="0 0 300 300" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M150 18C198 62 282 118 282 178C282 228 238 272 176 272C146 272 122 258 108 242C92 264 64 282 32 282C20 282 8 276 2 270C42 264 72 232 82 198C32 198 18 154 18 120C18 78 88 34 150 18Z"
                    fill="#0070AD"
                  />
                  <path
                    d="M176 272C238 272 282 228 282 178C282 144 252 110 208 86C214 132 202 180 162 210C142 224 120 234 102 240C116 258 142 272 176 272Z"
                    fill="#0091FF"
                  />
                </svg>
              ) : vault.logoUrl ? (
                <img
                  src={vault.logoUrl}
                  alt={vault.companyName}
                  className="max-h-full max-w-full object-contain filter drop-shadow"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : null}
              <span
                className="text-2xl font-black text-white"
                style={{
                  display: vault.logoUrl ? 'none' : 'block',
                  color: color,
                }}
              >
                {vault.companyName.charAt(0)}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span
                  className="text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border"
                  style={{
                    backgroundColor: `${color}20`,
                    color: color,
                    borderColor: `${color}40`,
                  }}
                >
                  {vault.companyName}
                </span>
              </div>
              <h3 className="text-base font-extrabold text-white group-hover:text-cyan-300 transition-colors leading-snug line-clamp-1">
                {vault.name}
              </h3>
            </div>
          </div>

          {/* Status Badge */}
          <div className="shrink-0">
            {vault.isUnlocked ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                <Unlock className="w-3 h-3" /> <span>UNLOCKED</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                <Lock className="w-3 h-3" /> <span>LOCKED</span>
              </span>
            )}
          </div>
        </div>

        {/* Target CTC Pill & Exam Pattern Badge */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {vault.targetCtc && (
            <span
              className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-black border shadow-md"
              style={{
                backgroundColor: `${color}25`,
                color: '#ffffff',
                borderColor: `${color}60`,
                boxShadow: `0 0 15px ${color}20`,
              }}
            >
              <Briefcase className="w-3.5 h-3.5" style={{ color }} /> CTC: {vault.targetCtc}
            </span>
          )}
          {vault.examPattern && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-950/80 text-slate-300 border border-slate-700/80 truncate max-w-[210px]">
              <Award className="w-3.5 h-3.5 text-cyan-400" /> {vault.examPattern}
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-xs text-slate-300/90 line-clamp-2 mb-5 leading-relaxed font-normal">
          {vault.description || `Complete placement preparation sheet and secret test bank for ${vault.companyName}.`}
        </p>
      </div>

      {/* Footer Stat Row */}
      <div className="pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3 font-medium">
          <span className="flex items-center gap-1 text-slate-300">
            <FileText className="w-3.5 h-3.5 text-cyan-400" /> {vault.materialsCount || 3} Materials
          </span>
          <span className="flex items-center gap-1 text-slate-300">
            <Award className="w-3.5 h-3.5 text-purple-400" /> {vault.transcriptsCount || 1} Transcripts
          </span>
        </div>

        <button
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all shadow-md group-hover:scale-105"
          style={{
            backgroundColor: `${color}25`,
            color: color,
            border: `1px solid ${color}50`,
          }}
        >
          {vault.isUnlocked ? 'Open Vault' : 'Enter Code'} <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
};
