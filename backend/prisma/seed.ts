import { PrismaClient, Role } from '../src/generated/client';
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
    update: { name: 'Prof. Rajesh Sharma', organizationId: org.id, role: 'ORG_MEMBER' as Role },
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
    update: { name: 'Prof. Raman', organizationId: org.id, role: 'ORG_MEMBER' as Role },
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
    update: { name: 'Dr. Ananya Sharma', role: 'PLATFORM_CONTENT_AUTHOR' as Role },
    create: {
      name: 'Dr. Ananya Sharma',
      email: 'sme@contestos.io',
      password: smePassword,
      role: 'PLATFORM_CONTENT_AUTHOR' as Role,
      status: 'ACTIVE',
    } as any,
  });
  console.log(`Platform SME: ${smeUser.email}`);

  const proctorUser = await prisma.user.upsert({
    where: { email: 'proctor@iitd.ac.in' },
    update: { name: 'Rohan Sharma', organizationId: org.id, role: 'PROCTOR' as Role, lastLoginAt: new Date(Date.now() - 3 * 3600 * 1000) },
    create: {
      name: 'Rohan Sharma',
      email: 'proctor@iitd.ac.in',
      password: proctorPassword,
      role: 'PROCTOR' as Role,
      organizationId: org.id,
      status: 'ACTIVE',
      lastLoginAt: new Date(Date.now() - 3 * 3600 * 1000),
    } as any,
  });
  console.log(`Proctor: ${proctorUser.email}`);

  const evaluator = await prisma.user.upsert({
    where: { email: 'evaluator@iitd.ac.in' },
    update: { name: 'Dr. Anita Verma', organizationId: org.id, role: 'EVALUATOR' as Role, lastLoginAt: new Date(Date.now() - 1 * 3600 * 1000) },
    create: {
      name: 'Dr. Anita Verma',
      email: 'evaluator@iitd.ac.in',
      password: evaluatorPassword,
      role: 'EVALUATOR' as Role,
      organizationId: org.id,
      status: 'ACTIVE',
      lastLoginAt: new Date(Date.now() - 1 * 3600 * 1000),
    } as any,
  });
  console.log(`Evaluator: ${evaluator.email}`);

  const analyticsPassword = await bcrypt.hash('Analytics@123456', 12);
  const analyticsUser = await prisma.user.upsert({
    where: { email: 'analytics@iitd.ac.in' },
    update: { name: 'Vikram Sethi', organizationId: org.id, role: 'ANALYTICS_VIEWER' as Role, lastLoginAt: new Date(Date.now() - 24 * 3600 * 1000) },
    create: {
      name: 'Vikram Sethi',
      email: 'analytics@iitd.ac.in',
      password: analyticsPassword,
      role: 'ANALYTICS_VIEWER' as Role,
      organizationId: org.id,
      status: 'ACTIVE',
      lastLoginAt: new Date(Date.now() - 24 * 3600 * 1000),
    } as any,
  });
  console.log(`Analytics Viewer: ${analyticsUser.email}`);

  const moderatorPassword = await bcrypt.hash('Moderator@123456', 12);
  const moderatorUser = await prisma.user.upsert({
    where: { email: 'moderator@iitd.ac.in' },
    update: { name: 'Prof. K. K. Sharma', organizationId: org.id, role: 'CONTEST_MODERATOR' as Role, lastLoginAt: new Date(Date.now() - 12 * 3600 * 1000) },
    create: {
      name: 'Prof. K. K. Sharma',
      email: 'moderator@iitd.ac.in',
      password: moderatorPassword,
      role: 'CONTEST_MODERATOR' as Role,
      organizationId: org.id,
      status: 'ACTIVE',
      lastLoginAt: new Date(Date.now() - 12 * 3600 * 1000),
    } as any,
  });
  console.log(`Contest Moderator: ${moderatorUser.email}`);

  const compliancePassword = await bcrypt.hash('Compliance@123456', 12);
  const complianceUser = await prisma.user.upsert({
    where: { email: 'compliance@iitd.ac.in' },
    update: { name: 'Sunita Rao', organizationId: org.id, role: 'COMPLIANCE_OFFICER' as Role, lastLoginAt: new Date(Date.now() - 48 * 3600 * 1000) },
    create: {
      name: 'Sunita Rao',
      email: 'compliance@iitd.ac.in',
      password: compliancePassword,
      role: 'COMPLIANCE_OFFICER' as Role,
      organizationId: org.id,
      status: 'ACTIVE',
      lastLoginAt: new Date(Date.now() - 48 * 3600 * 1000),
    } as any,
  });
  console.log(`Compliance Officer: ${complianceUser.email}`);

  const student = await prisma.user.upsert({
    where: { email: 'student@iitd.ac.in' },
    update: { organizationId: null, role: 'STUDENT' as Role },
    create: {
      name: 'Aarav Patel',
      email: 'student@iitd.ac.in',
      password: studentPassword,
      role: 'STUDENT' as Role,
      organizationId: null,
      status: 'ACTIVE',
    } as any,
  });

  await prisma.user.upsert({
    where: { email: 'rahul@iitd.ac.in' },
    update: { organizationId: null, role: 'STUDENT' as Role },
    create: {
      name: 'Rahul Kumar',
      email: 'rahul@iitd.ac.in',
      password: studentPassword,
      role: 'STUDENT' as Role,
      organizationId: null,
      status: 'ACTIVE',
    } as any,
  });
  console.log(`Student: ${student.email}`);

  // Seed GLA University Mathura Organization & Provision Dr. Neeraj Agrawal as active ORG_ADMIN
  let glaOrg = await prisma.organization.findFirst({
    where: { OR: [{ domain: 'gla.ac.in' }, { slug: 'gla-university' }] },
  });

  if (!glaOrg) {
    glaOrg = await prisma.organization.create({
      data: {
        name: 'GLA University Mathura',
        slug: 'gla-university',
        domain: 'gla.ac.in',
        status: 'ACTIVE',
        subscriptionTier: 'PRO',
      },
    });
  }

  const glaPass = await bcrypt.hash('GlaAdmin@123456', 12);
  const neerajAdmin = await prisma.user.upsert({
    where: { email: 'neeraj@gla.ac.in' },
    update: {
      name: 'Dr. Neeraj Agrawal',
      password: glaPass,
      role: 'ORG_ADMIN' as Role,
      organizationId: glaOrg.id,
      status: 'ACTIVE',
    },
    create: {
      name: 'Dr. Neeraj Agrawal',
      email: 'neeraj@gla.ac.in',
      password: glaPass,
      role: 'ORG_ADMIN' as Role,
      organizationId: glaOrg.id,
      status: 'ACTIVE',
      lastLoginAt: new Date(),
    } as any,
  });
  console.log(`GLA Org Admin Provisioned: ${neerajAdmin.email} / GlaAdmin@123456`);

  // Seed historical notifications for Super Admin so notifications are permanently saved
  const adminNotifCount = await prisma.notification.count({ where: { userId: superAdmin.id } });
  if (adminNotifCount === 0) {
    await prisma.notification.createMany({
      data: [
        {
          userId: superAdmin.id,
          title: '🏛️ System Architecture Directive Activated',
          message: 'ContestOS Governance Engine & Security Compliance Protocols initialized successfully.',
          type: 'SYSTEM_ALERT',
          isRead: true,
          createdAt: new Date(Date.now() - 3600000 * 24 * 3),
        },
        {
          userId: superAdmin.id,
          title: '🏢 New Tenant Verification Request — IIT Delhi',
          message: 'Prof. Rajesh Sharma (admin@iitd.ac.in) verified and provisioned under PRO Tier.',
          type: 'SYSTEM_ALERT',
          isRead: true,
          createdAt: new Date(Date.now() - 3600000 * 24),
        },
      ],
    });
  }

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

