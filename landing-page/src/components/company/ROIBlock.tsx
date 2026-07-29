import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

export default function ROIBlock() {
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
          <h2 className="text-4xl md:text-6xl font-black mb-4">
            Screening time: <span className="text-blue-400">10 min</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            What used to take your team 3 days now takes 10 minutes.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Before */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-red-500/10 bg-red-500/[0.03] p-8"
          >
            <div className="text-xs font-mono text-red-400 uppercase tracking-widest mb-4">Without ContestOS</div>
            <div className="space-y-4">
              {[
                { icon: '📋', text: '100 resumes manually screened', time: '8 hours' },
                { icon: '📝', text: 'Take-home assignments sent', time: '3 days wait' },
                { icon: '🔍', text: 'Manual code review', time: '4 hours' },
                { icon: '🤝', text: 'Interview scheduling', time: '2 days' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-red-500/10 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-sm text-gray-400">{item.text}</span>
                  </div>
                  <span className="text-xs font-mono text-red-400/70">{item.time}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-red-500/10">
              <span className="text-2xl font-black text-red-400">7+ days</span>
              <span className="text-sm text-gray-500 ml-2">to first signal</span>
            </div>
          </motion.div>

          {/* After */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.35 }}
            className="rounded-2xl border border-green-500/10 bg-green-500/[0.03] p-8"
          >
            <div className="text-xs font-mono text-green-400 uppercase tracking-widest mb-4">With ContestOS</div>
            <div className="space-y-4">
              {[
                { icon: '⚡', text: 'Auto-graded assessments', time: '2 min setup' },
                { icon: '🛡️', text: 'Live proctoring built-in', time: 'Zero extra tools' },
                { icon: '📊', text: 'Ranked report + integrity flags', time: 'Instant' },
                { icon: '🎯', text: 'Top candidates identified', time: '10 min total' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-green-500/10 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-sm text-gray-300">{item.text}</span>
                  </div>
                  <span className="text-xs font-mono text-green-400/70">{item.time}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-green-500/10">
              <span className="text-2xl font-black text-green-400">10 minutes</span>
              <span className="text-sm text-gray-500 ml-2">to ranked results</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
