import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.problem.findFirst({
    where: { title: { contains: 'Second Highest' } },
  });
  console.log('=== PROBLEM RECORD ===');
  console.log('ID:', p?.id);
  console.log('Title:', p?.title);
  console.log('problemType:', p?.problemType);
  console.log('starterCode:', JSON.stringify(p?.starterCode, null, 2));
}

main().finally(() => prisma.$disconnect());
