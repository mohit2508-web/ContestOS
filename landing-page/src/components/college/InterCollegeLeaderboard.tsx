import { motion, useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';

const COLLEGES = [
  { rank: 1, name: 'IIT Bombay', students: 342, avgScore: 847, change: 0 },
  { rank: 2, name: 'BITS Pilani', students: 289, avgScore: 831, change: 1 },
  { rank: 3, name: 'NIT Trichy', students: 256, avgScore: 812, change: -1 },
  { rank: 4, name: 'IIIT Hyderabad', students: 198, avgScore: 798, change: 2 },
  { rank: 5, name: 'IIT Delhi', students: 312, avgScore: 791, change: -1 },
  { rank: 6, name: 'IIT Madras', students: 276, avgScore: 784, change: 0 },
  { rank: 7, name: 'NIT Warangal', students: 189, avgScore: 771, change: 3 },
  { rank: 8, name: 'VIT Vellore', students: 421, avgScore: 763, change: -2 },
];

export default function InterCollegeLeaderboard() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [data, setData] = useState(COLLEGES);

  useEffect(() => {
    if (!isInView) return;
    const id = setInterval(() => {
      setData(prev =>
        prev.map(c => ({ ...c, avgScore: c.avgScore + Math.floor(Math.random() * 10 - 4) }))
          .sort((a, b) => b.avgScore - a.avgScore)
          .map((c, i) => ({ ...c, rank: i + 1 }))
      );
    }, 3000);
    return () => clearInterval(id);
  }, [isInView]);

  return (
    <section ref={ref} className="py-24 px-4 border-t border-white/5">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/20 bg-red-500/5 mb-6">
            <span className="text-xs font-mono text-red-400">INTER-COLLEGE</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-black mb-4">
            College vs. College. <span className="text-red-400">Who's #1?</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Nationally ranked by average score. Updated after every contest. Share your rank.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: 0.2 }}
          className="backdrop-blur-xl bg-white/[0.03] rounded-3xl border border-white/10 overflow-hidden"
        >
          <div className="flex items-center justify-between px-8 py-5 border-b border-white/10">
            <div>
              <h3 className="font-bold text-white">National College Rankings</h3>
              <p className="text-xs text-gray-500 font-mono mt-0.5">Based on average scores across all contests</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs font-mono text-red-400">LIVE</span>
            </div>
          </div>

          <div className="divide-y divide-white/5">
            {data.map((college) => (
              <div key={college.name} className="flex items-center gap-5 px-8 py-4 hover:bg-white/[0.02] transition-colors">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                  college.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                  college.rank === 2 ? 'bg-gray-400/20 text-gray-300' :
                  college.rank === 3 ? 'bg-orange-500/20 text-orange-400' :
                  'bg-white/5 text-gray-500'
                }`}>{college.rank}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white truncate">{college.name}</div>
                  <div className="text-xs text-gray-500">{college.students} students participated</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-white tabular-nums">{college.avgScore.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-500 font-mono">avg score</div>
                </div>
                <div className={`text-xs font-mono shrink-0 w-8 text-right ${
                  data.indexOf(college) < COLLEGES.findIndex(c => c.name === college.name) ? 'text-green-400' :
                  data.indexOf(college) > COLLEGES.findIndex(c => c.name === college.name) ? 'text-red-400' :
                  'text-gray-500'
                }`}>
                  {data.indexOf(college) < COLLEGES.findIndex(c => c.name === college.name) ? '▲' :
                   data.indexOf(college) > COLLEGES.findIndex(c => c.name === college.name) ? '▼' : '—'}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
