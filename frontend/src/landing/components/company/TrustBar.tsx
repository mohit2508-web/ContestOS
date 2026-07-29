import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

const STATS = [
  { value: '50+', label: 'Hiring Teams' },
  { value: '12K+', label: 'Assessments Run' },
  { value: '94%', label: 'Faster Screening' },
  { value: '4.8/5', label: 'Candidate Rating' },
];

export default function TrustBar() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <div ref={ref} className="py-16 px-4 border-y border-white/5">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-10"
        >
          <p className="text-xs font-mono text-gray-500 uppercase tracking-[0.3em]">Trusted by forward-thinking teams</p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.08 }}
              className="text-center"
            >
              <div className="text-3xl font-black text-white mb-1">{stat.value}</div>
              <div className="text-xs text-gray-500 uppercase tracking-widest">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.5 }}
          className="mt-10 flex items-center justify-center gap-8 opacity-20"
        >
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="w-24 h-8 rounded bg-white/10 flex items-center justify-center">
              <span className="text-[10px] text-gray-500 font-mono">LOGO</span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
