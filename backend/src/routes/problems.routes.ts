import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, optionalAuth } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';

const router = Router();

function parseTableStructure(schemaDdl: string) {
  if (!schemaDdl || typeof schemaDdl !== 'string') return [];
  const tables: Array<{ name: string; columns: Array<{ name: string; type: string; constraints?: string }> }> = [];
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`?\w+`?\.)?`?(\w+)`?\s*\(([\s\S]*?)\);/gi;
  let tableMatch;
  while ((tableMatch = tableRegex.exec(schemaDdl)) !== null) {
    const tableName = tableMatch[1];
    const columnsBody = tableMatch[2];
    const columns: Array<{ name: string; type: string; constraints?: string }> = [];

    const colLines: string[] = [];
    let current = '';
    let parenDepth = 0;
    for (let i = 0; i < columnsBody.length; i++) {
      const char = columnsBody[i];
      if (char === '(') parenDepth++;
      else if (char === ')') parenDepth--;

      if ((char === ',' || char === '\n') && parenDepth === 0) {
        if (current.trim()) colLines.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) colLines.push(current.trim());

    const filteredLines = colLines.filter(l => {
      const u = l.toUpperCase();
      return l && !u.startsWith('PRIMARY') && !u.startsWith('UNIQUE') && !u.startsWith('INDEX') && !u.startsWith('KEY') && !u.startsWith('CONSTRAINT') && !u.startsWith('FOREIGN');
    });

    for (const line of filteredLines) {
      const clean = line.replace(/,$/, '').trim();
      if (!clean) continue;
      const parts = clean.split(/\s+/);
      if (parts.length >= 2) {
        const name = parts[0].replace(/`/g, '');
        let type = '';
        const constraintParts: string[] = [];
        for (let i = 1; i < parts.length; i++) {
          const p = parts[i];
          const pu = p.toUpperCase();
          if (pu === 'NOT' || pu === 'NULL' || pu === 'PRIMARY' || pu === 'KEY' || pu === 'UNIQUE' || pu === 'AUTO_INCREMENT' || pu === 'DEFAULT') {
            constraintParts.push(p);
          } else if (pu.startsWith('REFERENCES')) {
            constraintParts.push(parts.slice(i).join(' '));
            break;
          } else {
            type += (type ? ' ' : '') + p;
          }
        }
        columns.push({ name, type: type || 'VARCHAR', constraints: constraintParts.join(' ') });
      }
    }
    tables.push({ name: tableName, columns });
  }
  return tables;
}

function formatCanonicalSchema(schemaRaw: any): { setup: string; tables: any[] } | null {
  if (!schemaRaw) return null;
  let setupStr = '';
  if (typeof schemaRaw === 'string') {
    setupStr = schemaRaw;
  } else if (typeof schemaRaw === 'object' && schemaRaw !== null) {
    if (typeof schemaRaw.setup === 'string') setupStr = schemaRaw.setup;
  }
  if (!setupStr) return null;
  const tables = parseTableStructure(setupStr);
  return { setup: setupStr, tables };
}

// GET /api/problems — List problems with Public vs Private bank filtering & RBAC scoping
router.get('/', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { bank, category, difficulty, search, page = '1', limit = '50', type, take, skip: skipQuery } = req.query;
    const user = req.user;
    const userHierarchy = user?.hierarchyLevel ?? 5; // 1 = super_admin, 2 = org_admin, 3 = teacher/member, 5 = student
    const userOrgId = user?.organizationId || null;

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    // Support 'take' param as alias for 'limit' (used by frontend playgrounds)
    const limitNum = take
      ? Math.min(200, Math.max(1, parseInt(String(take), 10) || 50))
      : Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));
    const skip = skipQuery !== undefined
      ? Math.max(0, parseInt(String(skipQuery), 10) || 0)
      : (pageNum - 1) * limitNum;

    // Build problemType filter from 'type' query param
    // Normalize: 'web' and 'web-dev' both map to web-dev problems
    let problemTypeFilter: any = undefined;
    if (type && String(type) !== 'all') {
      const t = String(type).toLowerCase();
      if (t === 'sql') {
        problemTypeFilter = { problemType: 'sql' };
      } else if (t === 'web' || t === 'web-dev' || t === 'web_dev') {
        problemTypeFilter = { problemType: { in: ['web', 'web-dev'] } };
      } else if (t === 'code') {
        problemTypeFilter = { problemType: { in: ['code', 'algorithm', 'algorithmic'] } };
      }
    }

    // Build RBAC Bank Scope Condition
    let bankCondition: any = {};

    if (bank === 'public') {
      // Platform Public Question Bank items
      bankCondition = {
        OR: [
          { isPublic: true },
          { organizationId: null },
        ],
      };
    } else if (bank === 'private') {
      // Organization Private Question Bank items
      if (userHierarchy === 1) {
        // Super Admin sees all private org items or filtered by userOrgId if specified
        bankCondition = userOrgId
          ? { isPublic: false, organizationId: userOrgId }
          : { isPublic: false, organizationId: { not: null } };
      } else if (userOrgId) {
        bankCondition = { isPublic: false, organizationId: userOrgId };
      } else {
        // Unauthenticated or student without org sees 0 private items
        res.json({ problems: [], total: 0, page: pageNum, totalPages: 0 });
        return;
      }
    } else {
      // Default 'all' or unspecified:
      // Super Admin sees everything
      if (userHierarchy === 1) {
        bankCondition = {};
      } else if (userOrgId) {
        // Sees Public Bank + Own Org Private Bank
        bankCondition = {
          OR: [
            { isPublic: true },
            { organizationId: null },
            { isPublic: false, organizationId: userOrgId },
          ],
        };
      } else {
        // Public items only for external/student users
        bankCondition = {
          OR: [
            { isPublic: true },
            { organizationId: null },
          ],
        };
      }
    }

    const whereCondition: any = {
      ...bankCondition,
      ...(problemTypeFilter || {}),
      ...(category && category !== 'all' && { category: String(category) }),
      ...(difficulty && difficulty !== 'all' && { difficulty: String(difficulty) }),
      ...(search && {
        OR: [
          { title: { contains: String(search), mode: 'insensitive' } },
          { slug: { contains: String(search), mode: 'insensitive' } },
        ],
      }),
    };

    const [problems, total] = await Promise.all([
      prisma.problem.findMany({
        where: whereCondition,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true,
          title: true,
          slug: true,
          difficulty: true,
          category: true,
          problemType: true,
          evaluationStrategy: true,
          isPublic: true,
          organizationId: true,
          createdById: true,
          createdAt: true,
          description: true,
          starterCode: true,
          images: true,
          organization: {
            select: { name: true },
          },
          _count: {
            select: { testCases: true, contestProblems: true },
          },
        } as any,
      }),
      prisma.problem.count({ where: whereCondition }),
    ]);

    res.json({
      problems,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error: any) {
    console.error('Fetch problems error:', error);
    res.status(500).json({ error: 'Failed to fetch problems' });
  }
});

// GET /api/problems/:id — Fetch problem details with RBAC testcase filtering
router.get('/:id', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user;
    const userHierarchy = user?.hierarchyLevel ?? 5;

    const problem = await prisma.problem.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      include: {
        organization: { select: { id: true, name: true } },
        testCases: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!problem) {
      res.status(404).json({ error: 'Problem not found' });
      return;
    }

    // Check read access permissions for private questions
    if (!(problem as any).isPublic && problem.organizationId) {
      if (userHierarchy !== 1 && user?.organizationId !== problem.organizationId) {
        res.status(403).json({ error: 'Access denied to private organization problem' });
        return;
      }
    }

    // Determine if user can see hidden testcases & reference solution
    const isStaff = userHierarchy <= 3; // Super admin, org admin, teacher

    // For participants, filter out hidden testcases.
    // If all testcases are hidden, include the 1st testcase as a sample testcase so student has at least 1 testcase to run against!
    let visibleTestCases = problem.testCases.filter((tc) => !tc.isHidden);
    if (!isStaff && visibleTestCases.length === 0 && problem.testCases.length > 0) {
      visibleTestCases = [{ ...problem.testCases[0], isHidden: false }];
    }

    const formattedProblem = {
      ...problem,
      testCases: isStaff ? problem.testCases : visibleTestCases,
      referenceSolution: isStaff ? problem.referenceSolution : null,
    };

    res.json({ problem: formattedProblem });
  } catch (error: any) {
    console.error('Fetch problem detail error:', error);
    res.status(500).json({ error: 'Failed to fetch problem details' });
  }
});

// POST /api/problems — Create new problem in Public or Private bank (RBAC Enforced)
router.post('/', authenticateToken, requireRole('super_admin', 'org_admin', 'org_member'), async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const {
      title,
      slug,
      description,
      difficulty,
      category,
      problemType,
      evaluationStrategy,
      referenceSolution,
      starterCode,
      driverCode,
      isPublic = false,
      testCases,
      images,
      schema,
    } = req.body;

    if (!title || !description) {
      res.status(400).json({ error: 'title and description are required' });
      return;
    }

    // Enforce Public Bank RBAC: Only Super Admin can create Public Bank items
    let targetIsPublic = Boolean(isPublic);
    let targetOrgId = user.organizationId || null;

    if (targetIsPublic) {
      if (user.hierarchyLevel !== 1) {
        res.status(403).json({ error: 'Only Super Admins can create items in the Public Platform Bank' });
        return;
      }
      targetOrgId = null; // Public bank questions are not tied to a specific org
    } else {
      // Private Org Bank requires valid organizationId for non-superadmins
      if (!targetOrgId && user.hierarchyLevel !== 1) {
        res.status(400).json({ error: 'User is not associated with an organization' });
        return;
      }
    }
    const generatedSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now();

    let finalStarterCode: any = typeof starterCode === 'object' && starterCode !== null ? { ...starterCode } : { sql: starterCode || '' };
    const canonicalSchema = formatCanonicalSchema(schema || finalStarterCode.schema);
    if (canonicalSchema) {
      finalStarterCode.schema = canonicalSchema;
    }

    const problem = await prisma.problem.create({
      data: {
        title,
        slug: generatedSlug,
        description,
        difficulty: difficulty || 'Medium',
        category: category || 'General',
        problemType: problemType || 'code',
        evaluationStrategy: evaluationStrategy || 'EXACT_MATCH',
        referenceSolution: referenceSolution || null,
        starterCode: finalStarterCode,
        driverCode: driverCode || null,
        images: images || null,
        isPublic: targetIsPublic,
        organizationId: targetOrgId,
        createdById: user.userId,
        testCases: {
          create: (testCases || []).map((tc: any, idx: number) => ({
            input: tc.input || '',
            expectedOutput: tc.expectedOutput || '',
            isHidden: tc.isHidden ?? false,
            order: idx + 1,
          })),
        },
      } as any,
      include: {
        testCases: true,
        organization: { select: { name: true } },
      },
    });

    res.json({ success: true, problem });
  } catch (error: any) {
    console.error('Error creating problem:', error);
    res.status(500).json({ error: 'Failed to create problem: ' + (error?.message || '') });
  }
});

// PUT /api/problems/:id — Update existing problem (RBAC Scoped)
router.put('/:id', authenticateToken, requireRole('super_admin', 'org_admin', 'org_member'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const existingProblem = await prisma.problem.findUnique({
      where: { id },
      include: { contestProblems: { select: { contestId: true } } },
    });

    if (!existingProblem) {
      res.status(404).json({ error: 'Problem not found' });
      return;
    }

    // Permission Verification:
    // 1. Super Admin (hierarchyLevel === 1) can edit any problem.
    // 2. Org Admin (hierarchyLevel === 2) can edit any problem belonging to their org.
    // 3. Org Member (hierarchyLevel === 3) can edit problems created by self OR assigned contests.
    if (user.hierarchyLevel !== 1) {
      if ((existingProblem as any).isPublic) {
        res.status(403).json({ error: 'Cannot edit Public Platform Bank problems. Copy it to your private bank first.' });
        return;
      }
      if (user.hierarchyLevel === 2 && existingProblem.organizationId !== user.organizationId) {
        res.status(403).json({ error: 'Permission denied: Problem belongs to another organization' });
        return;
      }
      if (user.hierarchyLevel === 3) {
        const isOwner = (existingProblem as any).createdById === user.userId;
        let isAssigned = false;

        if (!isOwner) {
          const contestIds = existingProblem.contestProblems.map((cp) => cp.contestId);
          const assignment = await (prisma as any).contestAssignment.findFirst({
            where: { userId: user.userId, contestId: { in: contestIds } },
          });
          isAssigned = Boolean(assignment);
        }

        if (!isOwner && !isAssigned) {
          res.status(403).json({ error: 'Permission denied: You can only edit problems created by you or assigned contests' });
          return;
        }
      }
    }

    const {
      title,
      description,
      difficulty,
      category,
      problemType,
      evaluationStrategy,
      referenceSolution,
      starterCode,
      driverCode,
      testCases,
      images,
      schema,
    } = req.body;

    // Replace testcases if provided
    if (Array.isArray(testCases)) {
      await prisma.testCase.deleteMany({ where: { problemId: id } });
    }

    let finalStarterCode: any = starterCode !== undefined 
      ? (typeof starterCode === 'object' && starterCode !== null ? { ...starterCode } : { sql: starterCode || '' })
      : (typeof existingProblem.starterCode === 'object' && existingProblem.starterCode !== null ? { ...(existingProblem.starterCode as object) } : {});

    const canonicalSchema = formatCanonicalSchema(schema || finalStarterCode.schema);
    if (canonicalSchema) {
      finalStarterCode.schema = canonicalSchema;
    }

    const updatedProblem = await prisma.problem.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(difficulty && { difficulty }),
        ...(category && { category }),
        ...(problemType && { problemType }),
        ...(evaluationStrategy && { evaluationStrategy }),
        ...(referenceSolution !== undefined && { referenceSolution }),
        starterCode: finalStarterCode,
        ...(driverCode !== undefined && { driverCode }),
        ...(images !== undefined && { images }),
        ...(Array.isArray(testCases) && {
          testCases: {
            create: testCases.map((tc: any, idx: number) => ({
              input: tc.input || '',
              expectedOutput: tc.expectedOutput || '',
              isHidden: tc.isHidden ?? false,
              order: idx + 1,
            })),
          },
        }),
      },
      include: {
        testCases: true,
        organization: { select: { name: true } },
      },
    });

    res.json({ success: true, problem: updatedProblem });
  } catch (error: any) {
    console.error('Update problem error:', error);
    res.status(500).json({ error: 'Failed to update problem' });
  }
});

// DELETE /api/problems/:id — Delete problem from Question Bank
router.delete('/:id', authenticateToken, requireRole('super_admin', 'org_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const problem = await prisma.problem.findUnique({ where: { id } });
    if (!problem) {
      res.status(404).json({ error: 'Problem not found' });
      return;
    }

    // Permission Verification:
    if (user.hierarchyLevel !== 1) {
      if ((problem as any).isPublic || problem.organizationId !== user.organizationId) {
        res.status(403).json({ error: 'Permission denied: Cannot delete this problem' });
        return;
      }
    }

    await prisma.problem.delete({ where: { id } });
    res.json({ success: true, message: 'Problem deleted successfully' });
  } catch (error: any) {
    console.error('Delete problem error:', error);
    res.status(500).json({ error: 'Failed to delete problem' });
  }
});

// POST /api/problems/:id/copy — Clone Public Bank question into Private Org Bank
router.post('/:id/copy', authenticateToken, requireRole('super_admin', 'org_admin', 'org_member'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const original = await prisma.problem.findUnique({
      where: { id },
      include: { testCases: true },
    });

    if (!original) {
      res.status(404).json({ error: 'Original problem not found' });
      return;
    }

    const newTitle = `${original.title} (Copy)`;
    const newSlug = `${original.slug}-copy-${Date.now()}`;

    const clonedProblem = await prisma.problem.create({
      data: {
        title: newTitle,
        slug: newSlug,
        description: original.description,
        difficulty: original.difficulty,
        category: original.category,
        problemType: original.problemType,
        evaluationStrategy: original.evaluationStrategy,
        referenceSolution: original.referenceSolution,
        starterCode: original.starterCode || {},
        driverCode: (original.driverCode as any) || undefined,
        images: (original.images as any) || undefined,
        isPublic: false, // Cloned items become private to user's org
        organizationId: user.organizationId || null,
        createdById: user.userId,
        testCases: {
          create: original.testCases.map((tc) => ({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isHidden: tc.isHidden,
            order: tc.order,
          })),
        },
      } as any,
      include: {
        testCases: true,
      },
    });

    res.json({
      success: true,
      message: 'Problem successfully copied to your organization bank',
      problem: clonedProblem,
    });
  } catch (error: any) {
    console.error('Copy problem error:', error);
    res.status(500).json({ error: 'Failed to copy problem to private bank' });
  }
});

export default router;