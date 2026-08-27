const { PrismaClient } = require('./generated/client');
const prisma = new PrismaClient();

async function assignProctorToDrives() {
  console.log('📌 ASSIGNING PROCTOR TO CONTEST DRIVES...');

  const proctor = await prisma.user.findFirst({
    where: { email: 'proctor@iitd.ac.in' }
  });

  if (!proctor) {
    console.log('No proctor user proctor@iitd.ac.in found');
    return;
  }

  console.log(`Target Proctor: ${proctor.name} (${proctor.id})`);

  const contests = await prisma.contest.findMany({
    select: { id: true, title: true }
  });

  console.log(`Found ${contests.length} total contests to assign to proctor...`);

  for (const c of contests) {
    await prisma.contestAssignment.upsert({
      where: {
        contestId_userId: { contestId: c.id, userId: proctor.id }
      },
      update: {
        role: 'PROCTOR'
      },
      create: {
        contestId: c.id,
        userId: proctor.id,
        assignedById: proctor.id,
        role: 'PROCTOR'
      }
    }).catch(err => console.error('Error assigning:', err.message));
  }

  console.log('🎉 SUCCESSFULLY ASSIGNED ALL RELEVANT DRIVES TO PROCTOR!');
  await prisma.$disconnect();
}

assignProctorToDrives();
