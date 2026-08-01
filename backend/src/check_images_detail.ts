import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const problems = await prisma.problem.findMany();
  for (const p of problems) {
    if (p.images) {
      console.log(`\n========================================`);
      console.log(`ID: ${p.id} | Title: ${p.title}`);
      const imgObj = p.images as any;
      Object.keys(imgObj).forEach(k => {
        const val = imgObj[k];
        console.log(`  Key [${k}]: type=${typeof val}, length=${val?.length || 0}, startsWith=${val?.substring?.(0, 40) || ''}`);
      });
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
