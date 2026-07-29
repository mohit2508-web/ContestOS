import { motion } from 'framer-motion';
import { portalLink } from '../../lib/portal';

export default function CompanyHero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 pt-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-950/20 via-black to-black" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.08),transparent_60%)]" />

      <div className="relative z-10 max-w-5xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500/20 bg-blue-500/5 mb-8">
            <span className="w-2 h-2 bg-blue-500 rounded-full" />
            <span className="text-sm font-mono text-blue-400">Trusted by 50+ hiring teams</span>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.95] mb-6"
        >
          Hire on real code,
          <br />
          <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            not resumes.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35 }}
          className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Proctored, tamper-proof coding assessments with
          <span className="text-white font-medium"> full integrity reports </span>.
          Results in minutes, not days.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <motion.a
            href={portalLink('/register')}
            whileHover={{ scale: 1.03, boxShadow: '0 0 40px rgba(59,130,246,0.3)' }}
            whileTap={{ scale: 0.97 }}
            className="px-10 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full font-bold text-lg text-white cursor-pointer inline-block"
          >
            Book a Demo
          </motion.a>
          <motion.a
            href={portalLink('/register')}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="px-10 py-4 border border-white/15 rounded-full font-bold text-lg text-gray-300 hover:text-white hover:bg-white/5 cursor-pointer transition-colors inline-block"
          >
            Run Your First Test Free
          </motion.a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-16 flex justify-center gap-16 text-sm"
        >
          {[{ n: '< 200ms', l: 'Judge Speed' }, { n: '7-Layer', l: 'Anti-Cheat' }, { n: '0', l: 'False Positives' }].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 + i * 0.12 }}
              className="text-center"
            >
              <div className="text-xl md:text-2xl font-black text-white">{s.n}</div>
              <div className="text-gray-500 text-xs uppercase tracking-widest mt-1">{s.l}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
