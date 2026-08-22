/// <reference types="node" />
import prisma from './lib/prisma';

export async function seedCapgeminiLcmProblem() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Problem" ADD COLUMN IF NOT EXISTS "aiCreditsRemaining" INT4 DEFAULT 2000;`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Problem" ADD COLUMN IF NOT EXISTS "aiCreditsMax" INT4 DEFAULT 2000;`).catch(() => {});

    const existing = await prisma.problem.findFirst({
      where: { slug: 'lcm-of-two-trees-c' },
      select: { id: true, title: true, slug: true, problemType: true }
    }).catch(() => null);

    if (existing) {
      if (existing.problemType !== 'vibe-code' || existing.title !== '01. LCM of Two Binary Trees') {
        await prisma.problem.update({
          where: { id: existing.id },
          data: { problemType: 'vibe-code', title: '01. LCM of Two Binary Trees' },
          select: { id: true }
        }).catch(() => null);
      }
      return existing;
    }

    const problem = await prisma.problem.create({
      data: {
        title: '01. LCM of Two Binary Trees',
        slug: 'lcm-of-two-trees-c',
        description: `### Explanation
LCM of corresponding node values:
- \`(1, 4) = 4\`
- \`(2, 6) = 6\`
- \`(3, 8) = 24\`
- \`(4, null) = 4\`
- \`(5, 2) = 10\`
- \`(9, null) = 9\`

### Sample input
**root1:**
\`\`\`
      2
    /   \\
   3     5
        / \\
       1   7
\`\`\`

**root2:**
\`\`\`
      5
    /   \\
   6     3
        / \\
       2   8
\`\`\`

### Sample Output
\`\`\`
     10
    /  \\
   6   15
      /  \\
     2   56
\`\`\`

### Instructions
- This is a template based question, **DO NOT write the "main" function**.
- Your code is judged by an automated system, do not write any additional welcome/greeting messages.
- "Save and Test" only checks for basic test cases, more rigorous cases will be used to judge your code while scoring.
- Additional score will be given for writing optimized code both in terms of space and time.`,
        difficulty: 'Medium',
        category: 'Trees & Recursion',
        problemType: 'vibe-code',
        isPublic: true,
        starterCode: {
          c: `/* Read-only code below... */
struct TreeNode
{
    int data;
    int val;
    struct TreeNode* left;
    struct TreeNode* right;
};

/* Modify or complete the below code as needed... */
struct TreeNode* LCMOfTrees(struct TreeNode* root1, struct TreeNode* root2)
{
    /* Write your code here. */
}`
        },
        testCases: {
          create: [
            {
              input: 'root1: [2, 3, 5, null, null, 1, 7], root2: [5, 6, 3, null, null, 2, 8]',
              expectedOutput: '[10, 6, 15, null, null, 2, 56]',
              isHidden: false,
              order: 1
            }
          ]
        }
      },
      select: { id: true }
    }).catch((err) => {
      console.warn('Could not persist problem to DB (running offline mode):', err.message);
      return null;
    });

    return problem;
  } catch (err: any) {
    console.warn('DB Seeding Note:', err.message);
    return null;
  }
}

if (require.main === module) {
  seedCapgeminiLcmProblem()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
