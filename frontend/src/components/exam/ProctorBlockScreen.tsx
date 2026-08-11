import { useEffect, useRef } from 'react';
import { Shield, AlertCircle, Clock, User } from 'lucide-react';

interface Props {
  isBlocked: boolean;
  blockReason?: string;
  proctorName?: string;
  contestTitle?: string;
}

export function ProctorBlockScreen({ isBlocked, blockReason, proctorName, contestTitle }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Animated particle background
  useEffect(() => {
    if (!isBlocked) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number }[] = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 3 + 1,
        opacity: Math.random() * 0.4 + 0.1,
      });
    }

    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(239, 68, 68, ${p.opacity})`;
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isBlocked]);

  if (!isBlocked) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0505 50%, #0a0a0a 100%)',
        userSelect: 'none',
        pointerEvents: 'all',
      }}
    >
      {/* Animated particle canvas */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, opacity: 0.6 }}
      />

      {/* Pulsing red ring */}
      <div
        style={{
          position: 'absolute',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          animation: 'pulse-ring 3s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          border: '1px solid rgba(239, 68, 68, 0.15)',
          animation: 'pulse-ring 3s ease-in-out infinite 1s',
        }}
      />

      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.05); opacity: 0.4; }
          100% { transform: scale(1); opacity: 0.8; }
        }
        @keyframes icon-pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink-bar {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      {/* Main card */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          padding: '48px 56px',
          background: 'rgba(20, 5, 5, 0.9)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '24px',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 0 80px rgba(239, 68, 68, 0.15), 0 32px 64px rgba(0,0,0,0.6)',
          maxWidth: '520px',
          width: '90%',
          animation: 'fade-in 0.4s ease-out',
          textAlign: 'center',
        }}
      >
        {/* Shield icon */}
        <div
          style={{
            width: '96px',
            height: '96px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '2px solid rgba(239, 68, 68, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'icon-pulse 2s ease-in-out infinite',
          }}
        >
          <Shield size={48} color="#ef4444" strokeWidth={1.5} />
        </div>

        {/* Title */}
        <div>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: '700',
              color: '#ffffff',
              margin: '0 0 8px 0',
              letterSpacing: '-0.5px',
            }}
          >
            ⛔ Exam Paused
          </h1>
          <p
            style={{
              fontSize: '15px',
              color: 'rgba(239, 68, 68, 0.9)',
              margin: 0,
              fontWeight: '500',
            }}
          >
            Action taken by the Invigilator
          </p>
        </div>

        {/* Reason box */}
        <div
          style={{
            width: '100%',
            padding: '16px 20px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '12px',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
          }}
        >
          <AlertCircle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
          <p
            style={{
              color: 'rgba(255, 255, 255, 0.85)',
              fontSize: '14px',
              lineHeight: '1.6',
              margin: 0,
              textAlign: 'left',
            }}
          >
            {blockReason || 'Your exam has been paused by the invigilator. Please remain at your workstation and do not close this window.'}
          </p>
        </div>

        {/* Proctor info */}
        {proctorName && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '13px',
            }}
          >
            <User size={14} />
            <span>Action by: <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{proctorName}</strong></span>
          </div>
        )}

        {/* Waiting indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 24px',
            background: 'rgba(255, 255, 255, 0.04)',
            borderRadius: '100px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Clock size={16} color="rgba(255,255,255,0.5)" />
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
            Waiting for invigilator to resume your session...
          </span>
          <span
            style={{
              display: 'inline-flex',
              gap: '3px',
              alignItems: 'center',
            }}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.7)',
                  animation: `blink-bar 1.2s ease-in-out infinite ${i * 0.2}s`,
                }}
              />
            ))}
          </span>
        </div>

        {/* Contest name */}
        {contestTitle && (
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', margin: 0 }}>
            {contestTitle}
          </p>
        )}

        {/* Red scanning line decoration */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #ef4444, transparent)',
            borderRadius: '0 0 24px 24px',
            animation: 'blink-bar 2s ease-in-out infinite',
          }}
        />
      </div>

      {/* Bottom warning */}
      <p
        style={{
          position: 'relative',
          zIndex: 10,
          marginTop: '24px',
          color: 'rgba(255,255,255,0.25)',
          fontSize: '12px',
          letterSpacing: '0.5px',
        }}
      >
        Do not close this browser window • Your timer is frozen
      </p>
    </div>
  );
}
