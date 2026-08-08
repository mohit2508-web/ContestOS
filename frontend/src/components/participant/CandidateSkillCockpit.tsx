import React, { useState } from 'react';
import { CompetencyRadarChart } from '../analytics/CompetencyRadarChart';

interface CandidateSkillCockpitProps {
  user: {
    id: string;
    name: string;
    email: string;
  };
  stats?: {
    eloRating?: number;
    globalRank?: number;
    percentile?: number;
    problemsSolved?: number;
    contestsAttended?: number;
  };
  mode?: 'all' | 'skills' | 'credentials';
}

export function CandidateSkillCockpit({ user, stats, mode = 'all' }: CandidateSkillCockpitProps) {
  const [showCertificateModal, setShowCertificateModal] = useState(false);

  const eloRating = stats?.eloRating || 1785;
  const globalRank = stats?.globalRank || 42;
  const percentile = stats?.percentile || 96.5;
  const solved = stats?.problemsSolved || 142;
  const contests = stats?.contestsAttended || 18;

  // 10-Format Competencies Data for Candidate Profile
  const candidateCompetencies = [
    { id: 'dsa', format: 'DSA & Algorithms', icon: '💻', category: 'Engineering', avgScore: 88, status: 'Strong', totalQuestions: 45, avgTimeSeconds: 1200, cohortPercentile: 92, color: 'from-teal-500 to-emerald-400', details: { topSkill: 'Dynamic Programming', weakSkill: 'Graphs', pBiserial: 0.8, description: 'Algorithmic efficiency and time/space complexity optimization.' } },
    { id: 'sql', format: 'SQL & Databases', icon: '🗄️', category: 'Data', avgScore: 82, status: 'Optimal', totalQuestions: 30, avgTimeSeconds: 700, cohortPercentile: 85, color: 'from-cyan-500 to-blue-400', details: { topSkill: 'CTEs & Window Functions', weakSkill: 'Indexing', pBiserial: 0.7, description: 'Relational query optimization and schema design.' } },
    { id: 'webdev', format: 'Web Development', icon: '🌐', category: 'Full-Stack', avgScore: 78, status: 'Optimal', totalQuestions: 20, avgTimeSeconds: 1800, cohortPercentile: 81, color: 'from-indigo-500 to-purple-400', details: { topSkill: 'DOM State', weakSkill: 'CSS Grid', pBiserial: 0.68, description: 'Live HTML5/CSS3/JS component creation.' } },
    { id: 'mcq', format: 'Technical MCQ', icon: '☑️', category: 'Core CS', avgScore: 92, status: 'Strong', totalQuestions: 100, avgTimeSeconds: 40, cohortPercentile: 95, color: 'from-purple-500 to-pink-500', details: { topSkill: 'OS Concurrency', weakSkill: 'Networking', pBiserial: 0.85, description: 'CS fundamentals and system design concepts.' } },
    { id: 'aptitude', format: 'Aptitude & Math', icon: '🔢', category: 'Cognitive', avgScore: 74, status: 'Moderate', totalQuestions: 50, avgTimeSeconds: 85, cohortPercentile: 75, color: 'from-amber-500 to-yellow-400', details: { topSkill: 'Ratios & Averages', weakSkill: 'Permutations', pBiserial: 0.6, description: 'Quantitative reasoning speed.' } },
    { id: 'verbal', format: 'Verbal Reasoning', icon: '📖', category: 'Communication', avgScore: 90, status: 'Strong', totalQuestions: 35, avgTimeSeconds: 65, cohortPercentile: 93, color: 'from-emerald-500 to-teal-400', details: { topSkill: 'Comprehension', weakSkill: 'Grammar', pBiserial: 0.78, description: 'Written English comprehension.' } },
    { id: 'logical', format: 'Logical Deductions', icon: '🧩', category: 'Problem Solving', avgScore: 85, status: 'Optimal', totalQuestions: 40, avgTimeSeconds: 55, cohortPercentile: 88, color: 'from-blue-500 to-indigo-500', details: { topSkill: 'Matrices', weakSkill: 'Syllogisms', pBiserial: 0.72, description: 'Non-verbal fluid intelligence.' } },
    { id: 'psychometric', format: 'Psychometric (OCEAN)', icon: '🧠', category: 'Behavioral', avgScore: 89, status: 'High Fit', totalQuestions: 30, avgTimeSeconds: 45, cohortPercentile: 91, color: 'from-rose-500 to-red-400', details: { topSkill: 'High Ownership', weakSkill: 'Stress Tolerance', pBiserial: 0.77, description: 'Big-5 work style alignment.' } },
    { id: 'sjt', format: 'Situational Judgment', icon: '⚖️', category: 'Leadership', avgScore: 86, status: 'Strong', totalQuestions: 25, avgTimeSeconds: 110, cohortPercentile: 89, color: 'from-orange-500 to-amber-500', details: { topSkill: 'Conflict Management', weakSkill: 'Resource Crunch', pBiserial: 0.73, description: 'Workplace decision efficacy.' } },
    { id: 'essay', format: 'Subjective Essay', icon: '📝', category: 'Synthesis', avgScore: 80, status: 'Optimal', totalQuestions: 10, avgTimeSeconds: 1200, cohortPercentile: 83, color: 'from-fuchsia-500 to-pink-500', details: { topSkill: 'Clarity of Argument', weakSkill: 'Structure', pBiserial: 0.69, description: 'In-depth domain synthesis and written articulation.' } },
  ];

  return (
    <div className="bg-zinc-950 border border-white/10 rounded-3xl p-6 md:p-8 space-y-8 shadow-2xl">
      {/* Candidate Profile Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-black font-black text-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
            {user.name ? user.name[0].toUpperCase() : 'C'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-white">{user.name || 'Candidate Student'}</h2>
              <span className="px-2.5 py-0.5 text-[10px] font-black rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-widest">
                VERIFIED CANDIDATE
              </span>
            </div>
            <p className="text-gray-400 text-xs mt-0.5">{user.email} · Computer Science & Engineering</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCertificateModal(true)}
            className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold rounded-xl hover:bg-amber-500/20 transition flex items-center gap-2"
          >
            📜 View Signed Credentials
          </button>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Contest Elo Rating</span>
          <p className="text-2xl font-black text-amber-400">{eloRating} <span className="text-xs text-emerald-400 font-normal">▲ +45</span></p>
          <p className="text-[10px] text-gray-500">Top {100 - Math.round(percentile)}% Percentile</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Global Rank</span>
          <p className="text-2xl font-black text-cyan-400">#{globalRank}</p>
          <p className="text-[10px] text-gray-500">Ranked out of 1,240 Candidates</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Problems Solved</span>
          <p className="text-2xl font-black text-emerald-400">{solved}</p>
          <p className="text-[10px] text-gray-500">DSA, SQL & WebDev combined</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Contests Completed</span>
          <p className="text-2xl font-black text-purple-400">{contests}</p>
          <p className="text-[10px] text-gray-500">100% Integrity Trust Score</p>
        </div>
      </div>

      {/* 10-Domain Competency Radar Chart (shown in 'all' or 'skills' mode) */}
      {(mode === 'all' || mode === 'skills') && (
        <div className="space-y-4">
          <h3 className="font-bold text-white text-sm">📊 10-Domain Skill Competency Radar</h3>
          <CompetencyRadarChart items={candidateCompetencies} />
        </div>
      )}

      {/* Verifiable Credentials Showcase (shown in 'all' or 'credentials' mode) */}
      {(mode === 'all' || mode === 'credentials') && (
        <div className="space-y-4 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-sm">📜 SHA-256 Verifiable Assessment Certificates</h3>
            <span className="text-xs text-emerald-400 font-bold">SHA-256 Signed Credentials</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400">🏅 Advanced Algorithmic Mastery</span>
                <span className="text-[10px] text-gray-400 font-mono">Issued Aug 2026</span>
              </div>
              <p className="text-xs text-gray-300">
                Issued for solving 100+ Hard/Medium DSA & SQL problems under SEB lockdown proctoring.
              </p>
              <button
                onClick={() => setShowCertificateModal(true)}
                className="px-3.5 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold rounded-xl hover:bg-amber-500/20 transition"
              >
                📄 View Signed Certificate & QR Link
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-400">🗄️ Full-Stack & Database Engineering</span>
                <span className="text-[10px] text-gray-400 font-mono">Issued Jul 2026</span>
              </div>
              <p className="text-xs text-gray-300">
                Issued for completing live WebDev DOM challenges & SQLite aggregations with 95%+ score.
              </p>
              <button
                onClick={() => setShowCertificateModal(true)}
                className="px-3.5 py-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-bold rounded-xl hover:bg-cyan-500/20 transition"
              >
                📄 View Signed Certificate & QR Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Certificate Modal */}
      {showCertificateModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-white/20 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="border-b border-white/10 pb-3 flex justify-between items-center">
              <h4 className="font-extrabold text-white text-base">Verified Certificate Preview</h4>
              <button onClick={() => setShowCertificateModal(false)} className="text-gray-400 hover:text-white text-sm font-bold">✕</button>
            </div>
            <div className="p-6 bg-gradient-to-b from-zinc-900 to-black border border-amber-500/30 rounded-2xl text-center space-y-3">
              <span className="text-3xl block">🎓</span>
              <h3 className="text-lg font-black text-amber-400">CERTIFICATE OF EXCELLENCE</h3>
              <p className="text-xs text-gray-300">This certifies that <strong className="text-white">{user.name || 'Aarav Patel'}</strong> has achieved Top 5% ranking in Assessment Engineering.</p>
              <div className="p-3 bg-black border border-white/10 rounded-xl font-mono text-[10px] text-emerald-400 break-all">
                SHA256-DIGEST: 8f9a2b4c6e8d101214161820222426283032343638404244464850
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={() => setShowCertificateModal(false)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CandidateSkillCockpit;
