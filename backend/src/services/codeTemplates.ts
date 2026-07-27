// Codeforces-style full stdin/stdout program templates.
// Students write complete programs that read from stdin and print to stdout.
// No auto-wrapping; judge runs: compile + execute with stdin = test input.

export interface CodeTemplate {
  language: string;
  name: string;
  defaultCode: string;
}

// Primary templates used as default starter code for new problems.
// These are Codeforces-style: complete programs with main() + stdin/stdout.
export const CODE_TEMPLATES: Record<string, CodeTemplate> = {
  java: {
    language: "java",
    name: "Java",
    defaultCode: `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        // int t = Integer.parseInt(br.readLine().trim());
        
        // TODO: Read input and write your solution
        int n = Integer.parseInt(br.readLine().trim());
        int[] arr = Arrays.stream(br.readLine().trim().split(" "))
                          .mapToInt(Integer::parseInt).toArray();
        
        // Your logic here
        System.out.println(0);
    }
}`
  },

  cpp: {
    language: "cpp",
    name: "C++",
    defaultCode: `#include <bits/stdc++.h>
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
}`
  },

  python: {
    language: "python",
    name: "Python",
    defaultCode: `import sys
input = sys.stdin.readline

def solve():
    n = int(input())
    arr = list(map(int, input().split()))
    
    # TODO: Your solution here
    print(0)

t = int(input())
for _ in range(t):
    solve()`
  },

  javascript: {
    language: "javascript",
    name: "JavaScript",
    defaultCode: `const lines = require('fs').readFileSync(0, 'utf8').trim().split('\\n');
let idx = 0;

const t = parseInt(lines[idx++]);
const results = [];

for (let i = 0; i < t; i++) {
    const n = parseInt(lines[idx++]);
    const arr = lines[idx++].split(' ').map(Number);
    
    // TODO: Your solution here
    results.push(0);
}

console.log(results.join('\\n'));`
  },

  typescript: {
    language: "typescript",
    name: "TypeScript",
    defaultCode: `import * as fs from 'fs';

const lines = fs.readFileSync('/dev/stdin', 'utf8').trim().split('\\n');
let idx = 0;

const t = parseInt(lines[idx++]);
const results: number[] = [];

for (let i = 0; i < t; i++) {
    const n = parseInt(lines[idx++]);
    const arr = lines[idx++].split(' ').map(Number);
    
    // TODO: Your solution here
    results.push(0);
}

console.log(results.join('\\n'));`
  },

  c: {
    language: "c",
    name: "C",
    defaultCode: `#include <stdio.h>
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
}`
  },

  go: {
    language: "go",
    name: "Go",
    defaultCode: `package main

import (
    "bufio"
    "fmt"
    "os"
)

var reader *bufio.Reader
var writer *bufio.Writer

func solve() {
    var n int
    fmt.Fscan(reader, &n)
    arr := make([]int, n)
    for i := range arr {
        fmt.Fscan(reader, &arr[i])
    }
    
    // TODO: Your solution here
    fmt.Fprintln(writer, 0)
}

func main() {
    reader = bufio.NewReader(os.Stdin)
    writer = bufio.NewWriter(os.Stdout)
    defer writer.Flush()
    
    var t int
    fmt.Fscan(reader, &t)
    for ; t > 0; t-- {
        solve()
    }
}`
  },

  rust: {
    language: "rust",
    name: "Rust",
    defaultCode: `use std::io::{self, BufRead, Write, BufWriter};

fn solve(line: &str) -> String {
    let nums: Vec<i64> = line.split_whitespace()
        .map(|x| x.parse().unwrap())
        .collect();
    
    // TODO: Your solution here
    format!("{}", 0)
}

fn main() {
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut out = BufWriter::new(stdout.lock());
    
    let mut lines = stdin.lock().lines();
    let t: usize = lines.next().unwrap().unwrap().trim().parse().unwrap();
    
    for _ in 0..t {
        let line = lines.next().unwrap().unwrap();
        writeln!(out, "{}", solve(&line)).unwrap();
    }
}`
  },

  csharp: {
    language: "csharp",
    name: "C#",
    defaultCode: `using System;
using System.IO;

class Program {
    static void Solve() {
        int n = int.Parse(Console.ReadLine().Trim());
        int[] arr = Array.ConvertAll(Console.ReadLine().Trim().Split(), int.Parse);
        
        // TODO: Your solution here
        Console.WriteLine(0);
    }
    
    static void Main() {
        int t = int.Parse(Console.ReadLine().Trim());
        while (t-- > 0) Solve();
    }
}`
  },

  kotlin: {
    language: "kotlin",
    name: "Kotlin",
    defaultCode: "import java.io.BufferedReader\n" +
      "import java.io.InputStreamReader\n" +
      "import java.util.StringTokenizer\n\n" +
      "fun main() {\n" +
      "    val br = BufferedReader(InputStreamReader(System.`in`))\n" +
      "    val t = br.readLine().trim().toInt()\n" +
      "    val sb = StringBuilder()\n\n" +
      "    repeat(t) {\n" +
      "        val n = br.readLine().trim().toInt()\n" +
      "        val arr = StringTokenizer(br.readLine()).run {\n" +
      "            IntArray(n) { nextToken().toInt() }\n" +
      "        }\n\n" +
      "        // TODO: Your solution here\n" +
      "        sb.appendLine(0)\n" +
      "    }\n" +
      "    print(sb)\n" +
      "}"
  },


  php: {
    language: "php",
    name: "PHP",
    defaultCode: `<?php
function solve($arr) {
    // TODO: Your solution here
    return 0;
}

$t = intval(fgets(STDIN));
for ($i = 0; $i < $t; $i++) {
    $n = intval(fgets(STDIN));
    $arr = array_map('intval', explode(' ', trim(fgets(STDIN))));
    echo solve($arr) . "\\n";
}
?>`
  },

  ruby: {
    language: "ruby",
    name: "Ruby",
    defaultCode: `t = gets.to_i
t.times do
  n = gets.to_i
  arr = gets.split.map(&:to_i)
  
  # TODO: Your solution here
  puts 0
end`
  }
};

// Code template manager — simplified for Codeforces mode
export class CodeTemplateManager {

  getTemplate(language: string): CodeTemplate | undefined {
    return CODE_TEMPLATES[language.toLowerCase()];
  }

  // Returns the default full-program starter code for a language
  getDefaultCode(language: string): string {
    return CODE_TEMPLATES[language.toLowerCase()]?.defaultCode || "";
  }

  getSupportedLanguages(): string[] {
    return Object.keys(CODE_TEMPLATES);
  }

  // Kept for backward compat — returns full default code
  getStandardIoTemplate(language: string): string {
    return this.getDefaultCode(language);
  }

  // Legacy method: extracts user code from old marker-based templates.
  // Not used in Codeforces mode (students write full programs).
  extractUserCode(code: string, _language: string): string {
    const startMarker = "// ===== USER CODE START =====";
    const endMarker = "// ===== USER CODE END =====";
    const startIdx = code.indexOf(startMarker);
    const endIdx = code.indexOf(endMarker);
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      return code.substring(startIdx + startMarker.length, endIdx).trim();
    }
    return code;
  }

  // Legacy: assemble prefix+user+suffix. Not used in Codeforces mode.
  assembleCode(userCode: string, language: string): string {
    return userCode; // In Codeforces mode, user writes the complete program
  }

  getUserFunctionSignature(_language: string): string {
    return ""; // Not applicable in Codeforces (full program) mode
  }
}

export default new CodeTemplateManager();