import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const problems = await prisma.problem.findMany();
  for (const p of problems) {
    if (p.description?.includes('![') || p.description?.includes('data:image')) {
      console.log(`\n========================================`);
      console.log(`Problem ID: ${p.id} | Title: ${p.title}`);
      console.log(`Description contains images or data:image!`);
      const lines = p.description.split('\n');
      lines.forEach((l, idx) => {
        if (l.includes('![') || l.includes('data:image')) {
          console.log(`Line ${idx + 1} (${l.length} chars):`, l.substring(0, 120) + '...');
        }
      });
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
