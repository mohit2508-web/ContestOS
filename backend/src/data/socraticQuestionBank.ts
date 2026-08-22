export interface SocraticTestCase {
  id: number;
  name: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

export interface SocraticConcept {
  id: string;
  triggers: string[];
}

export interface SocraticStageConfig {
  minConceptsRequired: number;
  concepts: SocraticConcept[];
}

export interface SocraticProblem {
  id: string;
  title: string;
  category: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  problemType: 'code' | 'vibe-code' | 'sql';
  description: string;
  starterCode: Record<string, string>;
  referenceSolution: string;
  solutionByLanguage: Record<string, string>;
  starterCodeByLanguage: Record<string, string>;
  functionSignatureByLanguage: Record<string, string>;
  testCases: SocraticTestCase[];
  socraticConfig: {
    PROBLEM: SocraticStageConfig;
    DATA_STRUCTURE: SocraticStageConfig;
    APPROACH: SocraticStageConfig;
  };
}

const description = `### Problem Statement

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

### Instructions:
- This is a template based question, **DO NOT write the \`main\` function**.
- Your code is judged by an automated system, do not write any additional welcome/greeting messages.
- "Save and Test" only checks for basic test cases, more rigorous cases will be used to judge your code while scoring.`;

const starterCodeByLanguage: Record<string, string> = {
  c: `struct TreeNode {
    int data;
    int val;
    struct TreeNode* left;
    struct TreeNode* right;
};

// Helper function to calculate GCD of two numbers
long long gcd(long long a, long long b) {
    while (b) {
        long long temp = b;
        b = a % b;
        a = temp;
    }
    return a;
}

// Helper function to calculate LCM of two numbers
long long lcm(long long a, long long b) {
    if (a == 0 || b == 0) return 0;
    return (a / gcd(a, b)) * b;
}

struct TreeNode* LCMOfTrees(struct TreeNode* root1, struct TreeNode* root2) {
    // Base Case 1: If both trees are NULL, return NULL
    if (!root1 && !root2) return NULL;
    
    // Base Case 2: If one tree is NULL, return the other tree node
    if (!root1) return root2;
    if (!root2) return root1;

    // TODO: 1. Calculate the LCM of node data values
    // TODO: 2. Update root1->data and root1->val in-place
    // TODO: 3. Recursively call LCMOfTrees for root1->left and root2->left
    // TODO: 4. Recursively call LCMOfTrees for root1->right and root2->right
    // TODO: 5. Return root1

    return root1;
}`,

  cpp: `#include <iostream>
using namespace std;

struct TreeNode {
    int data;
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode(int x) : data(x), val(x), left(nullptr), right(nullptr) {}
};

class Solution {
public:
    long long gcd(long long a, long long b) {
        while (b) {
            long long t = b;
            b = a % b;
            a = t;
        }
        return a;
    }

    long long lcm(long long a, long long b) {
        if (a == 0 || b == 0) return 0;
        return (a / gcd(a, b)) * b;
    }

    TreeNode* LCMOfTrees(TreeNode* root1, TreeNode* root2) {
        if (!root1 && !root2) return nullptr;
        if (!root1) return root2;
        if (!root2) return root1;

        // TODO: 1. Calculate LCM of node data values using helper
        // TODO: 2. Update root1->data and root1->val in-place
        // TODO: 3. Recurse on left and right subtrees
        // TODO: 4. Return root1

        return root1;
    }
};`,

  java: `class TreeNode {
    int data;
    int val;
    TreeNode left;
    TreeNode right;
    TreeNode(int x) { this.data = x; this.val = x; }
}

public class Solution {
    private long gcd(long a, long b) {
        while (b != 0) {
            long t = b;
            b = a % b;
            a = t;
        }
        return a;
    }

    private long lcm(long a, long b) {
        if (a == 0 || b == 0) return 0;
        return (a / gcd(a, b)) * b;
    }

    public TreeNode LCMOfTrees(TreeNode root1, TreeNode root2) {
        if (root1 == null && root2 == null) return null;
        if (root1 == null) return root2;
        if (root2 == null) return root1;

        // TODO: 1. Calculate LCM of node data values using helper
        // TODO: 2. Update root1.data and root1.val in-place
        // TODO: 3. Recurse on left and right subtrees
        // TODO: 4. Return root1

        return root1;
    }
}`,

  python: `class TreeNode:
    def __init__(self, data=0, val=None, left=None, right=None):
        self.data = data
        self.val = val if val is not None else data
        self.left = left
        self.right = right

class Solution:
    def _gcd(self, a: int, b: int) -> int:
        while b:
            a, b = b, a % b
        return a

    def _lcm(self, a: int, b: int) -> int:
        if a == 0 or b == 0:
            return 0
        return (a // self._gcd(a, b)) * b

    def LCMOfTrees(self, root1: 'TreeNode', root2: 'TreeNode') -> 'TreeNode':
        if root1 is None and root2 is None:
            return None
        if root1 is None:
            return root2
        if root2 is None:
            return root1

        # TODO: 1. Calculate LCM of node data values
        # TODO: 2. Update root1.data and root1.val in-place
        # TODO: 3. Recurse on left and right subtrees
        # TODO: 4. Return root1
        return root1`,

  javascript: `function TreeNode(data, left, right) {
    this.data = (data === undefined ? 0 : data);
    this.val = (data === undefined ? 0 : data);
    this.left = (left === undefined ? null : left);
    this.right = (right === undefined ? null : right);
}

function gcd(a, b) {
    while (b) {
        const t = b;
        b = a % b;
        a = t;
    }
    return a;
}

function lcm(a, b) {
    if (a === 0 || b === 0) return 0;
    return (a / gcd(a, b)) * b;
}

function LCMOfTrees(root1, root2) {
    if (!root1 && !root2) return null;
    if (!root1) return root2;
    if (!root2) return root1;

    // TODO: 1. Calculate LCM of node data values
    // TODO: 2. Update root1.data and root1.val in-place
    // TODO: 3. Recurse on left and right subtrees
    // TODO: 4. Return root1

    return root1;
}`
};

const referenceSolution = `// C Reference Solution for LCM of Two Binary Trees
long long gcd(long long a, long long b) {
    while (b) {
        long long temp = b;
        b = a % b;
        a = temp;
    }
    return a;
}

long long lcm(long long a, long long b) {
    if (a == 0 || b == 0) return 0;
    return (a / gcd(a, b)) * b;
}

struct TreeNode* LCMOfTrees(struct TreeNode* root1, struct TreeNode* root2) {
    if (!root1 && !root2) return NULL;
    if (!root1) return root2;
    if (!root2) return root1;

    int v1 = root1->data ? root1->data : root1->val;
    int v2 = root2->data ? root2->data : root2->val;
    int res = (int)lcm((long long)v1, (long long)v2);
    root1->data = res;
    root1->val = res;

    root1->left = LCMOfTrees(root1->left, root2->left);
    root1->right = LCMOfTrees(root1->right, root2->right);
    return root1;
}`;

const solutionByLanguage: Record<string, string> = {
  c: referenceSolution,

  cpp: `#include <iostream>
using namespace std;

struct TreeNode {
    int data;
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode(int x) : data(x), val(x), left(nullptr), right(nullptr) {}
};

class Solution {
public:
    long long gcdLL(long long a, long long b) {
        while (b) {
            long long t = b;
            b = a % b;
            a = t;
        }
        return a;
    }

    long long lcmLL(long long a, long long b) {
        if (a == 0 || b == 0) return 0;
        return (a / gcdLL(a, b)) * b;
    }

    TreeNode* LCMOfTrees(TreeNode* root1, TreeNode* root2) {
        if (!root1 && !root2) return nullptr;
        if (!root1) return root2;
        if (!root2) return root1;

        int v1 = root1->data ? root1->data : root1->val;
        int v2 = root2->data ? root2->data : root2->val;
        int res = (int)lcmLL((long long)v1, (long long)v2);
        root1->data = res;
        root1->val = res;

        root1->left = LCMOfTrees(root1->left, root2->left);
        root1->right = LCMOfTrees(root1->right, root2->right);
        return root1;
    }
};`,

  java: `class TreeNode {
    int data;
    int val;
    TreeNode left;
    TreeNode right;
    TreeNode(int x) { this.data = x; this.val = x; }
}

public class Solution {
    private long gcd(long a, long b) {
        while (b != 0) {
            long t = b;
            b = a % b;
            a = t;
        }
        return a;
    }

    private long lcm(long a, long b) {
        if (a == 0 || b == 0) return 0;
        return (a / gcd(a, b)) * b;
    }

    public TreeNode LCMOfTrees(TreeNode root1, TreeNode root2) {
        if (root1 == null && root2 == null) return null;
        if (root1 == null) return root2;
        if (root2 == null) return root1;

        int v1 = root1.data != 0 ? root1.data : root1.val;
        int v2 = root2.data != 0 ? root2.data : root2.val;
        int res = (int) lcm((long) v1, (long) v2);
        root1.data = res;
        root1.val = res;

        root1.left = LCMOfTrees(root1.left, root2.left);
        root1.right = LCMOfTrees(root1.right, root2.right);
        return root1;
    }
}`,

  python: `class TreeNode:
    def __init__(self, data=0, val=None, left=None, right=None):
        self.data = data
        self.val = val if val is not None else data
        self.left = left
        self.right = right

class Solution:
    def _gcd(self, a: int, b: int) -> int:
        while b:
            a, b = b, a % b
        return a

    def _lcm(self, a: int, b: int) -> int:
        if a == 0 or b == 0:
            return 0
        return (a // self._gcd(a, b)) * b

    def LCMOfTrees(self, root1: 'TreeNode', root2: 'TreeNode') -> 'TreeNode':
        if root1 is None and root2 is None:
            return None
        if root1 is None:
            return root2
        if root2 is None:
            return root1

        v1 = root1.data if root1.data != 0 else root1.val
        v2 = root2.data if root2.data != 0 else root2.val
        res = self._lcm(v1, v2)

        root1.data = res
        root1.val = res

        root1.left = self.LCMOfTrees(root1.left, root2.left)
        root1.right = self.LCMOfTrees(root1.right, root2.right)
        return root1`,

  javascript: `function TreeNode(data, left, right) {
    this.data = (data === undefined ? 0 : data);
    this.val = (data === undefined ? 0 : data);
    this.left = (left === undefined ? null : left);
    this.right = (right === undefined ? null : right);
}

function gcd(a, b) {
    while (b) {
        const t = b;
        b = a % b;
        a = t;
    }
    return a;
}

function lcm(a, b) {
    if (a === 0 || b === 0) return 0;
    return (a / gcd(a, b)) * b;
}

function LCMOfTrees(root1, root2) {
    if (!root1 && !root2) return null;
    if (!root1) return root2;
    if (!root2) return root1;

    const v1 = root1.data !== 0 ? root1.data : root1.val;
    const v2 = root2.data !== 0 ? root2.data : root2.val;
    const res = lcm(v1, v2);

    root1.data = res;
    root1.val = res;

    root1.left = LCMOfTrees(root1.left, root2.left);
    root1.right = LCMOfTrees(root1.right, root2.right);
    return root1;
}`,
};

const functionSignatureByLanguage: Record<string, string> = {
  c: 'struct TreeNode* LCMOfTrees(struct TreeNode* root1, struct TreeNode* root2)',
  cpp: 'TreeNode* LCMOfTrees(TreeNode* root1, TreeNode* root2)',
  java: 'public TreeNode LCMOfTrees(TreeNode root1, TreeNode root2)',
  python: 'def LCMOfTrees(self, root1: TreeNode, root2: TreeNode) -> TreeNode',
  javascript: 'function LCMOfTrees(root1, root2)',
};

export const LCM_OF_TWO_TREES: SocraticProblem = {
  id: 'lcm_of_two_trees',
  title: '01. LCM of Two Binary Trees',
  category: 'Trees',
  difficulty: 'Medium',
  problemType: 'vibe-code',
  description,
  starterCode: starterCodeByLanguage,
  referenceSolution,
  solutionByLanguage,
  starterCodeByLanguage,
  functionSignatureByLanguage,
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
    { id: 10, name: 'Hidden #7: Large Max Values', input: 'root1: [1000, 2000]\nroot2: [1500, 2500]', expectedOutput: '[3000, 10000]', isHidden: true },
  ],
  socraticConfig: {
    PROBLEM: {
      minConceptsRequired: 3,
      concepts: [
        { id: 'two_trees_input',   triggers: ['two binary tree', 'root1 root2', 'given two tree', 'two tree', 'binary tree'] },
        { id: 'lcm_output',        triggers: ['lcm', 'least common multiple'] },
        { id: 'null_uses_other',   triggers: ['use the other value', 'one node is null', 'missing node uses', 'use the other node', 'if one is null'] },
        { id: 'no_extra_memory',   triggers: ['no extra memory', 'in place', 'without extra space', 'do not use extra memory', 'in-place'] },
        { id: 'both_null_return',  triggers: ['both null', 'return null', 'both tree null'] },
      ],
    },
    DATA_STRUCTURE: {
      minConceptsRequired: 2,
      concepts: [
        { id: 'structure_name',       triggers: ['binary tree', 'tree structure', 'treenode', 'existing tree', 'tree'] },
        { id: 'reasoning_recursion',  triggers: ['recursion', 'recursive', 'call stack', 'depth first', 'dfs'] },
        { id: 'reasoning_complexity', triggers: ['o(h)', 'space complexity', 'constant extra space', 'o(1)', 'o(n)'] },
      ],
    },
    APPROACH: {
      minConceptsRequired: 3,
      concepts: [
        { id: 'traverse_both',    triggers: ['traverse both', 'process both tree', 'node by node', 'position by position', 'traverse'] },
        { id: 'null_case',        triggers: ['if null', 'one null', 'both null', 'null check', 'base case'] },
        { id: 'lcm_gcd_calc',     triggers: ['gcd', 'calculate lcm', 'compute lcm', 'lcm using gcd', 'lcm'] },
        { id: 'recurse_children', triggers: ['left child', 'right child', 'recurse left and right', 'recursively merge', 'left and right', 'left right'] },
        { id: 'in_place_update',  triggers: ['update root1', 'modify in place', 'reuse the node', 'reuse existing node', 'in place', 'in-place'] },
      ],
    },
  },
};

export const SOCRATIC_QUESTION_BANK: Record<string, SocraticProblem> = {
  lcm_of_two_trees: LCM_OF_TWO_TREES,
};
