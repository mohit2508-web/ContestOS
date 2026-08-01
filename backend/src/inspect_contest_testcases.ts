import prisma from './lib/prisma';

async function main() {
  const contest = await prisma.contest.findFirst({
    where: { title: { contains: 'System Testing', mode: 'insensitive' } },
    include: {
      problems: {
        include: {
          problem: {
            include: {
              testCases: true,
            },
          },
        },
      },
    },
  });

  if (!contest) {
    console.log('Contest not found!');
    return;
  }

  for (const cp of contest.problems) {
    console.log(`\n========================================`);
    console.log(`PROBLEM: ${cp.problem.title} (ID: ${cp.problem.id})`);
    console.log(`TESTCASES COUNT: ${cp.problem.testCases.length}`);
    for (const tc of cp.problem.testCases) {
      console.log(`--- Testcase ${tc.id} ---`);
      console.log(`INPUT:\n${JSON.stringify(tc.input)}`);
      console.log(`EXPECTED OUTPUT:\n${JSON.stringify(tc.expectedOutput)}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
