import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

declare const process: any;

const prisma = new PrismaClient();

async function main() {
  console.log('Starting ContestOS Database Seeding...');

  const org = await prisma.organization.upsert({
    where: { slug: 'iit-delhi' },
    update: {},
    create: {
      name: 'IIT Delhi — Computer Science Department',
      slug: 'iit-delhi',
      domain: 'iitd.ac.in',
      logoUrl: 'https://images.unsplash.com/photo-1562774053-701939374585?w=100&h=100&fit=crop',
      status: 'ACTIVE',
      subscriptionTier: 'FREE',
    } as any,
  });
  console.log(`Organization: ${org.name}`);

  const password = await bcrypt.hash('Admin@123456', 12);
  const teacherPassword = await bcrypt.hash('Teacher@123456', 12);
  const evaluatorPassword = await bcrypt.hash('Evaluator@123456', 12);
  const studentPassword = await bcrypt.hash('Student@123456', 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@contestos.io' },
    update: {},
    create: {
      name: 'ContestOS Platform Admin',
      email: 'admin@contestos.io',
      password: password,
      role: 'SUPER_ADMIN' as Role,
      status: 'ACTIVE',
    } as any,
  });
  console.log(`Super Admin: ${superAdmin.email}`);

  const orgAdmin = await prisma.user.upsert({
    where: { email: 'admin@iitd.ac.in' },
    update: {},
    create: {
      name: 'Dr. Priya Gupta',
      email: 'admin@iitd.ac.in',
      password: password,
      role: 'ORG_ADMIN' as Role,
      organizationId: org.id,
      status: 'ACTIVE',
    } as any,
  });
  console.log(`Org Admin: ${orgAdmin.email}`);

  const orgMember = await prisma.user.upsert({
    where: { email: 'teacher@iitd.ac.in' },
    update: {},
    create: {
      name: 'Prof. Rajesh Sharma',
      email: 'teacher@iitd.ac.in',
      password: teacherPassword,
      role: 'ORG_MEMBER' as Role,
      organizationId: org.id,
      status: 'ACTIVE',
    } as any,
  });

  await prisma.user.upsert({
    where: { email: 'prof.raman@iitd.ac.in' },
    update: {},
    create: {
      name: 'Prof. Raman',
      email: 'prof.raman@iitd.ac.in',
      password: teacherPassword,
      role: 'ORG_MEMBER' as Role,
      organizationId: org.id,
      status: 'ACTIVE',
    } as any,
  });
  console.log(`Org Member: ${orgMember.email}`);

  const smePassword = await bcrypt.hash('Sme@123456', 12);
  const proctorPassword = await bcrypt.hash('Proctor@123456', 12);

  const smeUser = await prisma.user.upsert({
    where: { email: 'sme@contestos.io' },
    update: {},
    create: {
      name: 'Dr. Ananya Sharma (SME)',
      email: 'sme@contestos.io',
      password: smePassword,
      role: 'PLATFORM_CONTENT_AUTHOR' as Role,
      status: 'ACTIVE',
    } as any,
  });
  console.log(`Platform SME: ${smeUser.email}`);

  const proctorUser = await prisma.user.upsert({
    where: { email: 'proctor@iitd.ac.in' },
    update: {},
    create: {
      name: 'Rohan Sharma (Proctor)',
      email: 'proctor@iitd.ac.in',
      password: proctorPassword,
      role: 'PROCTOR' as Role,
      organizationId: org.id,
      status: 'ACTIVE',
    } as any,
  });
  console.log(`Proctor: ${proctorUser.email}`);

  const evaluator = await prisma.user.upsert({
    where: { email: 'evaluator@iitd.ac.in' },
    update: {},
    create: {
      name: 'Dr. Anita Verma',
      email: 'evaluator@iitd.ac.in',
      password: evaluatorPassword,
      role: 'EVALUATOR' as Role,
      organizationId: org.id,
      status: 'ACTIVE',
    } as any,
  });
  console.log(`Evaluator: ${evaluator.email}`);

  const analyticsPassword = await bcrypt.hash('Analytics@123456', 12);
  const analyticsUser = await prisma.user.upsert({
    where: { email: 'analytics@iitd.ac.in' },
    update: {},
    create: {
      name: 'Vikram Sethi (HR Analytics)',
      email: 'analytics@iitd.ac.in',
      password: analyticsPassword,
      role: 'ANALYTICS_VIEWER' as Role,
      organizationId: org.id,
      status: 'ACTIVE',
    } as any,
  });
  console.log(`Analytics Viewer: ${analyticsUser.email}`);

  const moderatorPassword = await bcrypt.hash('Moderator@123456', 12);
  const moderatorUser = await prisma.user.upsert({
    where: { email: 'moderator@iitd.ac.in' },
    update: {},
    create: {
      name: 'Prof. K. K. Sharma (Chief Examiner)',
      email: 'moderator@iitd.ac.in',
      password: moderatorPassword,
      role: 'CONTEST_MODERATOR' as Role,
      organizationId: org.id,
      status: 'ACTIVE',
    } as any,
  });
  console.log(`Contest Moderator: ${moderatorUser.email}`);

  const compliancePassword = await bcrypt.hash('Compliance@123456', 12);
  const complianceUser = await prisma.user.upsert({
    where: { email: 'compliance@iitd.ac.in' },
    update: {},
    create: {
      name: 'Sunita Rao (GDPR & Compliance)',
      email: 'compliance@iitd.ac.in',
      password: compliancePassword,
      role: 'COMPLIANCE_OFFICER' as Role,
      organizationId: org.id,
      status: 'ACTIVE',
    } as any,
  });
  console.log(`Compliance Officer: ${complianceUser.email}`);

  const student = await prisma.user.upsert({
    where: { email: 'student@iitd.ac.in' },
    update: {},
    create: {
      name: 'Aarav Patel',
      email: 'student@iitd.ac.in',
      password: studentPassword,
      role: 'STUDENT' as Role,
      organizationId: org.id,
      status: 'ACTIVE',
    } as any,
  });

  await prisma.user.upsert({
    where: { email: 'rahul@iitd.ac.in' },
    update: {},
    create: {
      name: 'Rahul Kumar',
      email: 'rahul@iitd.ac.in',
      password: studentPassword,
      role: 'STUDENT' as Role,
      organizationId: org.id,
      status: 'ACTIVE',
    } as any,
  });
  console.log(`Student: ${student.email}`);

  console.log('');
  console.log('=== ContestOS Seed Complete (Only Quick Access Accounts Retained) ===');
  console.log('  Super Admin : admin@contestos.io     / Admin@123456');
  console.log('  Org Admin   : admin@iitd.ac.in      / Admin@123456');
  console.log('  Org Member  : teacher@iitd.ac.in     / Teacher@123456');
  console.log('  Evaluator   : evaluator@iitd.ac.in   / Evaluator@123456');
  console.log('  Student     : student@iitd.ac.in     / Student@123456');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

