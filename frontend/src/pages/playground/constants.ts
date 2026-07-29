export const SQL_FREE_SCHEMA = `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (name, email) VALUES
  ('Alice Johnson', 'alice@example.com'),
  ('Bob Smith', 'bob@example.com'),
  ('Charlie Brown', 'charlie@example.com');

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  product VARCHAR(200) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  ordered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO orders (user_id, product, amount, status) VALUES
  (1, 'Laptop', 1200.00, 'shipped'),
  (1, 'Mouse', 25.50, 'delivered'),
  (2, 'Keyboard', 89.99, 'pending'),
  (3, 'Monitor', 350.00, 'shipped'),
  (2, 'Headphones', 150.00, 'delivered');`;

export const DEFAULT_CODE: Record<string, string> = {
  java: `import java.io.*;
import java.util.*;

class Solution {
    public void solve() {
        // Write your solution here
    }
}
`,
  python: `# Write your Python code here
class Solution:
    def solve(self):
        # Your solution
        pass
`,
  cpp: `#include <iostream>
#include <vector>
#include <string>
using namespace std;

class Solution {
public:
    void solve() {
        // Write your solution here
    }
};
`,
  javascript: `// Write your JavaScript code here
class Solution {
    solve() {
        // Your solution
    }
}
`,
  typescript: `// Write your TypeScript code here
class Solution {
    solve() {
        // Your solution
    }
}
`,
  c: `#include <stdio.h>

int main() {
    // Your solution
    return 0;
}
`,
  go: `package main

import "fmt"

func main() {
    // Your solution
    fmt.Println("Hello from Go!")
}
`,
  rust: `fn main() {
    // Your solution
    println!("Hello from Rust!");
}
`,
  ruby: `# Write your Ruby code here
def solve()
    # Your solution
end
`,
  csharp: `using System;

class Program {
    static void Main() {
        // Your solution
        Console.WriteLine("Hello from C#!");
    }
}
`,
  php: `<?php
// Write your PHP code here
echo "Hello from PHP!\\n";
`,
  swift: `// Write your Swift code here
print("Hello from Swift!")
`,
  kotlin: `fun main() {
    // Your solution
    println("Hello from Kotlin!")
}
`,
  scala: `@main def main =
    println("Hello from Scala!")
`,
  dart: `void main() {
    // Your solution
    print("Hello from Dart!");
  }
`,
  sql: `-- Write your SQL query here`,
  haskell: `-- Write your Haskell code here
main :: IO ()
main = do
    putStrLn "Hello from Haskell!"
`,
  perl: `#!/usr/bin/perl
use strict;
use warnings;
# Write your Perl code here
print "Hello from Perl!\\n";
`,
  r: `# Write your R code here
cat("Hello from R!\\n")
`,
  bash: `#!/bin/bash
# Write your Bash script here
echo "Hello from Bash!"
`,
  lua: `-- Write your Lua code here
print("Hello from Lua!")
`,
};

export const FREE_MODE_DEFAULT = `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Web Page</title>

    <style>
        /* Reset */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: grey;
        }

        .container {
            text-align: center;
            color: white;
        }

        h1 {
            margin-bottom: 10px;
        }

        button {
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            background: white;
            color: #333;
            cursor: pointer;
            font-weight: bold;
        }

        button:hover {
            background: #ddd;
        }
    </style>
</head>

<body>
    <div class="container">
        <h1>Hello, World!</h1>
        <button onclick="sayHello()">Click Me</button>
    </div>

    <script>
        function sayHello() {
            console.log("Button clicked!");
        }
    </script>
</body>

</html>`;

export const LANGUAGE_CONFIG = [
  { value: "java", label: "Java", extension: "java", downloadUrl: "https://www.oracle.com/java/technologies/downloads/" },
  { value: "python", label: "Python", extension: "python", downloadUrl: "https://www.python.org/downloads/" },
  { value: "cpp", label: "C++", extension: "cpp", downloadUrl: "https://www.msys2.org/" },
  { value: "javascript", label: "JavaScript", extension: "javascript", downloadUrl: "https://nodejs.org/" },
  { value: "typescript", label: "TypeScript", extension: "typescript", downloadUrl: "https://nodejs.org/" },
  { value: "c", label: "C", extension: "c", downloadUrl: "https://www.msys2.org/" },
  { value: "go", label: "Go", extension: "go", downloadUrl: "https://go.dev/dl/" },
  { value: "rust", label: "Rust", extension: "rust", downloadUrl: "https://rustup.rs/" },
  { value: "ruby", label: "Ruby", extension: "ruby", downloadUrl: "https://www.ruby-lang.org/" },
  { value: "csharp", label: "C#", extension: "csharp", downloadUrl: "https://dotnet.microsoft.com/download" },
  { value: "php", label: "PHP", extension: "php", downloadUrl: "https://www.php.net/downloads" },
  { value: "swift", label: "Swift", extension: "swift", downloadUrl: "https://www.swift.org/download/" },
  { value: "kotlin", label: "Kotlin", extension: "kotlin", downloadUrl: "https://kotlinlang.org/docs/command-line.html" },
  { value: "scala", label: "Scala", extension: "scala", downloadUrl: "https://scala-cli.virtuslab.org/install" },
  { value: "dart", label: "Dart", extension: "dart", downloadUrl: "https://dart.dev/get-dart" },
  { value: "haskell", label: "Haskell", extension: "haskell", downloadUrl: "https://www.haskell.org/ghcup/" },
  { value: "perl", label: "Perl", extension: "perl", downloadUrl: "https://www.perl.org/get.html" },
  { value: "r", label: "R", extension: "r", downloadUrl: "https://cran.r-project.org/" },
  { value: "bash", label: "Bash", extension: "sh", downloadUrl: "" },
  { value: "lua", label: "Lua", extension: "lua", downloadUrl: "https://www.lua.org/download/" },
  { value: "sql", label: "SQL", extension: "sql", downloadUrl: "" },
];
