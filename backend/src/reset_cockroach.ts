import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function unlockAndDrop() {
  const tables = [
    'Organization',
    'User',
    'Problem',
    'TestCase',
    'Contest',
    'ContestProblem',
    'ContestRegistration',
    'Submission',
    'ProctoringLog',
    'PlagiarismReport',
    'TeamInvitation',
    'ContestAssignment',
    'AuditLog',
    'RefreshToken',
    'OrganizationRequest',
    '_prisma_migrations',
  ];

  console.log('Connecting via PrismaClient to CockroachDB Cloud...');

  for (const t of tables) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "${t}" SET (schema_locked = false);`);
    } catch (_e) {}
    try {
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${t}" CASCADE;`);
      console.log(`Dropped table "${t}"`);
    } catch (err: any) {
      console.log(`Table ${t}: ${err.message}`);
    }
  }

  await prisma.$disconnect();
}

unlockAndDrop();
