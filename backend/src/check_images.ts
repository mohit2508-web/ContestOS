import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const problems = await prisma.problem.findMany();
  for (const p of problems) {
    console.log(`\n========================================`);
    console.log(`ID: ${p.id} | Title: ${p.title}`);
    console.log(`Images:`, JSON.stringify(p.images));
    if (typeof p.images === 'object' && p.images) {
      Object.keys(p.images as object).forEach(k => {
        const val = (p.images as any)[k];
        console.log(`  Key [${k}] length: ${val?.length || 0}, startsWith: ${val?.substring(0, 30)}`);
      });
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
