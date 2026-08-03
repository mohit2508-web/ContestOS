import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

// In-memory draft store (keyed by userId) — survives only while server is running.
// Client-side localStorage remains the source of truth; this is a server-side backup.
const draftStore = new Map<string, { draft: any; savedAt: number }>();

// GET /api/playground/draft — Fetch latest server-side draft for the current user
router.get('/draft', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const entry = draftStore.get(userId);
    res.json({ draft: entry?.draft ?? null });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch draft', details: error.message });
  }
});

// POST /api/playground/draft — Persist latest draft snapshot for the current user
router.post('/draft', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { mode, problemId, savedAt } = req.body;

    if (!mode) {
      res.status(400).json({ error: 'mode is required' });
      return;
    }

    draftStore.set(userId, {
      draft: { mode, problemId, savedAt: savedAt || Date.now(), ...req.body },
      savedAt: savedAt || Date.now(),
    });

    res.json({ success: true, savedAt: draftStore.get(userId)!.savedAt });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to save draft', details: error.message });
  }
});

export default router;
