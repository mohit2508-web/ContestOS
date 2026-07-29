import prisma from './lib/prisma';

async function main() {
  const problem = await prisma.problem.findFirst({
    where: {
      OR: [
        { title: { contains: 'Validate Binary Search Tree', mode: 'insensitive' } },
        { slug: { contains: 'validate-binary-search-tree', mode: 'insensitive' } }
      ]
    },
    include: {
      testCases: true
    }
  });

  console.log('PROBLEM:', JSON.stringify(problem, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
