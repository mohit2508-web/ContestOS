import { useState, useCallback, useEffect } from 'react';
import { api } from '../services/api';

const QUESTS_KEY = 'gamification:daily-quests';

interface Quest {
  id: string;
  label: string;
  description: string;
  icon: string;
  xpReward: number;
  completed: boolean;
  target: number;
  progress: number;
}

const DEFAULT_QUESTS: Omit<Quest, 'completed' | 'progress'>[] = [
  { id: 'mcq', label: 'MCQ Sprint', description: 'Complete 5 MCQ questions', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', xpReward: 50, target: 5 },
  { id: 'coding', label: 'Code Crusher', description: 'Solve 3 coding problems', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4', xpReward: 100, target: 3 },
  { id: 'interview', label: 'Interview Prep', description: 'Complete 1 mock interview', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', xpReward: 150, target: 1 },
  { id: 'streak', label: 'Daily Streak', description: 'Log in and practice today', icon: 'M13 10V3L4 14h7v7l9-11h-7z', xpReward: 25, target: 1 },
];

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

interface QuestsData {
  date: string;
  quests: Quest[];
}

function loadQuests(): Quest[] {
  try {
    const raw = localStorage.getItem(QUESTS_KEY);
    if (raw) {
      const data: QuestsData = JSON.parse(raw);
      if (data.date === getTodayKey()) return data.quests;
    }
  } catch (err) { console.error('Operation failed:', err); }
  return DEFAULT_QUESTS.map(q => ({ ...q, completed: false, progress: 0 }));
}

function saveQuests(quests: Quest[]) {
  const data: QuestsData = { date: getTodayKey(), quests };
  localStorage.setItem(QUESTS_KEY, JSON.stringify(data));
}

export function useDailyQuests() {
  const [quests, setQuests] = useState<Quest[]>(loadQuests);

  useEffect(() => {
    saveQuests(quests);
  }, [quests]);

  const claimReward = useCallback(async (questId: string) => {
    const quest = quests.find(q => q.id === questId);
    if (!quest || quest.completed) return;

    try {
      await api.addXp(quest.xpReward, 'quest');
      setQuests(prev => {
        const next = prev.map(q => q.id === questId ? { ...q, completed: true } : q);
        saveQuests(next);
        return next;
      });
    } catch (err) { console.error('Operation failed:', err); }
  }, [quests]);

  const updateProgress = useCallback((questId: string, progress: number) => {
    setQuests(prev => {
      const quest = prev.find(q => q.id === questId);
      if (!quest || quest.completed) return prev;
      const newProgress = Math.min(progress, quest.target);
      const next = prev.map(q => q.id === questId ? { ...q, progress: newProgress } : q);
      saveQuests(next);
      return next;
    });
  }, []);

  const completedCount = quests.filter(q => q.completed).length;
  const totalCount = quests.length;
  const allCompleted = completedCount >= totalCount;

  return { quests, claimReward, updateProgress, completedCount, totalCount, allCompleted };
}
