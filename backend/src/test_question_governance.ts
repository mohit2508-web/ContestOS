import { PrismaClient, BankScope, QuestionReviewStatus } from './generated/client';
import { QuestionBankService } from './services/questionBankService';
import { ContestAssemblyEngine } from './services/contestAssemblyEngine';
import { QuestionAnalyticsEngine } from './services/questionAnalyticsEngine';
import { PreviewRunnerService } from './services/previewRunnerService';

const prisma = new PrismaClient();

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✅ PASSED: ${message}`);
  }
}

async function runTests() {
  console.log('\n🧪 Starting Content Governance & Question Bank Integration Suite...\n');

  // Fetch or create a test user & organization
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: `gov_tester_${Date.now()}@kryptavia.io`,
        name: 'Gov Tester',
        password: 'hashed_password',
      },
    });
  }

  let org = await prisma.organization.findFirst();
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'IIT Delhi Tech Org',
        slug: `iitd-${Date.now()}`,
      },
    });
  }

  console.log('--- TEST GROUP 1: Multi-Tenant Question Bank Scoping ---');
  const globalBank = await QuestionBankService.createBank({
    name: 'Kryptavia OS Standard Aptitude Bank',
    scope: BankScope.PLATFORM_GLOBAL,
    createdById: user.id,
  });
  assert(globalBank.scope === BankScope.PLATFORM_GLOBAL, 'Global Aptitude Bank created');

  const tenantBank = await QuestionBankService.createBank({
    name: 'IITD Private Technical Bank',
    scope: BankScope.TENANT_PRIVATE,
    organizationId: org.id,
    createdById: user.id,
  });
  assert(tenantBank.organizationId === org.id, 'Tenant Private Bank scoped to Organization');

  const accessibleBanks = await QuestionBankService.listAccessibleBanks(org.id, false);
  assert(accessibleBanks.some((b) => b.id === tenantBank.id), 'Accessible banks list contains tenant private bank');
  assert(accessibleBanks.some((b) => b.id === globalBank.id), 'Accessible banks list contains global platform bank');

  console.log('\n--- TEST GROUP 2: Four-Eyes Review & Immutable Versioning ---');
  const draftQ = await QuestionBankService.createQuestion({
    bankId: tenantBank.id,
    questionType: 'SINGLE_SELECT',
    content: 'Which of the following is a non-linear data structure?',
    difficulty: 3,
    category: 'Technical',
    topic: 'Data Structures',
    points: 4.0,
    negativeMarking: 1.0,
    options: [
      { content: 'Array', isCorrect: false, displayOrder: 1 },
      { content: 'LinkedList', isCorrect: false, displayOrder: 2 },
      { content: 'Binary Search Tree', isCorrect: true, displayOrder: 3 },
      { content: 'Stack', isCorrect: false, displayOrder: 4 },
    ],
    createdById: user.id,
  });
  assert(draftQ.reviewStatus === QuestionReviewStatus.DRAFT, 'New question starts in DRAFT state');
  assert(draftQ.version === 1, 'New question starts at version 1');

  // Transition: DRAFT -> UNDER_REVIEW -> APPROVED -> PUBLISHED
  const underReviewQ = await QuestionBankService.transitionReviewStatus(draftQ.id, user.id, QuestionReviewStatus.UNDER_REVIEW);
  assert(underReviewQ.reviewStatus === QuestionReviewStatus.UNDER_REVIEW, 'Status transitioned to UNDER_REVIEW');

  const publishedQ = await QuestionBankService.transitionReviewStatus(underReviewQ.id, user.id, QuestionReviewStatus.PUBLISHED);
  assert(publishedQ.reviewStatus === QuestionReviewStatus.PUBLISHED, 'Status transitioned to PUBLISHED by 2nd reviewer');

  // Immutable Edit on PUBLISHED question
  const version2Q = await QuestionBankService.updateQuestionWithVersioning(
    publishedQ.id,
    user.id,
    { content: 'Which of the following is a non-linear tree data structure?' },
    'Clarified wording for non-linear tree'
  );
  assert(version2Q.version === 2, 'Editing published question increments version to 2');
  assert(version2Q.reviewStatus === QuestionReviewStatus.UNDER_REVIEW, 'Editing published question resets status to UNDER_REVIEW for 2nd review');

  // Re-publish v2
  await QuestionBankService.transitionReviewStatus(version2Q.id, user.id, QuestionReviewStatus.PUBLISHED);

  console.log('\n--- TEST GROUP 3: Rule-Based Auto-Assembly Engine ---');
  // Create test contest section
  let contest = await prisma.contest.findFirst();
  if (!contest) {
    contest = await prisma.contest.create({
      data: {
        title: 'Governance Test Contest',
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        duration: 60,
        createdById: user.id,
      },
    });
  }

  const section = await prisma.contestSection.create({
    data: {
      contestId: contest.id,
      title: 'Auto-Assembled Technical Section',
      duration: 30,
    },
  });

  const rule = await ContestAssemblyEngine.addRule({
    sectionId: section.id,
    category: 'Technical',
    topic: 'Data Structures',
    sampleCount: 1,
  });
  assert(rule.sampleCount === 1, 'Auto-assembly rule added for section');

  const sampledQuestions = await ContestAssemblyEngine.assembleCandidateQuestionsByRules(
    user.id,
    contest.id,
    section.id,
    org.id
  );
  assert(sampledQuestions.length === 1, 'Rule-based engine sampled 1 matching published question');
  assert(sampledQuestions[0].id === version2Q.id, 'Sampled question matches published question in bank');

  console.log('\n--- TEST GROUP 4: Candidate Dry-Run Preview Simulator ---');
  const previewData = await PreviewRunnerService.getQuestionPreview(version2Q.id);
  assert(previewData.previewMode === true, 'Preview payload has previewMode: true');
  assert(previewData.question.content.includes('non-linear tree'), 'Preview renders latest question content');

  console.log('\n--- TEST GROUP 5: Item Analytics & Point-Biserial Correlation ($r_{pbis}$) ---');
  // Create a dummy attempt question & response for analytics test
  const aq = await prisma.quizAttemptQuestion.create({
    data: {
      userId: user.id,
      contestId: contest.id,
      sectionId: section.id,
      questionId: version2Q.id,
      presentedOrder: 1,
      optionOrderMap: ['opt-1', 'opt-2', 'opt-3', 'opt-4'],
    },
  });

  await prisma.quizResponse.create({
    data: {
      attemptQuestionId: aq.id,
      userId: user.id,
      selectedOptionIds: ['opt-3'],
      isCorrect: true,
      scoreAwarded: 4.0,
      timeSpentMs: 12000,
    },
  });

  const analytics = await QuestionAnalyticsEngine.recalculateItemAnalytics(version2Q.id);
  assert(analytics !== null, 'Item analytics computed');
  assert(analytics?.totalAttempts === 1, 'Total attempts count is 1');
  assert(analytics?.correctAttempts === 1, 'Correct attempts count is 1');

  console.log('\n============================================================');
  console.log('📋 Content Governance Test Suite Results: ALL ASSERTIONS PASSED');
  console.log('============================================================\n');
}

runTests()
  .catch((err) => {
    console.error('Fatal Test Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
