import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { portalLink } from '../../lib/portal';

const MOCK_LEADERBOARD = [
  { rank: 1, name: 'Arjun_K', college: 'IIT Bombay', score: 9820, medal: '🥇' },
  { rank: 2, name: 'Sneha_R', college: 'BITS Pilani', score: 9654, medal: '🥈' },
  { rank: 3, name: 'Vikram_P', college: 'NIT Trichy', score: 9501, medal: '🥉' },
  { rank: 4, name: 'Priya_M', college: 'IIIT Hyderabad', score: 9387, medal: '' },
  { rank: 5, name: 'Rohan_S', college: 'IIT Delhi', score: 9210, medal: '' },
];

export default function CollegeHero() {
  const [lb, setLb] = useState(MOCK_LEADERBOARD);

  useEffect(() => {
    const id = setInterval(() => {
      setLb(prev =>
        prev.map(e => ({ ...e, score: e.score + Math.floor(Math.random() * 15 - 3) }))
          .sort((a, b) => b.score - a.score)
          .map((e, i) => ({ ...e, rank: i + 1 }))
      );
    }, 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 pt-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-amber-950/15 via-black to-black" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,165,0,0.06),transparent_60%)]" />

      <div className="relative z-10 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left: Copy */}
        <div>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/20 bg-amber-500/5 mb-8">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-mono text-amber-400">Live contests happening now</span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tight leading-[0.95] mb-6"
          >
            Run a contest
            <br />your campus will
            <br />
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
              talk about.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-lg text-gray-400 max-w-lg mb-10 leading-relaxed"
          >
            Auto-graded, real-time leaderboards, certificates, and
            <span className="text-white font-medium"> zero setup effort</span>.
            From creation to results in minutes.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <motion.a
              href={portalLink('/register')}
              whileHover={{ scale: 1.03, boxShadow: '0 0 40px rgba(255,165,0,0.3)' }}
              whileTap={{ scale: 0.97 }}
              className="px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full font-bold text-lg text-black cursor-pointer inline-block"
            >
              Host a Contest
            </motion.a>
            <motion.a
              href={portalLink('/browse')}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="px-8 py-4 border border-white/15 rounded-full font-bold text-lg text-gray-300 hover:text-white hover:bg-white/5 cursor-pointer transition-colors inline-block"
            >
              Join Upcoming Contest
            </motion.a>
          </motion.div>
        </div>

        {/* Right: Live Leaderboard Preview */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="backdrop-blur-xl bg-white/[0.03] rounded-2xl border border-white/10 overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-sm">🏆</div>
              <span className="font-bold text-white text-sm">Live Rankings</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-mono text-green-400">LIVE</span>
            </div>
          </div>
          <div className="divide-y divide-white/5">
            {lb.map((entry) => (
              <div key={entry.name} className="flex items-center gap-4 px-6 py-3 hover:bg-white/[0.02] transition-colors">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                  entry.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                  entry.rank === 2 ? 'bg-gray-400/20 text-gray-300' :
                  entry.rank === 3 ? 'bg-orange-500/20 text-orange-400' :
                  'bg-white/5 text-gray-500'
                }`}>{entry.rank}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{entry.name}</div>
                  <div className="text-[10px] text-gray-500 truncate">{entry.college}</div>
                </div>
                <div className="font-bold text-white text-sm tabular-nums">{entry.score.toLocaleString()}</div>
                {entry.medal && <span className="text-sm">{entry.medal}</span>}
              </div>
            ))}
          </div>
          <div className="px-6 py-3 border-t border-white/10 text-center">
            <span className="text-[10px] text-gray-500 font-mono">Updated in real-time</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
