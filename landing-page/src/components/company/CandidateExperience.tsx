import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

export default function CandidateExperience() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-24 px-4 border-t border-white/5">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center"
        >
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/5 mb-6">
              <span className="text-xs font-mono text-cyan-400">CANDIDATE EXPERIENCE</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black mb-6 leading-tight">
              Strict proctoring.<br />
              <span className="text-cyan-400">Great experience.</span>
            </h2>
            <p className="text-gray-400 leading-relaxed mb-6">
              Top candidates drop off when assessments are clunky. Our platform is fast, clean, and fair — candidates complete the test focused on code, not fighting the interface.
            </p>
            <div className="flex items-center gap-4">
              <div className="text-4xl font-black text-cyan-400">4.8</div>
              <div>
                <div className="flex gap-0.5 mb-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <span key={i} className={`text-sm ${i <= 4 ? 'text-yellow-400' : 'text-yellow-400/50'}`}>★</span>
                  ))}
                </div>
                <p className="text-xs text-gray-500">Candidate satisfaction rating</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {[
              { icon: '⚡', title: '< 200ms judge latency', desc: 'Results feel instant, not queued.' },
              { icon: '🎨', title: 'Clean, distraction-free UI', desc: 'Candidates focus on code, not navigation.' },
              { icon: '📱', title: 'Works on any device', desc: 'Desktop, tablet, or laptop — same experience.' },
              { icon: '🔒', title: 'Fair & transparent', desc: 'Candidates know the rules upfront. No surprises.' },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: 20 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="flex gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/10 transition-colors"
              >
                <span className="text-xl shrink-0 mt-0.5">{item.icon}</span>
                <div>
                  <h4 className="text-sm font-bold text-white">{item.title}</h4>
                  <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
