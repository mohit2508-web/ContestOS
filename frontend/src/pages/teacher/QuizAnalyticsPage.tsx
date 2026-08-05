import React, { useEffect, useState } from 'react';
import api from '../../services/api';

interface QuestionStat {
  questionId: string;
  content: string;
  questionType: string;
  category: string;
  totalResponses: number;
  correctResponses: number;
  accuracyPct: number;
  avgTimeSec: number;
  discriminationIndex: number;
}

export const QuizAnalyticsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ totalCandidatesCount: number; questionsCount: number; questions: QuestionStat[] }>({
    totalCandidatesCount: 24,
    questionsCount: 3,
    questions: [
      {
        questionId: 'q-1',
        content: 'Categorical syllogism abstract sets Bloops, Razzies, Lazzies...',
        questionType: 'SINGLE_SELECT',
        category: 'Logical Deduction',
        totalResponses: 24,
        correctResponses: 18,
        accuracyPct: 75,
        avgTimeSec: 42,
        discriminationIndex: 0.72,
      },
      {
        questionId: 'q-2',
        content: 'Select ALL prime numbers (17, 29, 35, 41)...',
        questionType: 'MULTI_SELECT',
        category: 'Quantitative Aptitude',
        totalResponses: 24,
        correctResponses: 12,
        accuracyPct: 50,
        avgTimeSec: 58,
        discriminationIndex: 0.81,
      },
      {
        questionId: 'q-3',
        content: 'Solve for x: 3x + 15 = 45...',
        questionType: 'NUMERIC',
        category: 'Algebra',
        totalResponses: 24,
        correctResponses: 22,
        accuracyPct: 92,
        avgTimeSec: 25,
        discriminationIndex: 0.35,
      },
    ],
  });

  useEffect(() => {
    // Fetch live analytics from backend API
    api.get('/quiz/sections/demo-section/analytics')
      .then((data) => {
        if (data.questions && data.questions.length > 0) {
          setStats(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#334155] pb-5">
        <div>
          <span className="text-xs uppercase font-extrabold text-cyan-400 tracking-wider">Recruiter Analytics</span>
          <h1 className="text-2xl font-black text-white mt-1">Quiz Cohort Item Discrimination & Heatmap</h1>
        </div>
        <div className="flex items-center space-x-3">
          <div className="bg-[#1e293b] border border-[#334155] px-4 py-2 rounded-xl text-center">
            <span className="text-xs text-slate-400 uppercase font-bold block">Total Candidates</span>
            <span className="text-lg font-black text-cyan-400">{stats.totalCandidatesCount}</span>
          </div>
          <div className="bg-[#1e293b] border border-[#334155] px-4 py-2 rounded-xl text-center">
            <span className="text-xs text-slate-400 uppercase font-bold block">Questions</span>
            <span className="text-lg font-black text-emerald-400">{stats.questionsCount}</span>
          </div>
        </div>
      </div>

      {/* Question Performance Heatmap Table */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-base font-bold text-white flex items-center space-x-2">
          <span>📊</span>
          <span>Question Performance & Discrimination Index</span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#0f172a] text-slate-400 uppercase tracking-wider border-b border-[#334155]">
                <th className="p-3">#</th>
                <th className="p-3">Question Content</th>
                <th className="p-3">Category</th>
                <th className="p-3">Type</th>
                <th className="p-3">Accuracy %</th>
                <th className="p-3">Avg Time</th>
                <th className="p-3">Discrimination Index (r)</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]">
              {stats.questions.map((q, idx) => (
                <tr key={q.questionId} className="hover:bg-slate-800/50 transition-colors">
                  <td className="p-3 font-mono font-bold text-cyan-400">{idx + 1}</td>
                  <td className="p-3 font-medium text-slate-200">{q.content}</td>
                  <td className="p-3 text-slate-400">{q.category}</td>
                  <td className="p-3 font-mono uppercase text-[10px] text-slate-400">{q.questionType}</td>
                  <td className="p-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-[#0f172a] h-2 rounded-full overflow-hidden border border-[#334155]">
                        <div
                          className={`h-full ${q.accuracyPct > 70 ? 'bg-emerald-400' : q.accuracyPct > 40 ? 'bg-amber-400' : 'bg-rose-500'}`}
                          style={{ width: `${q.accuracyPct}%` }}
                        />
                      </div>
                      <span className="font-bold text-slate-200">{q.accuracyPct}%</span>
                    </div>
                  </td>
                  <td className="p-3 font-mono text-slate-300">{q.avgTimeSec}s</td>
                  <td className="p-3 font-mono font-bold text-cyan-400">+{q.discriminationIndex.toFixed(2)}</td>
                  <td className="p-3">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${
                      q.discriminationIndex > 0.6
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {q.discriminationIndex > 0.6 ? 'High Quality' : 'Needs Review'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
