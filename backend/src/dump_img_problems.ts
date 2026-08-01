import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const problems = await prisma.problem.findMany();
  for (const p of problems) {
    if (p.images && Object.keys(p.images as object).length > 0) {
      console.log(`\n========================================`);
      console.log(`ID: ${p.id} | Title: ${p.title}`);
      console.log(`Images keys:`, Object.keys(p.images as object));
      console.log(`Full Description:\n${p.description}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
