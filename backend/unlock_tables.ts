import prisma from './src/lib/prisma';

async function main() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS "ContestSection" SET (schema_locked = false);`);
    console.log('Unlocked ContestSection if present');
  } catch (err: any) {
    console.log('Unlock notice:', err?.message || String(err));
  } finally {
    await prisma.$disconnect();
  }
}

main();
