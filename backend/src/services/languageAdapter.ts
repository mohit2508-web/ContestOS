import { spawn, spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as os from "os";
import externalCodeExecutor from "./externalCodeExecutor";
import wrapperGenerator from "./codeWrapperGenerator";

const isWindows = os.platform() === "win32";
const PYTHON_CMD = isWindows ? "py" : "python3";

const PYTHON_WRAPPER_TEMPLATE = `
def build_tree_from_level_order(input_str):
    if not input_str or input_str.strip() in ["N", "null", "[]"]:
        return None
    parts = input_str.strip().replace('[', '').replace(']', '').replace('"', '').split()
    if not parts or parts[0] in ["N", "null"]:
        return None
    root = TreeNode(int(parts[0]))
    queue = [root]
    i = 1
    while queue and i < len(parts):
        curr = queue.pop(0)
        if i < len(parts) and parts[i] not in ["N", "null"]:
            curr.left = TreeNode(int(parts[i]))
            queue.append(curr.left)
        i += 1
        if i < len(parts) and parts[i] not in ["N", "null"]:
            curr.right = TreeNode(int(parts[i]))
            queue.append(curr.right)
        i += 1
    return root

{{userCode}}

if __name__ == "__main__":
{{testCode}}
`;

const CPP_WRAPPER_TEMPLATE = `#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <queue>
#include <unordered_set>
using namespace std;

#ifndef TREE_NODE_HELPER
#define TREE_NODE_HELPER
TreeNode* buildTreeFromLevelOrder(string input) {
    if (input.empty() || input == "N" || input == "null" || input == "[]") return nullptr;
    stringstream ss(input);
    string item;
    vector<string> parts;
    while (ss >> item) {
        if (!item.empty()) parts.push_back(item);
    }
    if (parts.empty() || parts[0] == "N" || parts[0] == "null") return nullptr;
    TreeNode* root = new TreeNode(stoi(parts[0]));
    queue<TreeNode*> q;
    q.push(root);
    int i = 1;
    while (!q.empty() && i < (int)parts.size()) {
        TreeNode* curr = q.front();
        q.pop();
        if (i < (int)parts.size() && parts[i] != "N" && parts[i] != "null") {
            curr->left = new TreeNode(stoi(parts[i]));
            q.push(curr->left);
        }
        i++;
        if (i < (int)parts.size() && parts[i] != "N" && parts[i] != "null") {
            curr->right = new TreeNode(stoi(parts[i]));
            q.push(curr->right);
        }
        i++;
    }
    return root;
}
#endif

{{userCode}}

int main() {
{{testCode}}
    return 0;
}
`;

const JAVASCRIPT_WRAPPER_TEMPLATE = `
{{userCode}}

{{testCode}}
`;

const C_WRAPPER_TEMPLATE = `#include <stdio.h>

{{userCode}}

int main() {
{{testCode}}
    return 0;
}
`;

const JAVA_WRAPPER_TEMPLATE = `{{imports}}

public class Main {
    public static void main(String[] args) {
{{testCode}}
    }
{{helpers}}
}

{{userCode}}
`;

export interface ExecutionResult {
  success: boolean;
  output: string;
  stderr: string;
  error?: string;
  executionTime: number;
  memoryUsed?: number;
}

export interface TestCase {
  input: string;
  expectedOutput: string;
  orderIndependent?: boolean;
  isHidden?: boolean;
}

export interface TestCaseResult {
  testCase: number;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  executionTime: number;
  memoryUsed?: number;
  error?: string;
}

export interface TestSuiteResult {
  results: TestCaseResult[];
  summary: { passed: number; failed: number; total: number };
}

export interface LanguageConfig {
  extension: string;
  compile?: string[];
  run?: string[];
  format?: string[];
  lint?: string[];
  mainFile?: string;
  needsCompilation?: boolean;
}

const getLanguageConfigs = (): Record<string, LanguageConfig> => ({
  python: {
    extension: "py",
    run: [PYTHON_CMD, "main.py"],
    format: isWindows ? [PYTHON_CMD, "-m", "black", "-q", "-"] : ["black", "-q", "-"],
    lint: isWindows ? [PYTHON_CMD, "-m", "pylint", "--output-format=text", "-"] : ["pylint", "--output-format=text", "-"],
    mainFile: "main.py",
    needsCompilation: false,
  },
  javascript: {
    extension: "js",
    run: ["node", "main.js"],
    format: ["prettier", "--stdin-filepath", "main.js"],
    lint: ["eslint", "--stdin", "--stdin-filename", "main.js", "--format", "json"],
    mainFile: "main.js",
    needsCompilation: false,
  },
  typescript: {
    extension: "ts",
    run: ["npx", "tsx", "main.ts"],
    format: ["prettier", "--stdin-filepath", "main.ts"],
    lint: ["eslint", "--stdin", "--stdin-filename", "main.ts", "--format", "json"],
    mainFile: "main.ts",
    needsCompilation: false,
  },
  cpp: {
    extension: "cpp",
    compile: isWindows ? ["g++", "main.cpp", "-o", "main.exe", "-std=c++17", "-O2"] : ["g++", "main.cpp", "-o", "main", "-std=c++17", "-O2"],
    run: isWindows ? [".\\main.exe"] : ["./main"],
    format: ["clang-format", "-style=llvm"],
    lint: ["clang-tidy", "main.cpp", "-checks=*", "-format-style=llvm"],
    mainFile: "main.cpp",
    needsCompilation: true,
  },
  c: {
    extension: "c",
    compile: isWindows ? ["gcc", "main.c", "-o", "main.exe", "-O2"] : ["gcc", "main.c", "-o", "main", "-O2"],
    run: isWindows ? [".\\main.exe"] : ["./main"],
    format: ["clang-format", "-style=llvm"],
    lint: ["clang-tidy", "main.c", "-checks=*"],
    mainFile: "main.c",
    needsCompilation: true,
  },
  java: {
    extension: "java",
    compile: ["javac", "-Xlint:all", "Main.java"],
    run: ["java", "-cp", ".", "Main"],
    format: ["java", "-jar", path.join(__dirname, "../../google-java-format.jar"), "--replace"],
    mainFile: "Main.java",
    needsCompilation: true,
  },
  go: {
    extension: "go",
    run: ["go", "run", "main.go"],
    mainFile: "main.go",
    needsCompilation: false,
  },
  rust: {
    extension: "rs",
    compile: isWindows ? ["rustc", "main.rs", "-o", "main.exe"] : ["rustc", "main.rs", "-o", "main"],
    run: isWindows ? [".\\main.exe"] : ["./main"],
    mainFile: "main.rs",
    needsCompilation: true,
  },
  ruby: {
    extension: "rb",
    run: ["ruby", "main.rb"],
    mainFile: "main.rb",
    needsCompilation: false,
  },
  csharp: {
    extension: "cs",
    compile: ["dotnet", "script", "main.cs"],
    run: ["dotnet", "script", "main.cs"],
    mainFile: "main.cs",
    needsCompilation: true,
  },
  php: {
    extension: "php",
    run: ["php", "main.php"],
    mainFile: "main.php",
    needsCompilation: false,
  },
  swift: {
    extension: "swift",
    run: ["swift", "main.swift"],
    mainFile: "main.swift",
    needsCompilation: false,
  },
  kotlin: {
    extension: "kt",
    compile: ["kotlinc", "main.kt", "-include-runtime", "-d", "main.jar"],
    run: ["java", "-jar", "main.jar"],
    mainFile: "main.kt",
    needsCompilation: true,
  },
  scala: {
    extension: "scala",
    run: ["scala-cli", "run", "main.scala"],
    mainFile: "main.scala",
    needsCompilation: false,
  },
  dart: {
    extension: "dart",
    run: ["dart", "run", "main.dart"],
    mainFile: "main.dart",
    needsCompilation: false,
  },
  sql: {
    extension: "sql",
    mainFile: "query.sql",
    needsCompilation: false,
  },
  haskell: {
    extension: "hs",
    compile: ["ghc", "main.hs", "-o", "main"],
    run: isWindows ? [".\\main"] : ["./main"],
    mainFile: "main.hs",
    needsCompilation: true,
  },
  perl: {
    extension: "pl",
    run: ["perl", "main.pl"],
    mainFile: "main.pl",
    needsCompilation: false,
  },
  r: {
    extension: "r",
    run: ["Rscript", "main.r"],
    mainFile: "main.r",
    needsCompilation: false,
  },
  bash: {
    extension: "sh",
    run: ["bash", "main.sh"],
    mainFile: "main.sh",
    needsCompilation: false,
  },
  lua: {
    extension: "lua",
    run: ["lua", "main.lua"],
    mainFile: "main.lua",
    needsCompilation: false,
  },
});

export class LanguageAdapter {
  private tempDir: string;
  private availableLanguages: Map<string, boolean> = new Map();
  private LANGUAGE_CONFIGS: Record<string, LanguageConfig>;

  constructor(tempDir: string = path.join(__dirname, "../../temp")) {
    this.tempDir = tempDir;
    this.LANGUAGE_CONFIGS = getLanguageConfigs();
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    this.checkAvailableLanguages();
  }

  private checkAvailableLanguages(): void {
    const checkers: Record<string, string[]> = {
      python: [PYTHON_CMD, "--version"],
      node: ["node", "--version"],
      gcc: ["gcc", "--version"],
      gplus: ["g++", "--version"],
      javac: ["javac", "--version"],
      go: ["go", "version"],
      rustc: ["rustc", "--version"],
      ruby: ["ruby", "--version"],
      dotnet: ["dotnet", "--version"],
      php: ["php", "--version"],
      swift: ["swift", "--version"],
      kotlinc: ["kotlinc", "-version"],
      scala: ["scala-cli", "--version"],
      dart: ["dart", "--version"],
      tsx: ["npx", "tsx", "--version"],
      ghc: ["ghc", "--version"],
      perl: ["perl", "--version"],
      Rscript: ["Rscript", "--version"],
      bash: ["bash", "--version"],
      lua: ["lua", "-v"],
    };

    Object.keys(checkers).forEach((lang) => {
      const cmd = checkers[lang];
      try {
        const result = spawnSync(cmd[0], cmd.slice(1), { stdio: "ignore", timeout: 5000, shell: isWindows });
        this.availableLanguages.set(lang, result.status === 0);
      } catch {
        this.availableLanguages.set(lang, false);
      }
    });
  }

  private getLanguageErrorMessage(language: string): string | null {
    const errorMessages: Record<string, string> = {
      python: "Python is not installed. Download Python from https://www.python.org/downloads/",
      javascript: "Node.js is not installed. Download Node.js from https://nodejs.org/",
      typescript: "TypeScript is not installed. Install via: npm install -g tsx",
      cpp: "GCC/G++ is not installed. Install MinGW-w64 from https://www.msys2.org/",
      c: "GCC is not installed. Install MinGW-w64 from https://www.msys2.org/",
      java: "Java is not installed. Download JDK from https://www.oracle.com/java/technologies/downloads/",
      go: "Go is not installed. Download from https://go.dev/dl/",
      rust: "Rust is not installed. Install via: https://rustup.rs/",
      ruby: "Ruby is not installed. Download from https://www.ruby-lang.org/",
      csharp: "C#/.NET is not installed. Download from https://dotnet.microsoft.com/download",
      php: "PHP is not installed. Download from https://www.php.net/downloads",
      swift: "Swift is not installed. Download from https://www.swift.org/download/",
      kotlin: "Kotlin is not installed. Install via: https://kotlinlang.org/docs/command-line.html",
      scala: "Scala CLI is not installed. Install via: https://scala-cli.virtuslab.org/install",
      dart: "Dart is not installed. Download from https://dart.dev/get-dart",
      haskell: "GHC is not installed. Install via: https://www.haskell.org/ghcup/",
      perl: "Perl is not installed. Download from https://www.perl.org/get.html",
      r: "R is not installed. Download from https://cran.r-project.org/",
      bash: "Bash is not available on this system.",
      lua: "Lua is not installed. Download from https://www.lua.org/download/",
    };

    const langMap: Record<string, string> = {
      python: "python",
      javascript: "node",
      typescript: "tsx",
      cpp: "gplus",
      c: "gcc",
      java: "javac",
      go: "go",
      rust: "rustc",
      ruby: "ruby",
      csharp: "dotnet",
      php: "php",
      swift: "swift",
      kotlin: "kotlinc",
      scala: "scala",
      dart: "dart",
      haskell: "ghc",
      perl: "perl",
      r: "Rscript",
      bash: "bash",
      lua: "lua",
    };

    const checkerKey = langMap[language];
    const isAvailable = this.availableLanguages.get(checkerKey) || false;

    if (!isAvailable && errorMessages[language]) {
      return errorMessages[language];
    }
    return null;
  }

  private generateSessionId(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  private createSessionDir(): string {
    const sessionId = this.generateSessionId();
    const sessionDir = path.join(this.tempDir, sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });
    return sessionDir;
  }

  private cleanupSessionDir(dir: string): void {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error(`Cleanup failed for ${dir}:`, error);
    }
  }

  private parseInputToVariables(input: string, language: string): string {
    const lines = input.trim().split('\n');
    const normalizedInput = input.toLowerCase();
    
    if (normalizedInput.includes('[') || normalizedInput.startsWith('[')) {
      return this.parseJsonLikeInput(input, language);
    }
    
    if (lines.length >= 2) {
      const firstLine = lines[0].trim();
      const isNumber = !isNaN(Number(firstLine));
      
      if (isNumber && lines.length >= 2) {
        const secondLine = lines[1].trim();
        const hasArrayPattern = secondLine.includes(' ') || /^\d/.test(secondLine);
        
        if (hasArrayPattern && lines.length >= 2) {
          const restOfInput = lines.slice(1).join(' ');
          const parts = restOfInput.split(/\s+/).filter(p => p);
          
          if (parts.length >= 2) {
            const n = parseInt(firstLine);
            const potentialArr = parts.slice(0, n).join(', ');
            const potentialTarget = parts.slice(n).join(' ');
            
            if (potentialArr && potentialTarget && !isNaN(parseInt(potentialTarget))) {
              if (language === "java") {
                return `int[] nums = new int[]{${potentialArr}};\nint target = ${potentialTarget};`;
              } else if (language === "python") {
                return `nums = [${potentialArr}]\ntarget = ${potentialTarget}`;
              } else if (language === "cpp") {
                return `vector<int> nums = {${potentialArr}};\nint target = ${potentialTarget};`;
              } else if (language === "c") {
                return `int nums[] = {${potentialArr}};\nint target = ${potentialTarget};`;
              }
            }
          }
        }
      }
    }
    
    if (lines.length === 1) {
      const parts = lines[0].trim().split(/\s+/);
      if (parts.length === 1) {
        if (language === "java") {
          return `int n = ${parts[0]};`;
        } else if (language === "python") {
          return `n = ${parts[0]}`;
        } else if (language === "cpp") {
          return `int n = ${parts[0]};`;
        }
      }
      const arrValues = parts.join(', ');
      if (language === "java") {
        return `int[] arr = new int[]{${arrValues}};`;
      } else if (language === "python") {
        return `arr = [${arrValues}]`;
      } else if (language === "cpp") {
        return `vector<int> arr = {${arrValues}};`;
      }
    }
    
    if (lines.length === 2) {
      const n = lines[0].trim();
      const arr = lines[1].trim();
      
      if (language === "java") {
        return `int n = ${n};\nint[] nums = new int[]{${arr}};`;
      } else if (language === "python") {
        return `n = ${n}\nnums = [${arr}]`;
      } else if (language === "cpp") {
        return `int n = ${n};\nvector<int> nums = {${arr}};`;
      }
    }
    
    if (lines.length === 3) {
      const n = lines[0].trim();
      const arr = lines[1].trim();
      const target = lines[2].trim();
      
      if (language === "java") {
        return `int n = ${n};\nint[] nums = new int[]{${arr}};\nint target = ${target};`;
      } else if (language === "python") {
        return `n = ${n}\nnums = [${arr}]\ntarget = ${target}`;
      } else if (language === "cpp") {
        return `int n = ${n};\nvector<int> nums = {${arr}};\nint target = ${target};`;
      }
    }
    
    return `// Input: ${input}`;
  }
  
  private parseJsonLikeInput(input: string, language: string): string {
    try {
      if (input.includes('[') && input.includes(']')) {
        const arrMatch = input.match(/\[[\s\d,\-]+\]/);
        if (arrMatch) {
          const arrStr = arrMatch[0];
          const numMatch = input.match(/-?\d+(?=\s*$|\s*\])/);
          
          if (numMatch) {
            const arrValues = arrStr.replace(/[\[\]]/g, '').trim();
            const target = numMatch[0];
            
            if (language === "java") {
              return `int[] nums = ${arrStr};\nint target = ${target};`;
            } else if (language === "python") {
              return `nums = ${arrStr}\ntarget = ${target}`;
            } else if (language === "cpp") {
              return `vector<int> nums = ${arrStr};\nint target = ${target};`;
            }
          } else {
            const arrValues = arrStr.replace(/[\[\]]/g, '').trim();
            if (language === "java") {
              return `int[] nums = new int[]{${arrValues}};`;
            } else if (language === "python") {
              return `nums = [${arrValues}]`;
            } else if (language === "cpp") {
              return `vector<int> nums = {${arrValues}};`;
            }
          }
        }
      }
    } catch {}
    
    return `// Input: ${input}`;
  }

  private extractFunctionSignature(code: string, language: string): { name: string; params: string[] } | null {
    const cleanCode = code.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
    if (language === "java") {
      const solutionMatch = cleanCode.match(/class\s+Solution\s*\{([\s\S]*)\}/i);
      const targetCode = solutionMatch ? solutionMatch[1] : cleanCode;
      const regex = /(?:public\s+|protected\s+|private\s+|static\s+)*([\w<>[\]*]+)\s+(\w+)\s*\(([^)]*)\)/g;
      const matches = [...targetCode.matchAll(regex)];
      const valid = matches.filter(m => !['Solution', 'ListNode', 'TreeNode', 'Node', 'Main', 'Group', 'SparseTable', 'if', 'while', 'for', 'gcd', 'lcm', 'gcd_cpp', 'lcm_cpp', 'gcd_c', 'lcm_c'].includes(m[2]) && m[1] !== m[2]);
      const publicValid = valid.filter(m => m[0].includes("public"));
      const bestMatches = publicValid.length > 0 ? publicValid : valid;
      if (bestMatches.length > 0) {
        const match = bestMatches[0];
        const paramStr = match[3] || "";
        const params = paramStr.split(',').map(p => p.trim()).filter(p => p);
        return { name: match[2], params };
      }
    } else if (language === "python") {
      const solutionMatch = cleanCode.match(/class\s+Solution[\s\S]*?:\n([\s\S]*)/i);
      const targetCode = solutionMatch ? solutionMatch[1] : cleanCode;
      const regex = /def\s+(\w+)\s*\(([^)]*)\)/g;
      const matches = [...targetCode.matchAll(regex)];
      const valid = matches.filter(m => !['__init__', 'main', 'ListNode', 'TreeNode', 'Node', 'Group', 'SparseTable'].includes(m[1]) && !m[1].startsWith('_'));
      if (valid.length > 0) {
        const match = valid[0];
        const paramStr = match[2] || "";
        const params = paramStr.split(',').map(p => p.trim()).filter(p => p && p !== 'self');
        return { name: match[1], params };
      }
    } else if (language === "cpp" || language === "c") {
      const solutionMatch = cleanCode.match(/class\s+Solution\s*\{([\s\S]*)\}/i);
      const targetCode = solutionMatch ? solutionMatch[1] : cleanCode;
      const regex = /(?:public:\s+|private:\s+|protected:\s+)?(?:struct\s+[\w*]+|[\w<>[\]*]+)\s+\*?\s*(\w+)\s*\(([^)]*)\)/g;
      const matches = [...targetCode.matchAll(regex)];
      const valid = matches.filter(m => !['Solution', 'ListNode', 'TreeNode', 'Node', 'Main', 'Group', 'SparseTable', 'main', 'if', 'while', 'for', 'switch', 'return', 'gcd', 'lcm', 'gcd_cpp', 'lcm_cpp', 'gcd_c', 'lcm_c'].includes(m[1]) && m[1] !== 'struct');
      const publicValid = valid.filter(m => m[0].includes("public"));
      const bestMatches = publicValid.length > 0 ? publicValid : valid;
      if (bestMatches.length > 0) {
        const match = bestMatches[0];
        const paramStr = match[2] || "";
        const params = paramStr.split(',').map(p => p.trim()).filter(p => p);
        return { name: match[1], params };
      }
    }
    return null;
  }

  private extractUserCode(code: string): string {
    if (!code || !code.trim()) {
      return '';
    }
    
    let userCode = code.trim();
    
    userCode = userCode.replace(/^class\s+Solution\s*\{[\s\S]*?(public|private|protected)?\s+\w+\s+\w+\s*\([^)]*\)/, '');
    
    const methodMatch = userCode.match(/public\s+\w+\s+(\w+)\s*\([^)]*\)\s*\{([\s\S]*)\}/);
    if (methodMatch && methodMatch[2]) {
      let body = methodMatch[2];
      
      body = body.replace(/^[\s\n]*return\s+new\s+int\[\]\{-1,\s*-1\};[\s\n]*$/, '');
      body = body.replace(/^[\s\n]+/, '').replace(/[\s\n]+$/, '');
      
      return body;
    }
    
    const startMarker = userCode.includes('// ===== USER CODE START =====') || userCode.includes('// USTART') || userCode.includes('# USTART');
    const endMarker = userCode.includes('// ===== USER CODE END =====') || userCode.includes('// UEND') || userCode.includes('# UEND');
    
    if (startMarker && endMarker) {
      const startMarkerStr = userCode.includes('// USTART') ? '// USTART' : (userCode.includes('# USTART') ? '# USTART' : '// ===== USER CODE START =====');
      const endMarkerStr = userCode.includes('// UEND') ? '// UEND' : (userCode.includes('# UEND') ? '# UEND' : '// ===== USER CODE END =====');
      const startIdx = userCode.indexOf(startMarkerStr) + startMarkerStr.length;
      const endIdx = userCode.indexOf(endMarkerStr);
      userCode = userCode.substring(startIdx, endIdx).trim();
    }
    
    userCode = userCode.replace(/^[\s\n]+/, '').replace(/[\s\n]+$/, '');
    
    return userCode;
  }

  public prepareTemplateInput(testCases: TestCase[]): string {
    let totalT = 0;
    let concatenatedBody = "";
    for (const tc of testCases) {
      const trimmed = tc.input.trim();
      const firstNewlineIdx = trimmed.indexOf('\n');
      if (firstNewlineIdx !== -1) {
        const firstLine = trimmed.substring(0, firstNewlineIdx).trim();
        const rest = trimmed.substring(firstNewlineIdx + 1);
        const tVal = parseInt(firstLine, 10);
        // STRICT check: only treat as T if the entire line is a pure integer AND <= 1000.
        // e.g. "53..7...." parses as 53 but is NOT a T value.
        // "126749835" parses as 126749835 (a solved Sudoku row) which is > 1000, so it's not a T value.
        const isPureInt = !isNaN(tVal) && String(tVal) === firstLine.trim() && tVal <= 1000;
        if (isPureInt) {
          totalT += tVal;
          concatenatedBody += rest + '\n';
        } else {
          totalT += 1;
          concatenatedBody += trimmed + '\n';
        }
      } else {
        // Single line input
        const tVal = parseInt(trimmed, 10);
        const isPureInt = !isNaN(tVal) && String(tVal) === trimmed && tVal <= 1000;
        if (isPureInt) {
          totalT += tVal;
        } else {
          totalT += 1;
          concatenatedBody += trimmed + '\n';
        }
      }
    }
    return `${totalT}\n${concatenatedBody}`;
  }

  private getInjectedUserCode(code: string, testBlocks: string, language: string, helpers: string = ""): string {
    let result = code.trim();
    const cleanCode = result.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "").replace(/#.*$/gm, "").replace(/'''[\s\S]*?'''|"""[\s\S]*?"""/g, "");
    const needsListNode = result.includes("ListNode") || testBlocks.includes("ListNode") || helpers.includes("ListNode");
    const needsTreeNode = result.includes("TreeNode") || testBlocks.includes("TreeNode") || helpers.includes("TreeNode");

    if (language === "java") {
      if (!/\bpublic\s+static\s+void\s+main\b/.test(result)) {
        result = result.replace(/\bpublic\s+class\s+Solution\b/g, "class Solution");
      }
      if (needsListNode && !/\bclass\s+ListNode\s*\{/.test(cleanCode)) {
        result = result + `\n\nclass ListNode {\n    int data;\n    int val;\n    ListNode next;\n    ListNode() {}\n    ListNode(int val) { this.data = val; this.val = val; }\n    ListNode(int val, ListNode next) { this.data = val; this.val = val; this.next = next; }\n}`;
      }
      if (needsTreeNode && !/^(public\s+)?class\s+TreeNode\s*\{/m.test(cleanCode) && !/\nclass\s+TreeNode\s*\{/.test(cleanCode)) {
        result = result + `\n\nclass TreeNode {\n    int data;\n    int val;\n    TreeNode left;\n    TreeNode right;\n    TreeNode() {}\n    TreeNode(int val) { this.data = val; this.val = val; }\n    TreeNode(int val, TreeNode left, TreeNode right) { this.data = val; this.val = val; this.left = left; this.right = right; }\n}`;
      }
    } else if (language === "python") {
      if (needsListNode && !/\bclass\s+ListNode\b/.test(cleanCode)) {
        result = `class ListNode:\n    def __init__(self, val=0, next=None):\n        self.val = val\n        self.next = next\n\n` + result;
      }
      if (needsTreeNode && !/\bclass\s+TreeNode\b/.test(cleanCode)) {
        result = `class TreeNode:\n    def __init__(self, val=0, left=None, right=None):\n        self.val = val\n        self.left = left\n        self.right = right\n\n` + result;
      }
    } else if (language === "cpp" || language === "c") {
      let includes = "";
      if (!cleanCode.includes("<stdio.h>")) includes += "#include <stdio.h>\n";
      if (!cleanCode.includes("<stdlib.h>")) includes += "#include <stdlib.h>\n";
      if (!cleanCode.includes("<stdbool.h>")) includes += "#include <stdbool.h>\n";
      if (language === "cpp" && !cleanCode.includes("<iostream>")) includes += "#include <iostream>\nusing namespace std;\n";
      
      let structs = "";
      if (needsListNode && !/\bstruct\s+ListNode\s*\{/.test(cleanCode) && !/\bclass\s+ListNode\s*\{/.test(cleanCode)) {
        structs += `struct ListNode {\n    int data;\n    int val;\n    struct ListNode *next;\n#ifdef __cplusplus\n    ListNode() : data(0), val(0), next(nullptr) {}\n    ListNode(int x) : data(x), val(x), next(nullptr) {}\n    ListNode(int x, ListNode *next) : data(x), val(x), next(next) {}\n#endif\n};\n\n`;
      }
      if (needsTreeNode && !/\bstruct\s+TreeNode\s*\{/.test(cleanCode) && !/\bclass\s+TreeNode\s*\{/.test(cleanCode)) {
        structs += `struct TreeNode {\n    int data;\n    int val;\n    struct TreeNode *left;\n    struct TreeNode *right;\n#ifdef __cplusplus\n    TreeNode() : data(0), val(0), left(nullptr), right(nullptr) {}\n    TreeNode(int x) : data(x), val(x), left(nullptr), right(nullptr) {}\n    TreeNode(int x, TreeNode *left, TreeNode *right) : data(x), val(x), left(left), right(right) {}\n#endif\n};\n\n`;
      }
      result = includes + structs + result;
    } else if (language === "javascript" || language === "typescript") {
      if (needsListNode && !/\bfunction\s+ListNode\b/.test(cleanCode) && !/\bclass\s+ListNode\b/.test(cleanCode)) {
        result = `function ListNode(val, next) {\n    this.val = (val===undefined ? 0 : val);\n    this.next = (next===undefined ? null : next);\n}\n\n` + result;
      }
      if (needsTreeNode && !/\bfunction\s+TreeNode\b/.test(cleanCode) && !/\bclass\s+TreeNode\b/.test(cleanCode)) {
        result = `function TreeNode(val, left, right) {\n    this.val = (val===undefined ? 0 : val);\n    this.left = (left===undefined ? null : left);\n    this.right = (right===undefined ? null : right);\n}\n\n` + result;
      }
    }
    return result;
  }

  public detectRealLanguage(code: string, claimedLanguage: string): string {
    const lang = (claimedLanguage || "").toLowerCase().trim();
    if (lang && lang !== "unknown" && lang !== "auto") {
      return lang;
    }
    if (!code) return "java";

    if (code.includes("struct TreeNode") || code.includes("struct Node") || code.includes("->") || code.includes("#include") || code.includes("using namespace std") || code.includes("vector<") || code.includes("std::")) {
      return code.includes("using namespace std") || code.includes("vector<") || code.includes("class Solution") ? "cpp" : "c";
    }
    if (code.includes("def ") || (code.includes("class Solution:") && !code.includes("{"))) {
      return "python";
    }
    if (code.includes("public class") || code.includes("public static void main") || code.includes("System.out.print")) {
      return "java";
    }
    if (code.includes("console.log(") || code.includes("module.exports")) {
      return "javascript";
    }

    return "java";
  }

  public generateBatchedWrapper(code: string, testCases: TestCase[], language: string): string {
    if (testCases.length === 0) return code;
    language = this.detectRealLanguage(code, language);

    const hasStandaloneMain =
      (language === "java" && (code.includes("static void main") || code.includes("public static void main"))) ||
      ((language === "cpp" || language === "c") && /\bint\s+main\b/.test(code)) ||
      (language === "python" && (code.includes("__main__") || code.includes("sys.stdin")));

    if (hasStandaloneMain) {
      if (language === "java") {
        let mainCode = code;
        if (!mainCode.includes("public class Main")) {
          mainCode = mainCode.replace(/\bpublic\s+class\s+\w+/, "public class Main");
        }
        return mainCode;
      }
      return code;
    }
    
    const inputType = this.detectInputType(testCases[0].input, code, language);
    const funcSig = this.extractFunctionSignature(code, language);
    const funcName = funcSig?.name || "solution";
    const outputFormat = this.detectOutputFormat(testCases[0].input, inputType, code, language);
    const hasSolutionClass = code.includes("class Solution") || code.includes("struct Solution") || code.includes("class solution") || code.includes("class Main") || code.includes("public class Main");

    let preparedCode = code;
    if (language === "java") {
      preparedCode = code
        .replace(/\bpublic\s+class\s+(\w+)/g, "class $1")
        .replace(/\bclass\s+Main\b/g, "class Solution");
    }

    switch (language) {
      case "java": {
        const imports: string[] = [];
        const cleanedCode = preparedCode.replace(/^import\s+.*;\s*$/gm, (match) => {
          imports.push(match.trim());
          return '';
        });
        const allImports = [...new Set(['import java.util.*;', ...imports])].join('\n');
        
        let testBlocks = "";
        let needsListNode = false;
        let needs2DList = false;

        const batchSize = 10;
        const helperMethods: string[] = [];
        let currentBatchBlocks = "";

        if (hasSolutionClass) {
          testBlocks += "        Solution sol = new Solution();\n";
        }

        for (let i = 0; i < testCases.length; i++) {
          const variables = this.parseInputToVariablesAdvanced(testCases[i].input, "java", inputType, code);
          const testCode = this.generateJavaTestCode(funcName, variables.varNames, outputFormat, hasSolutionClass, cleanedCode);
          
          if (testCode.includes("printListNode") || variables.declaration.includes("ListNode") || testCode.includes("ListNode")) {
            needsListNode = true;
          }
          if (testCode.includes("print2DList")) {
            needs2DList = true;
          }

          let block = `
        {
            // Testcase ${i + 1}
            ${variables.declaration.replace(/\n/g, "\n            ")}
            ${testCode.replace(/\n/g, "\n            ")}
            System.out.println("###TC_END###");
            System.out.flush();
        }
          `;

          if (i > 0 && i % 20 === 0) {
            block = "        System.gc();\n" + block;
          }

          currentBatchBlocks += block;

          if ((i + 1) % batchSize === 0 || (i + 1) === testCases.length) {
            const batchNum = Math.floor(i / batchSize) + 1;
            const helperMethodName = `runBatch${batchNum}`;
            const param = hasSolutionClass ? "Solution sol" : "";
            const callParam = hasSolutionClass ? "sol" : "";
            
            helperMethods.push(`    private static void ${helperMethodName}(${param}) {\n${currentBatchBlocks}\n    }`);
            testBlocks += `        ${helperMethodName}(${callParam});\n`;
            currentBatchBlocks = "";
          }
        }
        
        let helpers = "";
        
        if (needsListNode) {
          helpers += `
    private static void printListNode(ListNode node) {
        if (node == null) {
            System.out.println("null");
            return;
        }
        Set<ListNode> visited = new HashSet<>();
        ListNode curr = node;
        StringBuilder sb = new StringBuilder();
        int step = 0;
        while (curr != null && step < 1000) {
            if (visited.contains(curr)) {
                sb.append("tail connects to node index ").append(curr.val);
                break;
            }
            visited.add(curr);
            sb.append(curr.val).append(curr.next == null ? "" : " ");
            curr = curr.next;
            step++;
        }
        System.out.println(sb.toString().trim());
    }

    private static void printListNodeArray(ListNode[] result) {
        for (ListNode node : result) {
            if (node == null) {
                System.out.println("NULL");
            } else {
                printListNode(node);
            }
        }
    }
          `;
        }
        
        if (needs2DList) {
          helpers += `
    private static void print2DList(List<List<String>> result) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < result.size(); i++) {
            sb.append("[");
            List<String> group = result.get(i);
            for (int j = 0; j < group.size(); j++) {
                sb.append(String.valueOf((char)34)).append(group.get(j)).append(String.valueOf((char)34));
                if (j < group.size() - 1) sb.append(",");
            }
            sb.append("]");
            if (i < result.size() - 1) sb.append(",");
        }
        sb.append("]");
        System.out.println(sb.toString());
    }
    private static void print2DIntList(List<List<Integer>> result) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < result.size(); i++) {
            sb.append("[");
            List<Integer> group = result.get(i);
            for (int j = 0; j < group.size(); j++) {
                sb.append(group.get(j));
                if (j < group.size() - 1) sb.append(",");
            }
            sb.append("]");
            if (i < result.size() - 1) sb.append(",");
        }
        sb.append("]");
        System.out.println(sb.toString());
    }
          `;
        }
        
        helpers += `
    private static TreeNode buildTreeFromLevelOrder(String input) {
        if (input == null || input.trim().isEmpty() || input.equals("[]") || input.equals("null") || input.equals("N")) return null;
        String clean = input.replace("[", "").replace("]", "").replace(String.valueOf((char)34), "").trim();
        if (clean.isEmpty()) return null;
        String[] parts = clean.split("[\\s,]+");
        if (parts.length == 0 || parts[0].equals("null") || parts[0].equals("N") || parts[0].isEmpty()) return null;
        TreeNode root = new TreeNode(Integer.parseInt(parts[0]));
        Queue<TreeNode> queue = new LinkedList<>();
        queue.add(root);
        int i = 1;
        while (!queue.isEmpty() && i < parts.length) {
            TreeNode curr = queue.poll();
            if (i < parts.length && !parts[i].equals("null") && !parts[i].equals("N") && !parts[i].isEmpty()) {
                curr.left = new TreeNode(Integer.parseInt(parts[i]));
                queue.add(curr.left);
            }
            i++;
            if (i < parts.length && !parts[i].equals("null") && !parts[i].equals("N") && !parts[i].isEmpty()) {
                curr.right = new TreeNode(Integer.parseInt(parts[i]));
                queue.add(curr.right);
            }
            i++;
        }
        return root;
    }

    private static ListNode buildListWithCycle(int[] vals, int pos) {
        if (vals == null || vals.length == 0) return null;
        ListNode head = new ListNode(vals[0]);
        ListNode curr = head;
        ListNode cycleNode = (pos == 0) ? head : null;
        for (int i = 1; i < vals.length; i++) {
            curr.next = new ListNode(vals[i]);
            curr = curr.next;
            if (i == pos) cycleNode = curr;
        }
        if (pos >= 0) curr.next = cycleNode;
        return head;
    }

    private static void printResult(Object result) {
        if (result == null) {
            System.out.println("null");
            return;
        }
        if (result instanceof TreeNode) {
            TreeNode root = (TreeNode) result;
            List<String> res = new ArrayList<>();
            Queue<TreeNode> q = new LinkedList<>();
            q.add(root);
            while (!q.isEmpty()) {
                TreeNode curr = q.poll();
                if (curr != null) {
                    int nodeVal = 0;
                    try {
                        java.lang.reflect.Field f = curr.getClass().getDeclaredField("data");
                        f.setAccessible(true);
                        nodeVal = f.getInt(curr);
                    } catch (Exception _e) {
                        try {
                            java.lang.reflect.Field f = curr.getClass().getDeclaredField("val");
                            f.setAccessible(true);
                            nodeVal = f.getInt(curr);
                        } catch (Exception _ex) {
                            nodeVal = curr.val;
                        }
                    }
                    res.add(String.valueOf(nodeVal));
                    q.add(curr.left);
                    q.add(curr.right);
                } else {
                    res.add("N");
                }
            }
            while (res.size() > 1 && res.get(res.size() - 1).equals("N")) {
                res.remove(res.size() - 1);
            }
            System.out.println(String.join(" ", res));
            return;
        }
        if (result instanceof int[]) {
            int[] arr = (int[]) result;
            StringBuilder sb = new StringBuilder();
            sb.append("[");
            for (int i = 0; i < arr.length; i++) {
                sb.append(arr[i]);
                if (i < arr.length - 1) {
                    sb.append(",");
                }
            }
            sb.append("]");
            System.out.println(sb.toString());
        } else if (result instanceof Object[]) {
            Object[] arr = (Object[]) result;
            StringBuilder sb = new StringBuilder();
            sb.append("[");
            for (int i = 0; i < arr.length; i++) {
                Object item = arr[i];
                if (item instanceof String) {
                    sb.append('"').append(item).append('"');
                } else {
                    sb.append(item);
                }
                if (i < arr.length - 1) {
                    sb.append(",");
                }
            }
            sb.append("]");
            System.out.println(sb.toString());
        } else if (result instanceof Collection<?>) {
            Collection<?> coll = (Collection<?>) result;
            StringBuilder sb = new StringBuilder();
            sb.append("[");
            int i = 0;
            for (Object item : coll) {
                if (item instanceof Collection<?>) {
                    Collection<?> sub = (Collection<?>) item;
                    sb.append("[");
                    int j = 0;
                    for (Object subItem : sub) {
                        if (subItem instanceof String) {
                            sb.append('"').append(subItem).append('"');
                        } else {
                            sb.append(subItem);
                        }
                        if (j++ < sub.size() - 1) sb.append(",");
                    }
                    sb.append("]");
                } else if (item instanceof String) {
                    sb.append('"').append(item).append('"');
                } else {
                    sb.append(item);
                }
                if (i++ < coll.size() - 1) {
                    sb.append(",");
                }
            }
            sb.append("]");
            System.out.println(sb.toString());
        } else {
            System.out.println(result);
        }
    }
        `;

        if (helperMethods.length > 0) {
          helpers += "\n\n" + helperMethods.join("\n\n") + "\n";
        }
        
        const finalUserCode = this.getInjectedUserCode(cleanedCode, testBlocks, "java", helpers);
        return JAVA_WRAPPER_TEMPLATE
          .replace('{{imports}}', allImports)
          .replace('{{testCode}}', testBlocks)
          .replace('{{helpers}}', helpers)
          .replace('{{userCode}}', finalUserCode);
      }

      case "python": {
        let testBlocks = "";
        for (let i = 0; i < testCases.length; i++) {
          const variables = this.parseInputToVariablesAdvanced(testCases[i].input, "python", inputType, code);
          const testCode = this.generatePythonTestCode(funcName, variables.varNames, outputFormat, hasSolutionClass, code);
          
          const declLines = variables.declaration.split('\n').map(line => line.startsWith('    ') ? line : '    ' + line).join('\n');
          const testLines = testCode.split('\n').map(line => line.startsWith('    ') ? line : '    ' + line).join('\n');
          
          testBlocks += `
${declLines}
${testLines}
    print("###TC_END###")
    import sys
    sys.stdout.flush()
`;
        }
        const finalUserCode = this.getInjectedUserCode(code, testBlocks, "python");
        return PYTHON_WRAPPER_TEMPLATE
          .replace('{{testCode}}', testBlocks)
          .replace('{{userCode}}', finalUserCode);
      }

      case "c":
      case "cpp": {
        let testBlocks = "";
        for (let i = 0; i < testCases.length; i++) {
          const variables = this.parseInputToVariablesAdvanced(testCases[i].input, "cpp", inputType, code);
          const testCode = this.generateCppTestCode(funcName, variables.varNames, outputFormat, hasSolutionClass, code);
          testBlocks += `
    {
        // Testcase ${i + 1}
        ${variables.declaration.replace(/\n/g, "\n        ")}
        ${testCode.replace(/\n/g, "\n        ")}
        cout << "###TC_END###" << endl;
    }
          `;
        }
        const finalUserCode = this.getInjectedUserCode(code, testBlocks, "cpp");
        return CPP_WRAPPER_TEMPLATE
          .replace('{{testCode}}', testBlocks)
          .replace('{{userCode}}', finalUserCode);
      }

      case "javascript":
      case "typescript": {
        let testBlocks = "";
        for (let i = 0; i < testCases.length; i++) {
          const variables = this.parseInputToVariablesAdvanced(testCases[i].input, "javascript", inputType, code);
          const testCode = this.generateJsTestCode(funcName, variables.varNames, outputFormat, hasSolutionClass, code);
          testBlocks += `
{
    // Testcase ${i + 1}
    ${variables.declaration.replace(/\n/g, "\n    ")}
    ${testCode.replace(/\n/g, "\n    ")}
    console.log("###TC_END###");
}
          `;
        }
        const finalUserCode = this.getInjectedUserCode(code, testBlocks, "javascript");
        return JAVASCRIPT_WRAPPER_TEMPLATE
          .replace('{{testCode}}', testBlocks)
          .replace('{{userCode}}', finalUserCode);
      }

      default:
        return code;
    }
  }

  public generateTestWrapper(code: string, input: string, language: string): string {
    language = this.detectRealLanguage(code, language);
    const inputType = this.detectInputType(input, code, language);
    const variables = this.parseInputToVariablesAdvanced(input, language, inputType, code);
    const funcSig = this.extractFunctionSignature(code, language);
    const funcName = funcSig?.name || "solution";
    const outputFormat = this.detectOutputFormat(input, inputType, code, language);
    const hasSolutionClass = code.includes("class Solution");

    let preparedCode = code;
    if (language === "java") {
      preparedCode = code.replace(/\bpublic\s+class\s+Solution\b/g, "class Solution");
    }

    let testCode = "";

    switch (language) {
      case "java": {
        const imports: string[] = [];
        const cleanedCode = preparedCode.replace(/^import\s+.*;\s*$/gm, (match) => {
          imports.push(match.trim());
          return '';
        });
        const allImports = [...new Set(['import java.util.*;', ...imports])].join('\n');
        
        testCode = this.generateJavaTestCode(funcName, variables.varNames, outputFormat, hasSolutionClass, cleanedCode);
        const finalUserCode = this.getInjectedUserCode(cleanedCode, testCode, "java");
        return JAVA_WRAPPER_TEMPLATE
          .replace('{{imports}}', allImports)
          .replace('{{testCode}}', "        " + variables.declaration + "\n        " + testCode)
          .replace('{{userCode}}', finalUserCode);
      }

      case "python": {
        const indentedDeclaration = variables.declaration.split('\n').map(line => "    " + line).join('\n');
        testCode = this.generatePythonTestCode(funcName, variables.varNames, outputFormat, hasSolutionClass, code);
        const finalUserCode = this.getInjectedUserCode(code, testCode, "python");
        return PYTHON_WRAPPER_TEMPLATE
          .replace('{{testCode}}', indentedDeclaration + "\n" + testCode)
          .replace('{{userCode}}', finalUserCode);
      }

      case "cpp": {
        testCode = this.generateCppTestCode(funcName, variables.varNames, outputFormat, hasSolutionClass, code);
        const finalUserCode = this.getInjectedUserCode(code, testCode, "cpp");
        return CPP_WRAPPER_TEMPLATE
          .replace('{{testCode}}', variables.declaration + "\n" + testCode)
          .replace('{{userCode}}', finalUserCode);
      }

      case "javascript": {
        testCode = this.generateJsTestCode(funcName, variables.varNames, outputFormat, hasSolutionClass, code);
        const finalUserCode = this.getInjectedUserCode(code, testCode, "javascript");
        return JAVASCRIPT_WRAPPER_TEMPLATE
          .replace('{{testCode}}', variables.declaration + "\n" + testCode)
          .replace('{{userCode}}', finalUserCode);
      }

      case "c":
        testCode = `    int returnSize;\n    int* result = ${funcName}(nums, n, target, &returnSize);\n    printf("%d %d", result[0], result[1]);`;
        return C_WRAPPER_TEMPLATE
          .replace('{{testCode}}', variables.declaration + "\n" + testCode)
          .replace('{{userCode}}', code);

      default:
        return code;
    }
  }

  private detectInputType(input: string, code: string = "", language: string = ""): 'single' | 'array' | 'array_target' | 'matrix' | 'n_queens' {
    const trimmed = input.trim();
    
    if (trimmed.includes('"]["') && trimmed.includes('],[')) {
      return 'n_queens';
    }
    
    if (trimmed.startsWith('[[') || trimmed.includes('][') || (trimmed.match(/\[/g) || []).length >= 2) {
      return 'matrix';
    }

    if (code && language) {
      const funcSig = this.extractFunctionSignature(code, language);
      if (funcSig && funcSig.params.length === 1) {
        const param = funcSig.params[0].toLowerCase();
        const isMatrixType = 
          param.includes('[][]') || 
          param.includes('vector<vector') || 
          param.includes('list<list') || 
          param.includes('string[]') || 
          param.includes('vector<string>');
          
        if (isMatrixType) {
          return 'matrix';
        }
        if (param.includes('[]') || param.includes('vector') || param.includes('list') || param.includes('arr') || param.includes('nums')) {
          return 'array';
        }
      }
    }
    
    const lines = trimmed.split('\n');
    if (lines.length >= 2) {
      return 'array_target';
    }
    
    if (trimmed.startsWith('[')) {
      return 'array';
    }
    
    return 'single';
  }

  private detectOutputFormat(input: string, inputType: string, code?: string, language?: string): 'single' | 'array_1d' | 'array_2d' {
    if (inputType === 'n_queens') {
      return 'array_2d';
    }
    // Detect if the function return type is List<List<...>> or list[list[...]]
    if (code) {
      const retMatch2D =
        /\bList\s*<\s*List\s*</i.test(code) ||
        /\blist\s*\[\s*list\s*\[/i.test(code) ||
        /vector\s*<\s*vector\s*</i.test(code) ||
        (/\[\s*\[\s*/.test(code) && code.includes('return') && /List\s*<\s*List|list\s*\[\s*list/i.test(code));
      if (retMatch2D) return 'array_2d';
    }
    return 'array_1d';
  }

  private parseUniversalMultiParam(input: string, language: string, funcSig: { name: string; params: string[] }): { declaration: string; varNames: string[] } | null {
    if (!funcSig || !funcSig.params || funcSig.params.length === 0) return null;
    
    const lines = input.trim().split('\n').map(l => l.trim()).filter(l => l !== '');
    if (lines.length === 0) return null;

    const parsedParams: { type: string; name: string }[] = [];
    for (const p of funcSig.params) {
      const rawP = p.trim();
      if (!rawP || rawP === 'self') continue;

      if (rawP.includes(':')) {
        const colonIdx = rawP.indexOf(':');
        const pName = rawP.substring(0, colonIdx).trim().replace(/[*&]/g, '');
        const pType = rawP.substring(colonIdx + 1).trim();
        parsedParams.push({ type: pType, name: pName });
      } else {
        const parts = rawP.split(/\s+/);
        if (parts.length >= 2) {
          parsedParams.push({
            type: parts.slice(0, parts.length - 1).join(" "),
            name: parts[parts.length - 1].replace(/[*&]/g, '')
          });
        } else if (parts.length === 1) {
          parsedParams.push({
            type: "int",
            name: parts[0].replace(/[*&]/g, '')
          });
        }
      }
    }

    if (parsedParams.length === 0) return null;

    const declarations: string[] = [];
    const varNames: string[] = [];

    for (let i = 0; i < parsedParams.length; i++) {
      const p = parsedParams[i];
      const lineVal = lines[i] !== undefined ? lines[i] : (lines[lines.length - 1] || "");
      const pTypeLower = p.type.toLowerCase();
      const pName = p.name;
      varNames.push(pName);

      if (pTypeLower.includes("treenode")) {
        const treeStr = lineVal.startsWith('"') ? lineVal : `"${lineVal.replace(/"/g, '\\"')}"`;
        if (language === 'java') {
          declarations.push(`TreeNode ${pName} = buildTreeFromLevelOrder(${treeStr});`);
        } else if (language === 'cpp') {
          declarations.push(`TreeNode* ${pName} = buildTreeFromLevelOrder(${treeStr});`);
        } else if (language === 'python') {
          declarations.push(`${pName} = buildTreeFromLevelOrder(${treeStr})`);
        } else if (language === 'javascript') {
          declarations.push(`const ${pName} = buildTreeFromLevelOrder(${treeStr});`);
        }
      } else if (pTypeLower.includes("listnode") && !pTypeLower.includes("[]") && !pTypeLower.includes("vector")) {
        let posVal = "-1";
        if (i + 1 < lines.length && /^-?\d+$/.test(lines[i + 1])) {
          posVal = lines[i + 1];
        }
        const arrFormatted = lineVal.startsWith("[") ? lineVal : `[${lineVal.replace(/\s+/g, ',')}]`;
        if (language === 'java') {
          const javaArr = arrFormatted.replace(/\[/g, '{').replace(/\]/g, '}');
          declarations.push(`ListNode ${pName} = buildListWithCycle(new int[]${javaArr}, ${posVal});`);
        } else if (language === 'cpp') {
          const cppArr = arrFormatted.replace(/\[/g, '{').replace(/\]/g, '}');
          declarations.push(`ListNode* ${pName} = buildListWithCycle(vector<int>${cppArr}, ${posVal});`);
        } else if (language === 'python') {
          declarations.push(`${pName} = buildListWithCycle(${arrFormatted}, ${posVal})`);
        } else if (language === 'javascript') {
          declarations.push(`const ${pName} = buildListWithCycle(${arrFormatted}, ${posVal});`);
        }
      } else if (pTypeLower.includes("[][]") || pTypeLower.includes("list<list") || pTypeLower.includes("vector<vector")) {
        const formatted = lineVal.startsWith("[") ? lineVal : `[[${lineVal}]]`;
        if (language === 'java') {
          const javaVal = formatted.replace(/\[/g, '{').replace(/\]/g, '}');
          declarations.push(`int[][] ${pName} = new int[][]{${javaVal.substring(1, javaVal.length - 1)}};`);
        } else if (language === 'cpp') {
          const cppVal = formatted.replace(/\[/g, '{').replace(/\]/g, '}');
          declarations.push(`vector<vector<int>> ${pName} = ${cppVal};`);
        } else if (language === 'python') {
          declarations.push(`${pName} = ${formatted}`);
        } else if (language === 'javascript') {
          declarations.push(`const ${pName} = ${formatted};`);
        }
      } else if (pTypeLower.includes("[]") || pTypeLower.includes("vector") || pTypeLower.includes("list")) {
        const formatted = lineVal.startsWith("[") ? lineVal : `[${lineVal.replace(/\s+/g, ',')}]`;
        if (language === 'java') {
          const javaVal = formatted.replace(/\[/g, '{').replace(/\]/g, '}');
          // Detect element type: String, double, long, or int
          if (pTypeLower.includes("string")) {
            declarations.push(`String[] ${pName} = new String[]${javaVal};`);
          } else if (pTypeLower.includes("double") || pTypeLower.includes("float")) {
            declarations.push(`double[] ${pName} = new double[]${javaVal};`);
          } else if (pTypeLower.includes("long")) {
            declarations.push(`long[] ${pName} = new long[]${javaVal};`);
          } else if (pTypeLower.includes("char")) {
            declarations.push(`char[] ${pName} = new char[]${javaVal};`);
          } else {
            declarations.push(`int[] ${pName} = new int[]${javaVal};`);
          }
        } else if (language === 'cpp') {
          const cppVal = formatted.replace(/\[/g, '{').replace(/\]/g, '}');
          if (pTypeLower.includes("string")) {
            declarations.push(`vector<string> ${pName} = ${cppVal};`);
          } else {
            declarations.push(`vector<int> ${pName} = ${cppVal};`);
          }
        } else if (language === 'python') {
          declarations.push(`${pName} = ${formatted}`);
        } else if (language === 'javascript') {
          declarations.push(`const ${pName} = ${formatted};`);
        }
      } else if (pTypeLower.includes("string")) {
        const strVal = (lineVal.startsWith('"') && lineVal.endsWith('"')) ? lineVal : `"${lineVal.replace(/"/g, '\\"')}"`;
        if (language === 'java') declarations.push(`String ${pName} = ${strVal};`);
        else if (language === 'cpp') declarations.push(`string ${pName} = ${strVal};`);
        else if (language === 'python') declarations.push(`${pName} = ${strVal}`);
        else if (language === 'javascript') declarations.push(`const ${pName} = ${strVal};`);
      } else {
        const primVal = lineVal;
        if (language === 'java') declarations.push(`${p.type} ${pName} = ${primVal};`);
        else if (language === 'cpp') declarations.push(`${p.type} ${pName} = ${primVal};`);
        else if (language === 'python') declarations.push(`${pName} = ${primVal}`);
        else if (language === 'javascript') declarations.push(`const ${pName} = ${primVal};`);
      }
    }

    return {
      declaration: declarations.join(language === 'python' ? '\n' : '\n        '),
      varNames
    };
  }

  private parseInputToVariablesAdvanced(input: string, language: string, inputType: string, code: string): { declaration: string; varNames: string[] } {
    const funcSig = this.extractFunctionSignature(code, language);

    const isTree = code.includes("TreeNode") || code.includes("root1") || code.includes("root2") || (funcSig?.name && funcSig.name.includes("Trees"));
    if (isTree) {
      const lines = input.trim().split(/\n/).map(l => l.trim()).filter(l => l !== '');
      const paramCount = funcSig?.params?.length || (code.includes("root2") ? 2 : 1);

      if (paramCount === 2) {
        const val1 = lines[0] || "N";
        const val2 = lines[1] || "N";
        if (language === 'cpp' || language === 'c') {
          return {
            declaration: `TreeNode* root1 = buildTreeFromLevelOrder("${val1}");\n        TreeNode* root2 = buildTreeFromLevelOrder("${val2}");`,
            varNames: ['root1', 'root2']
          };
        } else if (language === 'java') {
          return {
            declaration: `TreeNode root1 = buildTreeFromLevelOrder("${val1}");\n        TreeNode root2 = buildTreeFromLevelOrder("${val2}");`,
            varNames: ['root1', 'root2']
          };
        } else if (language === 'python') {
          return {
            declaration: `root1 = build_tree_from_level_order("${val1}")\nroot2 = build_tree_from_level_order("${val2}")`,
            varNames: ['root1', 'root2']
          };
        } else if (language === 'javascript') {
          return {
            declaration: `const root1 = buildTreeFromLevelOrder("${val1}");\nconst root2 = buildTreeFromLevelOrder("${val2}");`,
            varNames: ['root1', 'root2']
          };
        }
      } else {
        const val1 = lines.join(" ") || "N";
        if (language === 'cpp' || language === 'c') {
          return {
            declaration: `TreeNode* root = buildTreeFromLevelOrder("${val1}");`,
            varNames: ['root']
          };
        } else if (language === 'java') {
          return {
            declaration: `TreeNode root = buildTreeFromLevelOrder("${val1}");`,
            varNames: ['root']
          };
        } else if (language === 'python') {
          return {
            declaration: `root = build_tree_from_level_order("${val1}")`,
            varNames: ['root']
          };
        } else if (language === 'javascript') {
          return {
            declaration: `const root = buildTreeFromLevelOrder("${val1}");`,
            varNames: ['root']
          };
        }
      }
    }

    if (funcSig && funcSig.params && funcSig.params.length > 0) {
      const univ = this.parseUniversalMultiParam(input, language, funcSig);
      if (univ) return univ;
    }
    let isListNodeArray = false;
    const funcName = funcSig?.name;

    let javaType = "int[][]";
    let cppType = "vector<vector<int>>";
    let varName = "matrix";

    if (funcSig && funcSig.params.length >= 1) {
      const paramStr = funcSig.params[0].trim();
      const parts = paramStr.split(/\s+/);
      if (parts.length >= 2) {
        javaType = parts.slice(0, parts.length - 1).join(" ");
        cppType = javaType;
        varName = parts[parts.length - 1];
      }
    }
    if (funcName) {
      const paramRegex = new RegExp(`${funcName}\\s*\\(([^)]*)\\)`);
      const paramMatch = code.match(paramRegex);
      if (paramMatch && paramMatch[1]) {
        const paramStr = paramMatch[1].toLowerCase();
        isListNodeArray = paramStr.includes("listnode[]") || 
                          paramStr.includes("vector<listnode*>") || 
                          paramStr.includes("list<listnode>") || 
                          paramStr.includes("listnode*[]");
      }
    }
    
    if (isListNodeArray) {
      const lines = input.trim().split('\n').map(l => l.trim()).filter(l => l);
      let listArrays: number[][] = [];
      try {
        let startIdx = 0;
        const firstLineSingle = /^\d+$/.test(lines[0]);
        const secondLineSingle = lines.length > 1 && /^\d+$/.test(lines[1]);
        const thirdLineSingle = lines.length > 2 && /^\d+$/.test(lines[2]);
        
        if (firstLineSingle && secondLineSingle && thirdLineSingle) {
          startIdx = 1;
        }

        const k = parseInt(lines[startIdx]);
        let idx = startIdx + 1;
        for (let i = 0; i < k; i++) {
          if (idx >= lines.length) break;
          const n = parseInt(lines[idx++]);
          if (n === 0) {
            listArrays.push([]);
          } else {
            if (idx >= lines.length) break;
            const vals = lines[idx++].split(/\s+/).map(Number);
            listArrays.push(vals);
          }
        }
      } catch (err) {
        listArrays = [];
      }
      
      const arrayRepr = JSON.stringify(listArrays);
      
      if (language === 'java') {
        const javaArray = arrayRepr.replace(/\[/g, '{').replace(/\]/g, '}');
        return {
          declaration: `int[][] lists_vals = ${javaArray};
        ListNode[] lists = new ListNode[lists_vals.length];
        for (int i = 0; i < lists_vals.length; i++) {
            ListNode head = null;
            ListNode tail = null;
            for (int val : lists_vals[i]) {
                ListNode node = new ListNode(val);
                if (head == null) head = node;
                else tail.next = node;
                tail = node;
            }
            lists[i] = head;
        }`,
          varNames: ['lists']
        };
      } else if (language === 'cpp') {
        const cppArray = arrayRepr.replace(/\[/g, '{').replace(/\]/g, '}');
        return {
          declaration: `vector<vector<int>> lists_vals = ${cppArray};
    vector<ListNode*> lists(lists_vals.size());
    for (int i = 0; i < lists_vals.size(); i++) {
        ListNode* head = nullptr;
        ListNode* tail = nullptr;
        for (int val : lists_vals[i]) {
            ListNode* node = new ListNode(val);
            if (head == nullptr) head = node;
            else tail->next = node;
            tail = node;
        }
        lists[i] = head;
    }`,
          varNames: ['lists']
        };
      } else if (language === 'python') {
        return {
          declaration: `lists_vals = ${arrayRepr}
lists = []
for vals in lists_vals:
    head = None
    tail = None
    for val in vals:
        node = ListNode(val)
        if not head: head = node
        else: tail.next = node
        tail = node
    lists.append(head)`,
          varNames: ['lists']
        };
      } else if (language === 'javascript') {
        return {
          declaration: `const lists_vals = ${arrayRepr};
const lists = lists_vals.map(vals => {
    let head = null;
    let tail = null;
    for (const val of vals) {
        const node = new ListNode(val);
        if (!head) head = node;
        else tail.next = node;
        tail = node;
    }
    return head;
});`,
          varNames: ['lists']
        };
      }
    }

    const lines = input.trim().split('\n').filter(l => l.trim());
    
    switch (inputType) {
      case 'n_queens':
        const n = lines[0]?.trim() || '4';
        if (language === 'java') {
          return { declaration: `int n = ${n};`, varNames: ['n'] };
        } else if (language === 'python') {
          return { declaration: `n = ${n}`, varNames: ['n'] };
        } else if (language === 'cpp') {
          return { declaration: `int n = ${n};`, varNames: ['n'] };
        } else if (language === 'javascript') {
          return { declaration: `const n = ${n};`, varNames: ['n'] };
        }
        return { declaration: `n = ${n}`, varNames: ['n'] };
        
      case 'array_target':
        if (lines.length >= 3) {
          const T = parseInt(lines[0].trim());
          if (!isNaN(T) && lines.length >= 2 + T) {
            // Check if lines[1] has two space-separated numbers (e.g. "5 2")
            const line1Parts = lines[1].trim().split(/\s+/);
            if (line1Parts.length === 2 && !isNaN(parseInt(line1Parts[0])) && !isNaN(parseInt(line1Parts[1]))) {
              const n = parseInt(line1Parts[0]);
              const target = line1Parts[1];
              const numsLine = lines.slice(2, 2 + T).join(' ');
              const parts = numsLine.split(/\s+/).filter(s => s);
              const arrPart = parts.slice(0, n).join(', ');
              if (language === 'java') {
                return { declaration: `int n = ${n};\nint[] nums = new int[]{${arrPart}};\nint target = ${target};`, varNames: ['n', 'nums', 'target'] };
              } else if (language === 'python') {
                return { declaration: `n = ${n}\nnums = [${arrPart}]\ntarget = ${target}`, varNames: ['n', 'nums', 'target'] };
              } else if (language === 'cpp') {
                return { declaration: `int n = ${n};\nvector<int> nums = {${arrPart}};\nint target = ${target};`, varNames: ['n', 'nums', 'target'] };
              } else if (language === 'javascript') {
                return { declaration: `const n = ${n};\nconst nums = [${arrPart}];\nconst target = ${target};`, varNames: ['n', 'nums', 'target'] };
              }
            }

            const n = parseInt(lines[1].trim());
            const numsLine = lines.slice(2, 2 + T).join(' ');
            const parts = numsLine.split(/\s+/).filter(s => s);
            const arrPart = parts.slice(0, n).join(', ');
            const target = parts.slice(n).join(' ') || lines.slice(2 + T).join(' ').trim();
            if (target && !isNaN(parseInt(target))) {
              const tVal = target;
              if (language === 'java') {
                return { declaration: `int n = ${n};\nint[] nums = new int[]{${arrPart}};\nint target = ${tVal};`, varNames: ['n', 'nums', 'target'] };
              } else if (language === 'python') {
                return { declaration: `n = ${n}\nnums = [${arrPart}]\ntarget = ${tVal}`, varNames: ['n', 'nums', 'target'] };
              } else if (language === 'cpp') {
                return { declaration: `int n = ${n};\nvector<int> nums = {${arrPart}};\nint target = ${tVal};`, varNames: ['n', 'nums', 'target'] };
              } else if (language === 'javascript') {
                return { declaration: `const n = ${n};\nconst nums = [${arrPart}];\nconst target = ${tVal};`, varNames: ['n', 'nums', 'target'] };
              }
            }
          }
        }
        
        if (lines.length >= 2) {
          const firstLine = lines[0].trim();
          const secondLine = lines.slice(1).join(' ').trim();
          
          if (/^\d+$/.test(firstLine) && secondLine.includes(' ')) {
            const parts = secondLine.split(/\s+/);
            const n = firstLine;
            const arrPart = parts.slice(0, Math.min(parts.length - 1, parseInt(n) || parts.length)).join(', ');
            const target = parts.slice(parseInt(n) || parts.length).join(' ') || parts[parts.length - 1];
            
            if (language === 'java') {
              return { 
                declaration: `int n = ${n};\nint[] nums = new int[]{${arrPart}};\nint target = ${target};`, 
                varNames: ['n', 'nums', 'target'] 
              };
            } else if (language === 'python') {
              return { 
                declaration: `n = ${n}\nnums = [${arrPart}]\ntarget = ${target}`, 
                varNames: ['n', 'nums', 'target'] 
              };
            } else if (language === 'cpp') {
              return { 
                declaration: `int n = ${n};\nvector<int> nums = {${arrPart}};\nint target = ${target};`, 
                varNames: ['n', 'nums', 'target'] 
              };
            } else if (language === 'javascript') {
              return { 
                declaration: `const n = ${n};\nconst nums = [${arrPart}];\nconst target = ${target};`, 
                varNames: ['n', 'nums', 'target'] 
              };
            }
          }
          
          const allNumbers = lines.every(l => /^[\d\s\-]+$/.test(l));
          if (allNumbers) {
            const numbers = lines.join(' ').split(/\s+/).filter(n => n);
            if (numbers.length === 1) {
              if (language === 'java') return { declaration: `int n = ${numbers[0]};`, varNames: ['n'] };
              if (language === 'python') return { declaration: `n = ${numbers[0]}`, varNames: ['n'] };
              if (language === 'cpp') return { declaration: `int n = ${numbers[0]};`, varNames: ['n'] };
              if (language === 'javascript') return { declaration: `const n = ${numbers[0]};`, varNames: ['n'] };
            }
            const arrValues = numbers.join(', ');
            if (language === 'java') return { declaration: `int[] nums = new int[]{${arrValues}};`, varNames: ['nums'] };
            if (language === 'python') return { declaration: `nums = [${arrValues}]`, varNames: ['nums'] };
            if (language === 'cpp') return { declaration: `vector<int> nums = {${arrValues}};`, varNames: ['nums'] };
            if (language === 'javascript') return { declaration: `const nums = [${arrValues}];`, varNames: ['nums'] };
          }
        }
        
        if (lines.length === 1) {
          const n = lines[0].trim();
          let javaType = "int";
          let cppType = "int";
          let varName = "n";
          
          if (funcSig && funcSig.params.length >= 1) {
             const paramStr = funcSig.params[0];
             const parts = paramStr.split(/\s+/);
             if (parts.length >= 2) {
                 javaType = parts.slice(0, parts.length - 1).join(" ");
                 cppType = javaType;
                 varName = parts[parts.length - 1];
             }
          } else {
             if (n.startsWith('"') && n.endsWith('"')) {
                javaType = "String";
                cppType = "string";
             }
          }
          
          if (language === 'java') return { declaration: `${javaType} ${varName} = ${n};`, varNames: [varName] };
          if (language === 'python') return { declaration: `${varName} = ${n}`, varNames: [varName] };
          if (language === 'cpp') return { declaration: `${cppType} ${varName} = ${n};`, varNames: [varName] };
          if (language === 'javascript') return { declaration: `const ${varName} = ${n};`, varNames: [varName] };
        }
        const escaped = input.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n');
        if (language === 'java') return { declaration: `String input = "${escaped}";`, varNames: ['input'] };
        if (language === 'python') return { declaration: `input = "${escaped}"`, varNames: ['input'] };
        if (language === 'cpp') return { declaration: `string input = "${escaped}";`, varNames: ['input'] };
        if (language === 'javascript') return { declaration: `const input = "${escaped}";`, varNames: ['input'] };
        return { declaration: `input = "${escaped}"`, varNames: ['input'] };
        
      case 'matrix': {
        const lines = input.trim().split('\n').map(l => l.trim()).filter(l => l);
        let matrixInput = input.trim();
        let extraLines: string[] = [];

        if (lines.length > 0) {
          if (lines[0].startsWith("[")) {
            matrixInput = lines[0];
            extraLines = lines.slice(1);
          } else {
            const isAllRows = lines.every(l => !l.startsWith("["));
            if (isAllRows) {
              matrixInput = lines.join("\n");
              extraLines = [];
            } else {
              matrixInput = lines[0];
              extraLines = lines.slice(1);
            }
          }
        }

        const funcParams: { type: string; name: string }[] = [];
        if (funcSig && funcSig.params.length > 0) {
          for (const p of funcSig.params) {
            const parts = p.trim().split(/\s+/);
            if (parts.length >= 2) {
              funcParams.push({
                type: parts.slice(0, parts.length - 1).join(" "),
                name: parts[parts.length - 1]
              });
            }
          }
        }

        if (language === 'java') {
          let javaMatrix = matrixInput;
          const firstParam = funcParams[0];
          let mainDecl = "";
          if (firstParam && firstParam.type.toLowerCase().includes("string") && !firstParam.type.includes("[]")) {
            mainDecl = `String ${firstParam.name} = ${matrixInput};`;
          } else {
            const isCharMatrix = javaType.includes("char") || 
                                 matrixInput.includes("'") || 
                                 (firstParam && firstParam.type.includes("char")) || 
                                 (code && /char\s*\[\s*\]\s*\[\s*\]/i.test(code)) ||
                                 (matrixInput.includes('"') && (matrixInput.includes('.') || /[a-zA-Z]/.test(matrixInput)));
            const finalJavaType = isCharMatrix ? "char[][]" : "int[][]";
            if (isCharMatrix) {
              javaMatrix = javaMatrix.replace(/"([^"])"/g, "'$1'");
            }
            if (!javaMatrix.startsWith("[")) {
              const gridLines = javaMatrix.split("\n").map(l => l.trim()).filter(l => l);
              const formattedRows = gridLines.map(rowLine => {
                const charElements = rowLine.split("").map(c => `'${c}'`).join(", ");
                return `{${charElements}}`;
              }).join(",\n            ");
              javaMatrix = `{\n            ${formattedRows}\n        }`;
            } else {
              javaMatrix = javaMatrix.replace(/\[/g, '{').replace(/\]/g, '}');
            }
            mainDecl = `${finalJavaType} ${varName} = new ${finalJavaType}${javaMatrix};`;
          }
          
          const extraDecls: string[] = [];
          const allVarNames = [varName];
          extraLines.forEach((extraVal, i) => {
            const pSpec = funcParams[i + 1];
            const pName = pSpec?.name || (i === 0 ? "k" : `arg${i + 1}`);
            let rawType = pSpec?.type || (isNaN(Number(extraVal)) ? "String" : "int");
            let pType = rawType;
            if (rawType.includes("int[][]") || rawType.includes("List<List<Integer>>") || extraVal.trim().startsWith("[[")) {
              pType = "int[][]";
              const formattedVal = extraVal.trim().replace(/\[/g, '{').replace(/\]/g, '}');
              extraDecls.push(`int[][] ${pName} = new int[][ limitations ]${formattedVal};`.replace("[ limitations ]", "[][]"));
            } else if (rawType.includes("int[]") || rawType.includes("List<Integer>") || extraVal.trim().startsWith("[")) {
              pType = "int[]";
              const formattedVal = extraVal.trim().replace(/\[/g, '{').replace(/\]/g, '}');
              extraDecls.push(`int[] ${pName} = new int[]${formattedVal};`);
            } else {
              if (rawType.includes("int")) pType = "int";
              if (rawType.includes("double") || rawType.includes("float")) pType = "double";
              if (rawType.includes("boolean") || rawType.includes("bool")) pType = "boolean";
              extraDecls.push(`${pType} ${pName} = ${extraVal};`);
            }
            allVarNames.push(pName);
          });

          return {
            declaration: [mainDecl, ...extraDecls].join('\n        '),
            varNames: allVarNames
          };
        }

        if (language === 'python') {
          let pyMatrix = matrixInput;
          if (!pyMatrix.startsWith("[")) {
            const gridLines = pyMatrix.split("\n").map(l => l.trim()).filter(l => l);
            const formattedRows = gridLines.map(rowLine => {
              const charElements = rowLine.split("").map(c => `"${c}"`).join(", ");
              return `[${charElements}]`;
            }).join(",\n    ");
            pyMatrix = `[\n    ${formattedRows}\n]`;
          }
          const mainDecl = `${varName} = ${pyMatrix}`;

          const extraDecls: string[] = [];
          const allVarNames = [varName];
          extraLines.forEach((extraVal, i) => {
            const pSpec = funcParams[i + 1];
            const pName = pSpec?.name || (i === 0 ? "k" : `arg${i + 1}`);
            extraDecls.push(`${pName} = ${extraVal}`);
            allVarNames.push(pName);
          });

          return {
            declaration: [mainDecl, ...extraDecls].join('\n'),
            varNames: allVarNames
          };
        }

        if (language === 'cpp') {
          let cppMatrix = matrixInput;
          if (!cppMatrix.startsWith("[")) {
            const gridLines = cppMatrix.split("\n").map(l => l.trim()).filter(l => l);
            const formattedRows = gridLines.map(rowLine => {
              const charElements = rowLine.split("").map(c => `'${c}'`).join(", ");
              return `{${charElements}}`;
            }).join(",\n            ");
            cppMatrix = `{\n            ${formattedRows}\n        }`;
          } else {
            cppMatrix = cppMatrix.replace(/\[/g, '{').replace(/\]/g, '}').replace(/"/g, "'");
          }
          const finalCppType = cppType.includes("int") ? "vector<vector<int>>" : cppType.includes("char") ? "vector<vector<char>>" : cppType;
          const mainDecl = `${finalCppType} ${varName} = ${cppMatrix};`;

          const extraDecls: string[] = [];
          const allVarNames = [varName];
          extraLines.forEach((extraVal, i) => {
            const pSpec = funcParams[i + 1];
            const pName = pSpec?.name || (i === 0 ? "k" : `arg${i + 1}`);
            let pType = pSpec?.type || (isNaN(Number(extraVal)) ? "string" : "int");
            if (pType.includes("int")) pType = "int";
            if (pType.includes("double") || pType.includes("float")) pType = "double";
            if (pType.includes("bool")) pType = "bool";
            extraDecls.push(`${pType} ${pName} = ${extraVal};`);
            allVarNames.push(pName);
          });

          return {
            declaration: [mainDecl, ...extraDecls].join('\n        '),
            varNames: allVarNames
          };
        }

        if (language === 'javascript') {
          let jsMatrix = matrixInput;
          if (!jsMatrix.startsWith("[")) {
            const gridLines = jsMatrix.split("\n").map(l => l.trim()).filter(l => l);
            const formattedRows = gridLines.map(rowLine => {
              const charElements = rowLine.split("").map(c => `"${c}"`).join(", ");
              return `[${charElements}]`;
            }).join(",\n    ");
            jsMatrix = `[\n    ${formattedRows}\n]`;
          }
          const mainDecl = `const ${varName} = ${jsMatrix};`;

          const extraDecls: string[] = [];
          const allVarNames = [varName];
          extraLines.forEach((extraVal, i) => {
            const pSpec = funcParams[i + 1];
            const pName = pSpec?.name || (i === 0 ? "k" : `arg${i + 1}`);
            extraDecls.push(`const ${pName} = ${extraVal};`);
            allVarNames.push(pName);
          });

          return {
            declaration: [mainDecl, ...extraDecls].join('\n'),
            varNames: allVarNames
          };
        }

        return { declaration: `${varName} = ${input.trim()}`, varNames: [varName] };
      }
        
      case 'array': {
        const lines = input.trim().split('\n').map(l => l.trim()).filter(l => l);
        let arrayInput = input.trim();
        let extraLines: string[] = [];

        if (lines.length > 0) {
          if (lines[0].startsWith("[")) {
            arrayInput = lines[0];
            extraLines = lines.slice(1);
          } else {
            const firstIsInt = /^\d+$/.test(lines[0]);
            if (firstIsInt && lines.length > 1) {
              const count = parseInt(lines[0]);
              const restElements = lines.slice(1).join(" ").split(/\s+/).filter(s => s);
              if (restElements.length === count) {
                arrayInput = restElements.join(", ");
                extraLines = [];
              } else {
                arrayInput = restElements.slice(0, count).join(", ");
                const remainingTokens = restElements.slice(count);
                extraLines = remainingTokens.length > 0 ? [remainingTokens.join(" ")] : [];
              }
            } else {
              arrayInput = lines[0];
              extraLines = lines.slice(1);
            }
          }
        }

        const funcParams: { type: string; name: string }[] = [];
        if (funcSig && funcSig.params.length > 0) {
          for (const p of funcSig.params) {
            const parts = p.trim().split(/\s+/);
            if (parts.length >= 2) {
              funcParams.push({
                type: parts.slice(0, parts.length - 1).join(" "),
                name: parts[parts.length - 1]
              });
            }
          }
        }

        const arrValues = arrayInput.replace(/[\[\]]/g, '').trim().split(/[\s,]+/).filter(s => s).join(', ');
        const firstP = funcParams[0];
        const mainVarName = (firstP && !firstP.type.includes("ListNode")) ? firstP.name : "nums";

        if (language === 'java') {
          const mainDeclJava = `int[] ${mainVarName} = new int[]{${arrValues}};`;
          const extraDecls: string[] = [];
          const allVarNames = [mainVarName];

          extraLines.forEach((extraVal, i) => {
            const pSpec = funcParams[i + 1];
            const pName = pSpec?.name || (i === 0 ? "pos" : `arg${i + 1}`);
            let pType = pSpec?.type || (isNaN(Number(extraVal)) ? "String" : "int");
            if (pType.includes("int")) pType = "int";
            if (pType.includes("double") || pType.includes("float")) pType = "double";
            if (pType.includes("boolean") || pType.includes("bool")) pType = "boolean";
            extraDecls.push(`${pType} ${pName} = ${extraVal};`);
            allVarNames.push(pName);
          });

          return {
            declaration: [mainDeclJava, ...extraDecls].join('\n        '),
            varNames: allVarNames
          };
        }

        if (language === 'python') {
          const mainDeclPy = `${mainVarName} = [${arrValues}]`;
          const extraDecls: string[] = [];
          const allVarNames = [mainVarName];

          extraLines.forEach((extraVal, i) => {
            const pSpec = funcParams[i + 1];
            const pName = pSpec?.name || (i === 0 ? "pos" : `arg${i + 1}`);
            extraDecls.push(`${pName} = ${extraVal}`);
            allVarNames.push(pName);
          });

          return {
            declaration: [mainDeclPy, ...extraDecls].join('\n'),
            varNames: allVarNames
          };
        }

        if (language === 'cpp') {
          const cppType = (firstP && !firstP.type.includes("ListNode")) ? firstP.type : "vector<int>";
          const mainDeclCpp = `${cppType} ${mainVarName} = {${arrValues}};`;
          const extraDecls: string[] = [];
          const allVarNames = [mainVarName];

          extraLines.forEach((extraVal, i) => {
            const pSpec = funcParams[i + 1];
            const pName = pSpec?.name || (i === 0 ? "pos" : `arg${i + 1}`);
            let pType = pSpec?.type || (isNaN(Number(extraVal)) ? "string" : "int");
            if (pType.includes("int")) pType = "int";
            if (pType.includes("double") || pType.includes("float")) pType = "double";
            if (pType.includes("bool")) pType = "bool";
            extraDecls.push(`${pType} ${pName} = ${extraVal};`);
            allVarNames.push(pName);
          });

          return {
            declaration: [mainDeclCpp, ...extraDecls].join('\n        '),
            varNames: allVarNames
          };
        }

        if (language === 'javascript') {
          const mainDeclJs = `const ${mainVarName} = [${arrValues}];`;
          const extraDecls: string[] = [];
          const allVarNames = [mainVarName];

          extraLines.forEach((extraVal, i) => {
            const pSpec = funcParams[i + 1];
            const pName = pSpec?.name || (i === 0 ? "pos" : `arg${i + 1}`);
            extraDecls.push(`const ${pName} = ${extraVal};`);
            allVarNames.push(pName);
          });

          return {
            declaration: [mainDeclJs, ...extraDecls].join('\n'),
            varNames: allVarNames
          };
        }

        return { declaration: `nums = [${arrValues}]`, varNames: ['nums'] };
      }
        
      case 'single':
      default: {
        const n = input.trim();
        let javaType = "int";
        let cppType = "int";
        let varName = "n";
        
        if (funcSig && funcSig.params.length >= 1) {
           const paramStr = funcSig.params[0];
           const parts = paramStr.split(/\s+/);
           if (parts.length >= 2) {
               javaType = parts.slice(0, parts.length - 1).join(" ");
               cppType = javaType;
               varName = parts[parts.length - 1];
           }
        } else {
           if (n.startsWith('"') && n.endsWith('"')) {
              javaType = "String";
              cppType = "string";
           }
        }
        
        if (language === 'java') return { declaration: `${javaType} ${varName} = ${n};`, varNames: [varName] };
        if (language === 'python') return { declaration: `${varName} = ${n}`, varNames: [varName] };
        if (language === 'cpp') return { declaration: `${cppType} ${varName} = ${n};`, varNames: [varName] };
        if (language === 'javascript') return { declaration: `const ${varName} = ${n};`, varNames: [varName] };
        return { declaration: `n = ${n}`, varNames: [varName] };
      }
    }
  }

  private generateJavaTestCode(funcName: string, varNames: string[], outputFormat: string, hasSolutionClass: boolean, code: string): string {
    const cleanCode = code
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "")
      .replace(/class\s+ListNode\s*\{[\s\S]*?\}/g, "")
      .replace(/struct\s+ListNode\s*\{[\s\S]*?\}/g, "");
    const match = cleanCode.match(/(?:public\s+)?(?:static\s+)?([\w<>[\]]+)\s+(\w+)\s*\(([^)]*)\)/);
    let returnType = "int";
    let paramStr = "";
    
    if (match) {
      returnType = match[1];
      paramStr = match[3].trim();
    }

    const firstParamIsList = paramStr.toLowerCase().includes("listnode") && !paramStr.includes("[]") && !paramStr.includes("vector") && !/\blist\b/i.test(paramStr);
    const returnsListNodeArray = returnType.toLowerCase().includes("listnode") && (returnType.includes("[]") || returnType.toLowerCase().includes("vector") || returnType.toLowerCase().includes("list<"));
    const returnsList = returnType.toLowerCase().includes("listnode") && !returnsListNodeArray;
    const returnsArray = (returnType.includes("[]") || returnType.toLowerCase().includes("vector") || returnType.toLowerCase().includes("list<")) && !returnsListNodeArray;
    
    let expectedParamCount = varNames.length;
    if (paramStr) {
      expectedParamCount = paramStr.split(',').map(p => p.trim()).filter(p => p).length;
    }

    let listBuilder = "";
    let args = "";

    const hasPosVar = varNames.includes("pos");
    if (firstParamIsList && !varNames.includes("head")) {
      if (hasPosVar) {
        listBuilder = `
        ListNode head = null;
        ListNode tail = null;
        ListNode[] nodes = new ListNode[nums.length];
        for (int i = 0; i < nums.length; i++) {
            nodes[i] = new ListNode(nums[i]);
            if (head == null) {
                head = nodes[i];
            } else {
                tail.next = nodes[i];
            }
            tail = nodes[i];
        }
        if (pos >= 0 && pos < nodes.length) {
            tail.next = nodes[pos];
        }
        `;
      } else {
        listBuilder = `
        ListNode head = null;
        ListNode tail = null;
        for (int val : nums) {
            ListNode node = new ListNode(val);
            if (head == null) {
                head = node;
            } else {
                tail.next = node;
            }
            tail = node;
        }
        `;
      }
      args = ['head', ...varNames.slice(1)].slice(0, Math.max(1, expectedParamCount)).join(', ');
    } else {
      args = varNames.slice(0, Math.max(1, expectedParamCount)).join(', ');
    }
    
    const invocation = hasSolutionClass ? `sol.${funcName}(${args})` : `new Solution().${funcName}(${args})`;

    if (returnType === "void") {
      const targetParam = varNames[0] || "";
      if (targetParam) {
        const targetTypeStr = paramStr.toLowerCase();
        if (targetTypeStr.includes("char[][]") || targetTypeStr.includes("int[][]")) {
          return `${listBuilder}
        ${invocation};
        for (int i = 0; i < ${targetParam}.length; i++) {
            StringBuilder sb = new StringBuilder();
            for (int j = 0; j < ${targetParam}[i].length; j++) {
                sb.append(${targetParam}[i][j]);
            }
            System.out.println(sb.toString());
        }`;
        } else if (targetTypeStr.includes("[]")) {
          return `${listBuilder}
        ${invocation};
        printResult(${targetParam});`;
        }
      }
      return `${listBuilder}
        ${invocation};`;
    }

    if (returnsListNodeArray) {
      return `${listBuilder}
        ListNode[] result = ${invocation};
        printListNodeArray(result);`;
    } else if (returnsList) {
      return `${listBuilder}        ListNode result = ${invocation};
        if (result == null) {
            System.out.println("-1");
        } else {
            ListNode curr = head;
            int idx = 0;
            Set<ListNode> visited = new HashSet<>();
            boolean found = false;
            while (curr != null && !visited.contains(curr)) {
                if (curr == result) {
                    found = true;
                    break;
                }
                visited.add(curr);
                curr = curr.next;
                idx++;
            }
            if (found && ${hasPosVar ? "true" : "false"}) {
                System.out.println(idx);
            } else {
                printListNode(result);
            }
        }`;
    } else if (outputFormat === 'array_2d') {
      const isStringList = /List\s*<\s*List\s*<\s*String/i.test(code);
      if (isStringList) {
        return `List<List<String>> result = ${invocation};
        print2DList(result);`;
      }
      return `Object result2d = ${invocation};
        if (result2d instanceof List) {
            List<?> outer = (List<?>) result2d;
            StringBuilder sb2d = new StringBuilder("[");
            for (int _i = 0; _i < outer.size(); _i++) {
                sb2d.append("[");
                Object inner = outer.get(_i);
                if (inner instanceof List) {
                    List<?> innerList = (List<?>) inner;
                    for (int _j = 0; _j < innerList.size(); _j++) {
                        Object elem = innerList.get(_j);
                        if (elem instanceof String) sb2d.append(String.valueOf((char)34)).append(elem).append(String.valueOf((char)34));
                        else sb2d.append(elem);
                        if (_j < innerList.size() - 1) sb2d.append(",");
                    }
                }
                sb2d.append("]");
                if (_i < outer.size() - 1) sb2d.append(",");
            }
            sb2d.append("]");
            System.out.println(sb2d.toString());
        } else {
            System.out.println(result2d);
        }`;
    } else {
      return `${listBuilder}
        Object result = ${invocation};
        printResult(result);`;
    }
  }

  private generatePythonTestCode(funcName: string, varNames: string[], outputFormat: string, hasSolutionClass: boolean, code: string): string {
    const cleanCode = code
      .replace(/'''[\s\S]*?'''|"""[\s\S]*?"""|#.*$/gm, "")
      .replace(/class\s+ListNode[\s\S]*?:[\s\S]*?(?=\nclass|\ndef|\Z)/g, "");
    const match = cleanCode.match(/def\s+(\w+)\s*\(([^)]*)\)/);
    let paramStr = "";
    if (match) {
      paramStr = match[2].trim();
    }
    
    const firstParamIsList = paramStr.toLowerCase().includes("head");
    
    let expectedParamCount = varNames.length;
    if (paramStr) {
      expectedParamCount = paramStr.split(',').map(p => p.trim()).filter(p => p && p !== "self").length;
    }

    let listBuilder = "";
    let args = "";

    const hasPosVar = varNames.includes("pos");
    if (firstParamIsList) {
      if (hasPosVar) {
        listBuilder = `    head = None
    tail = None
    nodes = []
    for val in nums:
        node = ListNode(val)
        nodes.append(node)
        if not head:
            head = node
        else:
            tail.next = node
        tail = node
    if pos >= 0 and pos < len(nodes):
        tail.next = nodes[pos]\n`;
      } else {
        listBuilder = `    head = None
    tail = None
    for val in nums:
        node = ListNode(val)
        if not head:
            head = node
        else:
            tail.next = node
        tail = node\n`;
      }
      args = ['head', ...varNames.slice(1)].slice(0, Math.max(1, expectedParamCount)).join(', ');
    } else {
      args = varNames.slice(0, Math.max(1, expectedParamCount)).join(', ');
    }
    
    const inst = hasSolutionClass ? "    sol = Solution()\n" : "";
    const invocation = hasSolutionClass ? `sol.${funcName}(${args})` : `${funcName}(${args})`;
    
    if (outputFormat === 'array_2d') {
      return `${inst}${listBuilder}    import json
    result = ${invocation}
    print(json.dumps(result))`;
    } else {
      const targetVar = varNames[0] || "nums";
      return `${inst}${listBuilder}    result = ${invocation}
    if result is None:
        if isinstance(${targetVar}, list):
            if len(${targetVar}) > 0 and isinstance(${targetVar}[0], list):
                for row in ${targetVar}:
                    print(''.join(map(str, row)))
    elif hasattr(result, 'left') or hasattr(result, 'right'):
        res = []
        queue = [result]
        while queue:
            curr = queue.pop(0)
            if curr:
                res.append(str(getattr(curr, 'val', getattr(curr, 'data', None))))
                queue.append(curr.left)
                queue.append(curr.right)
            else:
                res.append("N")
        while len(res) > 1 and res[-1] == "N":
            res.pop()
        print(' '.join(res))
    elif isinstance(result, ListNode):
        if result is None:
            print("-1")
        else:
            curr = head
            idx = 0
            visited = set()
            found = False
            while curr and curr not in visited:
                if curr == result:
                    found = True
                    break
                visited.add(curr)
                curr = curr.next
                idx += 1
            if found and 'pos' in locals():
                print(idx)
            else:
                currNode = result
                visited = set()
                vals = []
                step = 0
                while currNode and step < 1000:
                    if currNode in visited:
                        break
                    visited.add(currNode)
                    vals.append(str(currNode.val))
                    currNode = currNode.next
                    step += 1
                print(' '.join(vals))
    elif isinstance(result, list):
        if len(result) > 0 and (isinstance(result[0], ListNode) or (result[0] and hasattr(result[0], 'val'))):
            for node in result:
                if node is None:
                    print("NULL")
                else:
                    curr = node
                    vals = []
                    while curr:
                        vals.append(str(curr.val))
                        curr = curr.next
                    print(' '.join(vals))
        else:
            print(*(result))
    else:
        print(result)`;
    }
  }

  private generateCppTestCode(funcName: string, varNames: string[], outputFormat: string, hasSolutionClass: boolean, code: string): string {
    const cleanCode = code
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "")
      .replace(/struct\s+ListNode\s*\{[\s\S]*?\};?/g, "")
      .replace(/class\s+ListNode\s*\{[\s\S]*?\};?/g, "");
    const match = cleanCode.match(/([\w<>[\]*]+)\s+(\w+)\s*\(([^)]*)\)/);
    let returnType = "int";
    let paramStr = "";
    
    if (match) {
      returnType = match[1];
      paramStr = match[3].trim();
    }

    const firstParamIsList = paramStr.toLowerCase().includes("listnode") && !paramStr.includes("[]") && !paramStr.includes("vector") && !/\blist\b/i.test(paramStr);
    const returnsListNodeArray = returnType.toLowerCase().includes("listnode") && (returnType.includes("[]") || returnType.toLowerCase().includes("vector") || returnType.toLowerCase().includes("list<"));
    const returnsList = returnType.toLowerCase().includes("listnode") && !returnsListNodeArray;
    const returnsTreeNode = returnType.toLowerCase().includes("treenode") || code.includes("TreeNode") || funcName.includes("Trees");
    const returnsArray = (returnType.includes("vector") || returnType.includes("[]") || (returnType.includes("*") && !returnsTreeNode)) && !returnsListNodeArray;
    
    let expectedParamCount = varNames.length;
    if (paramStr) {
      expectedParamCount = paramStr.split(',').map(p => p.trim()).filter(p => p).length;
    }

    let listBuilder = "";
    let args = "";

    const hasPosVar = varNames.includes("pos");
    if (firstParamIsList) {
      if (hasPosVar) {
        listBuilder = `
        ListNode* head = nullptr;
        ListNode* tail = nullptr;
        vector<ListNode*> nodes(nums.size());
        for (size_t i = 0; i < nums.size(); ++i) {
            nodes[i] = new ListNode(nums[i]);
            if (!head) head = nodes[i];
            else tail->next = nodes[i];
            tail = nodes[i];
        }
        if (pos >= 0 && pos < (int)nodes.size()) {
            tail->next = nodes[pos];
        }
        `;
      } else {
        listBuilder = `
        ListNode* head = nullptr;
        ListNode* tail = nullptr;
        for (int val : nums) {
            ListNode* node = new ListNode(val);
            if (!head) head = node;
            else tail->next = node;
            tail = node;
        }
        `;
      }
      args = ['head', ...varNames.slice(1)].slice(0, Math.max(1, expectedParamCount)).join(', ');
    } else {
      args = varNames.slice(0, Math.max(1, expectedParamCount)).join(', ');
    }
    
    const inst = hasSolutionClass ? "        Solution sol;\n" : "";
    const invocation = hasSolutionClass ? `sol.${funcName}(${args})` : `${funcName}(${args})`;
    
    if (returnType === "void") {
      const targetParam = varNames[0] || "";
      if (targetParam) {
        const targetTypeStr = paramStr.toLowerCase();
        if (targetTypeStr.includes("vector<vector") || targetTypeStr.includes("vector<string>")) {
          return `${inst}${listBuilder}        ${invocation};
        for (const auto& row : ${targetParam}) {
            for (const auto& cell : row) {
                cout << cell;
            }
            cout << endl;
        }`;
        } else if (targetTypeStr.includes("vector") || targetTypeStr.includes("[]")) {
          return `${inst}${listBuilder}        ${invocation};
        for (size_t i = 0; i < ${targetParam}.size(); ++i) {
            cout << ${targetParam}[i] << (i + 1 == ${targetParam}.size() ? "" : " ");
        }
        cout << endl;`;
        }
      }
      return `${inst}${listBuilder}        ${invocation};`;
    }

    if (outputFormat === 'array_2d') {
      return `${inst}${listBuilder}        auto result = ${invocation};
        cout << "[";
        for (size_t i = 0; i < result.size(); ++i) {
            cout << "[";
            for (size_t j = 0; j < result[i].size(); ++j) {
                cout << (char)34 << result[i][j] << (char)34;
                if (j + 1 < result[i].size()) cout << ",";
            }
            cout << "]";
            if (i + 1 < result.size()) cout << ",";
        }
        cout << "]" << endl;`;
    } else if (returnsListNodeArray) {
      return `${inst}${listBuilder}        auto result = ${invocation};
        for (ListNode* node : result) {
            if (node == nullptr) {
                cout << "NULL" << endl;
            } else {
                ListNode* curr = node;
                while (curr != nullptr) {
                    cout << curr->val << (curr->next == nullptr ? "" : " ");
                    curr = curr->next;
                }
                cout << endl;
            }
        }`;
    } else if (returnsList) {
      return `${inst}${listBuilder}        ListNode* result = ${invocation};
        if (result == nullptr) {
            cout << "-1" << endl;
        } else {
            ListNode* curr = head;
            int idx = 0;
            unordered_set<ListNode*> visited;
            bool found = false;
            while (curr != nullptr && visited.find(curr) == visited.end()) {
                if (curr == result) {
                    found = true;
                    break;
                }
                visited.insert(curr);
                curr = curr->next;
                idx++;
            }
            if (found && ${hasPosVar ? "true" : "false"}) {
                cout << idx << endl;
            } else {
                ListNode* currNode = result;
                unordered_set<ListNode*> visited2;
                int step = 0;
                while (currNode && step < 1000) {
                    if (visited2.count(currNode)) break;
                    visited2.insert(currNode);
                    cout << currNode->val << (currNode->next ? " " : "");
                    currNode = currNode->next;
                    step++;
                }
                cout << endl;
            }
        }`;
    } else if (returnsTreeNode) {
      return `${inst}${listBuilder}        TreeNode* result = ${invocation};
        if (result == nullptr) {
            cout << "N" << endl;
        } else {
            vector<TreeNode*> q;
            q.push_back(result);
            int ptr = 0;
            while (ptr < (int)q.size()) {
                TreeNode* curr = q[ptr++];
                if (curr != nullptr) {
                    q.push_back(curr->left);
                    q.push_back(curr->right);
                }
            }
            int lastNonNull = (int)q.size() - 1;
            while (lastNonNull >= 0 && q[lastNonNull] == nullptr) {
                lastNonNull--;
            }
            for (int i = 0; i <= lastNonNull; i++) {
                if (i > 0) cout << " ";
                if (q[i] == nullptr) cout << "N";
                else cout << q[i]->data;
            }
            cout << endl;
        }`;
    } else if (returnsArray) {
      return `${inst}${listBuilder}        auto result = ${invocation};
        cout << "[";
        for (size_t i = 0; i < result.size(); ++i) {
            cout << result[i] << (i + 1 == result.size() ? "" : ",");
        }
        cout << "]" << endl;`;
    } else {
      return `${inst}${listBuilder}        auto result = ${invocation};
        cout << result << endl;`;
    }
  }

  private generateJsTestCode(funcName: string, varNames: string[], outputFormat: string, hasSolutionClass: boolean, code: string): string {
    const cleanCode = code
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "")
      .replace(/class\s+ListNode\s*\{[\s\S]*?\}/g, "")
      .replace(/function\s+ListNode[\s\S]*?\}/g, "");
    const match = cleanCode.match(/(\w+)\s*\(([^)]*)\)/);
    let paramStr = "";
    if (match) {
      paramStr = match[2].trim();
    }
    
    const firstParamIsList = paramStr.toLowerCase().includes("head");
    
    let expectedParamCount = varNames.length;
    if (paramStr) {
      expectedParamCount = paramStr.split(',').map(p => p.trim()).filter(p => p).length;
    }

    let listBuilder = "";
    let args = "";

    const hasPosVar = varNames.includes("pos");
    if (firstParamIsList) {
      if (hasPosVar) {
        listBuilder = `
let head = null;
let tail = null;
const nodes = [];
for (const val of nums) {
    const node = new ListNode(val);
    nodes.push(node);
    if (!head) head = node;
    else tail.next = node;
    tail = node;
}
if (pos >= 0 && pos < nodes.length) {
    tail.next = nodes[pos];
}
`;
      } else {
        listBuilder = `
let head = null;
let tail = null;
for (const val of nums) {
    const node = new ListNode(val);
    if (!head) head = node;
    else tail.next = node;
    tail = node;
}
`;
      }
      args = ['head', ...varNames.slice(1)].slice(0, Math.max(1, expectedParamCount)).join(', ');
    } else {
      args = varNames.slice(0, Math.max(1, expectedParamCount)).join(', ');
    }
    
    const inst = hasSolutionClass ? "const sol = new Solution();\n" : "";
    const invocation = hasSolutionClass ? `sol.${funcName}(${args})` : `${funcName}(${args})`;
    
    if (outputFormat === 'array_2d') {
      return `${inst}${listBuilder}const result = ${invocation};
console.log(JSON.stringify(result));`;
    } else {
      const targetVar = varNames[0] || "nums";
      return `${inst}${listBuilder}const result = ${invocation};
if (result === undefined) {
    if (Array.isArray(${targetVar})) {
        if (${targetVar}.length > 0 && Array.isArray(${targetVar}[0])) {
            ${targetVar}.forEach(row => console.log(row.join('')));
        } else {
            console.log(${targetVar}.join(' '));
        }
    } else {
        console.log(${targetVar});
    }
} else if (result && typeof result === 'object' && 'val' in result) {
    if (result === null) {
        console.log("-1");
    } else {
        let curr = head;
        let idx = 0;
        const visited = new Set();
        let found = false;
        while (curr && !visited.has(curr)) {
            if (curr === result) {
                found = true;
                break;
            }
            visited.add(curr);
            curr = curr.next;
            idx++;
        }
        if (found && typeof pos !== 'undefined') {
            console.log(idx);
        } else {
            let currNode = result;
            const visited2 = new Set();
            const vals = [];
            let step = 0;
            while (currNode && step < 1000) {
                if (visited2.has(currNode)) break;
                visited2.add(currNode);
                vals.push(currNode.val);
                currNode = currNode.next;
                step++;
            }
            console.log(vals.join(' '));
        }
    }
} else if (Array.isArray(result)) {
    if (result.length > 0 && result[0] && typeof result[0] === 'object' && 'val' in result[0]) {
        result.forEach(node => {
            if (node === null) {
                console.log("NULL");
            } else {
                const vals = [];
                let curr = node;
                while (curr !== null) {
                    vals.push(curr.val);
                    curr = curr.next;
                }
                console.log(vals.join(' '));
            }
        });
    } else {
        console.log(result.join(' '));
    }
} else {
    console.log(result);
}`;
    }
  }

  private execPromise(
    command: string[],
    options: { cwd: string; timeout?: number; input?: string }
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
      const env: Record<string, string> = { ...process.env, TMPDIR: options.cwd };
      if (!isWindows) env.HOME = "/tmp";

      const [cmd, ...args] = command;
      const timeout = options.timeout || 10000;
      let killed = false;

      const proc = spawn(cmd, args, {
        cwd: options.cwd,
        env,
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
      });

      const timer = setTimeout(() => {
        killed = true;
        try {
          if (proc.pid) {
            process.kill(-proc.pid, "SIGKILL");
          }
        } catch {}
        try { proc.kill("SIGKILL"); } catch {}
      }, timeout);

      let stdout = "";
      let stderr = "";

      proc.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        clearTimeout(timer);
        if (killed) {
          resolve({ stdout, stderr, exitCode: -1 });
        } else {
          resolve({ stdout, stderr, exitCode: code ?? 0 });
        }
      });

      proc.on("error", (error) => {
        clearTimeout(timer);
        resolve({ stdout, stderr: error.message, exitCode: 1 });
      });

      if (options.input) {
        proc.stdin?.write(options.input);
      }
      proc.stdin?.end();
    });
  }

  async executeCode(code: string, language: string, input: string = "", timeout: number = 10000): Promise<ExecutionResult> {
    const startTime = Date.now();
    const config = this.LANGUAGE_CONFIGS[language];
    if (!config) {
      return { success: false, output: "", stderr: "Unsupported language", error: "Language not supported", executionTime: 0 };
    }

    let processedCode = this.getInjectedUserCode(code, "", language);
    if (language === "java" || language === "cpp" || language === "c" || language === "javascript" || language === "typescript") {
      processedCode = processedCode
        .replace(/^\s*#region\b.*$/gm, "")
        .replace(/^\s*#endregion\b.*$/gm, "");
    }

    if (language === "java") {
      const imports: string[] = [];
      const cleaned = processedCode.replace(/^import\s+.*;\s*$/gm, (match) => {
        imports.push(match.trim());
        return '';
      });
      const uniqueImports = [...new Set(['import java.util.*;', 'import java.io.*;', ...imports])].join('\n');
      
      let finalBody = cleaned.trim();
      const mainClassIndex = finalBody.search(/(?:public\s+)?class\s+Main\b/);
      if (mainClassIndex > 0) {
        const helperCode = finalBody.substring(0, mainClassIndex).trim();
        const mainCode = finalBody.substring(mainClassIndex).trim();
        finalBody = mainCode + "\n\n" + helperCode;
      }
      processedCode = uniqueImports + "\n\n" + finalBody;
    }

    // ──────────────────────────────────────────────────────────
    // External Docker execution (Piston / Judge0)
    // ──────────────────────────────────────────────────────────
    if (externalCodeExecutor.isAvailable() && externalCodeExecutor.getSupportedLanguages().includes(language)) {
      try {
        const externalResult = await externalCodeExecutor.executeCode({
          language,
          code: processedCode,
          input,
          timeLimit: timeout,
        });
        return {
          success: externalResult.success,
          output: externalResult.output,
          stderr: externalResult.stderr,
          error: externalResult.error,
          executionTime: externalResult.executionTime,
          memoryUsed: externalResult.memoryUsed,
        };
      } catch (extError: any) {
        console.warn("External Piston execution error, falling back to local:", extError.message);
      }
    }

    const langError = this.getLanguageErrorMessage(language);
    if (langError) {
      return { success: false, output: "", stderr: langError, error: langError, executionTime: 0 };
    }



    // Only fall back to local subprocess execution in development mode
    if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== undefined) {
      return {
        success: false,
        output: "",
        stderr: "Code execution unavailable — no external executor configured",
        error: "Configure CODE_RUNNER_URL, JUDGE0_API_URL, or PISTON_API_URL for production",
        executionTime: Date.now() - startTime,
      };
    }

    // ──────────────────────────────────────────────────────────
    // External Docker execution (Piston / Judge0)
    // ──────────────────────────────────────────────────────────
    if (process.env.PISTON_API_URL || process.env.JUDGE0_API_URL) {
      try {
        const externalResult = await externalCodeExecutor.executeCode({
          language,
          code: processedCode,
          input,
          timeLimit: timeout,
        });
        return {
          success: externalResult.success,
          output: externalResult.output,
          stderr: externalResult.stderr,
          error: externalResult.error,
          executionTime: externalResult.executionTime,
        };
      } catch (extError: any) {
        console.warn("External Piston execution error, attempting local fallback:", extError.message);
      }
    }

    const sessionDir = this.createSessionDir();

    try {
      let className = "Main";
      
      if (language === "java") {
        if (/\bpublic\s+class\s+Main\b/.test(processedCode) || /\bclass\s+Main\b/.test(processedCode)) {
          className = "Main";
        } else {
          const mainClassMatch = processedCode.match(/(?:public\s+)?class\s+(\w+)[\s\S]*?\bpublic\s+static\s+void\s+main\b/);
          if (mainClassMatch) {
            className = mainClassMatch[1];
          } else {
            const publicClassMatch = processedCode.match(/public\s+class\s+(\w+)/);
            if (publicClassMatch) {
              className = publicClassMatch[1];
            } else {
              className = "Main";
            }
          }
        }
        const filePath = path.join(sessionDir, `${className}.java`);
        fs.writeFileSync(filePath, processedCode);
      } else {
        const mainFile = config.mainFile || `main.${config.extension}`;
        const filePath = path.join(sessionDir, mainFile);
        fs.writeFileSync(filePath, processedCode);
      }

      if (config.compile) {
        let compileCmd = [...config.compile];
        if (language === "java") {
          compileCmd = ["javac", "-Xlint:all", `${className}.java`];
        }
        const compileResult = await this.execPromise(compileCmd, { cwd: sessionDir, timeout: 10000 });
        if (compileResult.exitCode !== 0) {
          return { success: false, output: "", stderr: compileResult.stderr, error: "Compilation failed", executionTime: Date.now() - startTime };
        }
      }

      if (!config.run) {
        try {
          const externalResult = await externalCodeExecutor.executeCode({
            language,
            code: processedCode,
            input,
            timeLimit: timeout,
          });
          return {
            success: externalResult.success,
            output: externalResult.output,
            stderr: externalResult.stderr,
            error: externalResult.error,
            executionTime: externalResult.executionTime,
          };
        } catch (extError: any) {
          console.error("External executor also failed:", extError);
          return { success: false, output: "", stderr: extError.message || "Execution failed", error: "All execution paths failed", executionTime: Date.now() - startTime };
        }
      }
      let runCmd = [...config.run];
      if (language === "java") {
        runCmd = ["java", "-cp", ".", className];
      }
      const runResult = await this.execPromise(runCmd, { cwd: sessionDir, timeout, input });
      return {
        success: runResult.exitCode === 0,
        output: runResult.stdout,
        stderr: runResult.stderr,
        error: runResult.exitCode === -1 ? "Time Limit Exceeded" : runResult.exitCode !== 0 ? `Exit code: ${runResult.exitCode}` : undefined,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      console.error("Execution exception:", error);
      return { success: false, output: "", stderr: error.message || "Execution failed", error: error.message, executionTime: Date.now() - startTime };
    } finally {
      this.cleanupSessionDir(sessionDir);
    }
  }

  async runTestCases(
    code: string, 
    language: string, 
    testCases: TestCase[], 
    timeout: number = 5000,
    driverCode?: Record<string, string> | null,
    onProgress?: (result: TestCaseResult) => void
  ): Promise<TestSuiteResult> {
    language = this.detectRealLanguage(code, language);
    const results: TestCaseResult[] = [];
    let passed = 0;
    let failed = 0;

    if (testCases.length === 0) {
      return { results: [], summary: { passed: 0, failed: 0, total: 0 } };
    }

    const normalizeOutput = (str: string): string => {
      if (!str) return "";
      let res = str
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map(line => line.trimEnd())
        .join("\n")
        .trim();

      if (res.includes('[') && res.includes(']')) {
        res = res.replace(/,\s+/g, ',').replace(/\[\s+/g, '[').replace(/\s+\]/g, ']');
      }
      return res;
    };

    // Normalize a list-of-lists string for order-independent comparison.
    // Sorts each inner list's tokens, then sorts the outer list of inner list strings.
    const normalizeListOfLists = (str: string): string => {
      try {
        // Strip outer brackets
        const inner = str.trim().replace(/^\[|\]$/g, '');
        // Split into groups like ["eat","tea","ate"], ["bat"], etc.
        const groups: string[] = [];
        let depth = 0, cur = '';
        for (const ch of inner) {
          if (ch === '[') { depth++; cur += ch; }
          else if (ch === ']') { depth--; cur += ch; if (depth === 0) { groups.push(cur.trim()); cur = ''; } }
          else if (ch === ',' && depth === 0) { /* skip top-level comma */ }
          else { cur += ch; }
        }
        // Sort each group's inner tokens then sort groups
        const normalized = groups.map(g => {
          const tokens = g.replace(/^\[|\]$/g, '').split(',').map(t => t.trim()).sort();
          return '[' + tokens.join(',') + ']';
        }).sort();
        return '[' + normalized.join(',') + ']';
      } catch {
        return str;
      }
    };

    // Check if output looks like a list-of-lists (e.g. [["eat","tea"],["bat"]])
    const isListOfLists = (str: string): boolean => {
      const s = str.trim();
      return s.startsWith('[[') && s.endsWith(']]');
    };

    const compareUnordered = (a: string, b: string): boolean => {
      const aParts = a.split(/\s+/);
      const bParts = b.split(/\s+/);
      if (aParts.length !== bParts.length) return false;
      aParts.sort();
      bParts.sort();
      return aParts.every((v, i) => v === bParts[i]);
    };

    const canonicalizeTreeOutput = (s: string): string => {
      if (!s) return "";
      let clean = s.trim().replace(/^\[|\]$/g, '').replace(/,/g, ' ');
      clean = clean.replace(/\b(null|NULL|None|nil)\b/g, 'N');
      return clean.split(/\s+/).join(' ');
    };

    // Smart comparison: handles exact match, tree output normalization, unordered match, and list-of-lists
    const smartCompare = (actual: string, expected: string, orderIndependent: boolean): boolean => {
      if (actual === expected) return true;
      if (canonicalizeTreeOutput(actual) === canonicalizeTreeOutput(expected)) return true;
      if (orderIndependent) {
        if (compareUnordered(actual, expected)) return true;
      }
      // Auto-detect list-of-lists and compare order-independently
      if (isListOfLists(actual) && isListOfLists(expected)) {
        return normalizeListOfLists(actual) === normalizeListOfLists(expected);
      }
      return false;
    };

    // Codeforces-style execution: ALL code is treated as a full program with stdin/stdout.
    // No auto-wrapping — student writes complete program with main() and reads from stdin.
    const hasMain = true; // Always treat code as a complete program (Codeforces style)

    const hasDriver = !!(driverCode && driverCode[language] && driverCode[language].includes("{{userCode}}"));

    // Each test case runs individually (stdin = one test case input)
    const batchSize = 1;

    const chunks: TestCase[][] = [];
    for (let i = 0; i < testCases.length; i += batchSize) {
      chunks.push(testCases.slice(i, i + batchSize));
    }

    const executeChunk = async (chunk: TestCase[], chunkIdx: number): Promise<TestCaseResult[]> => {
      const chunkStartIdx = chunkIdx * batchSize;
      let wrappedCode = code;
      let runInput = "";

      // Codeforces-style execution:
      // 1. hasDriver (legacy): inject student code into driverCode template via {{userCode}},
      //    then pass test input via stdin. Kept for backward compatibility.
      const hasMain = /\bint\s+main\b|\bvoid\s+main\s*\(|\bstatic\s+void\s+main\s*\(|\bdef\s+main\s*\(|__main__/.test(code);

      if (hasDriver) {
        wrappedCode = driverCode[language].replace("{{userCode}}", code);
        runInput = chunk.map(tc => tc.input).join('\n');
      } else if (!hasMain && (language === "c" || language === "cpp" || language === "java" || language === "python" || language === "javascript")) {
        try {
          const testCase = chunk[0];
          const funcSig = this.extractFunctionSignature(code, language);
          const detectedFuncName = funcSig?.name || (code.match(/(?:struct\s+\w+\*?|\w+\*?)\s+(\w+)\s*\(/)?.[1]) || "solution";
          const paramCount = funcSig?.params?.length || (code.includes("root2") ? 2 : 1);

          const isTree = code.includes("TreeNode") || code.includes("root1") || code.includes("root2");
          const isList = code.includes("ListNode") || code.includes("head");

          const defaultType = isTree ? "TreeNode" : isList ? "ListNode" : "int";
          const inputNames = paramCount === 2 ? ["root1", "root2"] : ["root"];
          const inputTypes = paramCount === 2 ? [defaultType, defaultType] : [defaultType];

          const problemConfig = {
            functionName: detectedFuncName,
            className: "Solution",
            inputTypes: inputTypes,
            outputType: isTree ? "TreeNode" : isList ? "ListNode" : "int",
            inputNames: inputNames,
          };
          wrappedCode = wrapperGenerator.generateWrapper(code, language, testCase, problemConfig);
          runInput = "";
        } catch {
          wrappedCode = code;
          runInput = chunk.map(tc => tc.input).join('\n');
        }
      } else {
        // Codeforces style: full program with main(), raw stdin per test case
        wrappedCode = code;
        runInput = chunk.map(tc => tc.input).join('\n');
      }

      if (language === "java") {
        const imports: string[] = [];
        const cleaned = wrappedCode.replace(/^import\s+.*;\s*$/gm, (match) => {
          imports.push(match.trim());
          return '';
        });
        const uniqueImports = [...new Set(['import java.util.*;', ...imports])].join('\n');
        wrappedCode = uniqueImports + "\n\n" + cleaned;
      }

      const batchTimeout = Math.min(15000, 3000 + (chunk.length * 200));
      const startTime = Date.now();
      const result = await this.executeCode(wrappedCode, language, runInput, batchTimeout);
      const executionTimeTotal = Date.now() - startTime;

      console.log(`[DEBUG] Batch starting at ${chunkStartIdx}: success=${result.success}, error=${result.error}, time=${executionTimeTotal}ms`);


      // Codeforces style: entire stdout is the output for this test case (batchSize=1)
      const outputs: string[] = [result.output];
      const numCompleted = result.success ? chunk.length : 0;

      console.log(`[DEBUG] outputs.length=${outputs.length}, numCompleted=${numCompleted}`);

      const chunkResults: TestCaseResult[] = [];

      for (let i = 0; i < Math.min(numCompleted, chunk.length); i++) {
        const tcIdx = chunkStartIdx + i;
        const testCase = chunk[i];
        const rawOutput = outputs[i];
        
        const actualOutput = normalizeOutput(rawOutput);
        const expectedOutput = normalizeOutput(testCase.expectedOutput);
        
        const isPassed = smartCompare(actualOutput, expectedOutput, !!testCase.orderIndependent);

        const tcResult = {
          testCase: tcIdx + 1,
          passed: isPassed,
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          actualOutput: rawOutput,
          executionTime: Math.round(executionTimeTotal / Math.max(1, numCompleted)),
          memoryUsed: result.memoryUsed,
          error: result.error === "Compilation failed" ? (result.stderr || result.error) : (result.error || result.stderr),
        };

        chunkResults.push(tcResult);
        if (onProgress) {
          onProgress(tcResult);
        }
      }

      if (numCompleted < chunk.length) {
        const tleIdx = numCompleted;
        const testCase = chunk[tleIdx];
        const isCompilationFailed = result.error === "Compilation failed" || (result.stderr && result.stderr.includes("Compilation failed"));
        const isSystemError = !!result.error && result.error !== "Compilation failed";

        const tcResult = {
          testCase: chunkStartIdx + tleIdx + 1,
          passed: false,
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          actualOutput: "",
          executionTime: batchTimeout,
          memoryUsed: result.memoryUsed,
          error: isCompilationFailed 
            ? (result.stderr || "Compilation failed") 
            : isSystemError
              ? (result.error || result.stderr || "System / API Execution Error")
              : (result.stderr || "Time Limit Exceeded or Runtime Crash"),
        };

        chunkResults.push(tcResult);
        if (onProgress) {
          onProgress(tcResult);
        }

        for (let i = tleIdx + 1; i < chunk.length; i++) {
          const tcResultRest = {
            testCase: chunkStartIdx + i + 1,
            passed: false,
            input: chunk[i].input,
            expectedOutput: chunk[i].expectedOutput,
            actualOutput: "",
            executionTime: 0,
            error: isCompilationFailed 
              ? (result.stderr || "Compilation failed") 
              : isSystemError
                ? (result.error || result.stderr || "System / API Execution Error")
                : (result.stderr || "Skipped due to previous error"),
          };
          chunkResults.push(tcResultRest);
          if (onProgress) {
            onProgress(tcResultRest);
          }
        }
      }

      return chunkResults;
    };

    const tasks = chunks.map((chunk, chunkIdx) => () => executeChunk(chunk, chunkIdx));
    const concurrencyLimit = 3;
    const results2D = await this.parallelLimit(tasks, concurrencyLimit);
    const flatResults = results2D.flat();

    for (const r of flatResults) {
      if (r.passed) passed++;
      else failed++;
    }

    return { results: flatResults, summary: { passed, failed, total: testCases.length } };
  }

  async formatCode(code: string, language: string): Promise<{ success: boolean; formatted: string; error?: string }> {
    const config = this.LANGUAGE_CONFIGS[language];
    if (!config || !config.format) {
      return { success: false, formatted: code, error: "Formatter not available for this language" };
    }

    const sessionDir = this.createSessionDir();
    try {
      const mainFile = config.mainFile || `main.${config.extension}`;
      const filePath = path.join(sessionDir, mainFile);
      fs.writeFileSync(filePath, code);

      const cmd = config.format;
      const lastArg = cmd[cmd.length - 1];
      const isStdinFormatter = lastArg === "-" || cmd.some(a => a.startsWith("--stdin"));

      if (isStdinFormatter) {
        const formatResult = await this.execPromise(cmd, { cwd: sessionDir, timeout: 5000, input: code });
        return { success: formatResult.exitCode === 0, formatted: formatResult.stdout || code, error: formatResult.exitCode !== 0 ? formatResult.stderr : undefined };
      }

      const formatResult = await this.execPromise(cmd, { cwd: sessionDir, timeout: 5000 });
      const formattedCode = fs.readFileSync(filePath, "utf-8");

      return { success: formatResult.exitCode === 0, formatted: formattedCode, error: formatResult.exitCode !== 0 ? formatResult.stderr : undefined };
    } catch (error: any) {
      return { success: false, formatted: code, error: error.message };
    } finally {
      this.cleanupSessionDir(sessionDir);
    }
  }

  async lintCode(code: string, language: string): Promise<{ success: boolean; errors: any[]; formatted: string }> {
    const config = this.LANGUAGE_CONFIGS[language];
    if (!config || !config.lint) {
      return { success: true, errors: [], formatted: code };
    }

    const sessionDir = this.createSessionDir();
    try {
      const mainFile = config.mainFile || `main.${config.extension}`;
      const filePath = path.join(sessionDir, mainFile);
      fs.writeFileSync(filePath, code);

      const cmd = config.lint;
      const lastArg = cmd[cmd.length - 1];
      const isStdinLinter = lastArg === "-" || cmd.some(a => a === "--stdin");

      let lintResult;
      if (isStdinLinter) {
        lintResult = await this.execPromise(cmd, { cwd: sessionDir, timeout: 10000, input: code });
      } else {
        lintResult = await this.execPromise(cmd, { cwd: sessionDir, timeout: 10000 });
      }

      const errors = this.parseLintOutput(lintResult, language);

      return { success: lintResult.exitCode <= 1, errors, formatted: code };
    } catch (error: any) {
      return { success: false, errors: [{ line: 1, column: 1, message: error.message, severity: "error" }], formatted: code };
    } finally {
      this.cleanupSessionDir(sessionDir);
    }
  }

  private parseLintOutput(result: { stdout: string; stderr: string; exitCode: number }, language: string): any[] {
    const errors: any[] = [];
    const output = result.stderr || result.stdout;

    if (!output) return errors;

    if (language === "javascript" || language === "typescript") {
      try {
        const json = JSON.parse(result.stdout);
        if (Array.isArray(json)) {
          for (const msg of json) {
            errors.push({
              line: msg.line || 1,
              column: msg.column || 1,
              message: msg.message || msg.text || "Lint error",
              severity: msg.severity === 2 ? "error" : "warning",
            });
          }
        }
        if (errors.length > 0) return errors;
      } catch {}
    }

    if (language === "python") {
      const regex = /(\d+):(\d+):\s*([EW]):\s*(.+)/g;
      let match;
      while ((match = regex.exec(output)) !== null) {
        errors.push({ line: parseInt(match[1]), column: parseInt(match[2]), message: match[4], severity: match[3] === "E" ? "error" : "warning" });
      }
    } else if (language === "cpp" || language === "c") {
      const regex = /(\d+):(\d+):\s*(error|warning):\s*(.+)/g;
      let match;
      while ((match = regex.exec(output)) !== null) {
        errors.push({ line: parseInt(match[1]), column: parseInt(match[2]), message: match[4], severity: match[3] === "error" ? "error" : "warning" });
      }
    }

    return errors;
  }

  getSupportedLanguages(): string[] {
    return Object.keys(this.LANGUAGE_CONFIGS);
  }

  getLanguageConfig(language: string): LanguageConfig | undefined {
    return this.LANGUAGE_CONFIGS[language];
  }

  getLanguageAvailability(): Record<string, boolean> {
    return Object.fromEntries(this.availableLanguages);
  }

  private async parallelLimit<T>(
    tasks: (() => Promise<T>)[],
    limit: number
  ): Promise<T[]> {
    const results: T[] = [];
    const promises: Promise<void>[] = [];
    let index = 0;

    const execute = async () => {
      while (index < tasks.length) {
        const currentIndex = index++;
        const task = tasks[currentIndex];
        results[currentIndex] = await task();
      }
    };

    for (let i = 0; i < Math.min(limit, tasks.length); i++) {
      promises.push(execute());
    }

    await Promise.all(promises);
    return results;
  }
}

const defaultLanguageAdapter = new LanguageAdapter();

export async function evaluateCodeSubmission(params: {
  problemId: string;
  code: string;
  language: string;
  testCases: Array<{ id: string; input: string; expectedOutput: string; isHidden?: boolean }>;
  referenceSolution?: string | null;
  onProgress?: (result: TestCaseResult) => void;
}) {
  const { code, language, testCases = [], onProgress } = params;

  if (!testCases || testCases.length === 0) {
    return {
      status: 'ACCEPTED',
      score: 100,
      executionTime: 0,
      memoryUsed: 0,
      testResults: [],
      passedCount: 0,
      totalCount: 0,
    };
  }

  const formattedTestCases: TestCase[] = testCases.map((tc) => ({
    input: tc.input || '',
    expectedOutput: tc.expectedOutput || '',
    isHidden: tc.isHidden || false,
  }));

  const testSuiteResult = await defaultLanguageAdapter.runTestCases(
    code,
    language,
    formattedTestCases,
    5000,
    null,
    onProgress
  );

  const passedCount = testSuiteResult.summary.passed;
  const totalCount = testSuiteResult.summary.total;

  let overallStatus = 'ACCEPTED';
  let maxExecutionTime = 0;

  for (const r of testSuiteResult.results) {
    maxExecutionTime = Math.max(maxExecutionTime, r.executionTime || 0);
  }

  const firstFailed = testSuiteResult.results.find((r) => !r.passed);
  if (firstFailed) {
    const errText = (firstFailed.error || '').toLowerCase();
    if (errText.includes('compilation failed') || errText.includes('javac') || errText.includes('g++') || errText.includes('syntaxerror')) {
      overallStatus = 'COMPILATION_ERROR';
    } else if (errText.includes('time limit exceeded')) {
      overallStatus = 'TIME_LIMIT_EXCEEDED';
    } else if (errText.includes('memory limit exceeded')) {
      overallStatus = 'MEMORY_LIMIT_EXCEEDED';
    } else if (errText.includes('exit code') || errText.includes('exception') || errText.includes('error')) {
      overallStatus = 'RUNTIME_ERROR';
    } else {
      overallStatus = 'WRONG_ANSWER';
    }
  }

  const score = totalCount > 0 ? Math.floor((passedCount / totalCount) * 100) : 0;

  return {
    status: overallStatus,
    score,
    executionTime: maxExecutionTime,
    memoryUsed: 512,
    testResults: testSuiteResult.results,
    passedCount,
    totalCount,
  };
}

export default LanguageAdapter;
