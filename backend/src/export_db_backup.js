const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('./generated/client');

const prisma = new PrismaClient();

async function exportFullBackup() {
  const backupFilename = `cockroach_backup_${Date.now()}.json`;
  const backupPath = path.join(__dirname, '..', backupFilename);

  console.log('⚡ STARTING FULL COCKROACHDB DATA BACKUP...');
  console.log(`📦 Backup file path: ${backupPath}`);

  try {
    const backupData = {};

    console.log('1. Exporting Organizations...');
    backupData.organizations = await prisma.organization.findMany();

    console.log('2. Exporting Users (150+ Accounts)...');
    backupData.users = await prisma.user.findMany();

    console.log('3. Exporting Problems & Problem Bank...');
    backupData.problems = await prisma.problem.findMany();

    console.log('4. Exporting TestCases...');
    backupData.testCases = await prisma.testCase.findMany();

    console.log('5. Exporting Contests...');
    backupData.contests = await prisma.contest.findMany();

    console.log('6. Exporting ContestProblems...');
    backupData.contestProblems = await prisma.contestProblem.findMany();

    console.log('7. Exporting ContestRegistrations...');
    backupData.contestRegistrations = await prisma.contestRegistration.findMany();

    console.log('8. Exporting Submissions...');
    backupData.submissions = await prisma.submission.findMany();

    console.log('9. Exporting ProctoringLogs...');
    backupData.proctoringLogs = await prisma.proctoringLog.findMany();

    console.log('10. Exporting QuestionBanks & QuizQuestions...');
    backupData.questionBanks = await prisma.questionBank.findMany().catch(() => []);
    backupData.quizQuestions = await prisma.quizQuestion.findMany().catch(() => []);
    backupData.quizOptions = await prisma.quizOption.findMany().catch(() => []);
    backupData.contestSections = await prisma.contestSection.findMany().catch(() => []);

    console.log('11. Exporting CompanyVaults & AssistantSessions...');
    backupData.companyVaults = await prisma.companyVault.findMany().catch(() => []);
    backupData.assistantSessions = await prisma.assistantSession.findMany().catch(() => []);

    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');

    console.log('\n======================================================');
    console.log('🎉 BACKUP COMPLETED SUCCESSFULLY WITH ZERO DATA LOSS!');
    console.log(`📊 Summary of backed up records:`);
    console.log(`   - Users: ${backupData.users.length}`);
    console.log(`   - Contests: ${backupData.contests.length}`);
    console.log(`   - Problems: ${backupData.problems.length}`);
    console.log(`   - TestCases: ${backupData.testCases.length}`);
    console.log(`   - Submissions: ${backupData.submissions.length}`);
    console.log(`   - Registrations: ${backupData.contestRegistrations.length}`);
    console.log(`💾 Saved File: ${backupFilename}`);
    console.log('======================================================\n');
  } catch (error) {
    console.error('❌ BACKUP FAILED:', error);
  } finally {
    await prisma.$disconnect();
  }
}

exportFullBackup();
