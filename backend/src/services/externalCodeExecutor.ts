import axios from "axios";
import wrapperGenerator from "./codeWrapperGenerator";

const PISTON_API_URL = process.env.PISTON_API_URL || "https://emkc.org/api/v2/piston";
const JUDGE0_API_URL = process.env.JUDGE0_API_URL || (process.env.JUDGE0_RAPID_API_KEY ? "https://judge0-ce.p.rapidapi.com" : "https://ce.judge0.com");
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY || process.env.JUDGE0_RAPID_API_KEY || "";
const USE_RAPID = !!process.env.JUDGE0_RAPID_API_KEY;

interface ExecuteRequest {
  language: string;
  code: string;
  input?: string;
  timeLimit?: number;
  memoryLimit?: number;
}

interface ExecuteResponse {
  success: boolean;
  output: string;
  stderr: string;
  error?: string;
  executionTime: number;
  memoryUsed?: number;
}

interface TestCase {
  input: string;
  expectedOutput: string;
}

interface TestResult {
  testCase: number;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  executionTime: number;
  error?: string;
}

const PISTON_LANGUAGE_MAP: Record<string, string> = {
  python: "python",
  javascript: "javascript",
  typescript: "typescript",
  cpp: "c++",
  c: "c++",
  java: "java",
  go: "go",
  rust: "rust",
  ruby: "ruby",
  swift: "swift",
  kotlin: "kotlin",
  csharp: "csharp",
  php: "php",
  scala: "scala",
  haskell: "haskell",
  perl: "perl",
  r: "r",
  bash: "bash",
  lua: "lua",
  sql: "sql",
  dart: "dart",
  elixir: "elixir",
  erlang: "erlang",
};

const JUDGE0_LANGUAGE_MAP: Record<string, number> = {
  python: 71,
  python3: 71,
  javascript: 63,
  nodejs: 63,
  cpp: 54,
  c: 50,
  java: 62,
  csharp: 51,
  go: 60,
  rust: 72,
  ruby: 73,
  php: 68,
  swift: 77,
  kotlin: 78,
  haskell: 61,
  perl: 57,
  r: 80,
  bash: 46,
  lua: 38,
  sql: 82,
  vb: 84,
  cobol: 66,
  fortran: 65,
  typescript: 74,
  dart: 91,
  erlang: 58,
};

const PISTON_FILENAME_MAP: Record<string, string> = {
  python: "main.py",
  javascript: "main.js",
  typescript: "main.ts",
  cpp: "main.cpp",
  c: "main.cpp",
  java: "Main.java",
  go: "main.go",
  rust: "main.rs",
  csharp: "main.cs",
};

export class ExternalCodeExecutor {
  private useExternal: boolean = true;
  private externalProvider: "piston" = "piston";
  private isPistonDown: boolean = false;
  private lastPistonCheck: number = 0;

  constructor() {
    this.useExternal = true;
    this.externalProvider = "piston";
  }

  async executeCode(request: ExecuteRequest): Promise<ExecuteResponse> {
    const startTime = Date.now();

    if (request.code.length > 500000) {
      return {
        success: false,
        output: '',
        stderr: 'Source code exceeds maximum allowed size of 500KB',
        error: 'Code too large',
        executionTime: Date.now() - startTime,
      };
    }

    if (this.isPistonDown && Date.now() - this.lastPistonCheck > 60000) {
      this.isPistonDown = false;
    }

    if (!this.isPistonDown) {
      const pistonRes = await this.executeWithPiston(request, startTime);

      const isPistonSystemError =
        !pistonRes.success &&
        (pistonRes.error?.includes("Piston") ||
         pistonRes.error?.includes("socket hang up") ||
         pistonRes.error?.includes("API error") ||
         pistonRes.stderr?.includes("socket hang up") ||
         pistonRes.stderr?.includes("whitelist"));

      if (isPistonSystemError) {
        this.isPistonDown = true;
        this.lastPistonCheck = Date.now();
        console.warn("[ExternalCodeExecutor] Piston marked DOWN. Fast routing to Judge0 API...");
        try {
          const judge0Res = await this.executeWithJudge0(request, startTime);
          if (judge0Res.success || judge0Res.output || (judge0Res.stderr && !judge0Res.error?.includes("Judge0 API error"))) {
            return judge0Res;
          }
        } catch (jErr: any) {
          console.warn("[ExternalCodeExecutor] Judge0 fallback failed:", jErr.message);
        }
      } else {
        return pistonRes;
      }
    }

    try {
      const judge0Res = await this.executeWithJudge0(request, startTime);
      if (judge0Res.success || judge0Res.output || (judge0Res.stderr && !judge0Res.error?.includes("Judge0 API error"))) {
        return judge0Res;
      }
    } catch (jErr: any) {
      console.warn("[ExternalCodeExecutor] Direct Judge0 execution error:", jErr.message);
    }

    return await this.executeWithPiston(request, startTime);
  }

