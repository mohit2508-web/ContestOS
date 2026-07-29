import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

export interface GalaxyHandle {
  fadeToBlack: (duration?: number) => Promise<void>;
}

interface Star {
  x: number;
  y: number;
  r: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinkleOffset: number;
}

interface Nebula {
  x: number;
  y: number;
  r: number;
  color: string;
  alpha: number;
}

function generateStars(width: number, height: number, count: number): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 1.8 + 0.3,
    baseAlpha: Math.random() * 0.6 + 0.3,
    twinkleSpeed: Math.random() * 2 + 0.5,
    twinkleOffset: Math.random() * Math.PI * 2,
  }));
}

function generateNebulae(width: number, height: number): Nebula[] {
  const colors = [
    'rgba(100, 50, 180, 0.12)',
    'rgba(40, 80, 200, 0.08)',
    'rgba(200, 150, 50, 0.06)',
    'rgba(180, 50, 100, 0.05)',
    'rgba(50, 180, 180, 0.04)',
  ];
  return colors.map((color, i) => ({
    x: width * (0.15 + (i * 0.18)),
    y: height * (0.2 + Math.sin(i * 1.5) * 0.3),
    r: Math.max(width, height) * (0.25 + Math.random() * 0.2),
    color,
    alpha: 1,
  }));
}

const GalaxyCanvas = forwardRef<GalaxyHandle>(function GalaxyCanvas(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<{ stars: Star[]; nebulae: Nebula[] }>({ stars: [], nebulae: [] });
  const animRef = useRef<number>(0);
  const fadeRef = useRef<{ active: boolean; start: number; duration: number; from: number; onDone?: () => void }>({ active: false, start: 0, duration: 0, from: 1 });

  useImperativeHandle(ref, () => ({
    fadeToBlack(duration = 1200) {
      return new Promise<void>(resolve => {
        fadeRef.current = { active: true, start: performance.now(), duration, from: 1 };
        fadeRef.current.onDone = resolve;
      });
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      dataRef.current.stars = generateStars(canvas.width, canvas.height, 300);
      dataRef.current.nebulae = generateNebulae(canvas.width, canvas.height);
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = (time: number) => {
      const { stars, nebulae } = dataRef.current;
      const t = time / 1000;
      const fade = fadeRef.current;
      let globalAlpha = 1;

      if (fade.active) {
        const elapsed = time - fade.start;
        const progress = Math.min(1, elapsed / fade.duration);
        const ease = 1 - Math.pow(1 - progress, 3);
        globalAlpha = fade.from * (1 - ease);
        if (progress >= 1) {
          fade.active = false;
          fade.onDone?.();
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = globalAlpha;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const neb of nebulae) {
        const grad = ctx.createRadialGradient(neb.x, neb.y, 0, neb.x, neb.y, neb.r);
        grad.addColorStop(0, neb.color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(neb.x - neb.r, neb.y - neb.r, neb.r * 2, neb.r * 2);
      }

      for (const star of stars) {
        const twinkle = Math.sin(t * star.twinkleSpeed + star.twinkleOffset) * 0.3 + 0.7;
        const alpha = star.baseAlpha * twinkle;

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();

        if (star.r > 1.2) {
          const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.r * 4);
          glow.addColorStop(0, `rgba(200, 220, 255, ${alpha * 0.15})`);
          glow.addColorStop(1, 'transparent');
          ctx.fillStyle = glow;
          ctx.fillRect(star.x - star.r * 4, star.y - star.r * 4, star.r * 8, star.r * 8);
        }
      }

      ctx.globalAlpha = 1;
      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0"
      style={{ pointerEvents: 'none' }}
    />
  );
});

export default GalaxyCanvas;
