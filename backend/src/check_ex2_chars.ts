import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const problems = await prisma.problem.findMany();
  for (const p of problems) {
    if (p.images && (p.images as any).example2) {
      const ex2Str = (p.images as any).example2 as string;
      console.log(`\n========================================`);
      console.log(`ID: ${p.id} | Title: ${p.title}`);
      console.log(`ex2Str length:`, ex2Str.length);
      console.log(`Contains newlines:`, ex2Str.includes('\n') || ex2Str.includes('\r'));
      console.log(`Contains closing paren ')':`, ex2Str.includes(')'));
      console.log(`Contains space ' ':`, ex2Str.includes(' '));
      if (ex2Str.includes(')')) {
        console.log(`Index of ')' in ex2Str:`, ex2Str.indexOf(')'));
        console.log(`Substring around ')':`, ex2Str.substring(Math.max(0, ex2Str.indexOf(')') - 20), ex2Str.indexOf(')') + 20));
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
