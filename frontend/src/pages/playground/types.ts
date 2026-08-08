export interface TestCase {
  input: string;
  expectedOutput: string;
  orderIndependent?: boolean;
  isHidden?: boolean;
  setup?: string;
}

export interface TestResult {
  testCase: number;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  executionTime: number;
  error?: string;
  isHidden?: boolean;
}

export interface Submission {
  id: string;
  status: 'Accepted' | 'Wrong Answer' | 'Runtime Error' | 'Time Limit Exceeded' | 'Compile Error';
  language: string;
  runtime?: string;
  runtimeMs?: number;
  memory?: string;
  memoryMB?: number;
  timestamp: string;
  rawTimestamp?: string;
  passedCount: number;
  totalCount: number;
  code: string;
  notes?: string;
  tags?: string;
  user?: { fullName: string; avatarUrl?: string };
}

export interface DatabaseColumn {
  name: string;
  type: string;
  constraints?: string;
}

export interface DatabaseTable {
  name: string;
  columns: DatabaseColumn[];
  sampleData?: Record<string, any>[];
}

export interface DatabaseSchema {
  setup?: string;
  tables: DatabaseTable[];
}

export interface Problem {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  category?: string;
  problemType?: string;
  topics?: string[];
  companies?: string[];
  testCases?: TestCase[];
  starterCode?: Record<string, string>;
  hints?: string;
  constraints?: string[];
  evaluationStrategy?: string;
  referenceSolution?: string;
  solution?: string;
  acceptanceRate?: number;
  totalSubmissions?: number;
  points?: number;
  schema?: DatabaseSchema;
  images?: Record<string, string>;
}

export interface SqlResult {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  affected?: number;
  error?: string;
  executionTime?: number;
}

export interface PlaygroundPageProps {
  initialMode?: "code" | "web" | "sql";
}
