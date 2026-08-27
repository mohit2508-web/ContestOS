const { PrismaClient } = require('./generated/client');
const prisma = new PrismaClient();

async function testProctorVisibility() {
  console.log('🧪 TESTING PROCTOR CONTEST DRIVE VISIBILITY...');

  const proctor = await prisma.user.findFirst({
    where: { role: 'PROCTOR' }
  });

  if (!proctor) {
    console.log('No proctor user found.');
    return;
  }

  console.log(`Testing query for Proctor: ${proctor.name} (${proctor.email}), OrgID: ${proctor.organizationId}`);

  const visibleContests = await prisma.contest.findMany({
    where: {
      OR: [
        ...(proctor.organizationId ? [{ organizationId: proctor.organizationId }] : []),
        { isPublic: true },
        { assignments: { some: { userId: proctor.id } } },
        { createdById: proctor.id },
      ],
    },
    select: { id: true, title: true, isPublic: true, organizationId: true }
  });

  console.log(`\n🎉 PROCTOR CAN NOW SEE ${visibleContests.length} CONTEST DRIVES:`);
  visibleContests.forEach((c, idx) => {
    console.log(`  ${idx + 1}. "${c.title}" (Public: ${c.isPublic}, OrgID: ${c.organizationId})`);
  });

  await prisma.$disconnect();
}

testProctorVisibility();
