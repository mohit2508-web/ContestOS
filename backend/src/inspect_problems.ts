import prisma from './lib/prisma';

async function main() {
  const problems = await prisma.problem.findMany({
    where: { problemType: { in: ['web', 'web-dev'] } },
    include: { testCases: true }
  });

  console.log(`Found ${problems.length} web-dev problems:`);
  for (const p of problems) {
    console.log(`\nProblem ID: ${p.id} | Title: ${p.title}`);
    console.log(`Starter HTML length: ${p.starterCode ? JSON.stringify(p.starterCode).length : 0}`);
    console.log(`Test cases (${p.testCases.length}):`);
    for (const tc of p.testCases) {
      console.log(`  - [ID: ${tc.id}] Input: ${JSON.stringify(tc.input)} | Expected: ${JSON.stringify(tc.expectedOutput)} | Hidden: ${tc.isHidden}`);
    }
  }
}

main().finally(() => prisma.$disconnect());