  private async executeWithCodeRunner(request: ExecuteRequest, startTime: number): Promise<ExecuteResponse> {
    try {
      const response = await axios.post(`${process.env.CODE_RUNNER_URL}/run`, {
        code: request.code,
        language: request.language,
        input: request.input || "",
      }, {
        headers: { "Content-Type": "application/json" },
        timeout: 15000,
      });

      const data = response.data;
      return {
        success: data.success,
        output: data.output || "",
        stderr: data.stderr || "",
        error: data.error,
        executionTime: data.executionTime || (Date.now() - startTime),
      };
    } catch (error: any) {
      console.error("Code Runner API error, falling back to other providers:", error.message);
      const hasJudge0 = !!(process.env.JUDGE0_API_URL || process.env.JUDGE0_RAPID_API_KEY);
      if (hasJudge0) {
        return await this.executeWithJudge0(request, startTime);
      } else if (process.env.PISTON_API_URL) {
        return await this.executeWithPiston(request, startTime);
      }
      return {
        success: false,
        output: "",
        stderr: error.message,
        error: "Code Runner execution failed and no fallback configured",
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async executeWithPiston(request: ExecuteRequest, startTime: number): Promise<ExecuteResponse> {
    const language = PISTON_LANGUAGE_MAP[request.language];
    if (!language) {
      return {
        success: false,
        output: "",
        stderr: "Language not supported by Piston",
        error: "Unsupported language",
        executionTime: Date.now() - startTime,
      };
    }

    const filename = PISTON_FILENAME_MAP[request.language] || "main";
    const payload: any = {
      language,
      files: [{ name: filename, content: request.code }],
      stdin: request.input || "",
      compile_timeout: Math.min(10000, request.timeLimit || 10000),
      run_timeout: Math.min(3000, request.timeLimit || 3000),
      version: "*"
    };

    try {
      const response = await axios.post(`${PISTON_API_URL}/execute`, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 6000,
      });

      const { run, compile } = response.data;

      if (compile && (compile.code !== 0 || (compile.stderr && compile.stderr.includes('error')))) {
        const compErr = compile.stderr || compile.output || "Compilation failed";
        return {
          success: false,
          output: "",
          stderr: compErr,
          error: compErr,
          executionTime: Date.now() - startTime,
        };
      }

      if (run && (run.code !== 0 || (run.stderr && run.stderr.includes('chmod')))) {
        const runErr = (compile && (compile.stderr || compile.output))
          ? (compile.stderr || compile.output)
          : (run.stderr || run.output || `Exit code: ${run.code}`);
        return {
          success: false,
          output: "",
          stderr: runErr,
          error: runErr,
          executionTime: Date.now() - startTime,
        };
      }

      return {
        success: true,
        output: run?.output || "",
        stderr: run?.stderr || "",
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || "";
      console.warn("Piston Docker request failed:", msg);

      if (PISTON_API_URL !== "https://emkc.org/api/v2/piston" && (msg.includes("ETIMEDOUT") || msg.includes("ECONNREFUSED") || msg.includes("timeout") || !error.response)) {
        console.log("[FALLBACK] Custom Piston server unreachable, attempting fallback to public EMKC Piston API...");
        try {
          const fallbackRes = await axios.post(`https://emkc.org/api/v2/piston/execute`, payload, {
            headers: { "Content-Type": "application/json" },
            timeout: 6000
          });
          const { run, compile } = fallbackRes.data;

          if (compile && (compile.code !== 0 || (compile.stderr && compile.stderr.includes('error')))) {
            const compErr = compile.stderr || compile.output || "Compilation failed";
            return {
              success: false,
              output: "",
              stderr: compErr,
              error: compErr,
              executionTime: Date.now() - startTime,
            };
          }

          if (run && (run.code !== 0 || (run.stderr && run.stderr.includes('chmod')))) {
            const runErr = (compile && (compile.stderr || compile.output))
              ? (compile.stderr || compile.output)
              : (run.stderr || run.output || `Exit code: ${run.code}`);
            return {
              success: false,
              output: "",
              stderr: runErr,
              error: runErr,
              executionTime: Date.now() - startTime,
            };
          }

          return {
            success: true,
            output: run?.output || "",
            stderr: run?.stderr || "",
            executionTime: Date.now() - startTime,
          };
        } catch (fallbackErr: any) {
          console.warn("EMKC Piston fallback failed:", fallbackErr.message);
        }
      }

      return {
        success: false,
        output: "",
        stderr: msg,
        error: msg.includes("runtime is unknown") || error.response?.status === 400
          ? `Piston runtime unavailable: ${msg}`
          : error.response?.status === 401 ? "Piston API Key Required" : "Piston API error",
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async executeWithJudge0(request: ExecuteRequest, startTime: number): Promise<ExecuteResponse> {
    const languageId = JUDGE0_LANGUAGE_MAP[request.language];
    if (!languageId) {
      return {
        success: false,
        output: "",
        stderr: "Language not supported by Judge0",
        error: "Unsupported language",
        executionTime: Date.now() - startTime,
      };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (USE_RAPID) {
      headers["X-RapidAPI-Key"] = JUDGE0_API_KEY;
      headers["X-RapidAPI-Host"] = "judge0-ce.p.rapidapi.com";
    } else if (JUDGE0_API_KEY) {
      headers["Authorization"] = `Bearer ${JUDGE0_API_KEY}`;
    }

    try {
      const createResponse = await axios.post(`${JUDGE0_API_URL}/submissions`, {
        source_code: request.code,
        language_id: languageId,
        stdin: request.input || "",
        time_limit: request.timeLimit ? Math.floor(request.timeLimit / 1000) : 5,
        memory_limit: request.memoryLimit || 128000,
        compile_timeout: Math.floor((request.timeLimit || 10000) / 1000),
        run_timeout: Math.floor((request.timeLimit || 5000) / 1000),
      }, {
        headers,
        params: { base64_encoded: false, wait: true }
      });

      let result = createResponse.data;
      if (result && (!result.status || result.status.id <= 2)) {
        const token = createResponse.data.token;
        let maxAttempts = 30;
        let attempts = 0;

        while (attempts < maxAttempts) {
          const statusResponse = await axios.get(`${JUDGE0_API_URL}/submissions/${token}`, { headers });
          result = statusResponse.data;

          if (result.status && result.status.id > 2) {
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      }

      if (!result) {
        return {
          success: false,
          output: "",
          stderr: "Execution timed out",
          error: "Timeout",
          executionTime: Date.now() - startTime,
        };
      }

      const statusMap: Record<number, string> = {
        1: "In Queue",
        2: "In Progress",
        3: "Accepted",
        4: "Wrong Answer",
        5: "Time Limit Exceeded",
        6: "Runtime Error",
        7: "Compilation Error",
        8: "Internal Error",
        9: "File Error"
      };

      const isAccepted = result.status?.id === 3;
      const output = result.stdout || "";
      const stderr = result.stderr || result.compile_output || "";

      return {
        success: isAccepted,
        output,
        stderr,
        error: !isAccepted ? (statusMap[result.status?.id] || `Status: ${result.status?.id}`) : undefined,
        executionTime: Date.now() - startTime,
        memoryUsed: result.memory,
      };
    } catch (error: any) {
      console.warn("Judge0 API failed, trying Piston fallback:", error.message);
      try {
        return await this.executeWithPiston(request, startTime);
      } catch (pistonErr: any) {
        return {
          success: false,
          output: "",
          stderr: error.response?.data?.message || error.message,
          error: error.response?.status === 403 ? "Judge0 API Subscription Required" : "Judge0 API error",
          executionTime: Date.now() - startTime,
        };
      }
    }
  }

  private async executeWithJDoodle(request: ExecuteRequest, startTime: number): Promise<ExecuteResponse> {
    const jdoodleLanguageMap: Record<string, string> = {
      javascript: "nodejs",
      python: "python3",
      java: "java",
      cpp: "cpp17",
      c: "c"
    };

    const language = jdoodleLanguageMap[request.language] || request.language;

    try {
      const response = await axios.post(`https://api.jdoodle.com/v1/execute`, {
        clientId: process.env.JDOODLE_CLIENT_ID,
        clientSecret: process.env.JDOODLE_CLIENT_SECRET,
        script: request.code,
        language: language,
        versionIndex: "0",
        stdin: request.input || ""
      }, {
        headers: { "Content-Type": "application/json" }
      });

      const data = response.data;

      if (data.error) {
        return {
          success: false,
          output: "",
          stderr: data.error,
          error: "Execution Error",
          executionTime: Date.now() - startTime,
        };
      }

      return {
        success: data.statusCode === 200,
        output: data.output || "",
        stderr: "",
        executionTime: Date.now() - startTime,
        memoryUsed: data.memory,
      };
    } catch (error: any) {
      return {
        success: false,
        output: "",
        stderr: error.response?.data?.error || error.message,
        error: error.response?.status === 401 ? "JDoodle API Key Invalid or Daily Limit Reached" : "JDoodle API error",
        executionTime: Date.now() - startTime,
      };
    }
  }

  async runTestCases(
    code: string,
    language: string,
    testCases: TestCase[],
    timeLimit?: number,
    onProgress?: (result: TestResult) => void
  ): Promise<{
    results: TestResult[];
    summary: { passed: number; failed: number; total: number };
  }> {
    const results: TestResult[] = [];
    let passed = 0;
    let failed = 0;

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const result = await this.executeCode({
        language,
        code,
        input: testCase.input,
        timeLimit
      });

      const actualOutput = (result.output || "").trim();
      const expectedOutput = testCase.expectedOutput.trim();
      const isPassed = actualOutput === expectedOutput;

      if (isPassed) passed++;
      else failed++;

      const tcResult = {
        testCase: i + 1,
        passed: isPassed,
        input: testCase.input,
        expectedOutput,
        actualOutput: result.output || "",
        executionTime: result.executionTime,
        error: result.error || result.stderr,
      };

      results.push(tcResult);
      if (onProgress) {
        onProgress(tcResult);
      }
    }

    return {
      results,
      summary: { passed, failed, total: testCases.length },
    };
  }

  async runTestCasesWithWrapper(
    code: string,
    language: string,
    testCases: TestCase[],
    problem: {
      functionName: string;
      className: string;
      inputTypes: string[];
      outputType: string;
      inputNames: string[];
    },
    timeLimit?: number,
    onProgress?: (result: TestResult) => void
  ): Promise<{
    results: TestResult[];
    summary: { passed: number; failed: number; total: number };
  }> {
    const results: TestResult[] = [];
    let passed = 0;
    let failed = 0;

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];

      const wrappedCode = wrapperGenerator.generateWrapper(
        code,
        language,
        testCase,
        problem
      );

      const result = await this.executeCode({
        language,
        code: wrappedCode,
        input: "",
        timeLimit
      });

      const actualOutput = (result.output || "").trim();
      const expectedOutput = testCase.expectedOutput.trim();
      const isPassed = actualOutput === expectedOutput;

      if (isPassed) passed++;
      else failed++;

      results.push({
        testCase: i + 1,
        passed: isPassed,
        input: testCase.input,
        expectedOutput,
        actualOutput: result.output || "",
        executionTime: result.executionTime,
        error: result.error || result.stderr,
      });
    }

    return {
      results,
      summary: { passed, failed, total: testCases.length },
    };
  }

  isAvailable(): boolean {
    return true;
  }

  getProvider(): string {
    return "piston";
  }

  getSupportedLanguages(): string[] {
    return ["c", "cpp", "c++", "java", "python", "python3", "javascript", "typescript", "go", "rust", "ruby", "csharp", "php", "swift", "kotlin", "scala", "dart", "sql", "bash", "lua"];
  }
}

export default new ExternalCodeExecutor();