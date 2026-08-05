import prisma from './src/lib/prisma';

async function main() {
  const tables = [
    'ContestSection', 'QuizPassage', 'QuizQuestion', 'QuizOption',
    'QuizAttemptQuestion', 'QuizResponse', 'QuizItemAnalytics',
    'Contest', 'User', 'Problem', 'TestCase', 'Submission'
  ];

  for (const t of tables) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS "${t}" SET (schema_locked = false);`);
      console.log(`Unlocked "${t}"`);
    } catch (err: any) {
      console.log(`Notice for "${t}":`, err?.message || String(err));
    }
  }
  await prisma.$disconnect();
}

main().catch(console.error);
