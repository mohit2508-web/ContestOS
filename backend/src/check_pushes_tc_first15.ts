import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const p = await prisma.problem.findUnique({
    where: { id: '12b2b9a9-219e-4b64-8840-bfefb10e8eaa' },
    include: { testCases: true }
  });

  if (!p) return;
  console.log(`Problem "${p.title}" has ${p.testCases.length} total test cases.`);
  p.testCases.slice(0, 15).forEach((tc: any, idx: number) => {
    console.log(`TC #${idx + 1}: isHidden=${tc.isHidden}, input="${tc.input}", expectedOutput="${tc.expectedOutput}"`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
