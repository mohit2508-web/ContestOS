import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

const ORG_FEATURES = [
  { icon: '⚡', title: '5-Minute Setup', desc: 'Pick a template, add your students, go live. No technical knowledge required.' },
  { icon: '🤖', title: 'Auto-Grading', desc: 'Every submission auto-graded in real-time. No manual checking, ever.' },
  { icon: '📁', title: 'Bulk Student Import', desc: 'Upload a CSV with your class roster. Everyone gets invited instantly.' },
  { icon: '📊', title: 'Downloadable Reports', desc: 'Export results, rankings, and certificates as PDF. Share with administration.' },
  { icon: '🎓', title: 'Custom Branding', desc: 'Add your college logo to certificates and contest pages.' },
  { icon: '⏱️', title: 'Flexible Timing', desc: 'Set start/end times, duration limits, and grace periods per problem.' },
];

export default function ForOrganizers() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-24 px-4 border-t border-white/5">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-green-500/20 bg-green-500/5 mb-6">
            <span className="text-xs font-mono text-green-400">FOR ORGANIZERS</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-black mb-4">
            Zero effort. <span className="text-green-400">Maximum impact.</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            TPOs and faculty — focus on the event, not the logistics.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {ORG_FEATURES.map((feat, i) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.08 }}
              className="group backdrop-blur-xl bg-white/[0.02] rounded-2xl border border-white/[0.06] p-6 hover:border-green-500/20 transition-all duration-300"
            >
              <div className="text-3xl mb-4 group-hover:scale-110 transition-transform duration-300">{feat.icon}</div>
              <h3 className="text-base font-bold text-white mb-2">{feat.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{feat.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
