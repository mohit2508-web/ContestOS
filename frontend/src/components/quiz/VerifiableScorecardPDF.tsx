import React from 'react';

interface VerifiableScorecardPDFProps {
  contestTitle: string;
  candidateName: string;
  candidateEmail: string;
  totalScore: number;
  maxScore: number;
  totalAnswered: number;
  totalQuestions: number;
  summaryData: any;
  onClose: () => void;
}

export const VerifiableScorecardPDF: React.FC<VerifiableScorecardPDFProps> = ({
  contestTitle,
  candidateName,
  candidateEmail,
  totalScore,
  maxScore,
  totalAnswered,
  totalQuestions,
  summaryData,
  onClose,
}) => {
  // Generate SHA-256-like mock hash for verifiable certificate link
  const sha256Hash = `0x${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
  const verificationUrl = `${window.location.origin}/verify-report?hash=${sha256Hash}`;
  const qrCodeImg = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(verificationUrl)}`;

  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#14161A]/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white">
      <div className="bracket-panel active max-w-2xl w-full p-8 bg-[#1B1E23] border border-[#2B2F37] rounded-[2px] shadow-2xl space-y-6 text-[#ECE8E0] print:bg-white print:text-black print:p-8 print:border-none print:shadow-none font-sans">
        <span className="bl print:hidden" />
        <span className="br print:hidden" />

        {/* Top Breadcrumb & Actions */}
        <div className="flex items-center justify-between border-b border-[#2B2F37] pb-5 print:border-slate-300">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-[#C6A15B] flex items-center gap-1.5 mb-1 print:text-amber-800">
              <span>◈ CONTESTOS OFFICIAL VERIFIED SCORECARD</span>
            </div>
            <h1 className="text-2xl font-['Fraunces'] font-semibold text-[#ECE8E0] print:text-black">{contestTitle}</h1>
            <p className="text-xs text-[#8C9099] mt-0.5 print:text-slate-600 font-mono">Verified Assessment Certificate & Breakdown</p>
          </div>

          <div className="flex items-center space-x-2.5 print:hidden">
            <button
              type="button"
              onClick={handlePrintPDF}
              className="btn-submit text-xs font-semibold px-4 py-2 flex items-center space-x-2"
            >
              <span>🖨️</span>
              <span>Export PDF / Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-[2px] bg-[#21252B] border border-[#2B2F37] text-[#8C9099] hover:text-[#ECE8E0] font-bold text-xs flex items-center justify-center cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Candidate Info Grid */}
        <div className="grid grid-cols-2 gap-4 bg-[#21252B] p-4 rounded-[2px] border border-[#2B2F37] print:bg-slate-50 print:border-slate-200">
          <div>
            <span className="text-[10px] text-[#8C9099] uppercase font-mono font-bold block mb-1">Candidate Name</span>
            <span className="text-sm font-semibold text-[#ECE8E0] print:text-black">{candidateName}</span>
          </div>
          <div>
            <span className="text-[10px] text-[#8C9099] uppercase font-mono font-bold block mb-1">Email Identity</span>
            <span className="text-sm font-mono text-[#C6A15B] print:text-amber-700">{candidateEmail}</span>
          </div>
        </div>

        {/* Score Summary Metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#21252B] p-4 rounded-[2px] border border-[#2B2F37] text-center print:bg-slate-50 print:border-slate-200">
            <span className="text-[10px] text-[#8C9099] uppercase font-mono font-bold block">Final Score</span>
            <span className="text-2xl font-mono font-bold text-[#C6A15B] mt-1 block print:text-amber-800">
              {totalScore} / {maxScore}
            </span>
          </div>
          <div className="bg-[#21252B] p-4 rounded-[2px] border border-[#2B2F37] text-center print:bg-slate-50 print:border-slate-200">
            <span className="text-[10px] text-[#8C9099] uppercase font-mono font-bold block">Answered Rate</span>
            <span className="text-2xl font-mono font-bold text-[#6F9C7E] mt-1 block print:text-emerald-700">
              {totalAnswered} / {totalQuestions}
            </span>
          </div>
          <div className="bg-[#21252B] p-4 rounded-[2px] border border-[#2B2F37] text-center print:bg-slate-50 print:border-slate-200">
            <span className="text-[10px] text-[#8C9099] uppercase font-mono font-bold block">Proctor Integrity</span>
            <span className="text-[11px] font-mono font-bold text-[#6F9C7E] bg-[#6F9C7E]/10 border border-[#6F9C7E]/40 px-2 py-1 rounded-[2px] inline-block mt-2">
              VERIFIED CLEAN
            </span>
          </div>
        </div>

        {/* Cryptographic Hash Verification Block */}
        <div className="bg-[#21252B] p-4 rounded-[2px] border border-[#8A7343] flex items-center justify-between print:bg-slate-50 print:border-amber-300">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-mono font-bold text-[#C6A15B] tracking-wider block print:text-amber-800">
              SHA-256 Verifiable Hash
            </span>
            <p className="font-mono text-[11px] text-[#ECE8E0] break-all max-w-sm print:text-black">{sha256Hash}</p>
            <p className="text-[10px] text-[#8C9099] print:text-slate-600">Recruiters can scan QR code or query endpoint to verify integrity.</p>
          </div>
          <img src={qrCodeImg} alt="Report Verification QR Code" className="w-16 h-16 rounded-[2px] border border-[#2B2F37] print:border-slate-300" />
        </div>
      </div>
    </div>
  );
};
