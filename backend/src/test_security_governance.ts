import { PrismaClient, QuestionReviewStatus, QuestionType, Role } from '@prisma/client';
import { QuestionBankService } from './services/questionBankService';

const prisma = new PrismaClient();

async function runSecurityGovernanceTests() {
  console.log('=====================================================');
  console.log('🧪 RUNNING CONTESTOS SECURITY & GOVERNANCE TEST SUITE');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Role Enum Verification
    assert(Role.PROCTOR === 'PROCTOR', 'Role enum contains PROCTOR 6th role');
    assert(Role.CANDIDATE === 'CANDIDATE', 'Role enum contains CANDIDATE role');
    assert(Role.PLATFORM_CONTENT_AUTHOR === 'PLATFORM_CONTENT_AUTHOR', 'Role enum contains PLATFORM_CONTENT_AUTHOR 7th role');

    // 2. Setup Test Author & Reviewer
    let author = await prisma.user.findFirst({ where: { email: 'author_test@contestos.io' } });
    if (!author) {
      author = await prisma.user.create({
        data: { email: 'author_test@contestos.io', name: 'Author Setter', password: 'hash' },
      });
    }

    let reviewer = await prisma.user.findFirst({ where: { email: 'reviewer_test@contestos.io' } });
    if (!reviewer) {
      reviewer = await prisma.user.create({
        data: { email: 'reviewer_test@contestos.io', name: 'Peer Reviewer', password: 'hash' },
      });
    }

    // 3. Draft Question Creation
    const draftQ = await QuestionBankService.createQuestion({
      questionType: QuestionType.SINGLE_SELECT,
      content: 'What is the time complexity of Binary Search?',
      difficulty: 2,
      category: 'Technical',
      topic: 'Algorithms',
      points: 4,
      negativeMarking: 1,
      options: [
        { content: 'O(1)', isCorrect: false, displayOrder: 1 },
        { content: 'O(log n)', isCorrect: true, displayOrder: 2 },
      ],
      createdById: author.id,
    });
    assert(draftQ.reviewStatus === QuestionReviewStatus.DRAFT, 'Created question is in DRAFT state');

    // 4. Test Four-Eyes Principle Enforcement: Self-Approval Attempt MUST Fail!
    let selfApprovalBlocked = false;
    try {
      await QuestionBankService.transitionReviewStatus(
        draftQ.id,
        author.id, // Author trying to self-approve!
        QuestionReviewStatus.APPROVED,
        'Self approval attempt'
      );
    } catch (err: any) {
      if (err.message.includes('Four-Eyes Principle Violation')) {
        selfApprovalBlocked = true;
      }
    }
    assert(selfApprovalBlocked, 'Four-Eyes Backend Check: Author cannot self-approve their own draft question');

    // 5. Peer Approval by Different User MUST Succeed!
    const approvedQ = await QuestionBankService.transitionReviewStatus(
      draftQ.id,
      reviewer.id, // Peer reviewer (author !== reviewer)
      QuestionReviewStatus.APPROVED,
      'Peer review passed successfully'
    );
    assert(approvedQ.reviewStatus === QuestionReviewStatus.APPROVED, 'Peer review approval succeeded for different reviewer');

    // 6. Test Super Admin Break-Glass Audit Trail Log Creation
    const breakGlassLog = await prisma.breakGlassAuditLog.create({
      data: {
        superAdminId: author.id,
        organizationId: 'org-test',
        resourcePath: '/api/governance/banks/org-test',
        actionType: 'GET',
        reason: 'Compliance Security Audit Request #1049',
      },
    });
    assert(!!breakGlassLog.id && breakGlassLog.reason.includes('Security Audit'), 'Super Admin Break-Glass Audit Log created');

    console.log('\n=====================================================');
    console.log(`SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('=====================================================\n');

    if (failed > 0) process.exit(1);
  } catch (err: any) {
    console.error('Test Suite Fatal Error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runSecurityGovernanceTests();
