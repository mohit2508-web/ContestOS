import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const problems = await prisma.problem.findMany();
  console.log(`Found ${problems.length} problems in database.`);
  problems.forEach(p => {
    console.log(`\n--- Problem ID: ${p.id} | Title: ${p.title} ---`);
    console.log(`Images column type:`, typeof p.images, p.images);
    console.log(`Description preview (first 200 chars):`, p.description?.substring(0, 200));
    if (p.description?.includes('![') || (p.images && Object.keys(p.images as object).length > 0)) {
      console.log(`Description contains images markdown or images JSON!`);
    }
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
