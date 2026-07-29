import { useState, useCallback, useEffect, useRef } from 'react';

const HEARTS_KEY = 'gamification:hearts';
const MAX_HEARTS = 5;
const REGEN_INTERVAL_MS = 30 * 60 * 1000;

interface HeartsState {
  current: number;
  lastRegenAt: number;
}

function loadHearts(): HeartsState {
  try {
    const raw = localStorage.getItem(HEARTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) { console.error('Operation failed:', err); }
  return { current: MAX_HEARTS, lastRegenAt: Date.now() };
}

function saveHearts(state: HeartsState) {
  localStorage.setItem(HEARTS_KEY, JSON.stringify(state));
}

export function useHearts() {
  const [state, setState] = useState<HeartsState>(loadHearts);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const regen = useCallback(() => {
    setState(prev => {
      const elapsed = Date.now() - prev.lastRegenAt;
      const regened = Math.floor(elapsed / REGEN_INTERVAL_MS);
      if (regened <= 0) return prev;
      const newCurrent = Math.min(prev.current + regened, MAX_HEARTS);
      const newLastRegen = prev.lastRegenAt + regened * REGEN_INTERVAL_MS;
      const next: HeartsState = { current: newCurrent, lastRegenAt: newLastRegen };
      saveHearts(next);
      return next;
    });
  }, []);

  useEffect(() => {
    regen();
    timerRef.current = setInterval(regen, 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [regen]);

  const useHeart = useCallback(() => {
    setState(prev => {
      if (prev.current <= 0) return prev;
      const next: HeartsState = { current: prev.current - 1, lastRegenAt: prev.lastRegenAt };
      saveHearts(next);
      return next;
    });
  }, []);

  const refillHearts = useCallback(() => {
    const next: HeartsState = { current: MAX_HEARTS, lastRegenAt: Date.now() };
    saveHearts(next);
    setState(next);
  }, []);

  const nextHeartIn = Math.max(0, REGEN_INTERVAL_MS - (Date.now() - state.lastRegenAt));
  const nextHeartMinutes = Math.ceil(nextHeartIn / 60_000);

  return {
    hearts: state.current,
    maxHearts: MAX_HEARTS,
    useHeart,
    refillHearts,
    isFull: state.current >= MAX_HEARTS,
    nextHeartMinutes,
  };
}
