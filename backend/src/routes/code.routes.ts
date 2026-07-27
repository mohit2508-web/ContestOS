import { Router, Request, Response } from "express";
import { authenticateToken } from "../middlewares/auth";
import LanguageAdapter, { TestCase } from "../services/languageAdapter";
import executeSql from "../services/sqlExecutor";
import externalCodeExecutor from "../services/externalCodeExecutor";
import codeTemplates from "../services/codeTemplates";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import { getCached, setCache } from "../lib/cacheUtils";
import prisma from "../lib/prisma";

const router = Router();

const TEMP_DIR = path.join(os.tmpdir(), "talentos-code");

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const languageAdapter = new LanguageAdapter(TEMP_DIR);

const RESOURCE_LIMITS = {
  timeout: 10000,
  maxCodeSize: 1024 * 1024,
  maxInputSize: 1024 * 1024,
};

interface RunCodeBody {
  language: string;
  code: string;
  input?: string;
  setup?: string;
  problemId?: string;
}

interface RunTestsBody {
  language: string;
  code: string;
  testCases: Array<{ input: string; expectedOutput: string; setup?: string }>;
  problemId?: string;
  driverCode?: Record<string, string>;
}

interface FormatBody {
  language: string;
  code: string;
}

interface LintBody {
  language: string;
  code: string;
}

