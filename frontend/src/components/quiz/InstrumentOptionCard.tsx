import React from 'react';

interface InstrumentOptionCardProps {
  index: number;
  content: string;
  isSelected: boolean;
  onSelect: () => void;
}

export const InstrumentOptionCard: React.FC<InstrumentOptionCardProps> = ({
  index,
  content,
  isSelected,
  onSelect,
}) => {
  return (
    <div
      onClick={onSelect}
      className={`option flex items-center gap-4 p-4 bg-[#21252B] border rounded-[2px] cursor-pointer transition-all duration-150 relative ${
        isSelected
          ? 'selected border-[#C6A15B] bg-gradient-to-r from-[#C6A15B]/20 via-transparent to-transparent'
          : 'border-[#2B2F37] text-[#ECE8E0] hover:border-[#3A3F49] hover:-translate-y-[1px]'
      }`}
    >
      {/* 45° Diamond Rotated Marker */}
      <div
        className={`option-marker w-[26px] h-[26px] border-[1.5px] rounded-[2px] flex items-center justify-center font-mono text-xs flex-shrink-0 transition-all ${
          isSelected
            ? 'border-[#C6A15B] text-[#C6A15B] bg-[#C6A15B]/20 scale-105'
            : 'border-[#5B5F68] text-[#5B5F68]'
        }`}
      >
        <span className="transform -rotate-45">{index + 1}</span>
      </div>

      <span className="option-text text-[14.5px] text-[#ECE8E0] font-normal leading-relaxed">{content}</span>
    </div>
  );
};
