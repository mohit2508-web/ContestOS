import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

declare const process: any;

const prisma = new PrismaClient();

async function main() {
  console.log('Starting ContestOS Database Seeding...');

  const org = await prisma.organization.upsert({
    where: { slug: 'iit-delhi' },
    update: {},
    create: {
      name: 'IIT Delhi — Computer Science Department',
      slug: 'iit-delhi',
      domain: 'iitd.ac.in',
      logoUrl: 'https://images.unsplash.com/photo-1562774053-701939374585?w=100&h=100&fit=crop',
      status: 'ACTIVE',
      subscriptionTier: 'FREE',
    } as any,
  });
  console.log(`Organization: ${org.name}`);

  const password = await bcrypt.hash('Admin@123456', 12);
  const teacherPassword = await bcrypt.hash('Teacher@123456', 12);
  const evaluatorPassword = await bcrypt.hash('Evaluator@123456', 12);
  const studentPassword = await bcrypt.hash('Student@123456', 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@contestos.io' },
    update: {},
    create: {
      name: 'ContestOS Platform Admin',
      email: 'admin@contestos.io',
      password: password,
      role: 'SUPER_ADMIN' as Role,
      status: 'ACTIVE',
    } as any,
  });
  console.log(`Super Admin: ${superAdmin.email}`);

  const orgAdmin = await prisma.user.upsert({
    where: { email: 'admin@iitd.ac.in' },
    update: {},
    create: {
      name: 'Dr. Priya Gupta',
      email: 'admin@iitd.ac.in',
      password: password,
      role: 'ORG_ADMIN' as Role,
      organizationId: org.id,
      status: 'ACTIVE',
    } as any,
  });
  console.log(`Org Admin: ${orgAdmin.email}`);

  const orgMember = await prisma.user.upsert({
    where: { email: 'teacher@iitd.ac.in' },
    update: {},
    create: {
      name: 'Prof. Rajesh Sharma',
      email: 'teacher@iitd.ac.in',
      password: teacherPassword,
      role: 'ORG_MEMBER' as Role,
      organizationId: org.id,
      status: 'ACTIVE',
    } as any,
  });

  await prisma.user.upsert({
    where: { email: 'prof.raman@iitd.ac.in' },
    update: {},
    create: {
      name: 'Prof. Raman',
      email: 'prof.raman@iitd.ac.in',
      password: teacherPassword,
      role: 'ORG_MEMBER' as Role,
      organizationId: org.id,
      status: 'ACTIVE',
    } as any,
  });
  console.log(`Org Member: ${orgMember.email}`);

  const smePassword = await bcrypt.hash('Sme@123456', 12);
  const proctorPassword = await bcrypt.hash('Proctor@123456', 12);

  const smeUser = await prisma.user.upsert({
    where: { email: 'sme@contestos.io' },
    update: {},
    create: {
      name: 'Dr. Ananya Sharma (SME)',
      email: 'sme@contestos.io',
      password: smePassword,
      role: 'PLATFORM_CONTENT_AUTHOR' as Role,
      status: 'ACTIVE',
    } as any,
  });
  console.log(`Platform SME: ${smeUser.email}`);

  const proctorUser = await prisma.user.upsert({
    where: { email: 'proctor@iitd.ac.in' },
    update: {},
    create: {
      name: 'Rohan Sharma (Proctor)',
      email: 'proctor@iitd.ac.in',
      password: proctorPassword,
      role: 'PROCTOR' as Role,
      organizationId: org.id,
      status: 'ACTIVE',
    } as any,
  });
  console.log(`Proctor: ${proctorUser.email}`);

  const evaluator = await prisma.user.upsert({
    where: { email: 'evaluator@iitd.ac.in' },
    update: {},
    create: {
      name: 'Dr. Anita Verma',
      email: 'evaluator@iitd.ac.in',
      password: evaluatorPassword,
      role: 'EVALUATOR' as Role,
      organizationId: org.id,
      status: 'ACTIVE',
    } as any,
  });
  console.log(`Evaluator: ${evaluator.email}`);

  const student = await prisma.user.upsert({
    where: { email: 'student@iitd.ac.in' },
    update: {},
    create: {
      name: 'Aarav Patel',
      email: 'student@iitd.ac.in',
      password: studentPassword,
      role: 'STUDENT' as Role,
      organizationId: org.id,
      status: 'ACTIVE',
    } as any,
  });

  await prisma.user.upsert({
    where: { email: 'rahul@iitd.ac.in' },
    update: {},
    create: {
      name: 'Rahul Kumar',
      email: 'rahul@iitd.ac.in',
      password: studentPassword,
      role: 'STUDENT' as Role,
      organizationId: org.id,
      status: 'ACTIVE',
    } as any,
  });
  console.log(`Student: ${student.email}`);

  const problem = await prisma.problem.upsert({
    where: { slug: 'sudoku-solver' },
    update: {},
    create: {
      title: 'Sudoku Solver',
      slug: 'sudoku-solver',
      difficulty: 'Hard',
      category: 'Backtracking',
      problemType: 'code',
      evaluationStrategy: 'EXACT_MATCH',
      description: `You are given a partially filled 9x9 Sudoku board. Write a program to solve the puzzle by filling the empty cells.

A sudoku solution must satisfy **all of the following rules**:
1. Each of the digits \`1-9\` must occur exactly once in each row.
2. Each of the digits \`1-9\` must occur exactly once in each column.
3. Each of the digits \`1-9\` must occur exactly once in each of the 9 \`3x3\` sub-boxes of the grid.

The character \`'.'\` indicates an empty cell.

**Input Format:**
The input consists of 9 lines, each containing exactly 9 characters (digits \`1\`-\`9\` or \`.\`), representing the initial board row by row.

**Output Format:**
Print 9 lines, each containing 9 characters, representing the fully solved board row by row.`,
      referenceSolution: `import java.util.*;
import java.io.*;

public class Main {
    static char[][] board = new char[9][9];

    static boolean isValid(int row, int col, char d) {
        int boxRow = (row / 3) * 3, boxCol = (col / 3) * 3;
        for (int i = 0; i < 9; i++) {
            if (board[row][i] == d) return false;
            if (board[i][col] == d) return false;
            if (board[boxRow + i / 3][boxCol + i % 3] == d) return false;
        }
        return true;
    }

    static boolean solve() {
        for (int r = 0; r < 9; r++) {
            for (int c = 0; c < 9; c++) {
                if (board[r][c] == '.') {
                    for (char d = '1'; d <= '9'; d++) {
                        if (isValid(r, c, d)) {
                            board[r][c] = d;
                            if (solve()) return true;
                            board[r][c] = '.';
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }

    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        for (int i = 0; i < 9; i++) {
            String line = br.readLine().trim();
            for (int j = 0; j < 9; j++) board[i][j] = line.charAt(j);
        }
        solve();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 9; i++) {
            sb.append(new String(board[i])).append('\\n');
        }
        System.out.print(sb);
    }
}`,
      starterCode: {
        java: `import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    static char[][] board = new char[9][9];\n\n    public static void main(String[] args) throws IOException {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        for (int i = 0; i < 9; i++) {\n            String line = br.readLine().trim();\n            for (int j = 0; j < 9; j++) board[i][j] = line.charAt(j);\n        }\n        // TODO: Solve Sudoku and print board\n    }\n}`,
        cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nchar board[9][9];\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    for (int i = 0; i < 9; i++) {\n        string line;\n        cin >> line;\n        for (int j = 0; j < 9; j++) board[i][j] = line[j];\n    }\n    // TODO: Solve Sudoku and print board\n    return 0;\n}`,
        python: `import sys\ninput = sys.stdin.readline\n\nboard = [list(input().strip()) for _ in range(9)]\n# TODO: Solve Sudoku and print board`,
        javascript: `const lines = require('fs').readFileSync(0, 'utf8').trim().split('\\n');\nconst board = [];\nfor (let i = 0; i < 9; i++) board.push(lines[i].trim().split(''));\n// TODO: Solve Sudoku and print board`,
      },
      organizationId: org.id,
      testCases: {
        create: [
          {
            input: "53..7....\n6..195...\n.98....6.\n8...6...3\n4..8.3..1\n7...2...6\n.6....28.\n...419..5\n....8..79",
            expectedOutput: "534678912\n672195348\n198342567\n859761423\n426853791\n713924856\n961537284\n287419635\n345286179",
            isHidden: false,
            order: 1,
          },
          {
            input: "8........\n..36.....\n.7..9.2..\n.5...7...\n....457..\n...1...3.\n..1....68\n..85...1.\n.9....4..",
            expectedOutput: "812753649\n943682175\n675491283\n154237896\n369845721\n287169534\n521974368\n438526917\n796318452",
            isHidden: true,
            order: 2,
          },
        ],
      },
    },
  });
  console.log(`Problem: ${problem.title}`);

  const now = new Date();
  const startTime = new Date(now.getTime() - 1000 * 60 * 10);
  const endTime = new Date(now.getTime() + 1000 * 60 * 60 * 3);

  const contest = await prisma.contest.upsert({
    where: { id: 'seed-contest-001' },
    update: {},
    create: {
      id: 'seed-contest-001',
      title: 'IIT Delhi Grand Coding Championship 2026',
      description: 'Official Annual Competitive Programming Contest for IIT Delhi Students. SEB Enforcement enabled.',
      startTime: startTime,
      endTime: endTime,
      duration: 180,
      difficulty: 'Hard',
      isPublic: true,
      allowJoin: true,
      requireSeb: true,
      sebQuitPassword: 'Quit123',
      requireFullscreen: true,
      preventTabSwitch: true,
      disableCopyPaste: true,
      enableProctoring: true,
      maxWarnings: 3,
      organizationId: org.id,
      createdById: orgAdmin.id,
      problems: {
        create: [
          {
            problemId: problem.id,
            points: 100,
            order: 1,
          },
        ],
      },
    },
  });
  console.log(`Contest: ${contest.title}`);

  await (prisma as any).contestAssignment.upsert({
    where: { contestId_userId: { contestId: contest.id, userId: orgMember.id } },
    update: {},
    create: {
      contestId: contest.id,
      userId: orgMember.id,
      assignedById: orgAdmin.id,
      role: 'PROCTOR',
    },
  });

  await (prisma as any).contestAssignment.upsert({
    where: { contestId_userId: { contestId: contest.id, userId: evaluator.id } },
    update: {},
    create: {
      contestId: contest.id,
      userId: evaluator.id,
      assignedById: orgAdmin.id,
      role: 'EVALUATOR',
    },
  });
  console.log('Contest assignments created');

  await (prisma as any).auditLog.create({
    data: {
      userId: superAdmin.id,
      organizationId: org.id,
      action: 'SEED_COMPLETE',
      resource: 'system',
      details: { message: 'Database seeded successfully with demo data' },
    },
  });

  console.log('');
  console.log('=== ContestOS Seed Complete ===');
  console.log('');
  console.log('Demo Accounts:');
  console.log('  Super Admin : admin@contestos.io     / Admin@123456');
  console.log('  Org Admin   : admin@iitd.ac.in      / Admin@123456');
  console.log('  Org Member  : teacher@iitd.ac.in     / Teacher@123456');
  console.log('  Evaluator   : evaluator@iitd.ac.in   / Evaluator@123456');
  console.log('  Student     : student@iitd.ac.in     / Student@123456');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
