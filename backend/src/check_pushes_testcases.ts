import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const problems = await prisma.problem.findMany({
    include: { testCases: true }
  });

  for (const p of problems) {
    console.log(`\n========================================`);
    console.log(`ID: ${p.id} | Title: "${p.title}"`);
    console.log(`Total TestCases in DB: ${p.testCases.length}`);
    p.testCases.forEach((tc: any, idx: number) => {
      console.log(`  TC #${idx + 1}: isHidden=${tc.isHidden}, input="${tc.input.replace(/\n/g, '\\n')}", expectedOutput="${tc.expectedOutput.replace(/\n/g, '\\n')}"`);
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
