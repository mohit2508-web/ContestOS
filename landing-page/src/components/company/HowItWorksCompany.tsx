import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

const STEPS = [
  { num: '01', title: 'Create Test', desc: 'Pick from templates or build custom. Add problems, set time limit, configure proctoring.', icon: '📝' },
  { num: '02', title: 'Invite Candidates', desc: 'Share a link. Bulk upload via CSV. Candidates get their unique, secure assessment URL.', icon: '📧' },
  { num: '03', title: 'Auto-Proctored Attempt', desc: 'Candidates take the test. 7-layer proctoring runs silently in the background.', icon: '🛡️' },
  { num: '04', title: 'Ranked Report', desc: 'Sorted by skill. Each candidate gets an integrity score alongside their code score.', icon: '📊' },
];

export default function HowItWorksCompany() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-24 px-4 border-t border-white/5">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-6xl font-black mb-4">How it works</h2>
          <p className="text-gray-400 text-lg">From zero to ranked candidates in four steps.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.12 }}
              className="relative"
            >
              <div className="text-6xl font-black text-white/[0.04] mb-2">{step.num}</div>
              <div className="text-2xl mb-3">{step.icon}</div>
              <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-10 right-0 w-12 h-px bg-gradient-to-r from-white/10 to-transparent translate-x-6" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
