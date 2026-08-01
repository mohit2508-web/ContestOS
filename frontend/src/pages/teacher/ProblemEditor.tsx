import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import MarkdownRenderer from '../../components/MarkdownRenderer';
import { formatProblemDescriptionWithImages } from '../../utils/formatProblemDescription';
import axios from 'axios';
import { generateStarterCode, generateDriverCode } from '../../utils/signatureBuilder';
import { useNotify } from '../../components/notifications';
import { useAuth } from '../../contexts/AuthContext';
import { SqlProblemBuilder } from '../../components/admin/SqlProblemBuilder';

interface TestCaseEntry {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  setup?: string;
}

const LANGUAGE_KEYS = ['java', 'cpp', 'python', 'javascript', 'c'] as const;

const AI_PROMPT_TEMPLATE = `You are a problem-import assistant for ContestOS.
Your task is to convert any coding problem description into a structured JSON configuration block matching the following schema.

ContestOS uses a CODEFORCES-STYLE execution model:
- Students write COMPLETE programs with main() that read from stdin and print to stdout.
- There is NO function-only wrapper. Students must handle all input parsing themselves.
- The "starterCode" for each language must be a COMPLETE program (with imports, main(), stdin reading, and a TODO section for the student's logic).
- Test case "input" is raw stdin text exactly as your program would read it.
- Test case "expectedOutput" is the exact stdout your program should print.

Requirements:
1. "starterCode" MUST be a complete runnable program for each language with:
   - All necessary imports
   - A main() function / entry point
   - stdin reading boilerplate (pre-filled with the correct input format for this problem)
   - A clear "// TODO: Your solution here" section
   - stdout printing of the result
2. Java: public class must be named "Main" (NOT Solution). Use BufferedReader for fast I/O.
3. C++: Use #include <bits/stdc++.h>, int main() with ios_base::sync_with_stdio(false).
4. Python: Use import sys; input = sys.stdin.readline for fast I/O.
5. JavaScript: Use require('fs').readFileSync(0, 'utf8') to read all stdin at once.
6. Test case input format: raw multiline text matching exactly what stdin receives. For multiple test cases use T on first line.
7. "referenceSolution" should be a COMPLETE working program (with main + stdin/stdout) in Java or C++.
8. If the problem includes any figures or diagrams, extract image URLs into the "images" object.
9. Return ONLY a valid JSON object. Do not include extra commentary or markdown outside the JSON.

{
  "title": "Problem Title",
  "difficulty": "Easy | Medium | Hard",
  "category": "e.g. Array, String, Linked List, Tree, Graph, DP",
  "problemType": "code | sql | web-dev",
  "evaluationStrategy": "EXACT_MATCH | UNORDERED_MATCH | FLOAT_TOLERANCE",
  "description": "Markdown formatted problem statement with examples and constraints",
  "images": {
    "main": "Image URL for main problem diagram (or empty string)",
    "example1": "Image URL for Example 1 diagram (or empty string)",
    "example2": "Image URL for Example 2 diagram (or empty string)",
    "example3": "Image URL for Example 3 diagram (or empty string)"
  },
  "referenceSolution": "Complete Java or C++ program (with main + stdin/stdout) that solves the problem",
  "schema": "SQL schema DDL (only if problemType is sql, else omit)",
  "testCases": [
    {
      "input": "raw stdin text\\n(exactly what your program reads from stdin)",
      "expectedOutput": "exact stdout your program should print",
      "isHidden": false,
      "setup": "SQL INSERT statements (only if SQL problem, else omit)"
    }
  ],
  "starterCode": {
    "java": "import java.util.*;\\nimport java.io.*;\\n\\npublic class Main {\\n    public static void main(String[] args) throws IOException {\\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\\n        // TODO: Read input and write your solution\\n        System.out.println(0);\\n    }\\n}",
    "cpp": "#include <bits/stdc++.h>\\nusing namespace std;\\n\\nint main() {\\n    ios_base::sync_with_stdio(false);\\n    cin.tie(NULL);\\n    // TODO: Read input and write your solution\\n    cout << 0 << \\"\\\\n\\";\\n    return 0;\\n}",
    "python": "import sys\\ninput = sys.stdin.readline\\n\\n# TODO: Read input and write your solution\\nprint(0)",
    "javascript": "const lines = require('fs').readFileSync(0, 'utf8').trim().split('\\\\n');\\nlet idx = 0;\\n\\n// TODO: Read input and write your solution\\nconsole.log(0);"
  }
}

Now parse the following problem:

[PASTE YOUR PROBLEM HERE]`;

const SQL_AI_PROMPT_TEMPLATE = `You are a SQL problem import assistant for ContestOS.
Your task is to convert any SQL problem description (from LeetCode, HackerRank, StrataScratch, or custom exams) into a structured JSON configuration block matching the following schema.

Requirements:
1. "problemType" MUST be "sql".
2. "schema" MUST be a string containing valid CREATE TABLE DDL statements for all entities mentioned in the problem (e.g. CREATE TABLE Person (personId INT PRIMARY KEY, firstName VARCHAR(50)...);).
3. "testCases" MUST contain:
   - "setup": INSERT INTO statements to seed sample data into the tables (e.g. INSERT INTO Person VALUES (1, 'Wang', 'Allen');).
   - "expectedOutput": Tab-separated tabular string matching the expected result table format (e.g. "firstName\tlastName\tcity\tstate\nAllen\tWang\tNULL\tNULL").
   - "isHidden": false for public sample cases, true for hidden test cases.
4. "starterCode": { "sql": "-- Write your SQL query below\n" }
5. "referenceSolution": The complete working SQL query solution.
6. Return ONLY a valid JSON object matching the schema below. Do not include markdown or extra commentary outside the JSON.

{
  "title": "Problem Title",
  "difficulty": "Easy | Medium | Hard",
  "category": "Database",
  "problemType": "sql",
  "description": "Markdown formatted problem statement explaining table structures, required result columns, and order requirements.",
  "schema": "CREATE TABLE Person (personId INT PRIMARY KEY, lastName VARCHAR(50), firstName VARCHAR(50)); CREATE TABLE Address (addressId INT PRIMARY KEY, personId INT, city VARCHAR(50), state VARCHAR(50));",
  "referenceSolution": "SELECT p.firstName, p.lastName, a.city, a.state FROM Person p LEFT JOIN Address a ON p.personId = a.personId;",
  "starterCode": {
    "sql": "-- Write your SQL query below\n"
  },
  "testCases": [
    {
      "setup": "INSERT INTO Person VALUES (1, 'Wang', 'Allen'); INSERT INTO Address VALUES (1, 2, 'New York City', 'New York');",
      "expectedOutput": "firstName\tlastName\tcity\tstate\nAllen\tWang\tNULL\tNULL",
      "isHidden": false
    }
  ]
}

Now convert the following SQL problem into JSON:

[PASTE YOUR SQL PROBLEM QUESTION HERE]`;



interface ParsedColumn {
  name: string;
  type: string;
  constraints: string;
}

interface ParsedTable {
  name: string;
  columns: ParsedColumn[];
}

