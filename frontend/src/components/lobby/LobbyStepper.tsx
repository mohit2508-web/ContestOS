import React from 'react';

interface LobbyStepperProps {
  currentStep: number;
  steps: Array<{ title: string; desc: string }>;
}

export const LobbyStepper: React.FC<LobbyStepperProps> = ({ currentStep, steps }) => {
  return (
    <div className="w-full max-w-4xl mx-auto mb-8 bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between relative">
        {/* Background Line */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/10 -translate-y-1/2 z-0" />
        
        {/* Active Progress Line */}
        <div 
          className="absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-[var(--accent-green)] to-[var(--accent-blue)] -translate-y-1/2 z-0 transition-all duration-500" 
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((step, idx) => {
          const stepNumber = idx + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;

          return (
            <div key={idx} className="flex flex-col items-center z-10 relative">
              {/* Step Circle */}
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                  isCompleted 
                    ? 'bg-[var(--accent-green)] text-black shadow-[0_0_15px_rgba(76,175,80,0.4)]' 
                    : isActive 
                      ? 'bg-[var(--accent-blue)] text-white shadow-[0_0_15px_rgba(33,150,243,0.4)] ring-4 ring-[var(--accent-blue)]/20' 
                      : 'bg-zinc-800 text-gray-500 border border-white/5'
                }`}
              >
                {isCompleted ? (
                  <svg className="w-5 h-5 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  stepNumber
                )}
              </div>

              {/* Text details */}
              <div className="text-center mt-3 max-w-[120px] md:max-w-[150px]">
                <div className={`text-xs font-bold transition-colors duration-300 ${isActive ? 'text-white' : isCompleted ? 'text-[var(--accent-green)]' : 'text-gray-500'}`}>
                  {step.title}
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5 hidden sm:block">
                  {step.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
