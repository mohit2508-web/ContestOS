import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

export default function PlacementConnect() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/5 mb-6">
            <span className="text-xs font-mono text-cyan-400">PLACEMENT PIPELINE</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-black mb-4">
            Top performers get<br />
            <span className="text-cyan-400">recruiter attention.</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Every contest is a placement opportunity. The best coders get noticed by hiring partners.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { num: '01', title: 'Students compete', desc: 'Best coders surface through fair, proctored contests.', icon: '🏆' },
            { num: '02', title: 'Results are shared', desc: 'Top performers\' profiles and scores are shared with our hiring network.', icon: '📊' },
            { num: '03', title: 'Recruiters reach out', desc: 'Companies see verified, integrity-scored results. Direct connection.', icon: '🤝' },
          ].map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.15 + i * 0.12 }}
              className="text-center p-6"
            >
              <div className="text-5xl font-black text-white/[0.04] mb-2">{step.num}</div>
              <div className="text-2xl mb-3">{step.icon}</div>
              <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-6 px-8 py-4 bg-white/[0.03] rounded-2xl border border-white/[0.06]">
            <div>
              <div className="text-2xl font-black text-cyan-400">200+</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Hiring Partners</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <div className="text-2xl font-black text-white">₹12L</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Avg CTC</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <div className="text-2xl font-black text-amber-400">85%</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Placement Rate</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
