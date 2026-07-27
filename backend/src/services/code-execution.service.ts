import axios from 'axios';

const LANGUAGE_MAP: Record<string, number> = {
  python: 71,
  java: 62,
  cpp: 54,
  c: 50,
  javascript: 63,
  typescript: 74,
  go: 60,
  rust: 72,
  ruby: 73,
  csharp: 51,
  php: 68,
  swift: 77,
  kotlin: 78,
  haskell: 61,
  perl: 57,
  r: 80,
  bash: 46,
  lua: 38,
  sql: 82,
  dart: 91,
  erlang: 58,
  js: 63,
  py: 71,
};

const JUDGE0_BASE_URL = process.env.JUDGE0_BASE_URL || 'https://ce.judge0.com';
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY || '';

const executionCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): void {
  const now = Date.now();
  const entry = executionCounts.get(userId);
  if (!entry || now > entry.resetAt) {
    executionCounts.set(userId, { count: 1, resetAt: now + 60000 });
    return;
  }
  if (entry.count >= 10) {
    const err = new Error('Rate limit exceeded: max 10 executions per minute');
    (err as any).statusCode = 429;
    throw err;
  }
  entry.count++;
}

function mockExecute(sourceCode: string, language: string, input: string) {
  const lines = sourceCode.split('\n').length;
  const mockOutput = input
    ? `[Mock] Executing ${language} code...\nInput received: ${input}\nProcessed ${lines} lines.`
    : `[Mock] ${language} code executed successfully.\nOutput: Hello from mock execution (${lines} lines)`;
  return {
    stdout: mockOutput,
    stderr: '',
    exitCode: 0,
    time: '0.015',
    memory: 1024,
    status_description: 'Accepted',
  };
}

async function callJudge0(sourceCode: string, languageId: number, stdin: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (JUDGE0_API_KEY) headers['X-Auth-Token'] = JUDGE0_API_KEY;

  const submitRes = await axios.post(
    `${JUDGE0_BASE_URL}/submissions`,
    { language_id: languageId, source_code: sourceCode, stdin: stdin || '' },
    { params: { base64_encoded: 'false', wait: 'false' }, headers, timeout: 20000 }
  );

  const token = submitRes.data.token;
  if (!token) throw new Error('Failed to create Judge0 submission');

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 800));
    const getRes = await axios.get(`${JUDGE0_BASE_URL}/submissions/${token}`, {
      params: { base64_encoded: 'false' },
      headers,
      timeout: 10000,
    });
    const statusId = getRes.data.status?.id;
    if (statusId && statusId !== 1 && statusId !== 2) {
      return {
        stdout: getRes.data.stdout || '',
        stderr: getRes.data.stderr || '',
        compile_output: getRes.data.compile_output || '',
        exitCode: getRes.data.exit_code ?? null,
        time: getRes.data.time || null,
        memory: getRes.data.memory || null,
        status_description: getRes.data.status?.description || 'Unknown',
      };
    }
  }
  throw new Error('Judge0 timed out');
}

export async function executeCode(
  sourceCode: string,
  language: string,
  input: string,
  userId?: string
) {
  if (sourceCode.length > 500000) {
    return {
      stdout: '',
      stderr: 'Source code exceeds maximum allowed size of 500KB',
      exitCode: 1,
      time: null,
      memory: null,
      status_description: 'Compilation Error',
    };
  }

  if (userId) checkRateLimit(userId);

  const languageId = LANGUAGE_MAP[language.toLowerCase().trim()];
  if (!languageId) {
    return {
      stdout: '',
      stderr: `Unsupported language: ${language}`,
      exitCode: 1,
      time: null,
      memory: null,
      status_description: 'Compilation Error',
    };
  }

  if (!JUDGE0_API_KEY && !process.env.JUDGE0_BASE_URL) {
    return mockExecute(sourceCode, language, input);
  }

  try {
    return await callJudge0(sourceCode, languageId, input);
  } catch (err: any) {
    if ((err as any).statusCode === 429) throw err;
    return {
      stdout: '',
      stderr: `Execution failed: ${err.message}`,
      exitCode: 1,
      time: null,
      memory: null,
      status_description: 'Runtime Error',
    };
  }
}

export function getSupportedLanguages() {
  return Object.keys(LANGUAGE_MAP).filter((k) => !['js', 'py'].includes(k));
}
