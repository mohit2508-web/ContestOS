import { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const STEPS = ['Submit', 'Compiling', 'Running', 'Grading', 'Result'];
const FINAL_TIME = 187;

export default function LiveJudgeSpeed() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const [activeStep, setActiveStep] = useState(-1);
  const [showTime, setShowTime] = useState(false);

  useEffect(() => {
    if (!isInView) return;
    let step = 0;
    const id = setInterval(() => {
      setActiveStep(step);
      if (step >= STEPS.length - 1) {
        clearInterval(id);
        setTimeout(() => setShowTime(true), 200);
      }
      step++;
    }, 250);
    return () => clearInterval(id);
  }, [isInView]);

  return (
    <div ref={ref} className="py-16 px-4">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-xs font-mono text-gray-500 uppercase tracking-[0.3em] mb-8">Submission to Result</p>
        <div className="flex items-center justify-center gap-2 md:gap-4 flex-wrap">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-2 md:gap-4">
              <motion.div
                initial={{ opacity: 0.3, scale: 0.9 }}
                animate={i <= activeStep ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-2"
              >
                <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  i < activeStep ? 'bg-green-500 shadow-lg shadow-green-500/30' :
                  i === activeStep ? 'bg-yellow-400 shadow-lg shadow-yellow-400/40 animate-pulse' :
                  'bg-white/10'
                }`} />
                <span className={`text-sm font-mono transition-colors ${
                  i <= activeStep ? 'text-white' : 'text-gray-600'
                }`}>{step}</span>
              </motion.div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-px transition-colors duration-300 ${
                  i < activeStep ? 'bg-green-500/40' : 'bg-white/10'
                }`} />
              )}
            </div>
          ))}
        </div>
        {showTime && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8"
          >
            <span className="text-5xl md:text-6xl font-black text-green-400 font-mono tabular-nums">{FINAL_TIME}</span>
            <span className="text-xl text-green-400/60 font-mono ml-1">ms</span>
            <p className="text-sm text-gray-500 mt-2">Average judge latency across 10M+ submissions</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
