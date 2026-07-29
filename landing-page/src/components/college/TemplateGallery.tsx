import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

const TEMPLATES = [
  { title: 'Placement Prep', desc: 'Standard DSA problems for placement season. Auto-graded, timed, proctored.', icon: '💼', problems: 50, duration: '90 min', popularity: 'Most popular' },
  { title: 'Semester Exam', desc: 'Course-specific problems. Supports custom test cases and partial grading.', icon: '📚', problems: 25, duration: '120 min', popularity: '' },
  { title: 'Inter-College Hackathon', desc: 'Team-based. Multi-problem. Leaderboard with team rankings.', icon: '🏆', problems: 8, duration: '6 hours', popularity: 'Trending' },
  { title: 'Coding Bootcamp', desc: 'Beginner-friendly. Progressively harder problems. Skill badges on completion.', icon: '🚀', problems: 30, duration: '60 min', popularity: '' },
];

export default function TemplateGallery() {
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/5 mb-6">
            <span className="text-xs font-mono text-purple-400">TEMPLATES</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-black mb-4">
            Ready-to-launch <span className="text-purple-400">contests</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Pick a template. Customize. Go live. It's that simple.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {TEMPLATES.map((tpl, i) => (
            <motion.div
              key={tpl.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.1 }}
              className="group backdrop-blur-xl bg-white/[0.03] rounded-2xl border border-white/[0.06] p-6 hover:border-purple-500/20 transition-all duration-300 cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="text-3xl">{tpl.icon}</div>
                {tpl.popularity && (
                  <span className="px-2.5 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-[10px] text-purple-400 font-bold uppercase tracking-wider">{tpl.popularity}</span>
                )}
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{tpl.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">{tpl.desc}</p>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>📝 {tpl.problems} problems</span>
                <span>⏱️ {tpl.duration}</span>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5">
                <button className="text-xs text-purple-400 font-bold hover:text-purple-300 transition-colors">
                  Use this template →
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
