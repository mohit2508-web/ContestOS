import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { portalLink } from '../../lib/portal';

export default function CompanyCTA() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="py-24 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="backdrop-blur-xl bg-white/[0.03] rounded-3xl border border-white/10 p-12 md:p-16"
        >
          <h2 className="text-4xl md:text-6xl font-black mb-6">
            Stop guessing.<br />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Start measuring.</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto mb-10">
            Run your first assessment today. Free for up to 25 candidates. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.a
              href={portalLink('/register')}
              whileHover={{ scale: 1.03, boxShadow: '0 0 50px rgba(59,130,246,0.3)' }}
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
              Run First Test Free
            </motion.a>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-6 text-xs text-gray-500">
            <span>✓ Free for 25 candidates</span>
            <span>✓ No credit card</span>
            <span>✓ Setup in 5 minutes</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
