import { PrismaClient, QuestionReviewStatus, QuestionType } from './generated/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding real UNDER_REVIEW governance questions into CockroachDB...');

  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: `author_${Date.now()}@contestos.io`,
        name: 'Tech Lead Author',
        password: 'hashed_password',
      },
    });
  }

  // 1. Single Select MCQ
  const q1 = await prisma.quizQuestion.create({
    data: {
      questionType: QuestionType.SINGLE_SELECT,
      reviewStatus: QuestionReviewStatus.UNDER_REVIEW,
      content: 'Which of the following data structures operates on a Last-In, First-Out (LIFO) principle?',
      difficulty: 2,
      category: 'Technical',
      topic: 'Data Structures',
      points: 4.0,
      negativeMarking: 1.0,
      explanation: 'A Stack follows the Last-In, First-Out (LIFO) order.',
      options: {
        create: [
          { content: 'Queue', isCorrect: false, displayOrder: 1 },
          { content: 'Stack', isCorrect: true, displayOrder: 2 },
          { content: 'Array', isCorrect: false, displayOrder: 3 },
          { content: 'Linked List', isCorrect: false, displayOrder: 4 },
        ],
      },
    },
  });

  // 2. Multi Select MCQ
  const q2 = await prisma.quizQuestion.create({
    data: {
      questionType: QuestionType.MULTI_SELECT,
      reviewStatus: QuestionReviewStatus.UNDER_REVIEW,
      content: 'Which of the following are valid React Hooks introduced in React 16.8?',
      difficulty: 3,
      category: 'Technical',
      topic: 'React',
      points: 4.0,
      negativeMarking: 1.0,
      explanation: 'useState and useEffect are core React Hooks.',
      options: {
        create: [
          { content: 'useState', isCorrect: true, displayOrder: 1 },
          { content: 'useEffect', isCorrect: true, displayOrder: 2 },
          { content: 'useComponentLifecycle', isCorrect: false, displayOrder: 3 },
          { content: 'useRender', isCorrect: false, displayOrder: 4 },
        ],
      },
    },
  });

  // 3. Numeric Question
  const q3 = await prisma.quizQuestion.create({
    data: {
      questionType: QuestionType.NUMERIC,
      reviewStatus: QuestionReviewStatus.UNDER_REVIEW,
      content: 'What is the worst-case time complexity exponent k for Bubble Sort O(n^k)?',
      difficulty: 1,
      category: 'Technical',
      topic: 'Algorithms',
      points: 4.0,
      negativeMarking: 1.0,
      explanation: 'Bubble sort requires O(n^2) comparisons.',
      options: {
        create: [
          { content: '2', isCorrect: true, displayOrder: 1 },
        ],
      },
    },
  });

  // 4. Fill in the Blank
  const q4 = await prisma.quizQuestion.create({
    data: {
      questionType: QuestionType.FILL_BLANK,
      reviewStatus: QuestionReviewStatus.UNDER_REVIEW,
      content: 'In SQL, which clause is used to filter aggregated groups after a GROUP BY statement?',
      difficulty: 2,
      category: 'Technical',
      topic: 'DBMS',
      points: 4.0,
      negativeMarking: 1.0,
      explanation: 'The HAVING clause filters aggregated groups.',
      options: {
        create: [
          { content: 'HAVING', isCorrect: true, displayOrder: 1 },
        ],
      },
    },
  });

  console.log(`Seeded 4 real UNDER_REVIEW questions in DB: ${q1.id}, ${q2.id}, ${q3.id}, ${q4.id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
