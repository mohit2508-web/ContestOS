import { motion, useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';

const MOCK_REPORT = {
  candidate: 'Priya Sharma',
  role: 'Senior Frontend Engineer',
  overallScore: 87,
  integrityScore: 98,
  timeTaken: '23:45',
  problemsSolved: 4,
  totalProblems: 5,
  metrics: [
    { label: 'Tab Switches', value: '0', status: 'clean', icon: '🖥️' },
    { label: 'Paste Events', value: '2', status: 'low', icon: '📋' },
    { label: 'Keystroke Anomaly', value: 'None', status: 'clean', icon: '⌨️' },
    { label: 'Plagiarism', value: '0%', status: 'clean', icon: '🔍' },
    { label: 'Face Match', value: '99.2%', status: 'clean', icon: '📷' },
    { label: 'IP Consistent', value: 'Yes', status: 'clean', icon: '🔐' },
  ],
  verdict: 'PASS',
};

function ScoreRing({ score, color, size = 80 }: { score: number; color: string; size?: number }) {
  const circumference = Math.PI * (size - 8);
  const offset = circumference * (1 - score / 100);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle cx={size / 2} cy={size / 2} r={(size - 8) / 2} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
        <circle cx={size / 2} cy={size / 2} r={(size - 8) / 2} fill="none" stroke={color} strokeWidth="4" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-black" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

export default function SampleReport() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (isInView) setTimeout(() => setRevealed(true), 400);
  }, [isInView]);

  return (
    <section ref={ref} className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-6xl font-black mb-4">
            This is what you <span className="text-blue-400">receive</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Not a score. A full evaluation report with integrity proof.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="max-w-4xl mx-auto backdrop-blur-xl bg-white/[0.03] rounded-3xl border border-white/10 overflow-hidden"
        >
          {/* Header */}
          <div className="px-8 py-5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg">PS</div>
              <div>
                <h3 className="font-bold text-white text-lg">{MOCK_REPORT.candidate}</h3>
                <p className="text-xs text-gray-500">{MOCK_REPORT.role}</p>
              </div>
            </div>
            <div className={`px-4 py-2 rounded-full text-sm font-bold ${
              MOCK_REPORT.verdict === 'PASS' ? 'bg-green-500/15 text-green-400 border border-green-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/20'
            }`}>
              {MOCK_REPORT.verdict}
            </div>
          </div>

          <div className="p-8">
            {/* Scores */}
            <div className="flex items-center gap-12 mb-8 justify-center">
              <div className="text-center">
                <ScoreRing score={MOCK_REPORT.overallScore} color="#3B82F6" />
                <p className="text-xs text-gray-500 mt-2">Code Score</p>
              </div>
              <div className="text-center">
                <ScoreRing score={MOCK_REPORT.integrityScore} color="#10B981" />
                <p className="text-xs text-gray-500 mt-2">Integrity</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-white mb-1">{MOCK_REPORT.timeTaken}</div>
                <p className="text-xs text-gray-500">Time Taken</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-white mb-1">{MOCK_REPORT.problemsSolved}/{MOCK_REPORT.totalProblems}</div>
                <p className="text-xs text-gray-500">Solved</p>
              </div>
            </div>

            {/* Integrity Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {MOCK_REPORT.metrics.map((m, i) => (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={revealed ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                >
                  <span className="text-lg">{m.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">{m.label}</div>
                    <div className="text-sm font-bold text-white">{m.value}</div>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${m.status === 'clean' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                </motion.div>
              ))}
            </div>
          </div>

          <div className="px-8 py-4 border-t border-white/10 bg-white/[0.01] flex items-center justify-between">
            <span className="text-xs text-gray-500 font-mono">Report ID: #RPT-2026-48721</span>
            <span className="text-xs text-gray-500 font-mono">Generated: 2026-07-28 14:32 UTC</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
