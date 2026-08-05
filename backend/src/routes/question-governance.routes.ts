import { Router } from 'express';
import { QuestionBankService } from '../services/questionBankService';
import { ContestAssemblyEngine } from '../services/contestAssemblyEngine';
import { QuestionAnalyticsEngine } from '../services/questionAnalyticsEngine';
import { PreviewRunnerService } from '../services/previewRunnerService';

const router = Router();

// GET /api/governance/banks - List accessible Question Banks
router.get('/banks', async (req, res) => {
  try {
    const { orgId, isSuperAdmin } = req.query;
    const banks = await QuestionBankService.listAccessibleBanks(
      orgId as string,
      isSuperAdmin === 'true'
    );
    res.json({ success: true, banks });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/governance/banks - Create a Question Bank
router.post('/banks', async (req, res) => {
  try {
    const bank = await QuestionBankService.createBank(req.body);
    res.json({ success: true, bank });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/governance/questions - Create Question in DRAFT state
router.post('/questions', async (req, res) => {
  try {
    const question = await QuestionBankService.createQuestion(req.body);
    res.json({ success: true, question });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/governance/questions/review-queue - Get questions pending review
router.get('/questions/review-queue', async (req, res) => {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const questions = await prisma.quizQuestion.findMany({
      where: {
        reviewStatus: { in: ['UNDER_REVIEW', 'DRAFT'] },
      },
      include: { options: true, bank: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, questions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/governance/questions/:id/review - Four-Eyes Review Transition
router.post('/questions/:id/review', async (req, res) => {
  try {
    const { reviewerId, targetStatus, comments } = req.body;
    const question = await QuestionBankService.transitionReviewStatus(
      req.params.id,
      reviewerId,
      targetStatus,
      comments
    );
    res.json({ success: true, question });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// PUT /api/governance/questions/:id - Update Question with Immutable Versioning
router.put('/questions/:id', async (req, res) => {
  try {
    const { editorId, updates, changeSummary } = req.body;
    const question = await QuestionBankService.updateQuestionWithVersioning(
      req.params.id,
      editorId,
      updates,
      changeSummary
    );
    res.json({ success: true, question });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/governance/assembly/rules - Add Auto-Assembly Rule
router.post('/assembly/rules', async (req, res) => {
  try {
    const rule = await ContestAssemblyEngine.addRule(req.body);
    res.json({ success: true, rule });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/governance/assembly/manual - Manual Attach PUBLISHED Questions
router.post('/assembly/manual', async (req, res) => {
  try {
    const { sectionId, questionIds } = req.body;
    const result = await ContestAssemblyEngine.attachQuestionsManual(sectionId, questionIds);
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/governance/preview/:id - Candidate Dry-Run Preview Simulator
router.get('/preview/:id', async (req, res) => {
  try {
    const preview = await PreviewRunnerService.getQuestionPreview(req.params.id);
    res.json({ success: true, preview });
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
});

// POST /api/governance/analytics/recalculate - Recalculate Item Analytics & Point-Biserial Correlation
router.post('/analytics/recalculate', async (req, res) => {
  try {
    const { questionId } = req.body;
    const analytics = await QuestionAnalyticsEngine.recalculateItemAnalytics(questionId);
    res.json({ success: true, analytics });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
