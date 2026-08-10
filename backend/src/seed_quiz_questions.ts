import prisma from './lib/prisma';
import process from 'process';

async function main() {
  console.log('🌱 Seeding Quiz & MCQ Questions into CockroachDB...');

  // Find or create a demo contest
  let contest = await prisma.contest.findFirst({
    where: { title: { contains: 'Aptitude' } },
  });

  if (!contest) {
    const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    if (!admin) {
      console.log('No super admin found. Run seed script after admin creation.');
      return;
    }

    contest = await prisma.contest.create({
      data: {
        title: 'National Aptitude & Technical Scholarship Contest 2026',
        description: 'Comprehensive 3-round contest with Aptitude Quiz, Web Dev Playground, and Data Structures.',
        startTime: new Date(),
        endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        duration: 90,
        difficulty: 'Hard',
        createdById: admin.id,
      },
    });
  }

  // Create or update Quiz ContestSection
  let section = await prisma.contestSection.findFirst({
    where: { contestId: contest.id, title: 'Aptitude & Technical MCQ Round' },
  });

  if (!section) {
    section = await prisma.contestSection.create({
      data: {
        contestId: contest.id,
        title: 'Aptitude & Technical MCQ Round',
        sectionType: 'QUIZ',
        order: 1,
        duration: 30,
        sectionLocked: true,
        weight: 1.0,
      },
    });
  }

  // Seed Passage
  let passage = await prisma.quizPassage.findFirst({
    where: { sectionId: section.id },
  });

  if (!passage) {
    passage = await prisma.quizPassage.create({
      data: {
        sectionId: section.id,
        title: 'Logical Deduction & Set Relations',
        passageType: 'logical_set',
        content: 'Consider three abstract finite sets $A$, $B$, and $C$. All elements in $A$ are contained within $B$, and no elements in $B$ overlap with set $C$.',
      },
    });
  }

  // Delete existing questions in section to refresh
  await prisma.quizQuestion.deleteMany({ where: { sectionId: section.id } });

  // Question 1: Single Select (Passage-linked)
  await prisma.quizQuestion.create({
    data: {
      sectionId: section.id,
      passageId: passage.id,
      questionType: 'SINGLE_SELECT',
      content: 'Based on the passage, which of the following statements MUST be true regarding sets $A$ and $C$?',
      difficulty: 2,
      category: 'logical',
      points: 4.0,
      negativeMarking: 1.0,
      explanation: 'Since $A \\subseteq B$ and $B \\cap C = \\emptyset$, it follows logically that $A \\cap C = \\emptyset$.',
      options: {
        create: [
          { content: 'Set A and Set C have no elements in common', isCorrect: true, displayOrder: 1 },
          { content: 'Set A is equal to Set C', isCorrect: false, displayOrder: 2 },
          { content: 'Set A contains all elements of Set C', isCorrect: false, displayOrder: 3 },
          { content: 'Cannot be determined', isCorrect: false, displayOrder: 4 },
        ],
      },
    },
  });

  // Question 2: Multi-Select (Weighted Partial Credit)
  await prisma.quizQuestion.create({
    data: {
      sectionId: section.id,
      questionType: 'MULTI_SELECT',
      content: 'Which of the following data structures offer $O(1)$ average time complexity for lookup operations?',
      difficulty: 3,
      category: 'technical',
      points: 4.0,
      negativeMarking: 1.0,
      explanation: 'Hash Tables and Hash Sets provide O(1) average lookup time. Binary Search Trees require O(log N).',
      options: {
        create: [
          { content: 'Hash Table / HashMap', isCorrect: true, displayOrder: 1 },
          { content: 'HashSet', isCorrect: true, displayOrder: 2 },
          { content: 'Balanced Binary Search Tree (AVL)', isCorrect: false, displayOrder: 3 },
          { content: 'Singly Linked List', isCorrect: false, displayOrder: 4 },
        ],
      },
    },
  });

  // Question 3: Numeric Answer
  await prisma.quizQuestion.create({
    data: {
      sectionId: section.id,
      questionType: 'NUMERIC',
      content: 'Solve for $x$: $4x - 12 = 36$. Enter the exact value:',
      difficulty: 1,
      category: 'quant',
      points: 4.0,
      negativeMarking: 1.0,
      explanation: '$4x = 48 \\implies x = 12$.',
    },
  });

  console.log(`✅ Quiz Section "${section.title}" seeded with 3 sample questions.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Quiz seed error:', err);
    process.exit(1);
  });
