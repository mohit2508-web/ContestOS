import { Router, Request, Response } from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import { cacheWithFallback } from "../lib/cacheUtils";

const router = Router();

// ─────────────────────────────────────────────────────────────
// GET /api/contests/upcoming - Get upcoming contests
// ─────────────────────────────────────────────────────────────
router.get("/upcoming", async (req: Request, res: Response) => {
    try {
        const result = await cacheWithFallback('contests:upcoming', async () => {
            const contests: any[] = [];

            try { const lc = await scrapeLeetCodeContests(); contests.push(...lc); } catch (e) { console.error("LeetCode contests error:", e); }
            try { const cf = await scrapeCodeforcesContests(); contests.push(...cf); } catch (e) { console.error("Codeforces contests error:", e); }
            try { const cc = await scrapeCodeChefContests(); contests.push(...cc); } catch (e) { console.error("CodeChef contests error:", e); }

            contests.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

            const now = new Date();
            const upcoming = contests.filter(c => new Date(c.startTime) > now);

            return { contests: upcoming.slice(0, 20) };
        }, 300);

        res.json(result);
    } catch (error: unknown) {
        console.error("Get upcoming contests error:", error);
        const message = error instanceof Error ? error.message : 'Failed to fetch contests';
        res.status(500).json({ error: message });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /api/contests/all - Get all contests (upcoming + past)
// ─────────────────────────────────────────────────────────────
router.get("/all", async (req: Request, res: Response) => {
    try {
        const result = await cacheWithFallback('contests:all', async () => {
            const contests: any[] = [];

            try { const lc = await scrapeLeetCodeContests(); contests.push(...lc); } catch (e) { console.error("LeetCode contests error:", e); }
            try { const cf = await scrapeCodeforcesContests(); contests.push(...cf); } catch (e) { console.error("Codeforces contests error:", e); }
            try { const cc = await scrapeCodeChefContests(); contests.push(...cc); } catch (e) { console.error("CodeChef contests error:", e); }

            contests.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

            return { contests: contests.slice(0, 50) };
        }, 300);

        res.json(result);
    } catch (error: unknown) {
        console.error("Get all contests error:", error);
        const message = error instanceof Error ? error.message : 'Failed to fetch contests';
        res.status(500).json({ error: message });
    }
});

// ─────────────────────────────────────────────────────────────
// Scraping Functions
// ─────────────────────────────────────────────────────────────
async function scrapeLeetCodeContests() {
    const contests: any[] = [];
    
    try {
        // Use LeetCode's GraphQL API
        const response = await axios.post('https://leetcode.com/graphql', {
            query: `
                query contestList {
                    brightTitle
                    allContests {
                        title
                        titleSlug
                        startTime
                        duration
                    }
                }
            `
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Referer': 'https://leetcode.com/contest/',
                'Origin': 'https://leetcode.com'
            }
        });

        if (response.data?.data?.allContests) {
            for (const contest of response.data.data.allContests) {
                const startTime = new Date(contest.startTime * 1000);
                const durationMs = contest.duration * 1000; // duration is in seconds from API
                
                contests.push({
                    platform: 'leetcode',
                    name: contest.title,
                    description: contest.description || 'LeetCode Contest',
                    startTime: startTime.toISOString(),
                    endTime: new Date(startTime.getTime() + durationMs).toISOString(),
                    url: `https://leetcode.com/contest/${contest.title.toLowerCase().replace(/\s+/g, '-')}`,
                    duration: contest.duration
                });
            }
        }
    } catch (error) {
        console.error('LeetCode contest scraping error:', error);
    }

    return contests;
}

async function scrapeCodeforcesContests() {
    const contests: any[] = [];
    
    try {
        const response = await axios.get('https://codeforces.com/api/contest.list?gym=false', {
            timeout: 15000
        });

        if (response.data?.status === 'OK') {
            const now = Date.now() / 1000;
            const upcoming = response.data.result.filter(
                (c: any) => c.phase === 'BEFORE' && c.startTimeSeconds > now
            );

            for (const contest of upcoming) {
                const startTime = new Date(contest.startTimeSeconds * 1000);
                const durationMs = (contest.durationSeconds || 7200) * 1000;

                contests.push({
                    platform: 'codeforces',
                    name: contest.name,
                    description: 'Codeforces Contest',
                    startTime: startTime.toISOString(),
                    endTime: new Date(startTime.getTime() + durationMs).toISOString(),
                    url: `https://codeforces.com/contest/${contest.id}`,
                    duration: Math.round((contest.durationSeconds || 7200) / 60)
                });
            }
        }
    } catch (error) {
        console.error('Codeforces API error:', (error as Error).message);
    }

    return contests;
}

async function scrapeCodeChefContests() {
    const contests: any[] = [];
    
    try {
        const response = await axios.get('https://www.codechef.com/contests', {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });

        const $ = cheerio.load(response.data);
        
        // CodeChef has different contest lists
        $('table').each((tableIdx, table) => {
            $(table).find('tr').each((i, el) => {
                if (i === 0) return; // Skip header
                
                const cells = $(el).find('td');
                if (cells.length < 4) return;

                const name = $(cells[0]).text().trim();
                const startTimeText = $(cells[1]).text().trim();
                const endTimeText = $(cells[2]).text().trim();
                const status = $(cells[3]).text().trim().toLowerCase();
                
                if (name && startTimeText) {
                    const startTime = new Date(startTimeText);
                    const endTime = new Date(endTimeText || startTimeText);
                    
                    // Only include upcoming contests
                    if (status === 'future' || status === 'Upcoming'.toLowerCase()) {
                        contests.push({
                            platform: 'codechef',
                            name: name,
                            description: 'CodeChef Contest',
                            startTime: startTime.toISOString(),
                            endTime: endTime.toISOString(),
                            url: `https://www.codechef.com/${name}`,
                            duration: Math.round((endTime.getTime() - startTime.getTime()) / 60000)
                        });
                    }
                }
            });
        });
    } catch (error) {
        console.error('CodeChef contest scraping error:', error);
    }

    return contests;
}

export default router;
