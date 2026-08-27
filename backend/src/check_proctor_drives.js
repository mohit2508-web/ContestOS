const { PrismaClient } = require('./generated/client');
const prisma = new PrismaClient();

async function checkProctorDrives() {
  console.log('🔍 CHECKING CONTEST ASSIGNMENTS & PROCTOR ROLES...');

  const proctors = await prisma.user.findMany({
    where: { OR: [{ role: 'PROCTOR' }, { role: 'ORG_ADMIN' }, { role: 'SUPER_ADMIN' }] },
    select: { id: true, name: true, email: true, role: true, organizationId: true }
  });

  console.log(`Found ${proctors.length} Admin/Proctor Users:`);
  console.table(proctors);

  const assignments = await prisma.contestAssignment.findMany({
    include: {
      contest: { select: { title: true } },
      user: { select: { name: true, email: true, role: true } }
    }
  });

  console.log(`\nFound ${assignments.length} Contest Assignments:`);
  assignments.forEach(a => {
    console.log(`- Contest: "${a.contest?.title}" Assigned To: ${a.user?.name} (${a.user?.email}) as Role: ${a.role}`);
  });

  const contests = await prisma.contest.findMany({
    select: { id: true, title: true, createdById: true, organizationId: true, isPublic: true }
  });

  console.log(`\nTotal Contests in DB: ${contests.length}`);
  contests.slice(0, 10).forEach(c => {
    console.log(`- Contest: "${c.title}" | OrgID: ${c.organizationId} | CreatedBy: ${c.createdById}`);
  });

  await prisma.$disconnect();
}

checkProctorDrives();
