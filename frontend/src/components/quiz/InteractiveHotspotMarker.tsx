import React, { useState } from 'react';

export interface HotspotRegion {
  id: string;
  label: string;
  xPct: number; // 0 to 100
  yPct: number; // 0 to 100
}

interface InteractiveHotspotMarkerProps {
  imageUrl?: string | null;
  regions: HotspotRegion[];
  selectedHotspotIds: string[];
  onToggleHotspot: (id: string) => void;
}

export const InteractiveHotspotMarker: React.FC<InteractiveHotspotMarkerProps> = ({
  imageUrl,
  regions,
  selectedHotspotIds,
  onToggleHotspot,
}) => {
  const [zoom, setZoom] = useState(1);

  return (
    <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
        <span className="text-xs uppercase font-extrabold text-teal-400 tracking-wider flex items-center space-x-2">
          <span>🎯 Image Hotspot Inspection</span>
        </span>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setZoom((z) => (z === 1 ? 1.5 : 1))}
            className="px-2.5 py-1 bg-[#1e293b] text-slate-300 rounded text-xs font-bold border border-[#334155]"
          >
            🔍 {zoom === 1.5 ? 'Zoom 150%' : 'Zoom 100%'}
          </button>
        </div>
      </div>

      {/* Visual Hotspot Overlay Image */}
      {imageUrl && (
        <div className="relative overflow-hidden rounded-xl border border-[#1e293b] bg-[#080c14] flex justify-center">
          <div className="relative inline-block" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
            <img src={imageUrl} alt="Inspection Hotspot Diagram" className="max-h-72 object-contain block" />
            {regions.map((reg) => {
              const isSelected = selectedHotspotIds.includes(reg.id);
              return (
                <button
                  key={reg.id}
                  type="button"
                  onClick={() => onToggleHotspot(reg.id)}
                  style={{ left: `${reg.xPct}%`, top: `${reg.yPct}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full font-extrabold text-xs flex items-center justify-center transition-all shadow-lg ${
                    isSelected
                      ? 'bg-teal-400 text-black border-2 border-white scale-125 animate-pulse'
                      : 'bg-rose-500/80 text-white border border-white hover:scale-110'
                  }`}
                  aria-label={`Hotspot Region: ${reg.label}`}
                >
                  🎯
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Accessible Text Fallback Region Selector */}
      <div className="space-y-2 pt-2 border-t border-[#1e293b]">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
          Accessible Region List (Keyboard / Screen-Reader Fallback)
        </span>
        <div className="grid grid-cols-2 gap-2">
          {regions.map((reg) => {
            const isSelected = selectedHotspotIds.includes(reg.id);
            return (
              <button
                key={reg.id}
                type="button"
                onClick={() => onToggleHotspot(reg.id)}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                  isSelected
                    ? 'bg-teal-500/10 border-teal-400 text-teal-200'
                    : 'bg-[#080c14] border-[#1e293b] text-slate-400 hover:text-white'
                }`}
              >
                <span>{reg.label}</span>
                {isSelected && <span className="font-bold text-teal-400">✓ Selected</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
