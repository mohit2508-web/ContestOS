import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const problems = await prisma.problem.findMany();
  console.log(`Total Problems in Database: ${problems.length}`);
  problems.forEach((p: any) => {
    console.log(`\n----------------------------------------`);
    console.log(`ID: ${p.id} | Title: "${p.title}" | Type: ${p.problemType}`);
    const imgObj = (p.images as any) || {};
    const keys = Object.keys(imgObj);
    console.log(`  Images keys: [${keys.join(', ')}]`);
    keys.forEach(k => {
      console.log(`    Slot [${k}]: len = ${imgObj[k]?.length || 0}`);
    });
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
