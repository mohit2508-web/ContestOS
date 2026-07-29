import prisma from './lib/prisma';

async function main() {
  const problems = await prisma.problem.findMany({
    where: {
      id: {
        in: [
          'fe520906-101d-4dd9-b89d-4c9e9a4c7132',
          'c3a35bb1-1a40-4eb4-b186-b54dde76d351',
          '836fbb94-7df4-43c4-bc9b-3c643a4c877d'
        ]
      }
    },
    select: {
      id: true,
      title: true,
      starterCode: true
    }
  });

  console.log('STARTER CODES:', JSON.stringify(problems, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
