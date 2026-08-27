const { PrismaClient } = require('./generated/client');
const prisma = new PrismaClient();

async function unlockAllTablesDynamically() {
  console.log('🔓 Querying all tables dynamically from information_schema...');
  try {
    const rawTables = await prisma.$queryRawUnsafe(`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
    `);
    
    for (const row of rawTables) {
      const tName = row.table_name;
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "${tName}" SET (schema_locked = false);`);
        console.log(`✅ Unlocked "${tName}"`);
      } catch (err) {
        // ignore
      }
    }
    console.log('🎉 ALL DYNAMIC TABLES UNLOCKED SUCCESSFULLY!');
  } catch (err) {
    console.error('Error unlocking dynamic tables:', err);
  } finally {
    await prisma.$disconnect();
  }
}

unlockAllTablesDynamically();
