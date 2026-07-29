import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

const PROBLEMS = [
  {
    title: 'Two Sum',
    difficulty: 'Easy',
    diffColor: 'text-green-400 bg-green-500/10 border-green-500/20',
    submissions: '23.4K',
    acceptance: '72%',
    tags: ['Array', 'Hash Map'],
  },
  {
    title: 'Merge K Sorted Lists',
    difficulty: 'Medium',
    diffColor: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    submissions: '18.1K',
    acceptance: '48%',
    tags: ['Linked List', 'Heap', 'Divide & Conquer'],
  },
  {
    title: 'Regular Expression Matching',
    difficulty: 'Hard',
    diffColor: 'text-red-400 bg-red-500/10 border-red-500/20',
    submissions: '12.7K',
    acceptance: '28%',
    tags: ['DP', 'String', 'Recursion'],
  },
];

export default function ProblemShowcase() {
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
          <h2 className="text-4xl md:text-6xl font-black mb-4">
            Sample <span className="text-orange-400">Problems</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Difficulty-scaled problems. Real competitive programming questions.
          </p>
        </motion.div>

        <div className="space-y-4">
          {PROBLEMS.map((prob, i) => (
            <motion.div
              key={prob.title}
              initial={{ opacity: 0, x: -20 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}
              className="group backdrop-blur-xl bg-white/[0.03] rounded-2xl border border-white/[0.06] p-6 hover:border-white/10 transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-mono text-gray-600">#{(i + 1) * 1001}</span>
                  <h3 className="text-lg font-bold text-white">{prob.title}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {prob.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-gray-400 font-mono">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                <div className="text-center">
                  <div className="text-xs text-gray-500">Submissions</div>
                  <div className="text-sm font-bold text-white font-mono">{prob.submissions}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500">Acceptance</div>
                  <div className="text-sm font-bold text-white font-mono">{prob.acceptance}</div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${prob.diffColor}`}>
                  {prob.difficulty}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
