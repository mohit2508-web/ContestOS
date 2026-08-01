import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const problems = await prisma.problem.findMany();
  problems.forEach(p => {
    console.log(`\n========================================`);
    console.log(`ID: ${p.id} | Title: ${p.title}`);
    console.log(`Images:`, JSON.stringify(p.images));
    console.log(`Description Full Text:\n${p.description}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
