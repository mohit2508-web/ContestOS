import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { KryptaviaLogo } from '../../../components/common/KryptaviaLogo';

export default function CertificatePreview() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-24 px-4 border-t border-white/5">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-yellow-500/20 bg-yellow-500/5 mb-6">
              <span className="text-xs font-mono text-yellow-400">CERTIFICATES</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black mb-6 leading-tight">
              Certificates they'll<br />
              <span className="text-yellow-400">share on LinkedIn.</span>
            </h2>
            <p className="text-gray-400 leading-relaxed mb-6">
              Verified certificates with unique IDs. Students share them, their network sees your brand. Free marketing with every contest.
            </p>
            <div className="space-y-3">
              {[
                'Unique verification ID for each certificate',
                'QR code linking to the result page',
                'Customizable with college logo',
                'One-click LinkedIn share',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-400 text-xs">✓</span>
                  <span className="text-sm text-gray-400">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Mock Certificate */}
          <motion.div
            initial={{ opacity: 0, x: 30, rotateY: -5 }}
            animate={isInView ? { opacity: 1, x: 0, rotateY: 0 } : {}}
            transition={{ delay: 0.2 }}
            className="perspective-[1000px]"
          >
            <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl border border-amber-500/20 p-8 shadow-2xl shadow-amber-500/5 overflow-hidden">
              {/* Decorative border */}
              <div className="absolute inset-2 border border-amber-500/10 rounded-xl pointer-events-none" />
              <div className="absolute inset-3 border border-amber-500/5 rounded-lg pointer-events-none" />

              {/* Corner accents */}
              <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-amber-500/30 rounded-tl-lg" />
              <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-amber-500/30 rounded-tr-lg" />
              <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-amber-500/30 rounded-bl-lg" />
              <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-amber-500/30 rounded-br-lg" />

              <div className="relative z-10 text-center py-4">
                <div className="text-xs font-mono text-amber-400/60 uppercase tracking-[0.3em] mb-2">Certificate of Achievement</div>
                <div className="flex items-center justify-center gap-2 mb-6">
                  <KryptaviaLogo size="sm" />
                </div>

                <div className="text-xs text-gray-500 mb-1">This certifies that</div>
                <div className="text-2xl font-black text-white mb-3">Arjun Kumar</div>
                <div className="text-xs text-gray-500 mb-4">has achieved</div>
                <div className="text-3xl font-black bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent mb-1">Rank #1</div>
                <div className="text-sm text-gray-400 mb-6">in CodeSprint '26</div>

                <div className="flex items-center justify-center gap-8 pt-4 border-t border-white/5">
                  <div className="text-center">
                    <div className="text-lg font-black text-amber-400">9,820</div>
                    <div className="text-[10px] text-gray-500">Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-black text-white">1,247</div>
                    <div className="text-[10px] text-gray-500">Participants</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-black text-green-400">Top 0.1%</div>
                    <div className="text-[10px] text-gray-500">Percentile</div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-center gap-4 text-[10px] text-gray-600 font-mono">
                  <span>ID: CERT-CS26-00001</span>
                  <span>•</span>
                  <span>verify.kryptavia.com</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
