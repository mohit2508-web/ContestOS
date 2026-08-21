import { Router, Request, Response } from 'express';
import { getOrCreateSession, processCandidateMessage } from '../services/assistant/assistant.service';

const router = Router();

/**
 * POST /api/assistant/session/init
 * Initializes or retrieves active assistant session.
 */
router.post('/session/init', async (req: Request, res: Response) => {
  try {
    const { sessionId, userId, problemId } = req.body;
    const session = await getOrCreateSession(
      sessionId || `sess_${Date.now()}`,
      userId || 'candidate_1',
      problemId
    );
    res.json({ success: true, session });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/assistant/:sessionId/message
 * Handles candidate message submission through the Socratic gating engine.
 */
router.post('/:sessionId/message', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { text, userId, language } = req.body;

    if (!text || typeof text !== 'string') {
      res.status(400).json({ success: false, error: 'Text message is required' });
      return;
    }

    const response = await processCandidateMessage(
      sessionId,
      userId || 'candidate_1',
      text,
      language
    );

    res.json({ success: true, ...response });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/assistant/:sessionId/insert-code
 * Logs editor code insertion event.
 */
router.post('/:sessionId/insert-code', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { code } = req.body;
    res.json({ success: true, sessionId, codeLength: code?.length || 0 });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/assistant/:sessionId/transcript
 * Evaluator view endpoint for reviewing candidate chat trajectory.
 */
router.get('/:sessionId/transcript', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await getOrCreateSession(sessionId, 'candidate_1');
    res.json({ success: true, session });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
