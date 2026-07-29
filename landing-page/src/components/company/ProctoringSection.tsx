import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';

const MECHANISMS = [
  { icon: '🖥️', title: 'Browser Lockdown', desc: 'Tab-switch detection with count log. Candidates cannot leave the assessment window.', color: '#3B82F6' },
  { icon: '📷', title: 'Face Presence Monitoring', desc: 'Webcam checks ensure the right person is taking the test throughout.', color: '#8B5CF6' },
  { icon: '🚫', title: 'Copy-Paste Block', desc: 'Clipboard monitoring blocks external code injection. Every paste attempt is logged.', color: '#EC4899' },
  { icon: '⌨️', title: 'Keystroke Timeline', desc: 'Full submission timeline — every keystroke, pause, and edit is recorded and replayable.', color: '#F59E0B' },
  { icon: '🔍', title: 'Code Similarity Check', desc: 'Cross-candidate plagiarism detection catches copied solutions instantly.', color: '#10B981' },
  { icon: '🔐', title: 'Device Fingerprinting', desc: 'IP + device fingerprint ensures one candidate, one attempt. No proxies.', color: '#6366F1' },
  { icon: '🚨', title: 'Auto-Flag Suspicious', desc: 'AI flags anomalies → evaluator gets a review queue. No blind trust.', color: '#EF4444' },
];

const MONITORING_EVENTS = [
  { text: 'Tab focus verified', layer: 'Browser Lockdown', color: '#3B82F6' },
  { text: 'Face detected — candidate match ✓', layer: 'Face Presence', color: '#8B5CF6' },
  { text: 'Clipboard access blocked', layer: 'Copy-Paste Block', color: '#EC4899' },
  { text: 'Keystroke cadence normal', layer: 'Keystroke Timeline', color: '#F59E0B' },
  { text: 'Code similarity: 0.3% (threshold 15%)', layer: 'Similarity Check', color: '#10B981' },
  { text: 'Device fingerprint matched', layer: 'Fingerprinting', color: '#6366F1' },
  { text: 'All 7 layers active — no anomalies', layer: 'Auto-Flag', color: '#EF4444' },
];

function MonitoringStatusBar({ active }: { active: boolean }) {
  const [eventIndex, setEventIndex] = useState(0);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setEventIndex(prev => (prev + 1) % MONITORING_EVENTS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [active]);

  const event = MONITORING_EVENTS[eventIndex];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: active ? 1 : 0, y: active ? 0 : 20 }}
      className="mt-8 mb-12 max-w-3xl mx-auto"
    >
      <div className="relative backdrop-blur-xl bg-white/[0.03] rounded-2xl border border-white/[0.08] p-5 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-cyan-500/5" />

        <div className="relative z-10 flex items-center gap-4">
          <div className="flex-shrink-0 flex items-center gap-2">
            <div className="relative">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-500 animate-ping" />
            </div>
            <span className="text-[10px] font-mono text-green-400 uppercase tracking-wider">Live</span>
          </div>

          <div className="h-6 w-px bg-white/10" />

          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={eventIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-3"
              >
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border" style={{ color: event.color, borderColor: `${event.color}33` }}>
                  {event.layer}
                </span>
                <span className="text-sm text-gray-300 font-mono truncate">{event.text}</span>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex-shrink-0 flex gap-1">
            {MECHANISMS.map((m, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
                style={{ backgroundColor: i <= eventIndex ? m.color : 'rgba(255,255,255,0.1)' }}
              />
            ))}
          </div>
        </div>

        <div className="mt-3 h-0.5 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${event.color}, ${event.color}88)` }}
            initial={{ width: '0%' }}
            animate={{ width: `${((eventIndex + 1) / MONITORING_EVENTS.length) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>
    </motion.div>
  );
}

export default function ProctoringSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [monitoringActive, setMonitoringActive] = useState(false);

  useEffect(() => {
    if (isInView) {
      const timer = setTimeout(() => setMonitoringActive(true), 800);
      return () => clearTimeout(timer);
    }
  }, [isInView]);

  return (
    <section ref={ref} className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500/20 bg-blue-500/5 mb-6">
            <span className="text-xs font-mono text-blue-400">INTEGRITY ENGINE</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-black mb-4">
            Every result comes with a<br />
            <span className="text-blue-400">full integrity report</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            7 independent monitoring layers. Not promises — mechanisms.
          </p>
        </motion.div>

        <MonitoringStatusBar active={monitoringActive} />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {MECHANISMS.map((mech, i) => (
            <motion.div
              key={mech.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.07 }}
              className="group relative backdrop-blur-xl bg-white/[0.02] rounded-2xl border border-white/[0.06] p-6 hover:border-white/10 transition-all duration-300 overflow-hidden"
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `radial-gradient(circle at center, ${mech.color}, transparent 70%)` }} />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-2xl">{mech.icon}</div>
                  {monitoringActive && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + i * 0.15 }}
                      className="flex items-center gap-1.5"
                    >
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: mech.color }} />
                      <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: mech.color }}>Active</span>
                    </motion.div>
                  )}
                </div>
                <h3 className="text-base font-bold text-white mb-2">{mech.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{mech.desc}</p>
              </div>
              <div className="absolute bottom-0 left-0 w-0 h-0.5 group-hover:w-full transition-all duration-700" style={{ backgroundColor: mech.color }} />
            </motion.div>
          ))}

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 1.2 }}
            className="group relative rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-cyan-500/5 p-6 flex flex-col justify-center"
          >
            <div className="absolute top-4 right-4">
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 animate-ping" />
              </div>
            </div>

            <div className="relative z-10">
              <div className="text-3xl font-black text-blue-400 mb-2">100%</div>
              <p className="text-sm text-gray-300 leading-relaxed">
                Every submission is proctored. Every anomaly is flagged. Every result is verifiable.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <div className="relative">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <div className="absolute inset-0 w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                </div>
                <span className="text-[10px] font-mono text-blue-400">Real-time monitoring active</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
