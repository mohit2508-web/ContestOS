import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

const CONTESTS = [
  { name: 'CodeSprint \'26', date: 'Jul 15, 2026', participants: 1247, colleges: 23, topScorer: 'Arjun_K (IIT Bombay)', prize: '₹50,000' },
  { name: 'DSA Championship', date: 'Jun 28, 2026', participants: 892, colleges: 18, topScorer: 'Sneha_R (BITS Pilani)', prize: '₹25,000' },
  { name: 'Freshers coding杯', date: 'Jun 10, 2026', participants: 2103, colleges: 41, topScorer: 'Vikram_P (NIT Trichy)', prize: 'Certificates' },
];

export default function ContestGallery() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-6xl font-black mb-4">Past <span className="text-amber-400">Events</span></h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Real contests. Real numbers. Real impact.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CONTESTS.map((contest, i) => (
            <motion.div
              key={contest.name}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}
              className="group backdrop-blur-xl bg-white/[0.03] rounded-2xl border border-white/[0.06] p-6 hover:border-amber-500/20 transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">{contest.name}</h3>
                <span className="text-xs font-mono text-gray-500">{contest.date}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-2xl font-black text-amber-400">{contest.participants.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Participants</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-white">{contest.colleges}</div>
                  <div className="text-xs text-gray-500">Colleges</div>
                </div>
              </div>
              <div className="pt-4 border-t border-white/5">
                <div className="text-xs text-gray-500 mb-1">Top Scorer</div>
                <div className="text-sm text-white font-medium">{contest.topScorer}</div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="px-2.5 py-1 bg-amber-500/10 rounded-full text-xs text-amber-400 font-medium">{contest.prize}</span>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.6 }}
          className="mt-12 grid grid-cols-3 gap-4 text-center"
        >
          {[
            { n: '4,242', l: 'Total Participants' },
            { n: '82', l: 'Colleges' },
            { n: '15+', l: 'Contests Hosted' },
          ].map((s, i) => (
            <div key={i}>
              <div className="text-3xl font-black text-white">{s.n}</div>
              <div className="text-xs text-gray-500 uppercase tracking-widest mt-1">{s.l}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
