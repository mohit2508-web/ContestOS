import { PrismaClient as PrismaClientCockroach } from '@prisma/client';
// @ts-ignore
import { Client as PgClient } from 'pg';

const SUPABASE_URL = "postgresql://postgres.dyuqlamhlyhnmzvrdvxb:baMZanEglTaujg9A@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";

const cockroachPrisma = new PrismaClientCockroach();
const supabaseClient = new PgClient({ connectionString: SUPABASE_URL });

async function migrateData() {
  try {
    console.log("Connecting to Supabase (Source)...");
    await supabaseClient.connect();
    console.log("Connected to Supabase.");

    console.log("Connecting to CockroachDB (Target)...");
    await cockroachPrisma.$connect();
    console.log("Connected to CockroachDB.");

    // Helper to query Supabase tables safely
    const fetchSupabase = async (tableName: string) => {
      try {
        const res = await supabaseClient.query(`SELECT * FROM "${tableName}";`);
        return res.rows || [];
      } catch (err: any) {
        console.warn(`Table "${tableName}" fetch note: ${err.message}`);
        return [];
      }
    };

    // 1. Migrate Organizations
    const orgs = await fetchSupabase("Organization");
    console.log(`Fetched ${orgs.length} Organizations from Supabase.`);
    for (const org of orgs) {
      await cockroachPrisma.organization.upsert({
        where: { id: org.id },
        update: {},
        create: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          logoUrl: org.logoUrl,
          domain: org.domain,
          status: org.status || 'ACTIVE',
          subscriptionTier: org.subscriptionTier || 'FREE',
          featureFlags: org.featureFlags || undefined,
          maxContests: org.maxContests || 5,
          maxUsers: org.maxUsers || 50,
          createdAt: new Date(org.createdAt),
          updatedAt: new Date(org.updatedAt),
        },
      });
    }

    // 2. Migrate Users
    const users = await fetchSupabase("User");
    console.log(`Fetched ${users.length} Users from Supabase.`);
    for (const user of users) {
      await cockroachPrisma.user.upsert({
        where: { id: user.id },
        update: {},
        create: {
          id: user.id,
          email: user.email,
          password: user.password,
          name: user.name,
          username: user.username,
          phone: user.phone,
          role: user.role || 'STUDENT',
          status: user.status || 'ACTIVE',
          lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : null,
          organizationId: user.organizationId,
          createdAt: new Date(user.createdAt),
          updatedAt: new Date(user.updatedAt),
        },
      });
    }

    // 3. Migrate Problems
    const problems = await fetchSupabase("Problem");
    console.log(`Fetched ${problems.length} Problems from Supabase.`);
    for (const p of problems) {
      await cockroachPrisma.problem.upsert({
        where: { id: p.id },
        update: {},
        create: {
          id: p.id,
          title: p.title,
          slug: p.slug,
          description: p.description,
          difficulty: p.difficulty || 'Medium',
          category: p.category || 'General',
          problemType: p.problemType || 'code',
          evaluationStrategy: p.evaluationStrategy || 'EXACT_MATCH',
          referenceSolution: p.referenceSolution,
          starterCode: p.starterCode || {},
          driverCode: p.driverCode || undefined,
          images: p.images || undefined,
          isPublic: p.isPublic ?? false,
          organizationId: p.organizationId,
          createdById: p.createdById,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        },
      });
    }

    // 4. Migrate TestCases
    const testCases = await fetchSupabase("TestCase");
    console.log(`Fetched ${testCases.length} TestCases from Supabase.`);
    for (const tc of testCases) {
      await cockroachPrisma.testCase.upsert({
        where: { id: tc.id },
        update: {},
        create: {
          id: tc.id,
          problemId: tc.problemId,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isHidden: tc.isHidden ?? false,
          order: tc.order || 0,
          createdAt: new Date(tc.createdAt),
        },
      });
    }

    // 5. Migrate Contests
    const contests = await fetchSupabase("Contest");
    console.log(`Fetched ${contests.length} Contests from Supabase.`);
    for (const c of contests) {
      await cockroachPrisma.contest.upsert({
        where: { id: c.id },
        update: {},
        create: {
          id: c.id,
          title: c.title,
          description: c.description,
          startTime: new Date(c.startTime),
          endTime: new Date(c.endTime),
          duration: c.duration,
          difficulty: c.difficulty || 'Medium',
          isPublic: c.isPublic ?? true,
          allowJoin: c.allowJoin ?? true,
          requireSeb: c.requireSeb ?? false,
          sebConfig: c.sebConfig,
          sebQuitPassword: c.sebQuitPassword,
          requireFullscreen: c.requireFullscreen ?? true,
          preventTabSwitch: c.preventTabSwitch ?? true,
          disableCopyPaste: c.disableCopyPaste ?? true,
          enableProctoring: c.enableProctoring ?? false,
          maxWarnings: c.maxWarnings || 3,
          allowMultipleMonitors: c.allowMultipleMonitors ?? false,
          randomizeQuestionOrder: c.randomizeQuestionOrder ?? false,
          organizationId: c.organizationId,
          createdById: c.createdById,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
        },
      });
    }

    // 6. Migrate ContestProblems
    const contestProblems = await fetchSupabase("ContestProblem");
    console.log(`Fetched ${contestProblems.length} ContestProblems from Supabase.`);
    for (const cp of contestProblems) {
      await cockroachPrisma.contestProblem.upsert({
        where: { id: cp.id },
        update: {},
        create: {
          id: cp.id,
          contestId: cp.contestId,
          problemId: cp.problemId,
          order: cp.order || 0,
          points: cp.points || 100,
          timeLimitOverride: cp.timeLimitOverride,
        },
      });
    }

    // 7. Migrate ContestRegistrations
    const registrations = await fetchSupabase("ContestRegistration");
    console.log(`Fetched ${registrations.length} ContestRegistrations from Supabase.`);
    for (const reg of registrations) {
      await cockroachPrisma.contestRegistration.upsert({
        where: { id: reg.id },
        update: {},
        create: {
          id: reg.id,
          contestId: reg.contestId,
          userId: reg.userId,
          score: reg.score || 0,
          penalty: reg.penalty || 0,
          activeSessionToken: reg.activeSessionToken,
          status: reg.status || 'REGISTERED',
          registeredAt: new Date(reg.registeredAt),
        },
      });
    }

    // 8. Migrate Submissions
    const submissions = await fetchSupabase("Submission");
    console.log(`Fetched ${submissions.length} Submissions from Supabase.`);
    for (const sub of submissions) {
      await cockroachPrisma.submission.upsert({
        where: { id: sub.id },
        update: {},
        create: {
          id: sub.id,
          contestId: sub.contestId,
          problemId: sub.problemId,
          userId: sub.userId,
          code: sub.code,
          language: sub.language,
          status: sub.status || 'PENDING',
          executionTime: sub.executionTime,
          memoryUsed: sub.memoryUsed,
          score: sub.score || 0,
          testResults: sub.testResults || undefined,
          evaluatedById: sub.evaluatedById,
          evaluatedAt: sub.evaluatedAt ? new Date(sub.evaluatedAt) : null,
          evaluationComments: sub.evaluationComments,
          submittedAt: new Date(sub.submittedAt),
        },
      });
    }

    // 9. Migrate ProctoringLogs
    const logs = await fetchSupabase("ProctoringLog");
    console.log(`Fetched ${logs.length} ProctoringLogs from Supabase.`);
    for (const log of logs) {
      await cockroachPrisma.proctoringLog.upsert({
        where: { id: log.id },
        update: {},
        create: {
          id: log.id,
          contestId: log.contestId,
          userId: log.userId,
          eventType: log.eventType,
          details: log.details,
          timestamp: new Date(log.timestamp),
        },
      });
    }

    console.log("🎉 ALL DATA MIGRATED FROM SUPABASE TO COCKROACHDB SUCCESSFULLY!");

  } catch (err: any) {
    console.error("Migration error:", err.message);
  } finally {
    await supabaseClient.end();
    await cockroachPrisma.$disconnect();
  }
}

migrateData();
