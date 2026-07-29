import { useState, useEffect, useRef } from 'react';
import type { ProctoringAlert } from '../hooks/useProctoring';

interface Props {
  violationCount: number;
  latestAlert: ProctoringAlert | null;
  faceDetectionActive?: boolean;
}

export function ProctoringIndicator({ violationCount, latestAlert, faceDetectionActive = false }: Props) {
  const [visibleAlert, setVisibleAlert] = useState<ProctoringAlert | null>(null);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (latestAlert) {
      setVisibleAlert(latestAlert);
      if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
      alertTimerRef.current = setTimeout(() => setVisibleAlert(null), 5000);
    }
  }, [latestAlert]);

  useEffect(() => {
    return () => {
      if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    };
  }, []);

  const severityColor = violationCount === 0 ? '#4ADE80' : violationCount <= 3 ? '#facc15' : '#f87171';
  const severityLabel = violationCount === 0 ? 'No violations' : violationCount <= 3 ? `${violationCount} violation${violationCount > 1 ? 's' : ''}` : `${violationCount} violations`;

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px',
        borderRadius: '999px',
        background: violationCount === 0 ? 'rgba(74,222,128,0.08)' : violationCount <= 3 ? 'rgba(250,204,21,0.08)' : 'rgba(239,68,68,0.08)',
        border: violationCount === 0 ? '1px solid rgba(74,222,128,0.15)' : violationCount <= 3 ? '1px solid rgba(250,204,21,0.15)' : '1px solid rgba(239,68,68,0.15)',
        fontFamily: 'Mona Sans, sans-serif', fontSize: '10px', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.1em',
        color: severityColor,
      }}>
        <div style={{
          width: '6px', height: '6px', borderRadius: '50%', background: severityColor,
          animation: violationCount === 0 ? 'pulse 2s infinite' : 'none',
        }} />
        <span>{severityLabel}</span>
        {!faceDetectionActive && violationCount > 0 && (
          <span style={{ opacity: 0.7 }}>(no camera)</span>
        )}
      </div>

      {visibleAlert && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
          padding: '12px 20px', borderRadius: '12px',
          background: visibleAlert.severity === 'flag' ? 'rgba(239,68,68,0.15)' : visibleAlert.severity === 'warning' ? 'rgba(250,204,21,0.15)' : 'rgba(96,165,250,0.15)',
          border: visibleAlert.severity === 'flag' ? '1px solid rgba(239,68,68,0.3)' : visibleAlert.severity === 'warning' ? '1px solid rgba(250,204,21,0.3)' : '1px solid rgba(96,165,250,0.3)',
          fontFamily: 'Mona Sans, sans-serif', fontSize: '13px', color: '#FFF',
          backdropFilter: 'blur(8px)',
          maxWidth: '360px',
          animation: 'slideIn 0.3s ease-out',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              padding: '2px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
              background: visibleAlert.severity === 'flag' ? 'rgba(239,68,68,0.3)' : visibleAlert.severity === 'warning' ? 'rgba(250,204,21,0.3)' : 'rgba(96,165,250,0.3)',
              color: visibleAlert.severity === 'flag' ? '#f87171' : visibleAlert.severity === 'warning' ? '#facc15' : '#93c5fd',
            }}>
              {visibleAlert.severity}
            </span>
            <span style={{ color: '#8E96AC', fontSize: '10px' }}>
              {new Date(visibleAlert.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <p style={{ color: '#d1d5db', fontSize: '13px', lineHeight: '1.4' }}>{visibleAlert.message}</p>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}