function parseTableStructure(schemaDdl: string): ParsedTable[] {
  const tables: ParsedTable[] = [];
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`?\w+`?\.)?`?(\w+)`?\s*\(([\s\S]*?)\);/gi;
  let tableMatch;
  while ((tableMatch = tableRegex.exec(schemaDdl)) !== null) {
    const tableName = tableMatch[1];
    const columnsBody = tableMatch[2];
    const columns: ParsedColumn[] = [];

    // Split column definitions by comma/newline outside parentheses (e.g. DECIMAL(10,2))
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

// Codeforces-style starter code: complete programs with main() + stdin/stdout.
// Students read input from stdin and print output to stdout.
const DEFAULT_STARTER_CODE: Record<string, string> = {
  java: `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        // int t = Integer.parseInt(br.readLine().trim()); // number of test cases

        // TODO: Read input
        int n = Integer.parseInt(br.readLine().trim());
        int[] arr = Arrays.stream(br.readLine().trim().split(" "))
                          .mapToInt(Integer::parseInt).toArray();

        // TODO: Write your solution and print output
        System.out.println(0);
    }
}`,
  cpp: `#include <bits/stdc++.h>
using namespace std;

void solve() {
    int n;
    cin >> n;
    vector<int> arr(n);
    for (auto& x : arr) cin >> x;

    // TODO: Your solution here
    cout << 0 << "\\n";
}

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    int t;
    cin >> t;
    while (t--) solve();
    return 0;
}`,
  python: `import sys
input = sys.stdin.readline

def solve():
    n = int(input())
    arr = list(map(int, input().split()))

    # TODO: Your solution here
    print(0)

t = int(input())
for _ in range(t):
    solve()`,
  javascript: `const lines = require('fs').readFileSync(0, 'utf8').trim().split('\\n');
let idx = 0;

const t = parseInt(lines[idx++]);
const results = [];

for (let i = 0; i < t; i++) {
    const n = parseInt(lines[idx++]);
    const arr = lines[idx++].split(' ').map(Number);

    // TODO: Your solution here
    results.push(0);
}

console.log(results.join('\\n'));`,
  c: `#include <stdio.h>
#include <stdlib.h>

void solve() {
    int n;
    scanf("%d", &n);
    int arr[n];
    for (int i = 0; i < n; i++) scanf("%d", &arr[i]);

    // TODO: Your solution here
    printf("0\\n");
}

int main() {
    int t;
    scanf("%d", &t);
    while (t--) solve();
    return 0;
}`,
};



export function TeacherProblemEditorPage() {
  const notify = useNotify();
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const [showGuide, setShowGuide] = useState(false);
  const [aiJsonInput, setAiJsonInput] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [category, setCategory] = useState('DSA');
  const [isPublic, setIsPublic] = useState(false);
  const [evaluationStrategy, setEvaluationStrategy] = useState('EXACT_MATCH');
  const [referenceSolution, setReferenceSolution] = useState('');
  const [testCases, setTestCases] = useState<TestCaseEntry[]>([
    { input: '', expectedOutput: '', isHidden: false, setup: '' },
  ]);
  const [tcPage, setTcPage] = useState(1);
  const tcPageSize = 10;
  const [starterCode, setStarterCode] = useState<Record<string, string>>({ ...DEFAULT_STARTER_CODE });
  const [driverCode, setDriverCode] = useState<Record<string, string>>({});
  const [problemType, setProblemType] = useState('code');
  const [schema, setSchema] = useState('');
  const [parsedTables, setParsedTables] = useState<ParsedTable[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const [showPreview, setShowPreview] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiCopied, setAiCopied] = useState(false);

  const [isVisualBuilder, setIsVisualBuilder] = useState(false);
  const [sigMethodName, setSigMethodName] = useState('solve');
  const [sigReturnType, setSigReturnType] = useState('int');
  const [sigParams, setSigParams] = useState<Array<{ name: string; type: string }>>([
    { name: 'nums', type: 'int[]' }
  ]);
  const [verifying, setVerifying] = useState(false);
  const [verifyResults, setVerifyResults] = useState<any[] | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyLanguage, setVerifyLanguage] = useState('java');

  const [images, setImages] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState<Record<string, boolean>>({});
  const [dragActive, setDragActive] = useState<Record<string, boolean>>({});

  const handleFileUpload = async (file: File, slotKey: string) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify.toast.error('Only image files are allowed!');
      return;
    }
    setIsUploading(prev => ({ ...prev, [slotKey]: true }));
    try {
      const res = await api.uploadProblemImage(file);
      setImages(prev => ({ ...prev, [slotKey]: res.url }));
      notify.toast.success('Figure uploaded successfully!');
    } catch (err) {
      console.error(err);
      notify.toast.error('Failed to upload figure. Please try again.');
    } finally {
      setIsUploading(prev => ({ ...prev, [slotKey]: false }));
    }
  };

  const handleDrop = (e: React.DragEvent, slotKey: string) => {
    e.preventDefault();
    setDragActive(prev => ({ ...prev, [slotKey]: false }));
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0], slotKey);
    }
  };

  const handleDragOver = (e: React.DragEvent, slotKey: string) => {
    e.preventDefault();
    setDragActive(prev => ({ ...prev, [slotKey]: true }));
  };

  const handleDragLeave = (slotKey: string) => {
    setDragActive(prev => ({ ...prev, [slotKey]: false }));
  };

  const handleCopyPrompt = useCallback(async () => {
    try {
      const templateToCopy = problemType === 'sql' ? SQL_AI_PROMPT_TEMPLATE : AI_PROMPT_TEMPLATE;
      await navigator.clipboard.writeText(templateToCopy);
      setAiCopied(true);
      setTimeout(() => setAiCopied(false), 2000);
    } catch (err) { console.error('Operation failed:', err); }
  }, [problemType]);

  const handleAutofill = useCallback(async () => {
    if (!aiJsonInput.trim()) {
      notify.toast.error("Please paste the JSON response from the AI first.");
      return;
    }
    
    try {
      let rawJson = aiJsonInput.trim();
      
      // 1. Strip outer markdown code block wrapper ONLY if the entire input starts with ```
      //    ⚠️ DO NOT use an unanchored regex here — the JSON description field itself may
      //    contain ``` code blocks (e.g. example inputs/outputs in markdown), and an
      //    unanchored match would strip everything between the first and last ```,
      //    completely destroying the JSON structure.
      if (rawJson.startsWith('```')) {
        const match = rawJson.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
        if (match) {
          rawJson = match[1].trim();
        }
      }
      
      // 2. Extract only the portion between the first '{' and the last '}'
      const firstBrace = rawJson.indexOf('{');
      const lastBrace = rawJson.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        rawJson = rawJson.substring(firstBrace, lastBrace + 1);
      }

      // 3. Clean up trailing commas
      rawJson = rawJson.replace(/,(\s*[}\]])/g, '$1');

      // 4. Fix literal newlines AND invalid backslash escapes inside JSON strings.
      //    Step A: Replace literal CRLF/LF/TAB with proper JSON escape sequences.
      //    Step B: Escape any lone backslash NOT followed by a valid JSON escape char
      //            (\", \\, \/, \b, \f, \n, \r, \t, \uXXXX) — fixes AI-generated code
      //            that has things like \n53, \S, \i, \j etc. from Java/C++ solutions.
      const sanitized = rawJson.replace(
        /"((?:[^"\\]|\\[\s\S])*)"/g,
        (_match, content: string) => {
          let fixed = content;
          // Step A: literal newlines/tabs → JSON escape sequences
          fixed = fixed
            .replace(/\r\n/g, '\\n')
            .replace(/\r/g, '\\n')
            .replace(/\n/g, '\\n')
            .replace(/\t/g, '\\t');
          // Step B: fix lone backslashes that are not valid JSON escapes
          // Valid JSON escape chars after \: " \ / b f n r t u
          fixed = fixed.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
          return `"${fixed}"`;
        }
      );

      const data = JSON.parse(sanitized);
      
      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
      if (data.difficulty) setDifficulty(data.difficulty);
      if (data.category) setCategory(data.category);
      if (data.problemType) setProblemType(data.problemType);
      if (data.evaluationStrategy) setEvaluationStrategy(data.evaluationStrategy);
      if (data.referenceSolution) setReferenceSolution(data.referenceSolution);
      if (data.schema) {
        const schemaStr = typeof data.schema === 'string' ? data.schema : (data.schema.setup || '');
        setSchema(schemaStr);
        if (data.problemType === 'sql') {
          const parsed = parseTableStructure(schemaStr);
          setParsedTables(parsed);
        }
      }
      if (data.images) setImages(data.images);
      
      if (data.starterCode) {
        setStarterCode(prev => ({
          ...prev,
          ...(typeof data.starterCode === 'object' ? data.starterCode : { sql: data.starterCode })
        }));
      }

      // ⚠️ Critical: driverCode MUST be imported too.
      // Without this, problems that need a custom Main class (e.g. Sudoku, Trees, Graphs)
      // fall back to the function-only auto-wrapper which cannot parse their input format.
      if (data.driverCode && typeof data.driverCode === 'object') {
        setDriverCode(data.driverCode);
      }
      
      if (data.testCases && Array.isArray(data.testCases)) {
        setTestCases(data.testCases.map((tc: any) => ({
          input: tc.input || "",
          expectedOutput: tc.expectedOutput || "",
          isHidden: tc.isHidden || false,
          setup: tc.setup || ""
        })));
      }
      
      setShowAIModal(false);
      setAiJsonInput("");
      notify.toast.success("Success! The problem form has been automatically populated.");
    } catch (err) {
      console.error(err);
      await notify.alert("JSON Parse Failure", {
        description: `Failed to parse JSON: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }, [aiJsonInput]);

  const handleExportJson = useCallback(() => {
    const payload = {
      title,
      description,
      difficulty,
      category,
      problemType,
      evaluationStrategy,
      referenceSolution,
      testCases: testCases.map(tc => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: tc.isHidden,
        setup: tc.setup
      })),
      starterCode,
      driverCode,
      schema: problemType === 'sql' && schema.trim() ? {
        setup: schema.trim(),
        tables: parseTableStructure(schema)
      } : undefined,
      images
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${title.replace(/\s+/g, '_').toLowerCase() || 'problem'}_config.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    notify.toast.success("Problem configuration exported successfully!");
  }, [title, description, difficulty, category, problemType, evaluationStrategy, referenceSolution, testCases, starterCode, driverCode, schema, images]);

  const handleImportJson = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = event.target?.result as string;
        const data = JSON.parse(raw);
        if (data.title) setTitle(data.title);
        if (data.description) setDescription(data.description);
        if (data.difficulty) setDifficulty(data.difficulty);
        if (data.category) setCategory(data.category);
        if (data.problemType) setProblemType(data.problemType);
        if (data.evaluationStrategy) setEvaluationStrategy(data.evaluationStrategy);
        if (data.referenceSolution) setReferenceSolution(data.referenceSolution);
        if (data.schema) {
          if (typeof data.schema === 'object') {
            if (data.schema.setup) setSchema(data.schema.setup);
          } else if (typeof data.schema === 'string') {
            setSchema(data.schema);
          }
        }
        if (data.images) setImages(data.images);
        if (data.starterCode) {
          setStarterCode(prev => ({ ...prev, ...data.starterCode }));
        }
        if (data.driverCode) {
          setDriverCode(prev => ({ ...prev, ...data.driverCode }));
        }
        if (data.testCases && Array.isArray(data.testCases)) {
          setTestCases(data.testCases.map((tc: any) => ({
            input: tc.input || "",
            expectedOutput: tc.expectedOutput || "",
            isHidden: tc.isHidden || false,
            setup: tc.setup || ""
          })));
        }
        notify.toast.success("Problem configuration imported successfully!");
      } catch (err) {
        console.error(err);
        notify.toast.error("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // Clear file input
  }, []);

  const addSigParam = useCallback(() => {
    setSigParams(prev => [...prev, { name: `param${prev.length + 1}`, type: 'int' }]);
  }, []);

  const removeSigParam = useCallback((index: number) => {
    setSigParams(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateSigParam = useCallback((index: number, key: 'name' | 'type', value: string) => {
    setSigParams(prev => prev.map((p, i) => i === index ? { ...p, [key]: value } : p));
  }, []);

  const handleVerify = useCallback(async () => {
    if (!referenceSolution.trim()) {
      notify.toast.error("Please provide a Reference Solution to test against.");
      return;
    }
    if (testCases.length === 0 || !testCases[0].input.trim()) {
      notify.toast.error("Please add at least one test case to verify.");
      return;
    }
    
    setVerifying(true);
    setVerifyResults(null);
    setShowVerifyModal(true);
    
    try {
      const response = await api.post('/code/run-tests', {
        language: verifyLanguage,
        code: referenceSolution,
        testCases: testCases.map(tc => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          setup: tc.setup
        })),
        driverCode: driverCode,
        problemId: id
      });
      setVerifyResults(response.results || []);
    } catch (err: any) {
      console.error(err);
      notify.toast.error(err.response?.data?.error || "Verification failed to execute.");
    } finally {
      setVerifying(false);
    }
  }, [referenceSolution, testCases, verifyLanguage, driverCode, id]);



  useEffect(() => {
    if (isEditing) {
      loadProblem();
    }
  }, [id]);

  useEffect(() => {
    if (problemType === 'sql' && schema.trim()) {
      setParsedTables(parseTableStructure(schema));
    } else {
      setParsedTables([]);
    }
  }, [schema, problemType]);

  useEffect(() => {
    if (!isVisualBuilder) return;
    
    const langs = ['java', 'cpp', 'python', 'javascript'] as const;
    const newStarter: Record<string, string> = { ...starterCode };
    const newDriver: Record<string, string> = { ...driverCode };
    
    langs.forEach(lang => {
      newStarter[lang] = generateStarterCode(lang, sigMethodName, sigReturnType, sigParams);
      newDriver[lang] = generateDriverCode(lang, sigMethodName, sigReturnType, sigParams);
    });
    
    setStarterCode(newStarter);
    setDriverCode(newDriver);
  }, [isVisualBuilder, sigMethodName, sigReturnType, sigParams]);


  const loadProblem = async () => {
    try {
      const data = await api.getProblem(id!);
      const p = data.problem;
      setTitle(p.title);
      setDescription(p.description);
      setDifficulty(p.difficulty);
      setCategory(p.category || 'DSA');
      setIsPublic(Boolean(p.isPublic));
      setEvaluationStrategy(p.evaluationStrategy || 'EXACT_MATCH');
      setReferenceSolution(p.referenceSolution || '');
      setTestCases(
        (p.testCases || []).map((tc: any) => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isHidden: tc.isHidden || false,
          setup: tc.setup || '',
        }))
      );
      setProblemType(p.problemType || 'code');
      if (p.schema?.setup) setSchema(p.schema.setup);
      if (p.starterCode) {
        const merged = { ...DEFAULT_STARTER_CODE };
        for (const key of LANGUAGE_KEYS) {
          if (p.starterCode[key]) merged[key] = p.starterCode[key];
        }
        setStarterCode(merged);
      }
      if (p.driverCode) {
        setDriverCode(p.driverCode);
      }
      setImages(p.images || {});
    } catch (err) {
      console.error('Failed to load problem:', err);
    } finally {
      setLoading(false);
    }
  };

  const addTestCase = () => {
    setTestCases(prev => {
      const next = [...prev, { input: '', expectedOutput: '', isHidden: false, setup: '' }];
      const newPage = Math.max(1, Math.ceil(next.length / tcPageSize));
      setTcPage(newPage);
      return next;
    });
  };

  const removeTestCase = (index: number) => {
    setTestCases(prev => {
      const next = prev.filter((_, i) => i !== index);
      const newPage = Math.min(tcPage, Math.max(1, Math.ceil(next.length / tcPageSize)));
      setTcPage(newPage);
      return next;
    });
  };

  const updateTestCase = (index: number, field: keyof TestCaseEntry, value: any) => {
    setTestCases(prev => prev.map((tc, i) => (i === index ? { ...tc, [field]: value } : tc)));
  };

  const updateStarterCode = (lang: string, code: string) => {
    setStarterCode(prev => ({ ...prev, [lang]: code }));
  };

  const updateDriverCode = (lang: string, code: string) => {
    setDriverCode(prev => ({ ...prev, [lang]: code }));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      notify.toast.warning('Title is required');
      return;
    }
    if (!description.trim()) {
      notify.toast.warning('Description is required');
      return;
    }
    if (testCases.length === 0) {
      notify.toast.warning('At least one test case is required');
      return;
    }
    for (let i = 0; i < testCases.length; i++) {
      if (problemType === 'sql') {
        if (!testCases[i].expectedOutput.trim()) {
          notify.toast.warning(`Test case ${i + 1} is missing expected output`);
          return;
        }
      } else {
        if (!testCases[i].input.trim() || !testCases[i].expectedOutput.trim()) {
          notify.toast.warning(`Test case ${i + 1} is missing input or expected output`);
          return;
        }
      }
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      difficulty,
      category,
      problemType,
      evaluationStrategy,
      referenceSolution: referenceSolution.trim() || undefined,
      testCases: testCases.map(tc => ({
        input: tc.input.trim(),
        expectedOutput: tc.expectedOutput.trim(),
        isHidden: tc.isHidden,
        setup: problemType === 'sql' ? (tc.setup || '').trim() || undefined : undefined,
      })),
      starterCode: problemType === 'sql' ? { sql: starterCode.sql || '' } : starterCode,
      driverCode: Object.keys(driverCode).length > 0 ? driverCode : undefined,
      schema: problemType === 'sql' && schema.trim() ? {
        setup: schema.trim(),
        tables: parseTableStructure(schema),
      } : undefined,
      isPublic: user?.role === 'SUPER_ADMIN' ? isPublic : false,
      images: Object.keys(images).length > 0 ? images : undefined,
    };

    setSaving(true);
    try {
      if (isEditing) {
        await api.updateProblem(id!, payload);
      } else {
        await api.createProblem(payload);
      }
      navigate('/problems');
    } catch (err: unknown) {
      console.error('Failed to save problem:', err);
      notify.toast.error('Failed to save problem: ' + (err instanceof Error ? (axios.isAxiosError(err) ? err.response?.data?.error || err.message : err.message) : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-green)]" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">
            {isEditing ? 'Edit Problem' : 'Create Problem'}
            <span className="text-[var(--accent-green)]">.</span>
          </h1>
          <p className="text-gray-400 font-medium">
            {isEditing ? 'Update the problem details below' : 'Define a new coding challenge'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportJson}
            className="px-4 py-2 text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded-lg transition text-sm"
          >
            Export JSON
          </button>
          <label
            className="px-4 py-2 text-green-400 hover:text-green-300 border border-green-500/30 rounded-lg transition text-sm cursor-pointer inline-flex items-center justify-center"
          >
            Import JSON
            <input
              type="file"
              accept=".json"
              onChange={handleImportJson}
              className="hidden"
            />
          </label>
          <button
            onClick={() => setShowAIModal(true)}
            className="px-4 py-2 text-purple-400 hover:text-purple-300 border border-purple-500/30 rounded-lg transition text-sm"
          >
            AI Import
          </button>
          <button
            onClick={() => navigate('/problems')}
            className="px-4 py-2 text-gray-400 hover:text-white border border-white/10 rounded-lg transition"
          >
            Cancel
          </button>
          {problemType === 'code' && (
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="px-4 py-2 text-[var(--accent-yellow)] hover:text-yellow-300 border border-yellow-500/30 rounded-lg transition text-sm flex items-center gap-1.5 font-semibold disabled:opacity-50"
            >
              ⚡ Test & Verify
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-[var(--accent-green)] text-white font-semibold rounded-lg hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEditing ? 'Update Problem' : 'Create Problem'}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Mapping Guide */}
        <div className="bg-gradient-to-r from-blue-950/20 to-indigo-950/20 border border-blue-500/20 rounded-xl p-5 shadow-lg">
          <div
            className="flex justify-between items-center cursor-pointer"
            onClick={() => setShowGuide(!showGuide)}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <h3 className="text-md font-bold text-blue-300">ContestOS Problem Mapping Guide & Best Practices</h3>
                <p className="text-xs text-blue-400/80 mt-0.5">Click to expand our step-by-step guidelines for creating coding, SQL, and Web-Dev challenges.</p>
              </div>
            </div>
            <span className={`text-blue-300 text-xs transition-transform duration-200 ${showGuide ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </div>
          {showGuide && (
            <div className="mt-4 pt-4 border-t border-blue-500/10 text-sm text-gray-300 space-y-4">
              <div>
                <h4 className="text-xs font-bold text-blue-200 uppercase tracking-wider mb-1">1. Codeforces-Style Execution (Full Program)</h4>
                <ul className="list-disc pl-5 space-y-1 text-xs text-gray-400">
                  <li>
                    <strong className="text-gray-300">Students write complete programs</strong> — with <code className="text-blue-300">main()</code>, reading from <code className="text-blue-300">stdin</code> and printing to <code className="text-blue-300">stdout</code>. Just like Codeforces / AtCoder.
                  </li>
                  <li>
                    The <strong className="text-gray-300">Starter Code</strong> you define is the template students see in the editor. It should be a complete program with boilerplate pre-filled (imports, main, input reading) and a clear <code className="text-blue-300">// TODO</code> section for their logic.
                  </li>
                  <li>
                    <strong className="text-amber-300">Java Rule</strong>: The public class must be named <code className="text-blue-300">Main</code> (e.g. <code className="text-blue-300">public class Main</code>). Do not use <code className="text-blue-300">public class Solution</code>.
                  </li>
                  <li>
                    Wrap boilerplate inside <code className="text-blue-300">// #region</code> / <code className="text-blue-300">// #endregion</code> (or <code className="text-blue-300"># region</code> / <code className="text-blue-300"># endregion</code> for Python) to <strong className="text-gray-300">lock and collapse</strong> them in the student editor.
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-bold text-blue-200 uppercase tracking-wider mb-1">2. Test Case Input Format (Raw stdin text)</h4>
                <ul className="list-disc pl-5 space-y-1 text-xs text-gray-400">
                  <li>
                    Test case <strong className="text-gray-300">Input</strong> is raw text that will be fed to your program via <code className="text-blue-300">stdin</code>. Write exactly what your program reads.
                  </li>
                  <li>
                    <strong className="text-gray-300">Single test case per input block</strong> — or use a T (number of test cases) format if your program loops:
                    <pre className="mt-1 bg-black/30 border border-white/5 rounded px-2 py-1 text-[10px] text-blue-300 font-mono">
{"1\n5\n1 2 3 4 5"}
                    </pre>
                  </li>
                  <li>
                    Test case <strong className="text-gray-300">Expected Output</strong> is the exact stdout your program should print (whitespace trimmed on comparison).
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-bold text-blue-200 uppercase tracking-wider mb-1">3. SQL Challenges</h4>
                <ul className="list-disc pl-5 space-y-1 text-xs text-gray-400">
                  <li>
                    In the global <strong className="text-gray-300">Database Schema</strong> block, provide <code className="text-blue-300">CREATE TABLE</code> statements.
                  </li>
                  <li>
                    In individual <strong className="text-gray-300">Test Cases</strong>, provide only <code className="text-blue-300">INSERT INTO</code> statements. Do not duplicate table creations.
                  </li>
                </ul>
              </div>

            </div>
          )}
        </div>

        {/* Basic Info */}
        <div className="bg-[var(--bg-card)] border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Title *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Two Sum"
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-white/10 rounded-lg text-white focus:outline-none focus:border-[var(--accent-blue)]"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm text-gray-400 mb-1">Difficulty</label>
                <div className="flex gap-2">
                  {(['Easy', 'Medium', 'Hard'] as const).map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                        difficulty === d
                          ? d === 'Easy'
                            ? 'border-green-500 bg-green-500/20 text-green-400'
                            : d === 'Medium'
                            ? 'border-yellow-500 bg-yellow-500/20 text-yellow-400'
                            : 'border-red-500 bg-red-500/20 text-red-400'
                          : 'border-white/10 text-gray-500 bg-white/[0.02] hover:bg-white/5'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-sm text-gray-400 mb-1">Category</label>
                <input
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  placeholder="e.g. Array"
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-white/10 rounded-lg text-white focus:outline-none focus:border-[var(--accent-blue)]"
                />
              </div>
            </div>
            {user?.role === 'SUPER_ADMIN' && (
              <div className="mt-3 bg-purple-950/20 border border-purple-500/30 rounded-lg p-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={e => setIsPublic(e.target.checked)}
                    className="w-4 h-4 accent-purple-400"
                  />
                  <div>
                    <p className="text-sm font-bold text-purple-300">Publish to Public Platform Bank</p>
                    <p className="text-xs text-purple-400/70">Allow all organizations on ContestOS to view & clone this question.</p>
                  </div>
                </label>
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm text-gray-400">Description *</label>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs px-2 py-1 rounded bg-white/10 text-gray-300 hover:bg-white/20 transition-colors"
              >
                {showPreview ? 'Edit' : 'Preview'}
              </button>
            </div>
            {showPreview ? (
              <div className="bg-[var(--bg-primary)] border border-white/10 rounded-lg p-4 min-h-[160px]">
                <MarkdownRenderer content={formatProblemDescriptionWithImages(description || '*No content*', images)} />
              </div>
            ) : (
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={8}
                placeholder="Problem statement, examples, constraints..."
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-white/10 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-[var(--accent-blue)] resize-y"
              />
            )}
          </div>

          <div className="mt-4">
            <label className="block text-sm font-semibold text-white mb-3">Problem Figures (Optional)</label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { key: 'main', label: 'Main Description' },
                { key: 'example1', label: 'Example 1' },
                { key: 'example2', label: 'Example 2' },
                { key: 'example3', label: 'Example 3' }
              ].map(slot => (
                <div key={slot.key} className="border border-white/10 rounded-lg p-3 bg-black/20">
                  <span className="text-xs text-gray-400 font-medium mb-2 block">{slot.label} Figure</span>
                  {images[slot.key] ? (
                    <div className="relative group rounded bg-[var(--bg-primary)] p-2 flex flex-col items-center">
                      <img src={images[slot.key]} alt={`${slot.label} Figure`} className="h-24 object-contain rounded border border-white/5" />
                      <button type="button" onClick={() => setImages(prev => { const n = {...prev}; delete n[slot.key]; return n; })} className="mt-2 px-2 py-1 bg-red-600/80 text-white rounded text-xs hover:bg-red-700 transition">Remove</button>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => handleDragOver(e, slot.key)}
                      onDragLeave={() => handleDragLeave(slot.key)}
                      onDrop={(e) => handleDrop(e, slot.key)}
                      className={`border border-dashed rounded p-4 flex flex-col items-center justify-center cursor-pointer transition h-32 ${dragActive[slot.key] ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/5' : 'border-white/10 hover:border-white/30'}`}
                      onClick={() => document.getElementById(`img-input-${slot.key}`)?.click()}
                    >
                      <input id={`img-input-${slot.key}`} type="file" accept="image/*" onChange={(e) => { if (e.target.files && e.target.files[0]) handleFileUpload(e.target.files[0], slot.key); }} className="hidden" />
                      <span className="text-xl mb-1">🖼️</span>
                      <p className="text-xs text-gray-400 text-center leading-tight">
                        {isUploading[slot.key] ? 'Uploading...' : 'Drop image here'}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Playground Type */}
        <div className="bg-[var(--bg-card)] border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Playground Type</h2>
          <p className="text-sm text-gray-500 mb-4">
            Select which playground environment students will use for this problem.
          </p>
          <div className="flex gap-3">
            {(['code', 'sql', 'web-dev'] as const).map(type => (
              <button
                key={type}
                onClick={() => {
                  setProblemType(type);
                  if (type === 'sql') setCategory('SQL');
                }}
                className={`flex-1 p-4 rounded-lg border text-left transition-all ${
                  problemType === type
                    ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/10'
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/5'
                }`}
              >
                <span className="block text-white font-medium mb-1">
                  {type === 'code' ? 'Code' : type === 'sql' ? 'SQL' : 'Web Dev'}
                </span>
                <span className="text-xs text-gray-500">
                  {type === 'code' ? 'Java, C++, Python, JS, C' : type === 'sql' ? 'SQL queries with schema' : 'HTML, CSS, JavaScript'}
                </span>
              </button>
            ))}
          </div>

          {problemType === 'sql' && (
            <div className="mt-4 space-y-4">
              <SqlProblemBuilder
                initialSql={starterCode.sql || ''}
                onSave={({ starterCode: newStarter, expectedOutput }) => {
                  setSchema(newStarter.schema.setup);
                  setStarterCode({ sql: newStarter.sql });
                  if (testCases.length > 0) {
                    setTestCases(prev => [
                      { ...prev[0], setup: newStarter.schema.setup, expectedOutput }
                    ]);
                  } else {
                    setTestCases([{ input: '', expectedOutput, isHidden: false, setup: newStarter.schema.setup }]);
                  }
                  notify.toast.success('SQL Problem schema and expected output synchronized!');
                }}
              />
              <label className="block text-sm text-gray-400 mb-1 font-semibold">Raw Database Setup DDL (CREATE TABLE + INSERT Statements)</label>
              <textarea
                value={schema}
                onChange={e => setSchema(e.target.value)}
                rows={6}
                placeholder={`CREATE TABLE Cinema (\n  id INT PRIMARY KEY,\n  movie VARCHAR(255),\n  rating FLOAT\n);\n\nINSERT INTO Cinema VALUES (1, 'Inception', 8.8);`}
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-white/10 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-[var(--accent-blue)] resize-y"
              />
              {parsedTables.length > 0 && (
                <div className="mt-3 space-y-3">
                  <p className="text-xs text-gray-500 font-medium">Parsed Table Structure:</p>
                  {parsedTables.map((table, ti) => (
                    <div key={ti} className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
                      <div className="px-3 py-2 bg-white/5 border-b border-white/10">
                        <span className="text-xs font-bold text-[var(--accent-yellow)] uppercase tracking-wider">{table.name}</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-white/10">
                              <th className="px-3 py-1.5 text-gray-500 font-medium">Column</th>
                              <th className="px-3 py-1.5 text-gray-500 font-medium">Type</th>
                              <th className="px-3 py-1.5 text-gray-500 font-medium">Constraints</th>
                            </tr>
                          </thead>
                          <tbody>
                            {table.columns.map((col, ci) => (
                              <tr key={ci} className="border-b border-white/5 hover:bg-white/5">
                                <td className="px-3 py-1.5 text-white font-mono">{col.name}</td>
                                <td className="px-3 py-1.5 text-gray-300 font-mono">{col.type}</td>
                                <td className="px-3 py-1.5 text-gray-500 italic">{col.constraints || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Visual Signature Builder */}
        {problemType === 'code' && (
          <div className="bg-[var(--bg-card)] border border-white/10 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                <div>
                  <h2 className="text-lg font-bold text-white">Interactive Code Generator</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Generate starter/driver codes automatically from function signatures</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setIsVisualBuilder(false)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    !isVisualBuilder
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Manual Editor
                </button>
                <button
                  type="button"
                  onClick={() => setIsVisualBuilder(true)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    isVisualBuilder
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Visual Builder
                </button>
              </div>
            </div>

            {isVisualBuilder ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1 font-medium">Method Name</label>
                    <input
                      type="text"
                      value={sigMethodName}
                      onChange={e => setSigMethodName(e.target.value)}
                      placeholder="e.g. twoSum"
                      className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-white/10 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-[var(--accent-blue)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1 font-medium">Return Type</label>
                    <select
                      value={sigReturnType}
                      onChange={e => setSigReturnType(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-white/10 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-[var(--accent-blue)] select-custom"
                    >
                      {['int', 'int[]', 'int[][]', 'char', 'char[]', 'char[][]', 'String', 'String[]', 'double', 'boolean', 'List<Integer>', 'ListNode', 'TreeNode', 'void'].map(t => (
                        <option key={t} value={t} className="bg-[#1a1a2e] text-white">{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between border-t border-white/5 pt-3">
                    <span className="text-xs font-semibold text-gray-400">Method Parameters</span>
                    <button
                      type="button"
                      onClick={addSigParam}
                      className="px-2.5 py-1 text-xs bg-white/5 border border-white/10 hover:bg-white/10 rounded-md text-white font-medium transition"
                    >
                      + Add Parameter
                    </button>
                  </div>

                  {sigParams.length === 0 ? (
                    <p className="text-xs text-gray-600 italic">No parameters defined. Add one above.</p>
                  ) : (
                    <div className="space-y-2">
                      {sigParams.map((param, index) => (
                        <div key={index} className="flex items-center gap-2 bg-white/[0.01] border border-white/5 rounded-lg p-2">
                          <input
                            type="text"
                            value={param.name}
                            onChange={e => updateSigParam(index, 'name', e.target.value)}
                            placeholder="Param name"
                            className="flex-1 px-3 py-1.5 bg-[var(--bg-primary)] border border-white/10 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-[var(--accent-blue)]"
                          />
                          <select
                            value={param.type}
                            onChange={e => updateSigParam(index, 'type', e.target.value)}
                            className="w-40 px-3 py-1.5 bg-[var(--bg-primary)] border border-white/10 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-[var(--accent-blue)]"
                          >
                            {['int', 'int[]', 'int[][]', 'char', 'char[]', 'char[][]', 'String', 'String[]', 'double', 'boolean', 'List<Integer>', 'ListNode', 'TreeNode'].map(t => (
                              <option key={t} value={t} className="bg-[#1a1a2e] text-white">{t}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeSigParam(index)}
                            className="text-gray-500 hover:text-red-400 p-1.5 transition"
                            title="Remove parameter"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-400 leading-relaxed">
                  💡 <strong>Visual Builder Active:</strong> Starter code and Driver code templates are locked and automatically updating based on your inputs. If you want to make manual modifications (like adding custom print formatting), switch to <strong>Manual Editor</strong>.
                </div>
              </div>
            ) : (
              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3 text-xs text-yellow-400 leading-relaxed">
                ✍️ <strong>Manual Editor Active:</strong> You can edit starter/driver code templates freely in the code boxes below. Turn on <strong>Visual Builder</strong> if you want the system to overwrite and regenerate them from function signatures.
              </div>
            )}
          </div>
        )}


        {/* Evaluation Strategy */}
        <div className="bg-[var(--bg-card)] border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Evaluation Strategy</h2>
          <p className="text-sm text-gray-500 mb-4">
            Choose how the student's output will be compared against the expected output.
          </p>
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/10 cursor-pointer hover:bg-white/5 transition">
              <input
                type="radio"
                name="strategy"
                value="EXACT_MATCH"
                checked={evaluationStrategy === 'EXACT_MATCH'}
                onChange={e => setEvaluationStrategy(e.target.value)}
                className="accent-[var(--accent-blue)]"
              />
              <div>
                <span className="text-white font-medium">Exact Match</span>
                <p className="text-xs text-gray-500 mt-0.5">Output must match exactly — order and formatting matters</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/10 cursor-pointer hover:bg-white/5 transition">
              <input
                type="radio"
                name="strategy"
                value="UNORDERED_MATCH"
                checked={evaluationStrategy === 'UNORDERED_MATCH'}
                onChange={e => setEvaluationStrategy(e.target.value)}
                className="accent-[var(--accent-blue)]"
              />
              <div>
                <span className="text-white font-medium">Any Order (Unordered Match)</span>
                <p className="text-xs text-gray-500 mt-0.5">Elements can be in any order — great for problems like Two Sum where [0,1] == [1,0]</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/10 cursor-pointer hover:bg-white/5 transition">
              <input
                type="radio"
                name="strategy"
                value="FLOAT_TOLERANCE"
                checked={evaluationStrategy === 'FLOAT_TOLERANCE'}
                onChange={e => setEvaluationStrategy(e.target.value)}
                className="accent-[var(--accent-blue)]"
              />
              <div>
                <span className="text-white font-medium">Float Tolerance</span>
                <p className="text-xs text-gray-500 mt-0.5">Floating-point values within 1e-5 tolerance — for numerical/math problems</p>
              </div>
            </label>
          </div>
        </div>

        {/* Reference Solution */}
        <div className="bg-[var(--bg-card)] border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Reference Solution</h2>
          <p className="text-sm text-gray-500 mb-3">
            Optional: Provide your solved implementation. This will be used to verify test cases produce the expected output.
          </p>
          <textarea
            value={referenceSolution}
            onChange={e => setReferenceSolution(e.target.value)}
            rows={6}
            placeholder={problemType === 'sql' ? `SELECT *\nFROM Cinema\nWHERE id % 2 = 1\n  AND description <> 'boring'\nORDER BY rating DESC;` : problemType === 'web-dev' ? '<!-- Your solution here -->' : `def solve(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in seen:\n            return [seen[complement], i]\n        seen[num] = i`}
            className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-white/10 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-[var(--accent-blue)] resize-y"
          />
        </div>

        {/* Test Cases */}
        <div className="bg-[var(--bg-card)] border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Test Cases</h2>
              <p className="text-sm text-gray-500 mt-1">
                {testCases.filter(tc => !tc.isHidden).length} sample · {testCases.filter(tc => tc.isHidden).length} hidden · {testCases.length} total
              </p>
            </div>
            <button
              type="button"
              onClick={addTestCase}
              className="px-3 py-1.5 bg-[var(--accent-blue)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition"
            >
              + Add Case
            </button>
          </div>

          {/* Premium Pagination Controls */}
          {testCases.length > tcPageSize && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4 mb-4">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setTcPage(p => Math.max(1, p - 1))}
                  disabled={tcPage === 1}
                  className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  title="Previous Page"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-xs text-gray-400">
                  Page <span className="text-white font-medium">{tcPage}</span> of <span className="text-white font-medium">{Math.ceil(testCases.length / tcPageSize)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setTcPage(p => Math.min(Math.ceil(testCases.length / tcPageSize), p + 1))}
                  disabled={tcPage === Math.ceil(testCases.length / tcPageSize)}
                  className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  title="Next Page"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Go to case:</span>
                <input
                  type="number"
                  min={1}
                  max={testCases.length}
                  placeholder="Case #"
                  onChange={e => {
                    const val = parseInt(e.target.value);
                    if (val >= 1 && val <= testCases.length) {
                      setTcPage(Math.ceil(val / tcPageSize));
                    }
                  }}
                  className="w-20 px-2.5 py-1 bg-[var(--bg-primary)] border border-white/10 rounded-md text-white font-mono text-xs focus:outline-none focus:border-[var(--accent-blue)]"
                />
              </div>
            </div>
          )}

          <div className="space-y-4">
            {testCases
              .slice((tcPage - 1) * tcPageSize, (tcPage - 1) * tcPageSize + tcPageSize)
              .map((tc, localIndex) => {
                const index = (tcPage - 1) * tcPageSize + localIndex;
                return (
                  <div
                    key={index}
                    className={`rounded-lg border p-4 ${tc.isHidden ? 'border-purple-500/30 bg-purple-500/5' : 'border-white/10 bg-white/[0.02]'}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-white">
                          {tc.isHidden ? `Hidden Case ${index + 1}` : `Case ${index + 1}`}
                        </span>
                        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={tc.isHidden}
                            onChange={e => updateTestCase(index, 'isHidden', e.target.checked)}
                            className="accent-purple-500"
                          />
                          Hidden
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTestCase(index)}
                        className="text-gray-500 hover:text-red-400 p-1 transition"
                        title="Remove test case"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    {problemType === 'sql' ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Insert Data (INSERT statements for this test case)</label>
                          <textarea
                            value={tc.setup || ''}
                            onChange={e => updateTestCase(index, 'setup', e.target.value)}
                            rows={4}
                            placeholder={`INSERT INTO Cinema VALUES (1, 'War', 'great 3D', 8.9);\nINSERT INTO Cinema VALUES (2, 'Science', 'fiction', 8.5);`}
                            className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-white/10 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-[var(--accent-blue)] resize-y"
                          />
                          <p className="text-[10px] text-gray-600 mt-1">Only INSERT statements — CREATE TABLE is in the global schema above.</p>
                        </div>
                        {parsedTables.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {parsedTables.map((table, ti) => (
                              <div key={ti} className="bg-white/5 rounded border border-white/10 px-2 py-1.5">
                                <span className="text-[10px] font-bold text-[var(--accent-yellow)] uppercase tracking-wider block mb-0.5">{table.name}</span>
                                <span className="text-[10px] text-gray-500 font-mono">
                                  ({table.columns.map(c => c.name).join(', ')})
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Expected Output</label>
                          <textarea
                            value={tc.expectedOutput}
                            onChange={e => updateTestCase(index, 'expectedOutput', e.target.value)}
                            rows={3}
                            placeholder="id | movie | description | rating"
                            className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-white/10 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-[var(--accent-blue)] resize-y"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Input</label>
                          <textarea
                            value={tc.input}
                            onChange={e => updateTestCase(index, 'input', e.target.value)}
                            rows={3}
                            placeholder="Test case input (stdin)"
                            className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-white/10 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-[var(--accent-blue)] resize-y"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Expected Output</label>
                          <textarea
                            value={tc.expectedOutput}
                            onChange={e => updateTestCase(index, 'expectedOutput', e.target.value)}
                            rows={3}
                            placeholder="Expected stdout output"
                            className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-white/10 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-[var(--accent-blue)] resize-y"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          {/* Premium Pagination Controls (Bottom) */}
          {testCases.length > tcPageSize && (
            <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-4">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setTcPage(p => Math.max(1, p - 1))}
                  disabled={tcPage === 1}
                  className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  title="Previous Page"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-xs text-gray-400">
                  Page <span className="text-white font-medium">{tcPage}</span> of <span className="text-white font-medium">{Math.ceil(testCases.length / tcPageSize)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setTcPage(p => Math.min(Math.ceil(testCases.length / tcPageSize), p + 1))}
                  disabled={tcPage === Math.ceil(testCases.length / tcPageSize)}
                  className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  title="Next Page"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Starter Code */}
        <div className="bg-[var(--bg-card)] border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            {problemType === 'code' ? 'Starter Code Templates' : problemType === 'sql' ? 'SQL Starter Template' : 'Starter Templates'}
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            {problemType === 'code' ? 'Provide initial code templates with locked sections for each language. Use <code className="text-xs bg-white/10 px-1 py-0.5 rounded">USER CODE START</code> and <code className="text-xs bg-white/10 px-1 py-0.5 rounded">USER CODE END</code> markers.' : problemType === 'sql' ? 'Provide the initial SQL query template students will see in the editor. Students will write their SQL query here.' : 'Provide the initial code template students will see in the editor.'}
          </p>
          <div className="space-y-4">
            {problemType === 'sql' ? (
              <div>
                <label className="block text-sm text-gray-400 mb-1">SQL Template</label>
                <textarea
                  value={starterCode.sql || ''}
                  onChange={e => updateStarterCode('sql', e.target.value)}
                  rows={6}
                  placeholder="-- Write your MySQL query statement below"
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-white/10 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-[var(--accent-blue)] resize-y"
                />
              </div>
            ) : problemType === 'web-dev' ? (
              <>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">HTML</label>
                  <textarea
                    value={starterCode.html || ''}
                    onChange={e => updateStarterCode('html', e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-white/10 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-[var(--accent-blue)] resize-y"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">CSS</label>
                  <textarea
                    value={starterCode.css || ''}
                    onChange={e => updateStarterCode('css', e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-white/10 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-[var(--accent-blue)] resize-y"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">JavaScript</label>
                  <textarea
                    value={starterCode.javascript || ''}
                    onChange={e => updateStarterCode('javascript', e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-white/10 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-[var(--accent-blue)] resize-y"
                  />
                </div>
              </>
            ) : (
              LANGUAGE_KEYS.map(lang => (
                <div key={lang}>
                  <label className="block text-sm text-gray-400 mb-1 capitalize flex items-center justify-between">
                    <span>{lang}</span>
                    {isVisualBuilder && <span className="text-[10px] text-blue-400 font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">Auto Generated</span>}
                  </label>
                  <textarea
                    value={starterCode[lang] || ''}
                    onChange={e => updateStarterCode(lang, e.target.value)}
                    readOnly={isVisualBuilder}
                    rows={6}
                    className={`w-full px-3 py-2 bg-[var(--bg-primary)] border border-white/10 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-[var(--accent-blue)] resize-y ${isVisualBuilder ? 'opacity-70 cursor-not-allowed' : ''}`}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Driver Code */}
        {problemType === 'code' && (
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
              <h2 className="text-lg font-bold text-white">Hidden Driver Code (Optional)</h2>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Use this if your problem requires custom boilerplate (e.g. `ListNode` or `TreeNode` definitions) to map inputs/outputs. If provided, the standard auto-wrapper will be bypassed and you MUST use `{"{"}{"{"}userCode{"}"}{"}"}` in your driver code to inject the student's solution.
            </p>
            <div className="space-y-4">
              {LANGUAGE_KEYS.map(lang => (
                <div key={lang}>
                  <label className="block text-sm text-gray-400 mb-1 capitalize flex items-center justify-between">
                    <span>{lang}</span>
                    {isVisualBuilder && <span className="text-[10px] text-blue-400 font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">Auto Generated</span>}
                  </label>
                  <textarea
                    value={driverCode[lang] || ''}
                    onChange={e => updateDriverCode(lang, e.target.value)}
                    readOnly={isVisualBuilder}
                    rows={6}
                    placeholder={`e.g. public class Main { ... {"{"}{"{"}userCode{"}"}{"}"} ... }`}
                    className={`w-full px-3 py-2 bg-[var(--bg-primary)] border border-white/10 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-[var(--accent-blue)] resize-y ${isVisualBuilder ? 'opacity-70 cursor-not-allowed' : ''}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Import Prompt Modal */}
      {showAIModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowAIModal(false)}>
          <div className="bg-[#1a1a2e] border border-purple-500/30 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-[#1a1a2e] z-10 flex items-center justify-between p-5 border-b border-white/10">
              <div>
                <h2 className="text-xl font-bold text-white">AI Import</h2>
                <p className="text-sm text-gray-400 mt-0.5">Generate problem configuration using ChatGPT, Claude, or any AI agent</p>
              </div>
              <button onClick={() => setShowAIModal(false)} className="text-gray-500 hover:text-white p-1 transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Steps */}
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                    <span className="text-sm font-bold text-purple-400">1</span>
                  </div>
                  <div>
                    <h3 className="text-white font-medium">Copy the prompt below</h3>
                    <p className="text-sm text-gray-400 mt-0.5">Includes instructions for the AI to generate a complete TalentOS problem definition.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                    <span className="text-sm font-bold text-purple-400">2</span>
                  </div>
                  <div>
                    <h3 className="text-white font-medium">Paste your problem</h3>
                    <p className="text-sm text-gray-400 mt-0.5">Replace the <code className="text-purple-400 bg-white/5 px-1 rounded text-xs">[PASTE YOUR PROBLEM HERE]</code> placeholder at the bottom with the problem statement you copied from LeetCode, CodeForces, HackerRank, etc.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                    <span className="text-sm font-bold text-purple-400">3</span>
                  </div>
                  <div>
                    <h3 className="text-white font-medium">Send to your AI agent</h3>
                    <p className="text-sm text-gray-400 mt-0.5">Paste the full prompt into ChatGPT, Claude, Gemini, or any AI. It will return a structured Markdown file.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                    <span className="text-sm font-bold text-purple-400">4</span>
                  </div>
                  <div>
                    <h3 className="text-white font-medium">Autofill the form</h3>
                    <p className="text-sm text-gray-400 mt-0.5">Paste the JSON response from your AI agent into the textbox below and click "Parse & Autofill Form".</p>
                  </div>
                </div>
              </div>

              {/* Prompt box */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300">Prompt Template</label>
                  <button
                    onClick={handleCopyPrompt}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                      aiCopied
                        ? 'border-green-500/50 text-green-400 bg-green-500/10'
                        : 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10'
                    }`}
                  >
                    {aiCopied ? 'Copied!' : 'Copy Prompt'}
                  </button>
                </div>
                <div className="relative">
                  <pre className="w-full bg-black/40 border border-white/10 rounded-lg p-4 text-gray-300 font-mono text-xs leading-relaxed overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap">
                    {problemType === 'sql' ? SQL_AI_PROMPT_TEMPLATE : AI_PROMPT_TEMPLATE}
                  </pre>
                </div>
              </div>

              {/* JSON Input box */}
              <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 space-y-3">
                <label className="text-sm font-medium text-gray-300 block">Paste AI JSON Output:</label>
                <textarea
                  value={aiJsonInput}
                  onChange={e => setAiJsonInput(e.target.value)}
                  rows={6}
                  placeholder="Paste the full JSON block from ChatGPT/Claude here..."
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-white/10 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-[var(--accent-blue)] resize-y"
                />
                <button
                  onClick={handleAutofill}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition-all text-sm w-full"
                >
                  Parse & Autofill Form
                </button>
              </div>

              <div className="text-xs text-gray-500 bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
                <strong className="text-yellow-400">Tip:</strong> Make sure to replace <code className="text-yellow-400 bg-white/5 px-1 rounded">[PASTE YOUR PROBLEM HERE]</code> with the actual problem text before sending to the AI. Include all examples, constraints, and table schemas if it's an SQL problem.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verification Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => !verifying && setShowVerifyModal(false)}>
          <div className="bg-[#1a1a2e] border border-yellow-500/20 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-[#1a1a2e] z-10 flex items-center justify-between p-5 border-b border-white/10">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="text-yellow-400">⚡</span>
                  Pre-Flight TestCase Verification
                </h2>
                <p className="text-sm text-gray-400 mt-0.5">Run and test your reference solution before saving to the database</p>
              </div>
              <button
                onClick={() => !verifying && setShowVerifyModal(false)}
                disabled={verifying}
                className="text-gray-500 hover:text-white p-1 transition disabled:opacity-30"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white/[0.02] border border-white/10 rounded-xl p-4">
                <div className="space-y-1">
                  <div className="text-sm text-gray-300 font-bold">Select Language</div>
                  <div className="text-xs text-gray-500">Pick the language matching your reference solution</div>
                </div>
                <div className="flex gap-2">
                  <select
                    value={verifyLanguage}
                    onChange={e => setVerifyLanguage(e.target.value)}
                    disabled={verifying}
                    className="px-3 py-1.5 bg-[var(--bg-primary)] border border-white/10 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-[var(--accent-blue)]"
                  >
                    {['java', 'cpp', 'python', 'javascript', 'c'].map(lang => (
                      <option key={lang} value={lang} className="bg-[#1a1a2e] text-white">{lang}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleVerify}
                    disabled={verifying}
                    className="px-5 py-1.5 bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-800 text-white font-semibold rounded-lg text-sm transition"
                  >
                    {verifying ? 'Running...' : 'Run Verification'}
                  </button>
                </div>
              </div>

              {verifying && (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500" />
                  <p className="text-sm text-gray-400 font-medium animate-pulse">Compiling code and executing testcases in the sandbox...</p>
                </div>
              )}

              {!verifying && verifyResults && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className={`p-4 rounded-xl border flex items-center justify-between ${
                    verifyResults.every(r => r.passed)
                      ? 'bg-green-500/5 border-green-500/20 text-green-400'
                      : 'bg-red-500/5 border-red-500/20 text-red-400'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{verifyResults.every(r => r.passed) ? '🟢' : '🔴'}</span>
                      <span className="font-bold text-sm">
                        {verifyResults.every(r => r.passed) 
                          ? 'Verification Succeeded! All test cases passed.' 
                          : 'Verification Failed! Some test cases returned errors or wrong answers.'}
                      </span>
                    </div>
                    <div className="text-xs font-mono bg-white/5 border border-white/10 px-2 py-1 rounded text-white">
                      Passed: {verifyResults.filter(r => r.passed).length} / {verifyResults.length}
                    </div>
                  </div>

                  {/* Results List */}
                  <div className="space-y-3">
                    {verifyResults.map((res, index) => (
                      <div
                        key={index}
                        className={`rounded-lg border p-4 ${
                          res.passed
                            ? 'border-green-500/20 bg-green-500/[0.01]'
                            : 'border-red-500/20 bg-red-500/[0.01]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">TestCase {res.testCase}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                              res.passed
                                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                              {res.passed ? 'Passed' : 'Failed'}
                            </span>
                          </div>
                          {res.executionTime !== undefined && (
                            <span className="text-xs text-gray-500 font-mono">{res.executionTime} ms</span>
                          )}
                        </div>

                        {res.error ? (
                          <div className="bg-black/30 border border-red-500/20 rounded-lg p-3 text-xs text-red-400 font-mono whitespace-pre-wrap leading-relaxed">
                            {res.error}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div className="bg-black/20 p-2 rounded border border-white/5">
                              <span className="text-gray-500 block mb-1 font-medium">Input:</span>
                              <pre className="font-mono text-gray-300 overflow-x-auto">{res.input || 'empty'}</pre>
                            </div>
                            <div className="bg-black/20 p-2 rounded border border-white/5">
                              <span className="text-gray-500 block mb-1 font-medium">Expected Output:</span>
                              <pre className="font-mono text-gray-300 overflow-x-auto">{res.expectedOutput || 'empty'}</pre>
                            </div>
                            <div className="bg-black/20 p-2 rounded border border-white/5 md:col-span-2">
                              <span className="text-gray-500 block mb-1 font-medium">Actual Output:</span>
                              <pre className={`font-mono overflow-x-auto ${res.passed ? 'text-green-400' : 'text-red-400'}`}>{res.actualOutput || 'empty'}</pre>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
