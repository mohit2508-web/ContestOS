import React from 'react';

interface InstrumentPassagePanelProps {
  title?: string | null;
  content: string;
}

export const InstrumentPassagePanel: React.FC<InstrumentPassagePanelProps> = ({ title, content }) => {
  const paragraphs = content.split('\n\n').filter(Boolean);

  return (
    <div className="bracket-panel active flex flex-col justify-between h-full">
      <span className="bl" />
      <span className="br" />

      <div>
        <div className="eyebrow flex items-center gap-1.5 font-mono text-[10px] tracking-[1.5px] text-[#C6A15B] uppercase mb-1">
          <span>Reading Gravity</span>
        </div>
        <div className="eyebrow-sub font-mono text-[10px] text-[#5B5F68] uppercase tracking-wider mb-4">
          POSITION-AWARE FOCUS · REF. SET A–C
        </div>

        <div className="passage-text text-[15px] leading-[1.75] text-[#ECE8E0] space-y-3">
          {paragraphs.map((p, idx) => (
            <p key={idx} className={idx === 0 ? 'lead border-l-2 border-[#8A7343] pl-3 text-[#ECE8E0]' : ''}>
              {p}
            </p>
          ))}
        </div>
      </div>

      {/* Schematic Set Containment Diagram Ref. 01 */}
      <div className="schematic mt-5 pt-4 border-t border-dashed border-[#2B2F37]">
        <div className="schematic-label font-mono text-[9px] tracking-[1.5px] text-[#5B5F68] uppercase mb-2">
          Set Containment — Schematic Ref. 01
        </div>
        <svg viewBox="0 0 220 140" className="w-full h-auto overflow-visible">
          <circle className="fill-none stroke-[#3A3F49] stroke-[1]" cx="110" cy="70" r="60" />
          <circle className="fill-none stroke-[#8A7343] stroke-[1]" cx="95" cy="75" r="38" />
          <circle className="fill-none stroke-[#C6A15B] stroke-[1]" cx="82" cy="80" r="18" />
          <line className="stroke-[#5B5F68] stroke-[0.6]" x1="110" y1="10" x2="110" y2="2" />
          <line className="stroke-[#5B5F68] stroke-[0.6]" x1="20" y1="70" x2="12" y2="70" />
          <text className="font-mono text-[9px] tracking-[0.5px]" x="158" y="24" fill="#5B5F68">LAZZIES</text>
          <text className="font-mono text-[9px] tracking-[0.5px]" x="120" y="42" fill="#8A7343">RAZZIES</text>
          <text className="font-mono text-[9px] tracking-[0.5px]" x="70" y="80" fill="#C6A15B">BLOOPS</text>
        </svg>
      </div>
    </div>
  );
};
