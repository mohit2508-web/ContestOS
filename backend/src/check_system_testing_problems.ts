import prisma from './lib/prisma';

async function main() {
  const contest = await prisma.contest.findUnique({
    where: { id: 'f601f14d-fee0-43e3-8fbf-f7a07018938d' },
    include: {
      problems: {
        include: {
          problem: {
            include: { testCases: true }
          }
        }
      }
    }
  });

  if (!contest) {
    console.log('Contest f601f14d-fee0-43e3-8fbf-f7a07018938d not found');
    return;
  }

  console.log(`Contest: ${contest.title} (${contest.id})`);
  console.log(`Total Problems: ${contest.problems.length}`);

  contest.problems.forEach((cp, idx) => {
    console.log(`\n--- Problem #${idx + 1}: ${cp.problem.title} (${cp.problem.id}) ---`);
    console.log(`Difficulty: ${cp.problem.difficulty}, Type: ${cp.problem.problemType}`);
    console.log(`TestCases Count: ${cp.problem.testCases.length}`);
    cp.problem.testCases.forEach((tc, tIdx) => {
      console.log(`  [TC #${tIdx + 1}] input: "${tc.input.replace(/\n/g, '\\n')}" -> expected: "${tc.expectedOutput.replace(/\n/g, '\\n')}" (hidden: ${tc.isHidden})`);
    });
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
