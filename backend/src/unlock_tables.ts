import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Unlocking all tables in CockroachDB...');
  const tables = [
    'Organization', 'User', 'Problem', 'TestCase', 'Contest', 'ContestProblem',
    'ContestRegistration', 'Submission', 'ProctoringLog', 'PlagiarismReport',
    'TeamInvitation', 'ContestAssignment', 'AuditLog', 'RefreshToken',
    'OrganizationRequest', 'ContestSection', 'QuizPassage', 'QuizQuestion',
    'QuizOption', 'QuizAttemptQuestion', 'QuizResponse', 'QuizItemAnalytics',
    'QuestionBank', 'ContestAssemblyRule', 'QuestionVersion', 'QuestionReviewLog',
    'BreakGlassAuditLog'
  ];
  for (const tbl of tables) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "${tbl}" SET (schema_locked = false);`);
      console.log(`Unlocked ${tbl}`);
    } catch (err: any) {
      console.log(`${tbl} unlock info:`, err.message);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
