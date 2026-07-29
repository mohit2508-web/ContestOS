import React, { useState, useCallback } from 'react';

interface UseGlassShatterProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onComplete: () => void;
}

export function useGlassShatter({ onComplete }: UseGlassShatterProps) {
  const [isShattering, setIsShattering] = useState(false);

  const shatter = useCallback((_clientX?: number, _clientY?: number) => {
    setIsShattering(true);
    setTimeout(() => {
      setIsShattering(false);
      onComplete();
    }, 150);
  }, [onComplete]);

  const ShatterCanvas = useCallback(() => <div style={{ display: 'none' }} />, []);

  return {
    shatter,
    ShatterCanvas,
    isShattering,
  };
}
