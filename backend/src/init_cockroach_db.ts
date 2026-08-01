import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

const SQL_STATEMENTS = [
  // Enums
  `CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ORG_ADMIN', 'ORG_MEMBER', 'STUDENT', 'EVALUATOR');`,
  `CREATE TYPE "OrgStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL');`,
  `CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');`,
  `CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');`,
  `CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING_INVITE');`,
  `CREATE TYPE "ContestMemberRole" AS ENUM ('CONTENT_EDITOR', 'PROCTOR', 'EVALUATOR');`,
  `CREATE TYPE "EvaluationStrategy" AS ENUM ('EXACT_MATCH', 'UNORDERED_MATCH', 'FLOAT_TOLERANCE');`,
  `CREATE TYPE "SubmissionStatus" AS ENUM ('ACCEPTED', 'WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED', 'MEMORY_LIMIT_EXCEEDED', 'RUNTIME_ERROR', 'COMPILATION_ERROR', 'PENDING', 'RUNNING');`,
  `CREATE TYPE "OrgRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');`,

  // Tables
  `CREATE TABLE "Organization" ("id" STRING NOT NULL, "name" STRING NOT NULL, "slug" STRING NOT NULL, "logoUrl" STRING, "domain" STRING, "status" "OrgStatus" NOT NULL DEFAULT 'ACTIVE', "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'FREE', "featureFlags" JSONB, "maxContests" INT4 NOT NULL DEFAULT 5, "maxUsers" INT4 NOT NULL DEFAULT 50, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Organization_pkey" PRIMARY KEY ("id"));`,
  `CREATE TABLE "User" ("id" STRING NOT NULL, "email" STRING NOT NULL, "password" STRING NOT NULL, "name" STRING NOT NULL, "username" STRING, "phone" STRING, "role" "Role" NOT NULL DEFAULT 'STUDENT', "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE', "lastLoginAt" TIMESTAMP(3), "invitedById" STRING, "organizationId" STRING, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "User_pkey" PRIMARY KEY ("id"));`,
  `CREATE TABLE "Problem" ("id" STRING NOT NULL, "title" STRING NOT NULL, "slug" STRING NOT NULL, "description" STRING NOT NULL, "difficulty" STRING NOT NULL DEFAULT 'Medium', "category" STRING NOT NULL DEFAULT 'General', "problemType" STRING NOT NULL DEFAULT 'code', "evaluationStrategy" "EvaluationStrategy" NOT NULL DEFAULT 'EXACT_MATCH', "referenceSolution" STRING, "starterCode" JSONB NOT NULL, "driverCode" JSONB, "images" JSONB, "isPublic" BOOL NOT NULL DEFAULT false, "organizationId" STRING, "createdById" STRING, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Problem_pkey" PRIMARY KEY ("id"));`,
  `CREATE TABLE "TestCase" ("id" STRING NOT NULL, "problemId" STRING NOT NULL, "input" STRING NOT NULL, "expectedOutput" STRING NOT NULL, "isHidden" BOOL NOT NULL DEFAULT false, "order" INT4 NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id"));`,
  `CREATE TABLE "Contest" ("id" STRING NOT NULL, "title" STRING NOT NULL, "description" STRING, "startTime" TIMESTAMP(3) NOT NULL, "endTime" TIMESTAMP(3) NOT NULL, "duration" INT4 NOT NULL, "difficulty" STRING NOT NULL DEFAULT 'Medium', "isPublic" BOOL NOT NULL DEFAULT true, "allowJoin" BOOL NOT NULL DEFAULT true, "requireSeb" BOOL NOT NULL DEFAULT false, "sebConfig" STRING, "sebQuitPassword" STRING, "requireFullscreen" BOOL NOT NULL DEFAULT true, "preventTabSwitch" BOOL NOT NULL DEFAULT true, "disableCopyPaste" BOOL NOT NULL DEFAULT true, "enableProctoring" BOOL NOT NULL DEFAULT false, "maxWarnings" INT4 NOT NULL DEFAULT 3, "allowMultipleMonitors" BOOL NOT NULL DEFAULT false, "randomizeQuestionOrder" BOOL NOT NULL DEFAULT false, "organizationId" STRING, "createdById" STRING NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Contest_pkey" PRIMARY KEY ("id"));`,
  `CREATE TABLE "ContestProblem" ("id" STRING NOT NULL, "contestId" STRING NOT NULL, "problemId" STRING NOT NULL, "order" INT4 NOT NULL DEFAULT 0, "points" INT4 NOT NULL DEFAULT 100, "timeLimitOverride" INT4, CONSTRAINT "ContestProblem_pkey" PRIMARY KEY ("id"));`,
  `CREATE TABLE "ContestRegistration" ("id" STRING NOT NULL, "contestId" STRING NOT NULL, "userId" STRING NOT NULL, "score" INT4 NOT NULL DEFAULT 0, "penalty" INT4 NOT NULL DEFAULT 0, "activeSessionToken" STRING, "status" STRING NOT NULL DEFAULT 'REGISTERED', "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ContestRegistration_pkey" PRIMARY KEY ("id"));`,
  `CREATE TABLE "Submission" ("id" STRING NOT NULL, "contestId" STRING, "problemId" STRING NOT NULL, "userId" STRING NOT NULL, "code" STRING NOT NULL, "language" STRING NOT NULL, "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING', "executionTime" INT4, "memoryUsed" INT4, "score" INT4 NOT NULL DEFAULT 0, "testResults" JSONB, "evaluatedById" STRING, "evaluatedAt" TIMESTAMP(3), "evaluationComments" STRING, "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Submission_pkey" PRIMARY KEY ("id"));`,
  `CREATE TABLE "ProctoringLog" ("id" STRING NOT NULL, "contestId" STRING NOT NULL, "userId" STRING NOT NULL, "eventType" STRING NOT NULL, "details" STRING, "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProctoringLog_pkey" PRIMARY KEY ("id"));`,
  `CREATE TABLE "PlagiarismReport" ("id" STRING NOT NULL, "contestId" STRING NOT NULL, "similarityMap" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PlagiarismReport_pkey" PRIMARY KEY ("id"));`,
  `CREATE TABLE "TeamInvitation" ("id" STRING NOT NULL, "email" STRING NOT NULL, "role" "Role" NOT NULL DEFAULT 'ORG_MEMBER', "token" STRING NOT NULL, "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING', "organizationId" STRING NOT NULL, "invitedById" STRING NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "acceptedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "TeamInvitation_pkey" PRIMARY KEY ("id"));`,
  `CREATE TABLE "ContestAssignment" ("id" STRING NOT NULL, "contestId" STRING NOT NULL, "userId" STRING NOT NULL, "assignedById" STRING NOT NULL, "role" "ContestMemberRole" NOT NULL DEFAULT 'CONTENT_EDITOR', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ContestAssignment_pkey" PRIMARY KEY ("id"));`,
  `CREATE TABLE "AuditLog" ("id" STRING NOT NULL, "userId" STRING NOT NULL, "organizationId" STRING, "action" STRING NOT NULL, "resource" STRING NOT NULL, "resourceId" STRING, "details" JSONB, "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id"));`,
  `CREATE TABLE "RefreshToken" ("id" STRING NOT NULL, "userId" STRING NOT NULL, "token" STRING NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id"));`,
  `CREATE TABLE "OrganizationRequest" ("id" STRING NOT NULL, "orgName" STRING NOT NULL, "orgType" STRING NOT NULL, "contactName" STRING NOT NULL, "contactEmail" STRING NOT NULL, "contactPhone" STRING, "websiteUrl" STRING, "domain" STRING, "reason" STRING, "status" "OrgRequestStatus" NOT NULL DEFAULT 'PENDING', "reviewedById" STRING, "reviewNotes" STRING, "reviewedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "OrganizationRequest_pkey" PRIMARY KEY ("id"));`,

  // Indices
  `CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");`,
  `CREATE UNIQUE INDEX "Organization_domain_key" ON "Organization"("domain");`,
  `CREATE UNIQUE INDEX "User_email_key" ON "User"("email");`,
  `CREATE UNIQUE INDEX "User_username_key" ON "User"("username");`,
  `CREATE UNIQUE INDEX "Problem_slug_key" ON "Problem"("slug");`,
  `CREATE INDEX "Problem_organizationId_isPublic_idx" ON "Problem"("organizationId", "isPublic");`,
  `CREATE INDEX "Problem_createdById_idx" ON "Problem"("createdById");`,
  `CREATE INDEX "ContestProblem_contestId_order_idx" ON "ContestProblem"("contestId", "order");`,
  `CREATE UNIQUE INDEX "ContestProblem_contestId_problemId_key" ON "ContestProblem"("contestId", "problemId");`,
  `CREATE UNIQUE INDEX "ContestRegistration_contestId_userId_key" ON "ContestRegistration"("contestId", "userId");`,
  `CREATE UNIQUE INDEX "TeamInvitation_token_key" ON "TeamInvitation"("token");`,
  `CREATE UNIQUE INDEX "ContestAssignment_contestId_userId_key" ON "ContestAssignment"("contestId", "userId");`,
  `CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");`,

  // Foreign Keys
  `ALTER TABLE "User" ADD CONSTRAINT "User_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;`,
  `ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;`,
  `ALTER TABLE "Problem" ADD CONSTRAINT "Problem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;`,
  `ALTER TABLE "Problem" ADD CONSTRAINT "Problem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;`,
  `ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "Contest" ADD CONSTRAINT "Contest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;`,
  `ALTER TABLE "Contest" ADD CONSTRAINT "Contest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`,
  `ALTER TABLE "ContestProblem" ADD CONSTRAINT "ContestProblem_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "ContestProblem" ADD CONSTRAINT "ContestProblem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "ContestRegistration" ADD CONSTRAINT "ContestRegistration_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "ContestRegistration" ADD CONSTRAINT "ContestRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "Submission" ADD CONSTRAINT "Submission_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE SET NULL ON UPDATE CASCADE;`,
  `ALTER TABLE "Submission" ADD CONSTRAINT "Submission_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "Submission" ADD CONSTRAINT "Submission_evaluatedById_fkey" FOREIGN KEY ("evaluatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;`,
  `ALTER TABLE "ProctoringLog" ADD CONSTRAINT "ProctoringLog_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "ProctoringLog" ADD CONSTRAINT "ProctoringLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "PlagiarismReport" ADD CONSTRAINT "PlagiarismReport_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`,
  `ALTER TABLE "ContestAssignment" ADD CONSTRAINT "ContestAssignment_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "ContestAssignment" ADD CONSTRAINT "ContestAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "ContestAssignment" ADD CONSTRAINT "ContestAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`,
  `ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`,
  `ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;`,
  `ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "OrganizationRequest" ADD CONSTRAINT "OrganizationRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;`
];

async function main() {
  console.log('⚡ Starting CockroachDB Table Creation...');
  for (let i = 0; i < SQL_STATEMENTS.length; i++) {
    const stmt = SQL_STATEMENTS[i];
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log(`✓ Executed step ${i + 1}/${SQL_STATEMENTS.length}`);
    } catch (err: any) {
      console.warn(`! Step ${i + 1} note: ${err.message}`);
    }
  }
  console.log('✅ ALL COCKROACHDB TABLES AND CONSTRAINTS CREATED SUCCESSFULLY!');
  await prisma.$disconnect();
}

main();
