import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const p = await prisma.problem.findUnique({
    where: { id: '12b2b9a9-219e-4b64-8840-bfefb10e8eaa' }
  });

  if (!p) return;
  console.log("=== RAW DB DESCRIPTION ===");
  console.log(JSON.stringify(p.description));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
