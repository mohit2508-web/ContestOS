export function generateStarterCode(language: string, functionName = 'solve', returnType = 'void', params: Array<{ name: string; type: string }> = []): string {
  const lang = language.toLowerCase();
  
  if (lang === 'java') {
    return `import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws IOException {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        // Write your solution here\n    }\n}`;
  }
  
  if (lang === 'cpp' || lang === 'c++') {
    return `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    // Write your solution here\n    return 0;\n}`;
  }

  if (lang === 'python' || lang === 'python3') {
    return `import sys\ninput = sys.stdin.readline\n\ndef main():\n    # Write your solution here\n    pass\n\nif __name__ == '__main__':\n    main()`;
  }

  if (lang === 'javascript' || lang === 'js') {
    return `const fs = require('fs');\nconst input = fs.readFileSync(0, 'utf-8').trim();\n\n// Write your solution here`;
  }

  return `// Write your solution for ${language} here`;
}

export function generateDriverCode(language: string, functionName = 'solve', returnType = 'void', params: Array<{ name: string; type: string }> = []): string {
  return generateStarterCode(language, functionName, returnType, params);
}
