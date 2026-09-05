import prisma from './lib/prisma.js';

async function main() {
  const contests = await prisma.contest.findMany({
    select: {
      id: true,
      title: true,
      createdAt: true,
    },
  });

  console.log(`Total contests in database: ${contests.length}`);
  console.log(JSON.stringify(contests, null, 2));

  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
