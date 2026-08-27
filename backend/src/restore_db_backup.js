const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('./generated/client');

const prisma = new PrismaClient();

async function restoreFullBackup(backupFileName) {
  const dirFiles = fs.readdirSync(path.join(__dirname, '..'));
  const targetFile = backupFileName || dirFiles.find(f => f.startsWith('cockroach_backup_') && f.endsWith('.json'));

  if (!targetFile) {
    console.error('❌ No backup JSON file found in backend directory!');
    return;
  }

  const backupPath = path.join(__dirname, '..', targetFile);
  console.log(`⚡ STARTING RESTORE FROM FILE: ${targetFile}`);

  const rawData = fs.readFileSync(backupPath, 'utf-8');
  const data = JSON.parse(rawData);

  try {
    console.log('1. Restoring Organizations...');
    for (const org of data.organizations || []) {
      await prisma.organization.upsert({
        where: { id: org.id },
        update: org,
        create: org,
      }).catch(err => console.warn('Org skip/exist:', org.name));
    }

    console.log('2. Restoring Users...');
    for (const u of data.users || []) {
      await prisma.user.upsert({
        where: { id: u.id },
        update: u,
        create: u,
      }).catch(err => console.warn('User skip/exist:', u.email));
    }

    console.log('3. Restoring Problems...');
    for (const p of data.problems || []) {
      await prisma.problem.upsert({
        where: { id: p.id },
        update: p,
        create: p,
      }).catch(err => console.warn('Problem skip/exist:', p.title));
    }

    console.log('4. Restoring TestCases...');
    for (const tc of data.testCases || []) {
      await prisma.testCase.upsert({
        where: { id: tc.id },
        update: tc,
        create: tc,
      }).catch(err => console.warn('TestCase skip/exist:', tc.id));
    }

    console.log('5. Restoring Contests...');
    for (const c of data.contests || []) {
      await prisma.contest.upsert({
        where: { id: c.id },
        update: c,
        create: c,
      }).catch(err => console.warn('Contest skip/exist:', c.title));
    }

    console.log('6. Restoring ContestProblems...');
    for (const cp of data.contestProblems || []) {
      await prisma.contestProblem.upsert({
        where: { id: cp.id },
        update: cp,
        create: cp,
      }).catch(err => console.warn('ContestProblem skip/exist:', cp.id));
    }

    console.log('7. Restoring ContestRegistrations...');
    for (const reg of data.contestRegistrations || []) {
      await prisma.contestRegistration.upsert({
        where: { id: reg.id },
        update: reg,
        create: reg,
      }).catch(err => console.warn('Registration skip/exist:', reg.id));
    }

    console.log('8. Restoring Submissions...');
    for (const s of data.submissions || []) {
      await prisma.submission.upsert({
        where: { id: s.id },
        update: s,
        create: s,
      }).catch(err => console.warn('Submission skip/exist:', s.id));
    }

    console.log('9. Restoring ProctoringLogs...');
    for (const pl of data.proctoringLogs || []) {
      await prisma.proctoringLog.upsert({
        where: { id: pl.id },
        update: pl,
        create: pl,
      }).catch(err => console.warn('ProctoringLog skip/exist:', pl.id));
    }

    console.log('\n======================================================');
    console.log('🎉 ALL DATA RESTORED SUCCESSFULLY TO NEW DATABASE!');
    console.log('======================================================\n');
  } catch (error) {
    console.error('❌ RESTORE ERROR:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreFullBackup();
