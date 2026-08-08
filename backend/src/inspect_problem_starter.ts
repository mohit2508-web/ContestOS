import prisma from './lib/prisma';

async function main() {
  const problem = await prisma.problem.findUnique({
    where: { id: '1fcf031b-0ee9-40a5-9c70-035af88970df' }
  });

  if (!problem) {
    console.error('Problem not found');
    return;
  }

  console.log('--- STARTER CODE ---');
  console.log(JSON.stringify(problem.starterCode, null, 2));
}

main().finally(() => prisma.$disconnect());