export function sanitizeCode(code: string): { valid: boolean; error?: string } {
  if (!code || typeof code !== "string") {
    return { valid: false, error: "Code is required" };
  }

  if (code.length > RESOURCE_LIMITS.maxCodeSize) {
    return { valid: false, error: `Code exceeds maximum size of ${RESOURCE_LIMITS.maxCodeSize} bytes` };
  }

  const dangerousPatterns = [
    // Python dangerous imports
    /import\s+(os|subprocess|sys|shutil|socket|pickle|ctypes|tempfile|multiprocessing|threading|signal)\b/i,
    /from\s+(os|subprocess|sys|shutil|socket|pickle|ctypes|tempfile|multiprocessing|threading|signal)\s+import/i,
    /import\s+pty/,
    /import\s+sys.*\.(exec|system)/,
    // Python dangerous built-ins
    /__import__\s*\(/,
    /__builtins__/,
    // Python OS/subprocess execution
    /os\.(system|popen|exec|fork)/i,
    /subprocess\.(call|Popen|run)/i,
    // Python eval/exec/compile
    /eval\s*\(/,
    /exec\s*\(/,
    /compile\s*\(/i,
    // Node.js dangerous imports
    /require\(["'](child_process|fs|http|https|net|dgram|dns)["']\)/i,
    /process\.(exec|spawn|fork|binding)/i,
    /child_process/,
    /Reflect\./,
    /global\.(eval|process)/i,
    /setTimeout\s*\(.*eval/,
    /Function\s*\(/,
    /new\s+Function\s*\(/,
    // Java Process/Execution/System exit control
    /Runtime\s*\.\s*getRuntime\s*\(/i,
    /ProcessBuilder/i,
    /System\s*\.\s*exit\s*\(/i,
    // C/C++ Process/Network control
    /#include\s*<unistd\.h>/i,
    /#include\s*<(sys\/socket|netinet|arpa\/inet|netdb)\.h>/i,
    // File / OS command patterns
    /rm\s+-rf/i,
    /del\s+\/f/i,
    /open\s*\([^)]*['"]([wa]|[rw]\+)/i,
    /fopen\s*\([^)]*['"]([wa]|[rw]\+)/i,
    /FileWriter|FileOutputStream|BufferedWriter/i,
    // Shell injection
    /\$\(/,
    /`[^`]*`/,
    // Network control
    /socket\s*\(/i,
    /connect\s*\(/i,
    /import\s+(urllib|requests|http|socket)/i,
    /from\s+(urllib|requests|http|socket)\s+import/i,
    /import\s+.*(java\.net|java\.io\.(File|Writer|OutputStream))/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      return { valid: false, error: "Code contains potentially dangerous imports" };
    }
  }

  return { valid: true };
}

function generateCodeHash(code: string, language: string): string {
  return crypto.createHash("sha256").update(`${language}:${code}`).digest("hex").slice(0, 16);
}

router.post("/run", authenticateToken, async (req: Request<{}, {}, RunCodeBody>, res: Response) => {
  try {
    const { language, code, input = "", setup, problemId } = req.body;

    if (!language || !code) {
      res.status(400).json({ error: "Language and code are required" });
      return;
    }

    const sanitization = sanitizeCode(code);
    if (!sanitization.valid) {
      res.status(400).json({ error: sanitization.error });
      return;
    }

    if (language === "sql") {
      const sqlResult = await executeSql(setup || "", code, RESOURCE_LIMITS.timeout);
      res.json({
        success: sqlResult.success,
        columns: sqlResult.columns,
        rows: sqlResult.rows,
        error: sqlResult.error,
        executionTime: `${sqlResult.executionTime}ms`,
      });
      return;
    }

    if (input.length > RESOURCE_LIMITS.maxInputSize) {
      res.status(400).json({ error: "Input exceeds maximum size" });
      return;
    }

    // Disable cache for debugging
    // const cacheKey = `code:run:${generateCodeHash(code, language)}:${Buffer.from(input).toString("base64").slice(0, 32)}`;
    // const cached = await getCached(cacheKey);
    // if (cached) {
    //   res.json(cached);
    //   return;
    // }

    let codeToRun = code;
    let runInput = input;

    if (problemId) {
      const problem = await prisma.problem.findUnique({
        where: { id: problemId }
      });
      if (problem) {
        const hasMain = 
          code.includes("public static void main") || 
          code.includes("int main(") || 
          code.includes("void main(") || 
          code.includes("static void Main") || 
          code.includes("func main()") || 
          code.includes("fn main()") ||
          (language === "python" && (code.includes("sys.stdin") || code.includes("input(") || code.includes("import sys"))) ||
          ((language === "javascript" || language === "typescript") && (code.includes("require('fs')") || code.includes("readline") || code.includes("process.stdin")));

        const isTemplate = code.includes("USER CODE START") || code.includes("USER CODE END") || code.includes("USTART") || code.includes("UEND") || hasMain;

        if (!isTemplate) {
          codeToRun = languageAdapter.generateTestWrapper(code, input, language);
          runInput = "";
        }
      }
    }

    const result = await languageAdapter.executeCode(codeToRun, language, runInput, RESOURCE_LIMITS.timeout);

    const response = {
      success: result.success,
      output: result.output,
      stderr: result.stderr,
      error: result.error,
      executionTime: `${result.executionTime}ms`,
    };

    // await setCache(cacheKey, response, 60);
    res.json(response);
  } catch (error: unknown) {
    console.error("Code execution error:", error);
    const message = error instanceof Error ? error.message : 'Execution failed';
    res.status(500).json({ error: message });
  }
});

router.post("/run-tests", authenticateToken, async (req: Request<{}, {}, RunTestsBody>, res: Response) => {
  try {
    const { language, code, testCases = [], problemId, driverCode: reqDriverCode } = req.body;

    if (!language || !code) {
      res.status(400).json({ error: "Language and code are required" });
      return;
    }

    if (!Array.isArray(testCases) || testCases.length === 0) {
      res.status(400).json({ error: "At least one test case is required" });
      return;
    }

    const sanitization = sanitizeCode(code);
    if (!sanitization.valid) {
      res.status(400).json({ error: sanitization.error });
      return;
    }

    if (language === "sql") {
      const results = [];
      let passed = 0;
      let failed = 0;

      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        const startTime = Date.now();
        try {
          const sqlResult = await executeSql(tc.setup || "", code, RESOURCE_LIMITS.timeout);
          const executionTime = Date.now() - startTime;

          const normalizeSqlOutput = (out: any): string => {
            if (!out) return "";
            if (!out.columns || out.columns.length === 0) {
              if (out.affected !== undefined) {
                return `Rows matched: ${out.affected}  Changed: ${out.affected}  Warnings: 0`;
              }
              return "";
            }
            const colWidths = out.columns.map((col: string) =>
              Math.max(col.length, ...out.rows.map((row: any) => String(row[col] ?? "NULL").length))
            );
            const header = out.columns.map((col: string, i: number) => col.padEnd(colWidths[i])).join(" | ");
            const rows = out.rows.map((row: any) =>
              out.columns.map((col: string, i: number) => String(row[col] ?? "NULL").padEnd(colWidths[i])).join(" | ")
            );
            return [header, ...rows].join("\n").trim();
          };

          const actualOutput = normalizeSqlOutput(sqlResult);
          const expectedOutput = (tc.expectedOutput || "").trim();
          const isPassed = actualOutput === expectedOutput;

          if (isPassed) passed++;
          else failed++;

          results.push({
            testCase: i + 1,
            passed: isPassed,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput,
            columns: sqlResult.columns || [],
            rows: sqlResult.rows || [],
            rowCount: (sqlResult.rows || []).length,
            affected: sqlResult.affected,
            executionTime,
            error: sqlResult.error || null,
          });
        } catch (err: any) {
          failed++;
          results.push({
            testCase: i + 1,
            passed: false,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: "",
            columns: [],
            rows: [],
            rowCount: 0,
            executionTime: Date.now() - startTime,
            error: err.message || "SQL execution failed",
          });
        }
      }

      const result = { results, summary: { passed, failed, total: testCases.length } };
      res.json(result);
      return;
    }

    // Disable cache for test execution so stale test results are not returned
    // const cacheKey = `code:tests:${generateCodeHash(code, language)}:${crypto.createHash("sha256").update(JSON.stringify(testCases)).digest("hex").slice(0, 16)}`;
    // const cached = await getCached(cacheKey);
    // if (cached) {
    //   res.json(cached);
    //   return;
    // }


    // Just run the code as-is - frontend sends full template with locked parts
    const codeToRun = code;

    let driverCode = reqDriverCode || null;
    if (!driverCode && problemId) {
      const problem = await prisma.problem.findUnique({ where: { id: problemId }, select: { driverCode: true } });
      if (problem && problem.driverCode) {
        driverCode = problem.driverCode as Record<string, string>;
      }
    }

    const streamMode = req.query.stream === 'true';

    if (streamMode) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      try {
        const result = await languageAdapter.runTestCases(
          codeToRun,
          language,
          testCases as TestCase[],
          5000,
          driverCode as Record<string, string> | null,
          (tcResult) => {
            res.write(`data: ${JSON.stringify({ type: 'progress', result: tcResult })}\n\n`);
            if ((res as any).flush) (res as any).flush();
          }
        );
        res.write(`data: ${JSON.stringify({ type: 'done', summary: result.summary })}\n\n`);
        res.end();
      } catch (err: any) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
        res.end();
      }
      return;
    }

    const result = await languageAdapter.runTestCases(
      codeToRun,
      language,
      testCases as TestCase[],
      5000,
      driverCode as Record<string, string> | null
    );

    // await setCache(cacheKey, result, 120);
    res.json(result);
  } catch (error: unknown) {
    console.error("Test execution error:", error);
    const message = error instanceof Error ? error.message : 'Test execution failed';
    res.status(500).json({ error: message });
  }
});

router.post("/format", authenticateToken, async (req: Request<{}, {}, FormatBody>, res: Response) => {
  try {
    const { language, code } = req.body;

    if (!language || !code) {
      res.status(400).json({ error: "Language and code are required" });
      return;
    }

    const sanitization = sanitizeCode(code);
    if (!sanitization.valid) {
      res.status(400).json({ error: sanitization.error });
      return;
    }

    const cacheKey = `code:format:${generateCodeHash(code, language)}`;
    const cached = await getCached(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const result = await languageAdapter.formatCode(code, language);

    const response = {
      success: result.success,
      formatted: result.formatted,
      error: result.error,
    };

    await setCache(cacheKey, response, 300);
    res.json(response);
  } catch (error: unknown) {
    console.error("Format error:", error);
    const message = error instanceof Error ? error.message : 'Formatting failed';
    res.status(500).json({ error: message });
  }
});

router.post("/lint", authenticateToken, async (req: Request<{}, {}, LintBody>, res: Response) => {
  try {
    const { language, code } = req.body;

    if (!language || !code) {
      res.status(400).json({ error: "Language and code are required" });
      return;
    }

    const sanitization = sanitizeCode(code);
    if (!sanitization.valid) {
      res.status(400).json({ error: sanitization.error });
      return;
    }

    const cacheKey = `code:lint:${generateCodeHash(code, language)}`;
    const cached = await getCached(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const result = await languageAdapter.lintCode(code, language);

    const response = {
      success: result.success,
      errors: result.errors,
      formatted: result.formatted,
    };

    await setCache(cacheKey, response, 300);
    res.json(response);
  } catch (error: unknown) {
    console.error("Lint error:", error);
    const message = error instanceof Error ? error.message : 'Linting failed';
    res.status(500).json({ error: message });
  }
});

router.get("/languages", authenticateToken, async (_req: Request, res: Response) => {
  const languages = languageAdapter.getSupportedLanguages();
  const availability = languageAdapter.getLanguageAvailability();
  const languageDetails = languages.map((lang) => {
    const config = languageAdapter.getLanguageConfig(lang);
    const langKey = 
      lang === "python" ? "python" : 
      lang === "javascript" ? "node" : 
      lang === "typescript" ? "tsx" :
      lang === "cpp" || lang === "c" ? "gcc" : 
      lang === "java" ? "javac" : 
      lang === "go" ? "go" :
      lang === "rust" ? "rustc" :
      lang === "ruby" ? "ruby" :
      lang === "csharp" ? "dotnet" :
      lang === "php" ? "php" :
      lang === "swift" ? "swift" :
      lang === "kotlin" ? "kotlinc" :
       lang === "scala" ? "scala" :
       lang === "dart" ? "dart" :
       lang === "haskell" ? "ghc" :
       lang === "perl" ? "perl" :
       lang === "r" ? "Rscript" :
       lang === "bash" ? "bash" :
       lang === "lua" ? "lua" :
       lang === "sql" ? "sql" : lang;
    const displayNames: Record<string, string> = {
      python: "Python",
      javascript: "JavaScript",
      typescript: "TypeScript",
      cpp: "C++",
      c: "C",
      java: "Java",
      go: "Go",
      rust: "Rust",
      ruby: "Ruby",
      csharp: "C#",
      php: "PHP",
      swift: "Swift",
      kotlin: "Kotlin",
      scala: "Scala",
      dart: "Dart",
      haskell: "Haskell",
      perl: "Perl",
      r: "R",
      bash: "Bash",
      lua: "Lua",
      sql: "SQL",
    };
    return {
      id: lang,
      name: displayNames[lang] || lang.charAt(0).toUpperCase() + lang.slice(1),
      extension: config?.extension,
      canFormat: !!config?.format,
      canLint: !!config?.lint,
      needsCompilation: config?.needsCompilation,
      isAvailable: availability[langKey] || false,
    };
  });

  res.json({ 
    languages: languageDetails,
    externalExecutor: {
      available: externalCodeExecutor.isAvailable(),
      provider: externalCodeExecutor.getProvider()
    }
  });
});

router.get("/executor-status", authenticateToken, async (_req: Request, res: Response) => {
  res.json({
    local: {
      available: true,
      adapter: "LanguageAdapter"
    },
    external: {
      available: externalCodeExecutor.isAvailable(),
      provider: externalCodeExecutor.getProvider()
    }
  });
});

router.get("/templates", authenticateToken, async (_req: Request, res: Response) => {
  const templates = codeTemplates.getSupportedLanguages().map(lang => {
    const template = codeTemplates.getTemplate(lang);
    return {
      language: lang,
      name: template?.name,
      defaultCode: codeTemplates.getDefaultCode(lang)
    };
  });
  res.json(templates);
});


router.get("/templates/:language", authenticateToken, async (req: Request, res: Response) => {
  const language = req.params.language as string;
  const template = codeTemplates.getTemplate(language);
  
  if (!template) {
    res.status(404).json({ error: "Template not found for language" });
    return;
  }
  
  res.json({
    language: template.language,
    name: template.name,
    defaultCode: codeTemplates.getDefaultCode(language)
  });

});

export default router;