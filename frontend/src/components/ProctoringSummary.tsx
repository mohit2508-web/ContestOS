interface ProctoringViolation {
  type: string;
  timestamp: string;
}

interface Props {
  violations: ProctoringViolation[] | null;
  violationCount: number;
}

const VIOLATION_LABELS: Record<string, { label: string; emoji: string }> = {
  window_blur: { label: 'Window/Tab Switch', emoji: '⬜' },
  fullscreen_exit: { label: 'Exited Fullscreen', emoji: '🖥️' },
  devtools_open: { label: 'Developer Tools Detected', emoji: '🔧' },
  face_missing: { label: 'Face Not Visible', emoji: '👤' },
  multiple_faces: { label: 'Multiple Faces Detected', emoji: '👥' },
  phone_detected: { label: 'Phone Detected', emoji: '📱' },
  virtual_camera: { label: 'Virtual Camera Detected', emoji: '🎥' },
};

export function ProctoringSummary({ violations, violationCount }: Props) {
  if (!violations || violations.length === 0) {
    return null;
  }

  const sorted = [...violations].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const grouped = sorted.reduce<Record<string, number>>((acc, v) => {
    acc[v.type] = (acc[v.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{
      borderRadius: '20px', border: '1px solid rgba(239,68,68,0.2)', padding: '32px',
      background: 'linear-gradient(180deg, #1A1C20 0%, #08090D 100%)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2 style={{ color: '#FFF', fontFamily: 'Mona Sans, sans-serif', fontSize: '18px', fontWeight: 600 }}>
          Proctoring Summary
        </h2>
        <span style={{
          padding: '4px 12px', borderRadius: '999px',
          background: violationCount > 5 ? 'rgba(239,68,68,0.15)' : violationCount > 0 ? 'rgba(250,204,21,0.15)' : 'rgba(74,222,128,0.15)',
          border: violationCount > 5 ? '1px solid rgba(239,68,68,0.3)' : violationCount > 0 ? '1px solid rgba(250,204,21,0.3)' : '1px solid rgba(74,222,128,0.3)',
          color: violationCount > 5 ? '#f87171' : violationCount > 0 ? '#facc15' : '#4ade80',
          fontFamily: 'Mona Sans, sans-serif', fontSize: '12px', fontWeight: 700,
        }}>
          {violationCount} violation{violationCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Grouped summary */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
        {Object.entries(grouped).map(([type, count]) => {
          const info = VIOLATION_LABELS[type] || { label: type.replace(/_/g, ' '), emoji: '⚠️' };
          return (
            <div key={type} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '8px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
              fontFamily: 'Mona Sans, sans-serif', fontSize: '12px'
            }}>
              <span>{info.emoji}</span>
              <span style={{ color: '#d1d5db' }}>{info.label}</span>
              <span style={{ color: '#f87171', fontWeight: 700 }}>×{count}</span>
            </div>
          );
        })}
      </div>

      {/* Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {sorted.map((v, i) => {
          const info = VIOLATION_LABELS[v.type] || { label: v.type.replace(/_/g, ' '), emoji: '⚠️' };
          const time = new Date(v.timestamp).toLocaleTimeString('en-US', {
            minute: '2-digit', second: '2-digit'
          });
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: '12px',
              padding: '10px 0',
              borderBottom: i < sorted.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none'
            }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: '#f87171', marginTop: '5px', flexShrink: 0
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#d1d5db', fontFamily: 'Mona Sans, sans-serif', fontSize: '13px', fontWeight: 500 }}>
                    {info.emoji} {info.label}
                  </span>
                  <span style={{ color: '#6B7280', fontFamily: 'Mona Sans, sans-serif', fontSize: '11px' }}>{time}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
