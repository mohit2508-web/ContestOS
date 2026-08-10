import { useRef, useEffect, useCallback, useState } from 'react';
import { useIceBreak, CrackEvent, DetachEvent } from './useIceBreak';
import { drawCellPath, Cell } from './lib/shatter';
import { createWorld, addShard, step, removeExitedShards, destroy, PhysicsWorld } from './lib/physicsWorld';

interface Props {
  onComplete: () => void;
  onFading?: () => void;
}

const ICE_OPACITY = 0.92;
const CRACK_DRAW_MS = 150;
const SHARD_RENDER_SIZE = 1;

function drawFrostTexture(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = `rgba(180, 210, 230, ${ICE_OPACITY})`;
  ctx.fillRect(0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 18;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise + 5));
  }
  ctx.putImageData(imgData, 0, 0);

  ctx.strokeStyle = 'rgba(200, 230, 255, 0.15)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const len = Math.random() * 40 + 10;
    const angle = Math.random() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();

    const branchAngle = angle + (Math.random() - 0.5) * 1.2;
    const branchLen = len * 0.4;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * len * 0.6, y + Math.sin(angle) * len * 0.6);
    ctx.lineTo(
      x + Math.cos(angle) * len * 0.6 + Math.cos(branchAngle) * branchLen,
      y + Math.sin(angle) * len * 0.6 + Math.sin(branchAngle) * branchLen,
    );
    ctx.stroke();
  }
}

