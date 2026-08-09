import React, { useState, useEffect, useRef } from 'react';

const ACCENT = '#f5a623';
const ACCENT_2 = '#22d3a4';

/* ---------- Canvas Constellation (Cursor Reactive) ---------- */
function Constellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf: number;
    let w: number;
    let h: number;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      if (!canvas) return;
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const onMove = (e: MouseEvent) => {
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    window.addEventListener('pointermove', onMove);

    const N = 65;
    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * (w || 1000),
      y: Math.random() * (h || 800),
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        const dmx = p.x - mouse.current.x;
        const dmy = p.y - mouse.current.y;
        const dm = Math.sqrt(dmx * dmx + dmy * dmy);
        if (dm < 120) {
          p.x += (dmx / dm) * 0.4;
          p.y += (dmy / dm) * 0.4;
        }
      }
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 140) {
            const dmx = (pts[i].x + pts[j].x) / 2 - mouse.current.x;
            const dmy = (pts[i].y + pts[j].y) / 2 - mouse.current.y;
            const dm = Math.sqrt(dmx * dmx + dmy * dmy);
            const boost = dm < 160 ? (1 - dm / 160) * 0.5 : 0;
            ctx.strokeStyle = `rgba(245,166,35,${0.08 * (1 - d / 140) + boost})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }
      for (const p of pts) {
        ctx.fillStyle = 'rgba(245,166,35,0.55)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

/* ---------- Parallax Mouse Tracking ---------- */
function useParallax() {
  const [p, setP] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setP({ x: e.clientX / window.innerWidth - 0.5, y: e.clientY / window.innerHeight - 0.5 });
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);
  return p;
}

/* ---------- Cursor Sparkle Trail ---------- */
function CursorTrail() {
  const containerRef = useRef<HTMLDivElement>(null);
  const last = useRef(0);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const now = performance.now();
      if (now - last.current < 35) return;
      last.current = now;
      const el = document.createElement('span');
      const size = 3 + Math.random() * 3;
      el.style.cssText = `
        position:fixed; left:${e.clientX}px; top:${e.clientY}px;
        width:${size}px; height:${size}px; border-radius:50%;
        background:${Math.random() > 0.5 ? ACCENT : ACCENT_2};
        pointer-events:none; z-index:60; opacity:0.9;
        box-shadow:0 0 6px ${Math.random() > 0.5 ? ACCENT : ACCENT_2};
        transform:translate(-50%,-50%);
        animation: sparkFade 0.7s ease-out forwards;
      `;
      containerRef.current?.appendChild(el);
      setTimeout(() => el.remove(), 720);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  return <div ref={containerRef} aria-hidden />;
}

/* ---------- Card 3D Tilt Hook ---------- */
export function useCardTilt(ref: React.RefObject<HTMLDivElement | null>) {
  const [style, setStyle] = useState({ rx: 0, ry: 0, mx: 50, my: 50, active: false });

  const onMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setStyle({ rx: (0.5 - py) * 6, ry: (px - 0.5) * 8, mx: px * 100, my: py * 100, active: true });
  };

  const onLeave = () => setStyle((s) => ({ ...s, rx: 0, ry: 0, active: false }));

  return { style, onMove, onLeave };
}

/* ---------- Master Cinematic Background Container ---------- */
interface CinematicAuthBackgroundProps {
  children: React.ReactNode;
  maxWidthClass?: string;
}

export function CinematicAuthBackground({ children, maxWidthClass = 'max-w-md' }: CinematicAuthBackgroundProps) {
  const parallax = useParallax();
  const cardRef = useRef<HTMLDivElement>(null);
  const tilt = useCardTilt(cardRef);

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden px-4 py-10 selection:bg-amber-500/20" style={{ backgroundColor: '#000' }}>
      {/* Base Vignette */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 40%, #0a0a0d 0%, #000 70%)' }} />

      {/* Parallax Gradient Orbs (Far / Mid / Near) */}
      <div
        aria-hidden
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 520, height: 520, top: '-10%', left: '-8%',
          background: `radial-gradient(circle, ${ACCENT}26 0%, transparent 70%)`,
          filter: 'blur(40px)',
          transform: `translate(${-parallax.x * 20}px, ${-parallax.y * 20}px)`,
          transition: 'transform 0.4s ease-out',
        }}
      />
      <div
        aria-hidden
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 420, height: 420, bottom: '-12%', right: '-6%',
          background: `radial-gradient(circle, ${ACCENT_2}22 0%, transparent 70%)`,
          filter: 'blur(40px)',
          transform: `translate(${-parallax.x * 34}px, ${-parallax.y * 34}px)`,
          transition: 'transform 0.4s ease-out',
        }}
      />
      <div
        aria-hidden
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 300, height: 300, top: '30%', right: '15%',
          background: `radial-gradient(circle, #a78bfa20 0%, transparent 70%)`,
          filter: 'blur(30px)',
          transform: `translate(${-parallax.x * 50}px, ${-parallax.y * 50}px)`,
          transition: 'transform 0.4s ease-out',
        }}
      />

      {/* Constellation Network */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.8 }}>
        <Constellation />
      </div>

      <CursorTrail />

      {/* Tron-style Receding Grid Floor */}
      <div
        aria-hidden
        className="absolute left-0 right-0 bottom-0 pointer-events-none"
        style={{ height: '45%', perspective: '300px', overflow: 'hidden' }}
      >
        <div
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: `linear-gradient(${ACCENT}22 1px, transparent 1px), linear-gradient(90deg, ${ACCENT}22 1px, transparent 1px)`,
            backgroundSize: '44px 44px',
            transform: 'rotateX(75deg) translateY(-20%)',
            transformOrigin: 'bottom',
            maskImage: 'linear-gradient(to top, black, transparent)',
            WebkitMaskImage: 'linear-gradient(to top, black, transparent)',
            animation: 'gridMove 6s linear infinite',
          }}
        />
      </div>

      {/* Ambient Scanline */}
      <div
        aria-hidden
        className="absolute left-0 right-0 pointer-events-none"
        style={{ height: '160px', background: `linear-gradient(180deg, transparent, ${ACCENT}14, transparent)`, animation: 'scan 4s linear infinite', mixBlendMode: 'screen' }}
      />

      {/* 3D Tilt Card Container */}
      <div style={{ perspective: '1400px' }} className={`relative z-10 w-full ${maxWidthClass}`}>
        <div
          ref={cardRef}
          onMouseMove={tilt.onMove}
          onMouseLeave={tilt.onLeave}
          style={{
            transform: `rotateX(${tilt.style.rx}deg) rotateY(${tilt.style.ry}deg)`,
            transition: 'transform 0.15s ease-out',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Animated Conic-Gradient Border */}
          <div
            className="relative rounded-3xl p-[1.5px]"
            style={{
              background: `conic-gradient(from var(--angle,0deg), ${ACCENT}, ${ACCENT_2}, ${ACCENT}66, ${ACCENT_2}66, ${ACCENT})`,
              animation: 'borderSpin 5s linear infinite',
              boxShadow: `0 0 60px -12px ${ACCENT}55, 0 0 30px -8px ${ACCENT_2}33`,
            }}
          >
            <div
              className="relative rounded-3xl overflow-hidden shadow-2xl bg-[#08080a]"
            >
              {/* Cursor Spotlight inside Card */}
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                  opacity: tilt.style.active ? 1 : 0,
                  transition: 'opacity 0.3s ease',
                  background: `radial-gradient(320px circle at ${tilt.style.mx}% ${tilt.style.my}%, ${ACCENT}12, transparent 60%)`,
                }}
              />

              {/* Holographic Sheen */}
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                  opacity: tilt.style.active ? 0.5 : 0,
                  transition: 'opacity 0.3s ease',
                  background: `linear-gradient(${105 + tilt.style.ry * 3}deg, transparent 40%, ${ACCENT_2}14 48%, #ffffff10 50%, ${ACCENT}14 52%, transparent 60%)`,
                }}
              />

              {/* Form Content Slot */}
              <div className="relative z-10">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Security Footer */}
      <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500 font-mono tracking-wide z-10 pointer-events-none">
        <span className="text-amber-400">🔒</span> 256-bit SSL Encrypted · GDPR Compliant · SOC 2 Ready
      </div>

      {/* Embedded Dynamic CSS Keyframes */}
      <style>{`
        @property --angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
        @keyframes borderSpin { to { --angle: 360deg; } }
        @keyframes gridMove { from { background-position: 0 0; } to { background-position: 0 44px; } }
        @keyframes scan { 0% { top: -20%; } 100% { top: 120%; } }
        @keyframes sparkFade {
          0% { opacity: 0.9; transform: translate(-50%,-50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%,-50%) scale(0.2) translateY(10px); }
        }
        @keyframes shimmerSweep { 0% { background-position: 150% 0; } 60%,100% { background-position: -50% 0; } }
        .logo-shimmer { position: relative; }
        .logo-shimmer::after {
          content: ""; position: absolute; inset: 0;
          background: linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.55) 45%, transparent 60%);
          background-size: 200% 100%;
          -webkit-background-clip: text; background-clip: text; color: transparent;
          animation: shimmerSweep 3.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export default CinematicAuthBackground;
