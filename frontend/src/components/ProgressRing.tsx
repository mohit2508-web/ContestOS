
interface ProgressRingProps {
  radius: number;
  stroke: number;
  progress: number;
  total: number;
  passed: number;
}

export function ProgressRing({ radius, stroke, progress, total, passed }: ProgressRingProps) {
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const validProgress = isNaN(progress) ? 0 : progress;
  const strokeDashoffset = circumference - (validProgress / 100) * circumference;

  const isComplete = validProgress === 100;
  const isAllPassed = isComplete && passed === total;
  const color = isComplete ? (isAllPassed ? '#22c55e' : '#ef4444') : '#3b82f6';

  return (
    <div className="relative flex flex-col items-center justify-center">
      <svg
        height={radius * 2}
        width={radius * 2}
        className="transform -rotate-90"
      >
        <circle
          stroke="#374151"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke={color}
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.1s ease-out' }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-xl font-bold text-white tracking-wider">
          {passed}/{total}
        </span>
        <span className="text-xs text-gray-400 font-medium">Passed</span>
      </div>
    </div>
  );
}
