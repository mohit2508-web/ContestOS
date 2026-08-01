const { PrismaClient } = require('@prisma/client');

const SUPABASE_URL = "postgresql://postgres.dyuqlamhlyhnmzvrdvxb:baMZanEglTaujg9A@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true";
const COCKROACH_URL = "postgresql://mohit:NUXWnL3rjFS1N9xE5wOlHg@adored-quokka-30598.j77.aws-ap-south-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full";

const supabase = new PrismaClient({
  datasources: { db: { url: SUPABASE_URL } }
});

const cockroach = new PrismaClient({
  datasources: { db: { url: COCKROACH_URL } }
});

async function main() {
  console.log("Starting full data transfer from Supabase -> CockroachDB Cloud...");

  try {
    console.log("Clearing initial seed data from CockroachDB...");
    await cockroach.proctoringLog.deleteMany({});
    await cockroach.submission.deleteMany({});
    await cockroach.contestRegistration.deleteMany({});
    await cockroach.contestProblem.deleteMany({});
    await cockroach.contestAssignment.deleteMany({});
    await cockroach.teamInvitation.deleteMany({});
    await cockroach.auditLog.deleteMany({});
    await cockroach.refreshToken.deleteMany({});
    await cockroach.organizationRequest.deleteMany({});
    await cockroach.contest.deleteMany({});
    await cockroach.testCase.deleteMany({});
    await cockroach.problem.deleteMany({});
    await cockroach.user.deleteMany({});
    await cockroach.organization.deleteMany({});
    console.log("CockroachDB cleared.");

    // 1. Organizations
    const orgs = await supabase.organization.findMany();
    console.log(`Copying ${orgs.length} Organizations...`);
    for (const org of orgs) {
      await cockroach.organization.create({ data: org });
    }

    // 2. Users
    const users = await supabase.user.findMany();
    console.log(`Copying ${users.length} Users...`);
    for (const u of users) {
      await cockroach.user.create({ data: u });
    }

    // 3. Problems
    const problems = await supabase.problem.findMany();
    console.log(`Copying ${problems.length} Problems...`);
    for (const p of problems) {
      await cockroach.problem.create({ data: p });
    }

    // 4. TestCases
    const testCases = await supabase.testCase.findMany();
    console.log(`Copying ${testCases.length} TestCases...`);
    for (const tc of testCases) {
      await cockroach.testCase.create({ data: tc });
    }

    // 5. Contests
    const contests = await supabase.contest.findMany();
    console.log(`Copying ${contests.length} Contests...`);
    for (const c of contests) {
      await cockroach.contest.create({ data: c });
    }

    // 6. ContestProblems
    const contestProblems = await supabase.contestProblem.findMany();
    console.log(`Copying ${contestProblems.length} ContestProblems...`);
    for (const cp of contestProblems) {
      await cockroach.contestProblem.create({ data: cp });
    }

    // 7. ContestRegistrations
    const registrations = await supabase.contestRegistration.findMany();
    console.log(`Copying ${registrations.length} Registrations...`);
    for (const reg of registrations) {
      await cockroach.contestRegistration.create({ data: reg });
    }

    // 8. Submissions
    const submissions = await supabase.submission.findMany();
    console.log(`Copying ${submissions.length} Submissions...`);
    for (const s of submissions) {
      await cockroach.submission.create({ data: s });
    }

    // 9. ProctoringLogs
    const logs = await supabase.proctoringLog.findMany();
    console.log(`Copying ${logs.length} ProctoringLogs...`);
    for (const log of logs) {
      await cockroach.proctoringLog.create({ data: log });
    }

    console.log("🎉 ALL SUPABASE DATA SUCCESSFULLY TRANSFERRED TO COCKROACHDB CLOUD!");
  } catch (err) {
    console.error("Data transfer error:", err);
  } finally {
    await supabase.$disconnect();
    await cockroach.$disconnect();
  }
}

main();
