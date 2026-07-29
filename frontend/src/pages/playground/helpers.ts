export function cleanStarterCode(code: string, lang: string): string {
  if (!code) return code;

  if (lang === 'javascript' || lang === 'java' || lang === 'cpp' || lang === 'c' || lang === 'typescript') {
    return code.split('\n').map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') && !trimmed.startsWith('#include') && !trimmed.startsWith('#define') && !trimmed.startsWith('#region') && !trimmed.startsWith('#endregion') && !trimmed.startsWith('#pragma')) {
        return '//' + line.substring(1);
      }
      return line;
    }).join('\n');
  }

  if (lang === 'python') {
    return code.split('\n').map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//')) {
        return '#' + line.substring(2);
      }
      return line;
    }).join('\n');
  }

  return code;
}

export function formatInputDisplay(input: string): string {
  if (!input) return "";
  const lines = input.split("\n").filter(s => s);
  if (lines.length < 4) return input;
  const n = parseInt(lines[1]);
  if (isNaN(n)) return input;
  const nums = lines[2].trim().split(/\s+/).filter(s => s);
  if (nums.length !== n) return input;
  const target = lines[3].trim();
  if (target === "") return input;
  return `nums = [${nums.join(", ")}], target = ${target}`;
}

import { generateStarterCode } from '../../utils/signatureBuilder';

export const isCodeValidForLang = (codeStr: string, l: string): boolean => {
  if (!codeStr || !codeStr.trim()) return false;

  if (l === 'java' || l === 'cpp' || l === 'c' || l === 'javascript' || l === 'typescript') {
    if (/\bdef\s+/i.test(codeStr) || /\bself[.,]/i.test(codeStr) || /class\s+Solution\s*:/i.test(codeStr)) return false;
    if (!codeStr.includes('{')) return false;
  }

  if (l === 'python') {
    if (/\bpublic\s+class\b/i.test(codeStr) || /class\s+Solution\s*\{/i.test(codeStr) || /\bListNode\s+\w+/i.test(codeStr)) return false;
    if (codeStr.includes('{') && codeStr.includes('}')) return false;
  }

  return true;
};

export function getOrGenerateStarterCode(problem: any, lang: string): string {
  if (!problem) return "";

  // 1. Check direct starterCode for requested language ONLY if valid
  const direct = problem.starterCode?.[lang];
  if (direct && isCodeValidForLang(direct, lang)) {
    return cleanStarterCode(direct, lang);
  }

  // 2. Extract method signature from any existing starterCode or referenceSolution
  const existingCode = (Object.values(problem.starterCode || {}).find((c: any) => typeof c === 'string' && isCodeValidForLang(c, typeof c === 'string' && c.includes('def ') ? 'python' : 'java')) as string) || problem.referenceSolution || "";

  if (existingCode && existingCode.trim()) {
    const pythonMatch = existingCode.match(/def\s+((?!__init__)\w+)\s*\(([^)]*)\)/);
    const javaCppMatch = existingCode.match(/(?:public\s+|static\s+|virtual\s+)*([\w<>[\]*]+)\s+((?!main|Solution)\w+)\s*\(([^)]*)\)/);

    let methodName = "";
    let returnType = "int";
    let paramStr = "";

    if (pythonMatch) {
      methodName = pythonMatch[1];
      paramStr = pythonMatch[2];
      const retMatch = existingCode.match(/->\s*([\w[\]]+)/);
      if (retMatch) returnType = retMatch[1].replace(/Optional\[(.*)\]/, '$1').trim();
      else if (existingCode.includes("ListNode")) returnType = "ListNode";
      else if (existingCode.includes("List[List")) returnType = "int[][]";
    } else if (javaCppMatch) {
      returnType = javaCppMatch[1];
      methodName = javaCppMatch[2];
      paramStr = javaCppMatch[3];
    }

    if (methodName && methodName !== "main" && methodName !== "Solution" && methodName !== "__init__") {
      const rawParams = paramStr.split(",").map(p => p.trim()).filter(p => p && p !== "self");
      const params = rawParams.map((p, i) => {
        const parts = p.split(/\s+/);
        if (parts.length >= 2) {
          return { type: parts.slice(0, -1).join(" "), name: parts[parts.length - 1] };
        }
        let cleanName = p.split(":")[0].trim() || `arg${i + 1}`;
        let cleanType = "int";
        if (p.includes("ListNode")) cleanType = "ListNode";
        else if (p.includes("TreeNode")) cleanType = "TreeNode";
        else if (p.includes("List[List") || p.includes("int[][]")) cleanType = "int[][]";
        else if (p.includes("int[]") || p.includes("List")) cleanType = "int[]";
        return { type: cleanType, name: cleanName };
      });

      const generated = generateStarterCode(methodName, returnType, params, lang);
      if (generated && generated.trim()) {
        return cleanStarterCode(generated, lang);
      }
    }
  }

  // 3. Language specific fallback defaults for known problems
  const title = (problem.title || "").toLowerCase();
  if (title.includes("grid") || title.includes("shift")) {
    if (lang === 'java') return `class Solution {\n    public List<List<Integer>> shiftGrid(int[][] grid, int k) {\n        // Write your solution here\n        return new ArrayList<>();\n    }\n}`;
    if (lang === 'python') return `class Solution:\n    def shiftGrid(self, grid: List[List[int]], k: int) -> List[List[int]]:\n        # Write your solution here\n        pass`;
    if (lang === 'cpp') return `class Solution {\npublic:\n    vector<vector<int>> shiftGrid(vector<vector<int>>& grid, int k) {\n        // Write your solution here\n        return {};\n    }\n};`;
    if (lang === 'javascript') return `class Solution {\n    shiftGrid(grid, k) {\n        // Write your solution here\n    }\n}`;
  }

  if (lang === 'java') return `class Solution {\n    public ListNode detectCycle(ListNode head) {\n        // Write your solution here\n        return null;\n    }\n}`;
  if (lang === 'python') return `class Solution:\n    def detectCycle(self, head: Optional[ListNode]) -> Optional[ListNode]:\n        # Write your solution here\n        pass`;
  if (lang === 'cpp') return `class Solution {\npublic:\n    ListNode* detectCycle(ListNode* head) {\n        // Write your solution here\n        return nullptr;\n    }\n};`;
  if (lang === 'javascript') return `class Solution {\n    detectCycle(head) {\n        // Write your solution here\n    }\n}`;

  return "";
}
