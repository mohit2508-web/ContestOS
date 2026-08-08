import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('⚡ Adding new values to CockroachDB "Role" ENUM...');

  const newRoles = ['ANALYTICS_VIEWER', 'GUEST_CANDIDATE', 'COMPLIANCE_OFFICER', 'CONTEST_MODERATOR'];

  for (const role of newRoles) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS '${role}';`);
      console.log(`✓ Added ${role} to "Role" ENUM`);
    } catch (err: any) {
      console.warn(`! Note for ${role}: ${err.message}`);
    }
  }

  console.log('✅ ENUM update completed successfully!');
  await prisma.$disconnect();
}

main().catch(console.error);
