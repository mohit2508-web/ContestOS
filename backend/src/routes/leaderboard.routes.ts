import { Router, Request, Response } from "express";
import { authenticateToken } from "../middlewares/auth";
import prisma from "../lib/prisma";
import { TRUST_SCORE_WEIGHTS as WEIGHTS } from "../config/scoring";
import { cacheWithFallback } from "../lib/cacheUtils";

const router = Router();

// ─────────────────────────────────────────────────────────────
// GET /api/leaderboard/global - Global leaderboard
// ─────────────────────────────────────────────────────────────
router.get("/global", async (req: Request, res: Response) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
        const skip = (page - 1) * limit;

        const result = await cacheWithFallback(`leaderboard:global:${page}:${limit}`, async () => {
            const students = await prisma.user.findMany({
                where: {
                    role: { name: 'student' },
                    isActive: true,
                    studentProfile: {
                        isPublic: true
                    }
                },
                select: {
                    id: true,
                    fullName: true,
                    avatarUrl: true,
                    branchId: true,
                    studentProfile: {
                        select: {
                            username: true,
                            trustScore: true,
                            platformAccounts: true,
                            statsSnapshots: {
                                orderBy: { snapshotDate: 'desc' }
                            }
                        }
                    },
                    tenant: {
                        select: { name: true }
                    },
                    branch: {
                        select: { name: true }
                    }
                },
                skip,
                take: limit
            });

            const leaderboard = await Promise.all(
                students.map(async (student) => {
                    const profile = student as any;
                    const seenPlatforms = new Set();
                    const stats = (profile.studentProfile?.statsSnapshots || []).filter((s: any) => {
                        if (seenPlatforms.has(s.platformId)) return false;
                        seenPlatforms.add(s.platformId);
                        return true;
                    });

                    const totalProblems = stats.reduce((sum: number, s: any) => sum + (s?.totalSolved || 0), 0);
                    const maxRating = Math.max(...stats.map((s: any) => s?.rating || 0), 0);
                    const totalContests = stats.reduce((sum: number, s: any) => sum + (s?.contestsParticipated || 0), 0);
                    const maxStreak = Math.max(...stats.map((s: any) => s?.streakCount || 0), 0);

                    const problemsScore = Math.min(totalProblems / 500, 1) * 100 * WEIGHTS.PROBLEMS_SOLVED;
                    const ratingScore = Math.min(maxRating / 2000, 1) * 100 * WEIGHTS.RATING;
                    const contestsScore = Math.min(totalContests / 50, 1) * 100 * WEIGHTS.CONTESTS;
                    const streakScore = Math.min(maxStreak / 100, 1) * 100 * WEIGHTS.STREAK;

                    const cScore = Math.round(problemsScore + ratingScore + contestsScore + streakScore);

                    let category = 'Newcomer';
                    if (cScore >= 80) category = 'Legend';
                    else if (cScore >= 60) category = 'Builder';
                    else if (cScore >= 40) category = 'Grinder';
                    else if (cScore >= 20) category = 'Starter';

                    return {
                        id: student.id,
                        name: student.fullName,
                        username: (student as any).studentProfile?.username || null,
                        avatar_url: student.avatarUrl,
                        university: (student as any).tenant?.name || 'Unknown',
                        department: (student as any).branch?.name || 'Unknown',
                        branchId: student.branchId,
                        trust_score: (student as any).studentProfile?.trustScore?.trustScore || cScore,
                        c_score: cScore,
                        category,
                        problems_solved: totalProblems,
                        rating: maxRating,
                        activity_score: maxStreak,
                        rank: 0
                    } as any;
                })
            );

            leaderboard.sort((a, b) => b.c_score - a.c_score);
            leaderboard.forEach((entry, index) => {
                entry.rank = index + 1;
            });

            return { leaderboard };
        }, 120);

        res.json(result);
    } catch (error: unknown) {
        console.error("Get global leaderboard error:", error);
        const message = error instanceof Error ? error.message : 'Failed to fetch leaderboard';
        res.status(500).json({ error: message });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /api/leaderboard/department/:department - Department leaderboard
// ─────────────────────────────────────────────────────────────
router.get("/department/:department", async (req: Request, res: Response) => {
    try {
        const { department } = req.params;
        const departmentStr = String(department);
        const limit = parseInt(req.query.limit as string) || 50;

        const result = await cacheWithFallback(`leaderboard:dept:${departmentStr}:${limit}`, async () => {
            const students = await prisma.user.findMany({
                where: {
                    role: { name: 'student' },
                    isActive: true,
                    branch: { name: departmentStr },
                    studentProfile: {
                        isPublic: true
                    }
                },
                include: {
                    studentProfile: {
                        include: {
                            trustScore: true,
                            platformAccounts: true,
                            statsSnapshots: {
                                orderBy: { snapshotDate: 'desc' }
                            }
                        }
                    },
                    tenant: true,
                    branch: true
                }
            });

            const leaderboard = students.map((student) => {
                const profile = student as any;
                const seenPlatforms = new Set();
                const stats = (profile.studentProfile?.statsSnapshots || []).filter((s: any) => {
                    if (seenPlatforms.has(s.platformId)) return false;
                    seenPlatforms.add(s.platformId);
                    return true;
                });

                const totalProblems = stats.reduce((sum: number, s: any) => sum + (s?.totalSolved || 0), 0);
                const maxRating = Math.max(...stats.map((s: any) => s?.rating || 0), 0);

                const problemsScore = Math.min(totalProblems / 500, 1) * 100 * WEIGHTS.PROBLEMS_SOLVED;
                const ratingScore = Math.min(maxRating / 2000, 1) * 100 * WEIGHTS.RATING;
                const cScore = Math.round(problemsScore + ratingScore);

                let category = 'Newcomer';
                if (cScore >= 80) category = 'Legend';
                else if (cScore >= 60) category = 'Builder';
                else if (cScore >= 40) category = 'Grinder';
                else if (cScore >= 20) category = 'Starter';

                return {
                    id: student.id,
                    name: student.fullName,
                    username: (student as any).studentProfile?.username || null,
                    avatar_url: student.avatarUrl,
                    university: (student as any).tenant?.name || 'Unknown',
                    department: (student as any).branch?.name || 'Unknown',
                    trust_score: (student as any).studentProfile?.trustScore?.trustScore || cScore,
                    c_score: cScore,
                    category,
                    problems_solved: totalProblems,
                    rating: maxRating,
                } as any;
            });

            leaderboard.sort((a, b) => b.c_score - a.c_score);
            leaderboard.forEach((entry: any, index) => {
                entry.rank = index + 1;
            });

            return { leaderboard: leaderboard.slice(0, limit) };
        }, 120);

        res.json(result);
    } catch (error: unknown) {
        console.error("Get department leaderboard error:", error);
        const message = error instanceof Error ? error.message : 'Failed to fetch leaderboard';
        res.status(500).json({ error: message });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /api/leaderboard/category/:category - Category leaderboard
// ─────────────────────────────────────────────────────────────
router.get("/category/:category", async (req: Request, res: Response) => {
    try {
        const { category } = req.params;
        const categoryStr = String(category);

        const result = await cacheWithFallback(`leaderboard:category:${categoryStr}`, async () => {
            const students = await prisma.user.findMany({
                where: {
                    role: { name: 'student' },
                    isActive: true,
                    studentProfile: {
                        isPublic: true
                    }
                },
                include: {
                    studentProfile: {
                        include: {
                            trustScore: true,
                            platformAccounts: true,
                            statsSnapshots: {
                                orderBy: { snapshotDate: 'desc' }
                            }
                        }
                    },
                    tenant: true,
                    branch: true
                }
            });

            const leaderboard = await Promise.all(
                students.map(async (student) => {
                    const profile = student as any;
                    const seenPlatforms = new Set();
                    const stats = (profile.studentProfile?.statsSnapshots || []).filter((s: any) => {
                        if (seenPlatforms.has(s.platformId)) return false;
                        seenPlatforms.add(s.platformId);
                        return true;
                    });

                    const totalProblems = stats.reduce((sum: number, s: any) => sum + (s?.totalSolved || 0), 0);
                    const maxRating = Math.max(...stats.map((s: any) => s?.rating || 0), 0);
                    const totalContests = stats.reduce((sum: number, s: any) => sum + (s?.contestsParticipated || 0), 0);
                    const maxStreak = Math.max(...stats.map((s: any) => s?.streakCount || 0), 0);

                    const problemsScore = Math.min(totalProblems / 500, 1) * 100 * WEIGHTS.PROBLEMS_SOLVED;
                    const ratingScore = Math.min(maxRating / 2000, 1) * 100 * WEIGHTS.RATING;
                    const contestsScore = Math.min(totalContests / 50, 1) * 100 * WEIGHTS.CONTESTS;
                    const streakScore = Math.min(maxStreak / 100, 1) * 100 * WEIGHTS.STREAK;

                    const cScore = Math.round(problemsScore + ratingScore + contestsScore + streakScore);

                    let studentCategory = 'Newcomer';
                    if (cScore >= 80) studentCategory = 'Legend';
                    else if (cScore >= 60) studentCategory = 'Builder';
                    else if (cScore >= 40) studentCategory = 'Grinder';
                    else if (cScore >= 20) studentCategory = 'Starter';

                    return {
                        id: student.id,
                        name: student.fullName,
                        username: (student as any).studentProfile?.username || null,
                        avatar_url: student.avatarUrl,
                        university: (student as any).tenant?.name || 'Unknown',
                        department: (student as any).branch?.name || 'Unknown',
                        trust_score: (student as any).studentProfile?.trustScore?.trustScore || cScore,
                        c_score: cScore,
                        category: studentCategory,
                        problems_solved: totalProblems,
                        rating: maxRating,
                    } as any;
                })
            );

            const filtered = leaderboard.filter((l: any) => l.category.toLowerCase() === categoryStr.toLowerCase());
            filtered.sort((a, b) => b.c_score - a.c_score);
            filtered.forEach((entry: any, index) => {
                entry.rank = index + 1;
            });

            return { leaderboard: filtered };
        }, 120);

        res.json(result);
    } catch (error: unknown) {
        console.error("Get category leaderboard error:", error);
        const message = error instanceof Error ? error.message : 'Failed to fetch leaderboard';
        res.status(500).json({ error: message });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /api/leaderboard/departments - List all departments
// ─────────────────────────────────────────────────────────────
router.get("/departments", async (req: Request, res: Response) => {
    try {
        const result = await cacheWithFallback('leaderboard:departments', async () => {
            const branches = await prisma.branch.findMany({
                select: { name: true },
                distinct: ['name']
            });
            return { departments: branches.map(b => b.name) };
        }, 3600);

        res.json(result);
    } catch (error: unknown) {
        console.error("Get departments error:", error);
        const message = error instanceof Error ? error.message : 'Failed to fetch departments';
        res.status(500).json({ error: message });
    }
});

// ─────────────────────────────────────────────────────────────
// Platform-specific leaderboard endpoints
// ─────────────────────────────────────────────────────────────
const PLATFORMS = ['leetcode', 'codeforces', 'codechef', 'github'] as const;

// Helper function to get platform-specific stats for a student
async function getPlatformStatsForStudent(student: any, platform: string) {
    // Find the specific platform account for this student to be robust
    const platformAccount = student.studentProfile?.platformAccounts?.find(
        (a: any) => a.platform?.name === platform
    );

    if (!platformAccount) {
        return null;
    }

    const studentProfileId = student.studentProfile?.id;
    if (!studentProfileId) return null;

    switch (platform) {
        case 'leetcode': {
            const lc = await prisma.leetCodeStats.findFirst({
                where: { studentProfileId, username: { equals: platformAccount.username, mode: 'insensitive' } }
            });
            if (!lc) return null;
            return {
                username: platformAccount.username,
                score: lc.totalSolved || 0,
                easy: lc.easySolved || 0,
                medium: lc.mediumSolved || 0,
                hard: lc.hardSolved || 0,
                rating: lc.rating || 0
            };
        }
        case 'codeforces': {
            const cf = await prisma.codeforcesStats.findFirst({
                where: { studentProfileId, username: { equals: platformAccount.username, mode: 'insensitive' } }
            });
            if (!cf) return null;
            return {
                username: platformAccount.username,
                score: cf.rating || 0,
                rating: cf.rating || 0,
                maxRating: cf.maxRating || 0,
                rank: cf.rank || 'newbie',
                problemsSolved: cf.problemsSolved || 0
            };
        }
        case 'codechef': {
            const cc = await prisma.codeChefStats.findFirst({
                where: { studentProfileId, username: { equals: platformAccount.username, mode: 'insensitive' } }
            });
            if (!cc) return null;
            return {
                username: platformAccount.username,
                score: cc.rating || 0,
                rating: cc.rating || 0,
                highestRating: cc.highestRating || 0,
                stars: cc.stars || '0',
                contests: cc.participation || 0
            };
        }
        case 'github': {
            const gh = await prisma.gitHubStats.findFirst({
                where: { studentProfileId, username: { equals: platformAccount.username, mode: 'insensitive' } }
            });
            if (!gh) return null;
            return {
                username: platformAccount.username,
                score: gh.contributions || gh.totalContributions || 0,
                contributions: gh.contributions || gh.totalContributions || 0,
                repos: gh.publicRepos || 0,
                followers: gh.followers || 0,
                stars: gh.totalStars || 0
            };
        }
        default:
            return null;
    }
}

// GET /api/leaderboard/platform/:platform - Platform-specific leaderboard
router.get("/platform/:platform", async (req: Request, res: Response) => {
    try {
        const { platform } = req.params;
        const platformStr = String(platform).toLowerCase();

        if (!PLATFORMS.includes(platformStr as any)) {
            res.status(400).json({ error: "Invalid platform. Supported: leetcode, codeforces, codechef, github" });
            return;
        }

        const limit = parseInt(req.query.limit as string) || 50;

        const result = await cacheWithFallback(`leaderboard:platform:${platformStr}:${limit}`, async () => {
            const platformRecord = await prisma.platform.findFirst({
                where: { name: platformStr }
            });

            if (!platformRecord) {
                return { error: "Invalid platform" };
            }

            const students = await prisma.user.findMany({
                where: {
                    isActive: true,
                    studentProfile: { isNot: null }
                },
                select: {
                    id: true,
                    fullName: true,
                    avatarUrl: true,
                    studentProfile: {
                        select: {
                            id: true,
                            username: true,
                            trustScore: true,
                            platformAccounts: {
                                select: {
                                    username: true,
                                    platform: {
                                        select: { name: true }
                                    }
                                }
                            }
                        }
                    },
                    tenant: {
                        select: { name: true }
                    },
                    branch: {
                        select: { name: true }
                    }
                }
            });

            const processedStudents = students.map(student => {
                if (!student.studentProfile) return student;
                const filteredAccounts = (student.studentProfile as any).platformAccounts?.filter(
                    (account: any) => account.platform?.name === platformStr
                ) || [];
                return {
                    ...student,
                    studentProfile: { ...student.studentProfile, platformAccounts: filteredAccounts }
                };
            });

            const leaderboard = await Promise.all(
                processedStudents.map(async (student) => {
                    const platformStats = await getPlatformStatsForStudent(student, platformStr);
                    let sortScore = 0;
                    let hasPlatform = false;

                    const hasValidStats = platformStats && (
                        (platformStats.score ?? 0) > 0 ||
                        (platformStats.rating ?? 0) > 0 ||
                        (platformStats.repos ?? 0) > 0 ||
                        (platformStats.problemsSolved ?? 0) > 0
                    );

                    if (hasValidStats) {
                        hasPlatform = true;
                        switch (platformStr) {
                            case 'leetcode': sortScore = platformStats.score || 0; break;
                            case 'codeforces': sortScore = platformStats.rating || platformStats.score || 0; break;
                            case 'codechef': sortScore = platformStats.rating || platformStats.score || 0; break;
                            case 'github': sortScore = platformStats.score || 0; break;
                        }
                    }

                    return {
                        id: student.id,
                        name: student.fullName,
                        avatar_url: student.avatarUrl,
                        university: (student as any).tenant?.name || 'Unknown',
                        department: (student as any).branch?.name || 'Unknown',
                        platform: platformStr,
                        profileUsername: (student as any).studentProfile?.username || null,
                        username: platformStats?.username || 'N/A',
                        score: sortScore,
                        hasConnected: hasPlatform,
                        stats: platformStats || null
                    } as any;
                })
            );

            leaderboard.sort((a: any, b: any) => {
                if (a.hasConnected && !b.hasConnected) return -1;
                if (!a.hasConnected && b.hasConnected) return 1;
                return b.score - a.score;
            });
            const filteredLeaderboard = leaderboard.filter(Boolean);
            filteredLeaderboard.forEach((entry: any, index) => { entry.rank = index + 1; });

            return { leaderboard: filteredLeaderboard.slice(0, limit) };
        }, 120);

        if ((result as any).error) {
            res.status(400).json({ error: (result as any).error });
            return;
        }

        res.json(result);
    } catch (error: unknown) {
        console.error("Get platform leaderboard error:", error);
        const message = error instanceof Error ? error.message : 'Failed to fetch platform leaderboard';
        res.status(500).json({ error: message });
    }
});

// GET /api/leaderboard/platforms - List available platforms for leaderboard
router.get("/platforms", async (_req: Request, res: Response) => {
    try {
        const result = await cacheWithFallback('leaderboard:platforms:list', async () => ({
            platforms: PLATFORMS.map(p => ({
                name: p,
                displayName: p.charAt(0).toUpperCase() + p.slice(1).replace(/([A-Z])/g, ' $1'),
                sortBy: p === 'codeforces' || p === 'codechef' ? 'rating' : 'problems'
            }))
        }), 3600);

        res.json(result);
    } catch (error: unknown) {
        console.error("Get platforms error:", error);
        const message = error instanceof Error ? error.message : 'Failed to fetch platforms';
        res.status(500).json({ error: message });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /api/leaderboard/my-rank - Get current user's rank
// ─────────────────────────────────────────────────────────────
router.get("/my-rank", authenticateToken, async (req: Request, res: Response) => {
    try {
        const { userId } = req.user!;

        const result = await cacheWithFallback(`leaderboard:myrank:${userId}`, async () => {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: {
                    studentProfile: {
                        include: {
                            trustScore: true,
                            platformAccounts: true,
                            statsSnapshots: {
                                orderBy: { snapshotDate: 'desc' }
                            }
                        }
                    }
                }
            });

            if (!user || !(user as any)?.studentProfile) {
                return { rank: null, cScore: 0 };
            }

            const profile = user as any;
            const seenPlatforms = new Set();
            const stats = (profile.studentProfile?.statsSnapshots || []).filter((s: any) => {
                if (seenPlatforms.has(s.platformId)) return false;
                seenPlatforms.add(s.platformId);
                return true;
            });
                    const totalProblems = stats.reduce((sum: number, s: any) => sum + (s?.totalSolved || 0), 0);
                    const maxRating = Math.max(...stats.map((s: any) => s?.rating || 0), 0);
                    const totalContests = stats.reduce((sum: number, s: any) => sum + (s?.contestsParticipated || 0), 0);
                    const maxStreak = Math.max(...stats.map((s: any) => s?.streakCount || 0), 0);

            const problemsScore = Math.min(totalProblems / 500, 1) * 100 * WEIGHTS.PROBLEMS_SOLVED;
            const ratingScore = Math.min(maxRating / 2000, 1) * 100 * WEIGHTS.RATING;
            const contestsScore = Math.min(totalContests / 50, 1) * 100 * WEIGHTS.CONTESTS;
            const streakScore = Math.min(maxStreak / 100, 1) * 100 * WEIGHTS.STREAK;

            const cScore = Math.round(problemsScore + ratingScore + contestsScore + streakScore);

            const userTrustScore: number = (user as any).studentProfile?.trustScore?.trustScore || cScore;
            const rank = await prisma.trustScore.count({
                where: { trustScore: { gt: userTrustScore } }
            }) + 1;

            return { rank, cScore };
        }, 120);

        res.json(result);
    } catch (error: unknown) {
        console.error("Get my rank error:", error);
        const message = error instanceof Error ? error.message : 'Failed to fetch rank';
        res.status(500).json({ error: message });
    }
});

export default router;
