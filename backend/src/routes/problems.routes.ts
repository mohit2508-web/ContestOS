import { Router, Request, Response } from "express";
import { authenticateToken } from "../middlewares/auth";
import { requireMinLevel } from "../middlewares/rbac";
import prisma from "../lib/prisma";
import { cacheWithFallback, delCache, delCacheByPattern } from "../lib/cacheUtils";
import multer from "multer";
import path from "path";
import fs from "fs";
import { searchYouTubeSolution } from "../services/ai.service";

const router = Router();

const problemImageUploadDir = path.resolve(process.cwd(), "uploads/problems");
if (!fs.existsSync(problemImageUploadDir)) {
  fs.mkdirSync(problemImageUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, problemImageUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `problem-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".png" || ext === ".jpg" || ext === ".jpeg" || ext === ".webp" || ext === ".gif") {
      cb(null, true);
    } else {
      cb(new Error("Only images (.png, .jpg, .jpeg, .webp, .gif) are allowed"));
    }
  },
});

router.post("/upload-image", authenticateToken, upload.single("image"), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    const fileUrl = `/uploads/problems/${file.filename}`;
    res.json({ url: fileUrl });
  } catch (error: any) {
    console.error("Error uploading problem image:", error);
    res.status(500).json({ error: "Failed to upload image" });
  }
});

interface ProblemBody {
  title: string;
  description: string;
  difficulty: string;
  category?: string;
  problemType?: string;
  testCases: Array<{ input: string; expectedOutput: string; orderIndependent?: boolean; isHidden?: boolean; setup?: string }>;
  starterCode: Record<string, string>;
  hints?: string;
  solution?: string;
  referenceSolution?: string;
  evaluationStrategy?: string;
  executionMode?: string;
  timeLimit?: number;
  memoryLimit?: number;
  isPublic?: boolean;
  schema?: { setup?: string; tables?: string[] };
  images?: Record<string, string>;
  driverCode?: Record<string, string>;
}

router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { type, skip, take, search } = req.query as { type?: string; skip?: string; take?: string; search?: string };
    
    const where: any = { isPublic: true };
    
    if (type === "web-dev") {
      where.problemType = "web-dev";
    } else if (type === "code") {
      where.problemType = "code";
    } else if (type === "sql") {
      where.problemType = "sql";
    } else if (type === "free" || !type) {
      // no filter
    }

    if (search) {
      where.title = { contains: search, mode: "insensitive" };
    }
    
    const skipNum = Math.max(0, parseInt(skip || "0"));
    const takeNum = Math.min(200, Math.max(1, parseInt(take || "50")));
    
    const result = await cacheWithFallback(`problems:list:${type || 'all'}:${skipNum}:${takeNum}`, async () => {
      const [problems, total] = await Promise.all([
        prisma.problem.findMany({
          where,
          select: {
            id: true,
            title: true,
            description: true,
            difficulty: true,
            category: true,
            problemType: true,
            schema: true,
            testCases: true,
            starterCode: true,
            timeLimit: true,
            memoryLimit: true,
            evaluationStrategy: true,
            createdById: true,
            images: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          skip: skipNum,
          take: takeNum,
        }),
        prisma.problem.count({ where }),
      ]);
      const isPrivileged = req.user && (req.user.hierarchyLevel <= 4);
      const filtered = problems.map(p => ({
        ...p,
        testCases: isPrivileged
          ? p.testCases
          : (p.testCases as any[]).map((tc: any) => {
              if (tc.isHidden) {
                const { expectedOutput, input, ...rest } = tc;
                return { ...rest, input: "[Hidden]", expectedOutput: "[Hidden]" };
              }
              return tc;
            }),
      }));
      return { problems: filtered, total };
    }, 300);

    res.json(result);
  } catch (error: any) {
    console.error("Error fetching problems:", error);
    res.status(500).json({ error: "Failed to fetch problems" });
  }
});

router.get("/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };

    const problem = await cacheWithFallback(`problem:${id}`, () =>
      prisma.problem.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          description: true,
          difficulty: true,
          category: true,
          problemType: true,
          schema: true,
          testCases: true,
          starterCode: true,
          hints: true,
          solution: true,
          referenceSolution: true,
          evaluationStrategy: true,
          timeLimit: true,
          memoryLimit: true,
          isPublic: true,
          createdById: true,
          images: true,
          createdAt: true,
        },
      })
    , 600);

    if (!problem) {
      res.status(404).json({ error: "Problem not found" });
      return;
    }

    if (!problem.isPublic && problem.createdById !== req.user!.userId) {
      res.status(404).json({ error: "Problem not found" });
      return;
    }

    const isAdmin = req.user && (req.user as any).hierarchyLevel <= 4;
    if (!isAdmin) {
      problem.testCases = (problem.testCases as any[]).map((tc: any) => {
        if (tc.isHidden) {
          const { expectedOutput, input, ...rest } = tc;
          return { ...rest, input: "[Hidden]", expectedOutput: "[Hidden]" };
        }
        return tc;
      });
      delete (problem as any).solution;
      delete (problem as any).referenceSolution;
      delete (problem as any).videoSolutionUrl;
    }

    res.json({ problem });
  } catch (error: any) {
    console.error("Error fetching problem:", error);
    res.status(500).json({ error: "Failed to fetch problem" });
  }
});

router.post("/", authenticateToken, requireMinLevel(4), async (req: Request<{}, {}, ProblemBody>, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { title, description, difficulty, category, problemType, testCases, starterCode, hints, solution, referenceSolution, evaluationStrategy, executionMode, timeLimit, memoryLimit, isPublic, schema, images, driverCode } = req.body;

    if (!title || !description || !testCases || !starterCode) {
      res.status(400).json({ error: "Title, description, testCases, and starterCode are required" });
      return;
    }

    if (!Array.isArray(testCases) || testCases.length === 0) {
      res.status(400).json({ error: "At least one test case is required" });
      return;
    }

    const strategy = evaluationStrategy || "EXACT_MATCH";
    const enrichedTestCases = testCases.map((tc: any) => ({
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      isHidden: tc.isHidden || false,
      setup: tc.setup || undefined,
      orderIndependent: strategy === "UNORDERED_MATCH" ? true : (tc.orderIndependent || false),
    }));

    const problemData: any = {
      title,
      description,
      difficulty: difficulty || "Medium",
      category: category || "DSA",
      problemType: problemType || "code",
      testCases: enrichedTestCases as any,
      starterCode: starterCode as any,
      driverCode: driverCode as any || undefined,
      hints,
      solution,
      referenceSolution,
      evaluationStrategy: strategy,
      timeLimit: timeLimit || 1000,
      memoryLimit: memoryLimit || 256,
      isPublic: isPublic ?? true,
      schema: schema as any || undefined,
      createdById: userId,
      images: images || {},
    };

    const problem = await prisma.problem.create({
      data: problemData,
    });

    await delCache(`problem:${problem.id}`);
    await delCacheByPattern("problems:list:*");
    res.status(201).json({ problem });
  } catch (error: any) {
    console.error("Error creating problem:", error);
    res.status(500).json({ error: error.message || "Failed to create problem" });
  }
});

router.put("/:id", authenticateToken, async (req: Request<{ id: string }, {}, ProblemBody>, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, difficulty, category, problemType, testCases, starterCode, hints, solution, referenceSolution, evaluationStrategy, timeLimit, memoryLimit, isPublic, schema, images, driverCode } = req.body;

    const existing = await prisma.problem.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Problem not found" });
      return;
    }

    if (existing.createdById !== req.user!.userId && (req.user as any).hierarchyLevel > 3) {
      res.status(403).json({ error: "You are not authorized to edit this problem" });
      return;
    }

    const strategy = evaluationStrategy || (existing as any).evaluationStrategy || "EXACT_MATCH";
    const enrichedTestCases = testCases
      ? testCases.map((tc: any) => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isHidden: tc.isHidden || false,
          setup: tc.setup || undefined,
          orderIndependent: strategy === "UNORDERED_MATCH" ? true : (tc.orderIndependent || false),
        }))
      : undefined;

    const problem = await prisma.problem.update({
      where: { id },
      data: {
        title: title || existing.title,
        description: description || existing.description,
        difficulty: difficulty || existing.difficulty,
        category: category || existing.category,
        problemType: problemType || existing.problemType,
        testCases: enrichedTestCases ? enrichedTestCases as any : existing.testCases,
        starterCode: starterCode ? starterCode as any : existing.starterCode,
        driverCode: driverCode !== undefined ? driverCode as any : (existing as any).driverCode,
        hints: hints !== undefined ? hints : existing.hints,
        solution: solution !== undefined ? solution : existing.solution,
        referenceSolution: referenceSolution !== undefined ? referenceSolution : (existing as any).referenceSolution,
        evaluationStrategy: strategy,
        timeLimit: timeLimit || existing.timeLimit,
        memoryLimit: memoryLimit || existing.memoryLimit,
        isPublic: isPublic !== undefined ? isPublic : existing.isPublic,
        schema: schema !== undefined ? schema as any : existing.schema,
        images: images !== undefined ? images : (existing as any).images,
      },
    });

    await delCache(`problem:${id}`);
    await delCacheByPattern("problems:list:*");
    res.json({ problem });
  } catch (error: any) {
    console.error("Error updating problem:", error);
    res.status(500).json({ error: "Failed to update problem" });
  }
});

router.delete("/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;

    const existing = await prisma.problem.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Problem not found" });
      return;
    }

    if (existing.createdById !== req.user!.userId && (req.user as any).hierarchyLevel > 3) {
      res.status(403).json({ error: "You are not authorized to delete this problem" });
      return;
    }

    await prisma.problem.delete({ where: { id } });

    await delCache(`problem:${id}`);
    await delCacheByPattern("problems:list:*");
    res.json({ message: "Problem deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting problem:", error);
    res.status(500).json({ error: "Failed to delete problem" });
  }
});

router.get("/:id/submissions", authenticateToken, async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    const userId = req.user!.userId;

    const submissions = await prisma.submission.findMany({
      where: {
        problemId: id,
        userId,
      },
      select: {
        id: true,
        language: true,
        status: true,
        passedTests: true,
        totalTests: true,
        executionTime: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json({ submissions });
  } catch (error: any) {
    console.error("Error fetching submissions:", error);
    res.status(500).json({ error: "Failed to fetch submissions" });
  }
});

router.get("/:id/video-solutions", authenticateToken, async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    const problem = await prisma.problem.findUnique({ where: { id }, select: { title: true, category: true } });
    if (!problem) { res.status(404).json({ error: "Problem not found" }); return; }
    const videos = await searchYouTubeSolution(problem.title, problem.category ? [problem.category] : []);
    res.json({ videos });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get("/:id/leaderboard", authenticateToken, async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    const currentUserId = req.user!.userId;

    // Fetch the top 10 fastest accepted submissions for this problem
    const submissions = await prisma.submission.findMany({
      where: {
        problemId: id,
        status: "passed"
      },
      include: {
        user: {
          select: {
            fullName: true
          }
        }
      },
      orderBy: {
        executionTime: "asc"
      },
      take: 10
    });

    const leaderboard = submissions.map((sub, index) => ({
      rank: index + 1,
      username: sub.user.fullName || 'Anonymous',
      runtime: sub.executionTime || 0,
      language: sub.language,
      isCurrentUser: sub.userId === currentUserId
    }));

    res.json({ leaderboard });
  } catch (error: any) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

export default router;