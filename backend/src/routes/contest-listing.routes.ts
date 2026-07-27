import { Router, Request, Response } from 'express';
import axios from 'axios';
import prisma from '../lib/prisma';
import { cacheWithFallback } from '../lib/cacheUtils';

const router = Router();

interface MergedContest {
  id: string;
  name: string;
  platform: string;
  startTime: string;
  duration: number;
  url: string | null;
  status: 'upcoming' | 'ongoing' | 'past';
  phase?: string;
  source: 'codeforces' | 'internal';
}

async function fetchCodeforcesUpcoming(): Promise<MergedContest[]> {
  try {
    const response = await axios.get('https://codeforces.com/api/contest.list', {
      timeout: 10000,
    });
    if (response.data.status !== 'OK') return [];

    const now = Math.floor(Date.now() / 1000);
    return (response.data.result || [])
      .filter((c: any) => c.phase === 1)
      .slice(0, 20)
      .map((c: any) => {
        const startTimeSec = c.startTimeSeconds;
        const durationSec = c.durationSeconds;
        const start = new Date(startTimeSec * 1000);
        const end = new Date((startTimeSec + durationSec) * 1000);
        const nowMs = Date.now();

        let status: 'upcoming' | 'ongoing' | 'past' = 'upcoming';
        if (nowMs > end.getTime()) status = 'past';
        else if (nowMs >= start.getTime()) status = 'ongoing';

        return {
          id: `cf-${c.id}`,
          name: c.name,
          platform: 'codeforces',
          startTime: start.toISOString(),
          duration: Math.round(durationSec / 60),
          url: `https://codeforces.com/contest/${c.id}`,
          status,
          phase: 'before',
          source: 'codeforces' as const,
        };
      });
  } catch (error) {
    console.error('Codeforces API error:', error);
    return [];
  }
}

async function fetchInternalUpcoming(): Promise<MergedContest[]> {
  try {
    const contests = await prisma.contest.findMany({
      where: {
        startTime: { gte: new Date() },
      },
      orderBy: { startTime: 'asc' },
      take: 20,
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        duration: true,
      },
    });

    return contests.map((c) => ({
      id: c.id,
      name: c.title,
      platform: 'internal',
      startTime: c.startTime.toISOString(),
      duration: c.duration,
      url: null,
      status: 'upcoming' as const,
      source: 'internal' as const,
    }));
  } catch (error) {
    console.error('Internal contests query error:', error);
    return [];
  }
}

router.get('/upcoming', async (_req: Request, res: Response) => {
  try {
    const result = await cacheWithFallback(
      'contest-listing:upcoming',
      async () => {
        const [codeforces, internal] = await Promise.all([
          fetchCodeforcesUpcoming(),
          fetchInternalUpcoming(),
        ]);

        const merged = [...codeforces, ...internal].sort(
          (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );

        return { contests: merged };
      },
      3600 // 1 hour TTL
    );

    res.json(result);
  } catch (error) {
    console.error('Contest listing error:', error);
    res.json({ contests: [] });
  }
});

export default router;
