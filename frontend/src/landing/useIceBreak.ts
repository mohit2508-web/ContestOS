import { useState, useRef, useCallback } from 'react';
import { generateSeeds, computeVoronoi, Cell } from './lib/shatter';

export interface CrackEvent {
  x: number;
  y: number;
  cells: Cell[];
  timestamp: number;
}

export interface DetachEvent {
  cells: Cell[];
  impulseX: number;
  impulseY: number;
  timestamp: number;
}

interface UseIceBreakOptions {
  width: number;
  height: number;
  onCrack: (event: CrackEvent) => void;
  onDetach: (event: DetachEvent) => void;
  onReveal: (percent: number) => void;
  onComplete: () => void;
  threshold?: number;
}

export function useIceBreak({
  width,
  height,
  onCrack,
  onDetach,
  onReveal,
  onComplete,
  threshold = 0.85,
}: UseIceBreakOptions) {
  const [revealedPercent, setRevealedPercent] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const revealedAreaRef = useRef(0);
  const totalAreaRef = useRef(width * height);
  const lastClickRef = useRef(0);
  const completeRef = useRef(false);

  const handleClick = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (completeRef.current) return;

    const now = Date.now();
    if (now - lastClickRef.current < 80) return;
    lastClickRef.current = now;

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = (e.clientX ?? (e as any).pageX) - rect.left;
    const y = (e.clientY ?? (e as any).pageY) - rect.top;

    const seeds = generateSeeds(x, y, width, height, 90);
    const { cells, totalArea } = computeVoronoi(seeds, width, height);

    if (totalAreaRef.current === 0) totalAreaRef.current = totalArea;

    onCrack({ x, y, cells, timestamp: now });

    const nearbyRadius = Math.min(width, height) * 0.18;
    const detachCells = cells.filter(c => {
      const dx = c.center[0] - x;
      const dy = c.center[1] - y;
      return Math.sqrt(dx * dx + dy * dy) < nearbyRadius;
    });

    if (detachCells.length > 0) {
      const clampDetach = detachCells.slice(0, 12);
      const detachArea = clampDetach.reduce((s, c) => s + c.area, 0);

      revealedAreaRef.current += detachArea;
      const pct = Math.min(1, revealedAreaRef.current / totalAreaRef.current);
      setRevealedPercent(pct);
      onReveal(pct);

      const angle = Math.atan2(height / 2 - y, width / 2 - x);
      const force = 3 + Math.random() * 2;

      onDetach({
        cells: clampDetach,
        impulseX: Math.cos(angle) * force,
        impulseY: -Math.abs(Math.sin(angle) * force) - 2,
        timestamp: now,
      });

      if (pct >= threshold && !completeRef.current) {
        completeRef.current = true;
        setTimeout(() => {
          setIsComplete(true);
          onComplete();
        }, 400);
      }
    }
  }, [width, height, onCrack, onDetach, onReveal, onComplete, threshold]);

  const forceComplete = useCallback(() => {
    if (completeRef.current) return;
    completeRef.current = true;
    setRevealedPercent(1);
    setIsComplete(true);
    onComplete();
  }, [onComplete]);

  return {
    revealedPercent,
    isComplete,
    handleClick,
    forceComplete,
  };
}
