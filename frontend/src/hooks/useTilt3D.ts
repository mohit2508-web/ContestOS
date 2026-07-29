/**
 * useTilt3D — shared Framer Motion pointer-driven 3D tilt hook.
 * Used on rule cards (Phase 1), problem-status cards (Phase 3), and score card (Phase 5).
 * maxDeg: maximum rotation in degrees (default 6).
 */
import { useRef, useCallback } from 'react';
import { useMotionValue, useSpring, useTransform } from 'framer-motion';

export function useTilt3D(maxDeg = 6) {
  const elementRef = useRef<HTMLDivElement | null>(null);

  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);

  const springX = useSpring(x, { stiffness: 300, damping: 30 });
  const springY = useSpring(y, { stiffness: 300, damping: 30 });

  const rotateX = useTransform(springY, [0, 1], [maxDeg, -maxDeg]);
  const rotateY = useTransform(springX, [0, 1], [-maxDeg, maxDeg]);

  const ref = useCallback((node: HTMLDivElement | null) => {
    elementRef.current = node;
  }, []);

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = elementRef.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - rect.left) / rect.width);
    y.set((e.clientY - rect.top) / rect.height);
  };

  const onMouseLeave = () => {
    x.set(0.5);
    y.set(0.5);
  };

  return {
    ref,
    style: {
      rotateX,
      rotateY,
      transformPerspective: 1200,
    } as const,
    onMouseMove,
    onMouseLeave,
  };
}
