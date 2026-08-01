import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const problems = await prisma.problem.findMany();
  for (const p of problems) {
    if (p.description.includes('![') || p.description.includes('Example 2 Figure') || p.description.includes('Main Figure')) {
      console.log(`\n========================================`);
      console.log(`ID: ${p.id} | Title: "${p.title}"`);
      console.log(`DESCRIPTION HAS HARDCODED FIGURE TAGS!`);
      const lines = p.description.split('\n');
      lines.forEach((l, i) => {
        if (l.includes('![')) {
          console.log(`  Line ${i + 1}: ${l.substring(0, 100)}...`);
        }
      });
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
