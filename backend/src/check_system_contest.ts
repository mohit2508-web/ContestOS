import prisma from './lib/prisma';

async function main() {
  const contests = await prisma.contest.findMany({
    select: { id: true, title: true, isPublic: true, requireSeb: true }
  });

  console.log('ALL CONTESTS:', JSON.stringify(contests, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