export default function IceBreakOverlay({ onComplete, onFading }: Props) {
  const iceCanvasRef = useRef<HTMLCanvasElement>(null);
  const debrisCanvasRef = useRef<HTMLCanvasElement>(null);
  const crackCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const physicsRef = useRef<PhysicsWorld | null>(null);
  const animRef = useRef<number>(0);
  const crackAnimsRef = useRef<{ x: number; y: number; cells: Cell[]; start: number }[]>([]);
  const [fading, setFading] = useState(false);
  const [hidden, setHidden] = useState(false);

  const width = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const height = typeof window !== 'undefined' ? window.innerHeight : 800;

  const handleCrack = useCallback((event: CrackEvent) => {
    crackAnimsRef.current.push({
      x: event.x,
      y: event.y,
      cells: event.cells,
      start: performance.now(),
    });
  }, []);

  const handleDetach = useCallback((event: DetachEvent) => {
    const iceCtx = iceCanvasRef.current?.getContext('2d');
    if (!iceCtx) return;

    if (!physicsRef.current) {
      physicsRef.current = createWorld(width, height);
    }
    const physics = physicsRef.current;

    for (const cell of event.cells) {
      drawCellPath(iceCtx, cell.polygon);
      iceCtx.globalCompositeOperation = 'destination-out';
      iceCtx.fillStyle = 'rgba(0,0,0,1)';
      iceCtx.fill();
      iceCtx.globalCompositeOperation = 'source-over';

      addShard(physics, cell, event.impulseX, event.impulseY);
    }
  }, [width, height]);

  const handleReveal = useCallback(() => {}, []);

  const handleComplete = useCallback(() => {
    setFading(true);
    onFading?.();
    setTimeout(() => {
      setHidden(true);
      onComplete();
    }, 1400);
  }, [onComplete, onFading]);

  const { handleClick, forceComplete } = useIceBreak({
    width,
    height,
    onCrack: handleCrack,
    onDetach: handleDetach,
    onReveal: handleReveal,
    onComplete: handleComplete,
  });

  useEffect(() => {
    const iceCanvas = iceCanvasRef.current;
    const debrisCanvas = debrisCanvasRef.current;
    const crackCanvas = crackCanvasRef.current;
    if (!iceCanvas || !debrisCanvas || !crackCanvas) return;

    const iceCtx = iceCanvas.getContext('2d');
    const debrisCtx = debrisCanvas.getContext('2d');
    const crackCtx = crackCanvas.getContext('2d');
    if (!iceCtx || !debrisCtx || !crackCtx) return;

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      [iceCanvas, debrisCanvas, crackCanvas].forEach(c => {
        c.width = w;
        c.height = h;
      });
      drawFrostTexture(iceCtx, w, h);
    };

    resize();
    window.addEventListener('resize', resize);

    const animate = (time: number) => {
      debrisCtx.clearRect(0, 0, debrisCanvas.width, debrisCanvas.height);
      crackCtx.clearRect(0, 0, crackCanvas.width, crackCanvas.height);

      if (physicsRef.current) {
        step(physicsRef.current);
        removeExitedShards(physicsRef.current, height);

        for (const [body, data] of physicsRef.current.shards) {
          const { x, y } = body.position;
          const angle = body.angle;
          const poly = data.cell.polygon;
          const cx = data.cell.center[0];
          const cy = data.cell.center[1];

          debrisCtx.save();
          debrisCtx.translate(x, y);
          debrisCtx.rotate(angle);
          debrisCtx.globalAlpha = Math.max(0.1, 0.6 - (y / height) * 0.3);

          drawCellPath(debrisCtx, poly.map(([px, py]) => [px - cx, py - cy]));
          debrisCtx.fillStyle = `rgba(170, 210, 240, 0.7)`;
          debrisCtx.fill();
          debrisCtx.strokeStyle = `rgba(200, 230, 255, 0.5)`;
          debrisCtx.lineWidth = 1;
          debrisCtx.stroke();

          debrisCtx.restore();
        }
      }

      const now = time;
      crackAnimsRef.current = crackAnimsRef.current.filter(anim => {
        const elapsed = now - anim.start;
        const progress = Math.min(1, elapsed / CRACK_DRAW_MS);
        const easedProgress = 1 - Math.pow(1 - progress, 3);

        crackCtx.save();
        crackCtx.globalAlpha = 1 - easedProgress * 0.5;
        crackCtx.strokeStyle = `rgba(200, 240, 255, ${0.8 - easedProgress * 0.4})`;
        crackCtx.lineWidth = 1.5 - easedProgress;
        crackCtx.shadowColor = 'rgba(150, 220, 255, 0.6)';
        crackCtx.shadowBlur = 6;

        for (const cell of anim.cells) {
          const visiblePts = Math.ceil(cell.polygon.length * easedProgress);
          if (visiblePts < 2) continue;

          crackCtx.beginPath();
          crackCtx.moveTo(cell.polygon[0][0], cell.polygon[0][1]);
          for (let i = 1; i < visiblePts; i++) {
            crackCtx.lineTo(cell.polygon[i][0], cell.polygon[i][1]);
          }
          crackCtx.stroke();
        }

        crackCtx.restore();
        return progress < 1;
      });

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
      if (physicsRef.current) destroy(physicsRef.current);
    };
  }, [width, height]);

  if (hidden) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50"
      style={{ cursor: fading ? 'default' : 'crosshair' }}
    >
      <canvas ref={debrisCanvasRef} className="absolute inset-0 z-10" style={{ pointerEvents: 'none' }} />
      <canvas ref={crackCanvasRef} className="absolute inset-0 z-20" style={{ pointerEvents: 'none' }} />
      <canvas
        ref={iceCanvasRef}
        className="absolute inset-0 z-30"
        onClick={handleClick}
        style={{
          opacity: fading ? 0 : 1,
          transition: 'opacity 1.2s ease-out',
          pointerEvents: fading ? 'none' : 'auto',
        }}
      />

      {!fading && (
        <>
          {/* Center CTA */}
          <div className="fixed inset-0 z-[45] flex flex-col items-center justify-center pointer-events-none select-none">
            <div className="relative">
              {/* Pulsing ring behind icon */}
              <div className="absolute inset-0 -m-8 rounded-full border border-white/10 animate-[pingRing_3s_ease-in-out_infinite]" />
              <div className="absolute inset-0 -m-14 rounded-full border border-white/5 animate-[pingRing_3s_ease-in-out_infinite_0.5s]" />

              {/* Lightning icon */}
              <div className="w-16 h-16 rounded-2xl bg-white/[0.06] backdrop-blur-sm border border-white/10 flex items-center justify-center text-3xl mb-6 mx-auto animate-[floatSoft_3s_ease-in-out_infinite]">
                ⚡
              </div>
            </div>

            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white/90 mb-3 text-center">
              Break the Ice
            </h2>
            <p className="text-sm text-white/30 font-mono tracking-widest uppercase mb-2 text-center">
              Click anywhere to shatter
            </p>

            {/* Animated expanding rings */}
            <div className="relative mt-4">
              <div className="w-12 h-12 rounded-full border border-white/10 animate-[rippleExpand_2.5s_ease-out_infinite]" />
              <div className="absolute inset-0 w-12 h-12 rounded-full border border-white/10 animate-[rippleExpand_2.5s_ease-out_infinite_0.8s]" />
            </div>
          </div>

          {/* Bottom-left brand mark */}
          <div className="fixed bottom-8 left-8 z-[60] flex items-center gap-3 opacity-40">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-black font-black text-xs">⚡</div>
            <span className="font-bold text-white/70 text-sm tracking-tight">Kryptavia OS</span>
          </div>

          {/* Skip button */}
          <button
            onClick={(e) => { e.stopPropagation(); forceComplete(); }}
            className="fixed bottom-8 right-8 z-[60] px-5 py-2.5 bg-white/[0.06] hover:bg-white/[0.12] backdrop-blur-md rounded-full border border-white/10 text-xs text-white/40 hover:text-white/80 transition-all duration-300 font-mono tracking-wider"
          >
            Skip intro →
          </button>
        </>
      )}

      <style>{`
        @keyframes pingRing {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.15); opacity: 0.08; }
        }
        @keyframes rippleExpand {
          0% { transform: scale(0.8); opacity: 0.5; }
          100% { transform: scale(3); opacity: 0; }
        }
        @keyframes floatSoft {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
