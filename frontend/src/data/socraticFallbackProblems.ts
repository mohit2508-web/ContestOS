export const SOCRATIC_FALLBACK_PROBLEMS = [
  {
    id: 'lcm_of_two_trees',
    title: '01. LCM of Two Binary Trees',
    category: 'Trees',
    difficulty: 'Medium',
    description: `### Problem Statement

A binary tree is represented by the following structure:
\`\`\`c
struct TreeNode
{
    int data;
    struct TreeNode* left;
    struct TreeNode* right;
};
\`\`\`

Implement the following function:
\`\`\`c
struct TreeNode* LCMOfTrees(struct TreeNode* root1, struct TreeNode* root2);
\`\`\`

**LCM of 2 integers** is the smallest positive integer that is exactly divisible by both integers.

The function accepts the root node of two binary trees \`root1\` and \`root2\` as its argument. Implement the function to return a tree which is LCM of both the trees. Each node value of output tree is equal to LCM of data values of nodes on that same position in the input trees.

#### Note:
- Return \`null\` if both trees are null.
- While calculating LCM, if one of the node is null use the data value of the other node.
- Do not use extra memory.

---

### Example

#### Input:
\`\`\`text
root1:
      2
     / \\
    3   5
       / \\
      1   7

root2:
      5
     / \\
    6   3
       / \\
      2   8
\`\`\`

#### Explanation (LCM of corresponding nodes):
- \`(2,5) = 10\`
- \`(3,6) = 6\`
- \`(5,3) = 15\`
- \`(1,2) = 2\`
- \`(7,8) = 56\`

#### Sample Output:
\`\`\`text
      10
     /  \\
    6    15
        /  \\
       2    56
\`\`\`

---

### Instructions:
- This is a template based question, **DO NOT write the \`main\` function**.
- Your code is judged by an automated system, do not write any additional welcome/greeting messages.
- "Save and Test" only checks for basic test cases, more rigorous cases will be used to judge your code while scoring.`,
    starterCode: {
      c: `// Use the Socratic AI Assistant on the right to discuss your approach and generate your starter code!`,
      cpp: `// Use the Socratic AI Assistant on the right to discuss your approach and generate your starter code!`,
      java: `// Use the Socratic AI Assistant on the right to discuss your approach and generate your starter code!`,
      python: `# Use the Socratic AI Assistant on the right to discuss your approach and generate your starter code!`,
      javascript: `// Use the Socratic AI Assistant on the right to discuss your approach and generate your starter code!`
    },
    testCases: [
      { id: 1, name: 'Sample #1: Overlapping Trees', input: 'root1: [2, 3, 5, null, null, 1, 7]\nroot2: [5, 6, 3, null, null, 2, 8]', expectedOutput: '[10, 6, 15, null, null, 2, 56]', isHidden: false },
      { id: 2, name: 'Sample #2: One Empty Tree', input: 'root1: [4, 2, 8]\nroot2: []', expectedOutput: '[4, 2, 8]', isHidden: false },
      { id: 3, name: 'Sample #3: Single Node Pair', input: 'root1: [12]\nroot2: [18]', expectedOutput: '[36]', isHidden: false },
      { id: 4, name: 'Hidden #1: Disjoint Subtrees', input: 'root1: [1, 2, null]\nroot2: [1, null, 3]', expectedOutput: '[1, 2, 3]', isHidden: true },
      { id: 5, name: 'Hidden #2: Zero Node Value', input: 'root1: [0, 5]\nroot2: [4, 0]', expectedOutput: '[0, 0]', isHidden: true },
      { id: 6, name: 'Hidden #3: Skewed Tree Left', input: 'root1: [1, 2, null, 3]\nroot2: [4, 5, null, 6]', expectedOutput: '[4, 10, null, 6]', isHidden: true },
      { id: 7, name: 'Hidden #4: Large Primes', input: 'root1: [17, 19]\nroot2: [23, 29]', expectedOutput: '[391, 551]', isHidden: true },
      { id: 8, name: 'Hidden #5: Identical Value Trees', input: 'root1: [6, 6, 6]\nroot2: [6, 6, 6]', expectedOutput: '[6, 6, 6]', isHidden: true },
      { id: 9, name: 'Hidden #6: Deep Asymmetric Depth', input: 'root1: [2, 4, 6, 8, 10]\nroot2: [3, 9, 27]', expectedOutput: '[6, 36, 54, 8, 10]', isHidden: true },
      { id: 10, name: 'Hidden #7: Large Max Values', input: 'root1: [1000, 2000]\nroot2: [1500, 2500]', expectedOutput: '[3000, 10000]', isHidden: true }
    ]
  }
];
