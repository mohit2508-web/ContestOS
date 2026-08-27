const { PrismaClient } = require('./generated/client');
const prisma = new PrismaClient();

async function verifyLiveDatabase() {
  console.log('⚡ TESTING LIVE COCKROACHDB CLUSTER QUERIES...');
  try {
    const userCount = await prisma.user.count();
    const contestCount = await prisma.contest.count();
    const problemCount = await prisma.problem.count();
    const submissionCount = await prisma.submission.count();
    const regCount = await prisma.contestRegistration.count();

    console.log('\n======================================================');
    console.log('🎉 LIVE DATABASE VERIFICATION SUCCESSFUL!');
    console.log(`📊 Live Record Counts:`);
    console.log(`   - Users: ${userCount}`);
    console.log(`   - Contests: ${contestCount}`);
    console.log(`   - Problems: ${problemCount}`);
    console.log(`   - Submissions: ${submissionCount}`);
    console.log(`   - Registrations: ${regCount}`);
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ LIVE DB VERIFICATION FAILED:', err);
  } finally {
    await prisma.$disconnect();
  }
}

verifyLiveDatabase();
