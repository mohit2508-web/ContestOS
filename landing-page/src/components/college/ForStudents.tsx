import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

const STUDENT_FEATURES = [
  { icon: '🏆', title: 'Real-Time Rankings', desc: 'See your rank update live as others submit. Every second counts.' },
  { icon: '🔥', title: 'Streaks & Badges', desc: 'Build daily streaks. Earn badges for milestones. Show them off.' },
  { icon: '📜', title: 'Certificate on Completion', desc: 'Download a verified certificate. Share it on LinkedIn instantly.' },
  { icon: '⚔️', title: 'Inter-College Battle', desc: 'Your college vs. 50 others. Compete for the top spot.' },
  { icon: '📈', title: 'Skill Tracking', desc: 'Watch your rating grow over time. See where you stand nationally.' },
  { icon: '🎯', title: 'Company Exposure', desc: 'Top performers get noticed by hiring partners in our network.' },
];

export default function ForStudents() {
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 mb-6">
            <span className="text-xs font-mono text-amber-400">FOR STUDENTS</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-black mb-4">
            Compete. <span className="text-amber-400">Prove.</span> Get noticed.
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Not just another contest — a platform that rewards skill and gives visibility.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {STUDENT_FEATURES.map((feat, i) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.08 }}
              className="group backdrop-blur-xl bg-white/[0.02] rounded-2xl border border-white/[0.06] p-6 hover:border-amber-500/20 transition-all duration-300"
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
