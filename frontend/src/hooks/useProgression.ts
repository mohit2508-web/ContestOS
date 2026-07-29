import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

interface Badge {
  id: string;
  name: string;
  description: string | null;
  earnedAt: string;
}

interface TrustScoreInfo {
  score: number;
  suspicionScore: number;
  logicScore: number;
  consistencyScore: number;
}

interface Stats {
  mcqSessions: number;
  codingProblemsSolved: number;
  interviewsCompleted: number;
  averageScore: number | null;
}

interface ProgressionSummary {
  xp: number;
  level: number;
  streak: number;
  xpToNext: number;
  xpProgress: number;
  badges: Badge[];
  trustScore: TrustScoreInfo | null;
  stats: Stats;
  lastActivity: string | null;
}

interface UseProgressionReturn {
  summary: ProgressionSummary | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addXp: (amount: number, category?: string) => Promise<void>;
}

const EMPTY_SUMMARY: ProgressionSummary = {
  xp: 0,
  level: 1,
  streak: 0,
  xpToNext: 1000,
  xpProgress: 0,
  badges: [],
  trustScore: null,
  stats: { mcqSessions: 0, codingProblemsSolved: 0, interviewsCompleted: 0, averageScore: null },
  lastActivity: null,
};

export function useProgression(): UseProgressionReturn {
  const [summary, setSummary] = useState<ProgressionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getProgressionSummary();
      setSummary(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load progression');
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, []);

  const addXp = useCallback(async (amount: number, category?: string) => {
    try {
      const result = await api.addXp(amount, category);
      setSummary((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          xp: result.xp,
          level: result.level,
          streak: result.streak,
          xpProgress: result.xp % 1000,
          xpToNext: 1000 - (result.xp % 1000),
        };
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { summary, loading, error, refresh, addXp };
}
