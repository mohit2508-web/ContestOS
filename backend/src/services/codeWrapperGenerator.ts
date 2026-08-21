interface TestCase {
  input: string;
  expectedOutput: string;
}

interface ProblemConfig {
  functionName: string;
  className: string;
  inputTypes: string[];
  outputType: string;
  inputNames: string[];
}

export class CodeWrapperGenerator {
  
  generateWrapper(
    userCode: string,
    language: string,
    testCase: TestCase,
    problem: ProblemConfig
  ): string {
    switch (language) {
      case 'java':
        return this.generateJavaWrapper(userCode, testCase, problem);
      case 'python':
        return this.generatePythonWrapper(userCode, testCase, problem);
      case 'javascript':
        return this.generateJavascriptWrapper(userCode, testCase, problem);
      case 'cpp':
      case 'c':
        return this.generateCppWrapper(userCode, testCase, problem);
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  private parseInput(input: string, types: string[], language: string): string[] {
    const lines = input.trim().split('\n');
    const parsed: string[] = [];
    
    for (let i = 0; i < types.length; i++) {
      const type = types[i].toLowerCase();
      let value = lines[i] || '';
      
      if (type.includes('node') && !type.includes('listnode') && !type.includes('treenode')) {
        value = value.replace(/null/g, '-1');
        parsed.push(this.formatArrayLiteral(value, language));
      } else if (type.includes('treenode')) {
        parsed.push(this.parseTreeInput(value, language));
      } else if (type.includes('listnode')) {
        // Linked list values are often nested arrays of arrays for lists of lists
        value = value.replace(/null/g, '-1');
        parsed.push(this.formatArrayLiteral(value, language));
      } else if (type.includes('interval')) {
        parsed.push(this.parseIntervals(value, language));
      } else if (type.includes('[]') || type.includes('vector') || type.includes('list')) {
        parsed.push(this.formatArrayLiteral(value, language));
      } else if (type.includes('int') && !type.includes('node') && !type.includes('interval')) {
        parsed.push(value.trim());
      } else if (type.includes('string') || type.includes('str')) {
        parsed.push(`"${value.replace(/"/g, '\\"')}"`);
      } else if (type.includes('double') || type.includes('float')) {
        parsed.push(value.trim());
      } else if (type.includes('bool')) {
        parsed.push(value.trim().toLowerCase() === 'true' ? 'true' : 'false');
      } else {
        parsed.push(value.trim());
      }
    }
    
    return parsed;
  }

  private formatArrayLiteral(value: string, language: string): string {
    const trimmed = value.trim();
    if (language === 'java' || language === 'cpp') {
      return trimmed.replace(/\[/g, '{').replace(/\]/g, '}');
    }
    return trimmed;
  }

  private parseTreeInput(value: string, language: string): string {
    let trimmed = value.trim();
    trimmed = trimmed.replace(/^[a-zA-Z0-9_]+\s*:\s*/, '');
    const cleanStr = trimmed.replace(/[\[\]]/g, '');
    const tokens = cleanStr.split(/[\s,]+/).filter(t => t.length > 0);

    if (language === 'python') {
      const pyTokens = tokens.map(t => {
        if (t === 'N' || t === 'null' || t === 'None' || t === 'NULL') return 'None';
        return t;
      });
      return `[${pyTokens.join(', ')}]`;
    }

    if (language === 'javascript') {
      const jsTokens = tokens.map(t => {
        if (t === 'N' || t === 'null' || t === 'None' || t === 'NULL') return 'null';
        return t;
      });
      return `[${jsTokens.join(', ')}]`;
    }

    if (language === 'cpp' || language === 'c') {
      const cppTokens = tokens.map(t => {
        if (t === 'N' || t === 'None') return '"null"';
        return `"${t}"`;
      });
      return `vector<string>{${cppTokens.join(', ')}}`;
    }

    if (language === 'java') {
      const javaTokens = tokens.map(t => {
        if (t === 'N' || t === 'null' || t === 'None' || t === 'NULL') return 'null';
        return t;
      });
      return `new Integer[]{${javaTokens.join(', ')}}`;
    }

    return trimmed;
  }

  private parseIntervals(value: string, language: string): string {
    try {
      const raw = JSON.parse(value.trim());
      if (Array.isArray(raw)) {
        const items = raw.map((item: any) => {
          if (Array.isArray(item) && item.length === 2) {
            const start = item[0];
            const end = item[1];
            if (language === 'java') return `new Interval(${start}, ${end})`;
            if (language === 'cpp') return `Interval(${start}, ${end})`;
            if (language === 'python') return `Interval(${start}, ${end})`;
            if (language === 'javascript') return `new Interval(${start}, ${end})`;
          }
          return '';
        }).filter(Boolean);
        
        if (language === 'java') return `new Interval[]{${items.join(', ')}}`;
        if (language === 'cpp') return `vector<Interval>{${items.join(', ')}}`;
        return `[${items.join(', ')}]`;
      }
    } catch {}
    return value;
  }

  private injectCustomClasses(userCode: string, language: string, problem: ProblemConfig): string {
    let injections = '';
    const allTypes = [...problem.inputTypes, problem.outputType].map(t => t.toLowerCase());
    
    const hasInterval = allTypes.some(t => t.includes('interval'));
    const hasNode = allTypes.some(t => t.includes('node') && !t.includes('listnode') && !t.includes('treenode'));
    const hasListNode = allTypes.some(t => t.includes('listnode'));
    const hasTreeNode = allTypes.some(t => t.includes('treenode'));

    const shouldInjectInterval = hasInterval && !userCode.includes('class Interval') && !userCode.includes('struct Interval');
    const shouldInjectNode = hasNode && !userCode.includes('class Node') && !userCode.includes('struct Node');
    const shouldInjectListNode = hasListNode && !userCode.includes('class ListNode') && !userCode.includes('struct ListNode');
    const shouldInjectTreeNode = hasTreeNode && !userCode.includes('class TreeNode') && !userCode.includes('struct TreeNode');
    
    const isGraph = hasNode && (
      problem.functionName.toLowerCase().includes('clone') || 
      problem.functionName.toLowerCase().includes('graph') || 
      problem.className.toLowerCase().includes('graph')
    );
    
    if (shouldInjectInterval) {
      if (language === 'java') {
        injections += `class Interval {
    public int start;
    public int end;
    public Interval() { start = 0; end = 0; }
    public Interval(int s, int e) { start = s; end = e; }
    @Override
    public String toString() { return "[" + start + "," + end + "]"; }
}\n\n`;
      } else if (language === 'cpp') {
        injections += `struct Interval {
    int start;
    int end;
    Interval() : start(0), end(0) {}
    Interval(int s, int e) : start(s), end(e) {}
};

inline ostream& operator<<(ostream& os, const Interval& interval) {
    return os << "[" << interval.start << "," << interval.end << "]";
}\n\n`;
      } else if (language === 'python') {
        injections += `class Interval:
    def __init__(self, start: int = 0, end: int = 0):
        self.start = start
        self.end = end
    def __repr__(self):
        return f"[{self.start},{self.end}]"\n\n`;
      } else if (language === 'javascript') {
        injections += `class Interval {
    constructor(start = 0, end = 0) {
        this.start = start;
        this.end = end;
    }
    toString() { return \`[\${this.start},\${this.end}]\`; }
}\n\n`;
      }
    }
    
    if (shouldInjectNode) {
      if (isGraph) {
        if (language === 'java') {
          injections += `class Node {
    public int val;
    public java.util.List<Node> neighbors;
    public Node() { val = 0; neighbors = new java.util.ArrayList<Node>(); }
    public Node(int _val) { val = _val; neighbors = new java.util.ArrayList<Node>(); }
    public Node(int _val, java.util.ArrayList<Node> _neighbors) { val = _val; neighbors = _neighbors; }
}\n\n`;
        } else if (language === 'cpp') {
          injections += `class Node {
public:
    int val;
    vector<Node*> neighbors;
    Node() { val = 0; neighbors = vector<Node*>(); }
    Node(int _val) { val = _val; neighbors = vector<Node*>(); }
    Node(int _val, vector<Node*> _neighbors) { val = _val; neighbors = _neighbors; }
};\n\n`;
        } else if (language === 'python') {
          injections += `class Node:
    def __init__(self, val = 0, neighbors = None):
        self.val = val
        self.neighbors = neighbors if neighbors is not None else []\n\n`;
        } else if (language === 'javascript') {
          injections += `class Node {
    constructor(val = 0, neighbors = []) {
        this.val = val;
        this.neighbors = neighbors;
    }
}\n\n`;
        }
      } else {
        if (language === 'java') {
          injections += `class Node {
    public int val;
    public Node next;
    public Node random;
    public Node(int val) { this.val = val; this.next = null; this.random = null; }
}\n\n`;
        } else if (language === 'cpp') {
          injections += `class Node {
public:
    int val;
    Node* next;
    Node* random;
    Node(int _val) { val = _val; next = NULL; random = NULL; }
};\n\n`;
        } else if (language === 'python') {
          injections += `class Node:
    def __init__(self, x: int, next: 'Node' = None, random: 'Node' = None):
        self.val = int(x)
        self.next = next
        self.random = random\n\n`;
        } else if (language === 'javascript') {
          injections += `class Node {
    constructor(val, next = null, random = null) {
        this.val = val;
        this.next = next;
        this.random = random;
    }
}\n\n`;
        }
      }
    }
    
    if (shouldInjectListNode) {
      if (language === 'java') {
        injections += `class ListNode {
    public int val;
    public ListNode next;
    public ListNode() { val = 0; next = null; }
    public ListNode(int x) { val = x; next = null; }
    public ListNode(int x, ListNode next) { val = x; this.next = next; }
}\n\n`;
      } else if (language === 'cpp') {
        injections += `struct ListNode {
    int data;
    int val;
    ListNode *next;
    ListNode() : data(0), val(0), next(nullptr) {}
    ListNode(int x) : data(x), val(x), next(nullptr) {}
    ListNode(int x, ListNode *next) : data(x), val(x), next(next) {}
};\n\n`;
      } else if (language === 'python') {
        injections += `class ListNode:
    def __init__(self, val=0, next=None):
        self.data = val
        self.val = val
        self.next = next\n\n`;
      } else if (language === 'javascript') {
        injections += `class ListNode {
    constructor(val = 0, next = null) {
        this.data = val;
        this.val = val;
        this.next = next;
    }
}\n\n`;
      }
    }
    
    if (shouldInjectTreeNode) {
      if (language === 'java') {
        injections += `class TreeNode {
    public int data;
    public int val;
    public TreeNode left;
    public TreeNode right;
    public TreeNode() { data = 0; val = 0; left = null; right = null; }
    public TreeNode(int x) { data = x; val = x; left = null; right = null; }
    public TreeNode(int x, TreeNode left, TreeNode right) { data = x; val = x; this.left = left; this.right = right; }
}\n\n`;
      } else if (language === 'cpp') {
        injections += `struct TreeNode {
    int data;
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode() : data(0), val(0), left(nullptr), right(nullptr) {}
    TreeNode(int x) : data(x), val(x), left(nullptr), right(nullptr) {}
    TreeNode(int x, TreeNode *left, TreeNode *right) : data(x), val(x), left(left), right(right) {}
};\n\n`;
      } else if (language === 'python') {
        injections += `class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right\n\n`;
      } else if (language === 'javascript') {
        injections += `class TreeNode {
    constructor(val = 0, left = null, right = null) {
        this.val = val;
        this.left = left;
        this.right = right;
    }
}\n\n`;
      }
    }
    
    return injections + userCode;
  }

  private generateJavaWrapper(userCode: string, testCase: TestCase, problem: ProblemConfig): string {
    const inputs = this.parseInput(testCase.input, problem.inputTypes, 'java');
    const inputArgs = problem.inputNames.join(', ');
    
    let imports = 'import java.util.*;\nimport java.io.*;\n';
    let processedUserCode = userCode;
    
    // Extract import statements to put them at the top
    const importRegex = /^import\s+[^;]+;\s*$/gm;
    const matches = processedUserCode.match(importRegex);
    if (matches) {
        imports += matches.join('\n') + '\n\n';
        processedUserCode = processedUserCode.replace(importRegex, '');
    }

    const hasMainMethod = /public\s+static\s+void\s+main\s*\(/.test(processedUserCode);

    if (hasMainMethod) {
        // Candidate wrote a full standalone program with main() method!
        processedUserCode = processedUserCode.replace(/\bclass\s+Main\b/, 'public class Main');
        return `${imports}${this.injectCustomClasses(processedUserCode, 'java', problem)}`;
    }

    // Always rename user class Main to class Solution if no main method exists
    processedUserCode = processedUserCode.replace(/\bpublic\s+class\s+Main\b/g, 'class Solution');
    processedUserCode = processedUserCode.replace(/\bclass\s+Main\b/g, 'class Solution');
    processedUserCode = processedUserCode.replace(/public\s+class\s+Solution/g, 'class Solution');
    processedUserCode = processedUserCode.replace(/public\s+class\s+ListNode/g, 'class ListNode');
    processedUserCode = processedUserCode.replace(/public\s+class\s+TreeNode/g, 'class TreeNode');
    processedUserCode = processedUserCode.replace(/public\s+class\s+Node/g, 'class Node');
    processedUserCode = processedUserCode.replace(/public\s+class\s+Interval/g, 'class Interval');
    
    const mainClassCode = `public class Main {
    public static void main(String[] args) {
        Solution sol = new Solution();
        ${this.generateJavaVariableDeclarations(problem, inputs)}
        ${this.generateJavaMethodCall(problem, inputArgs)}
        System.out.println(output);
    }
}\n\n`;

    const hasSolutionClass = /\bclass\s+Solution\b/.test(processedUserCode);

    if (hasSolutionClass) {
        return `${imports}${mainClassCode}${this.injectCustomClasses(processedUserCode, 'java', problem)}`;
    }

    return `${imports}${mainClassCode}class Solution {
    ${this.injectCustomClasses(processedUserCode, 'java', problem)}
}`;
  }

  private generateJavaVariableDeclarations(problem: ProblemConfig, inputs: string[]): string {
    const declarations: string[] = [];
    
    for (let i = 0; i < problem.inputTypes.length; i++) {
      const type = problem.inputTypes[i];
      const name = problem.inputNames[i];
      const value = inputs[i];
      
      const isNode = type.toLowerCase().includes('node') && !type.toLowerCase().includes('listnode') && !type.toLowerCase().includes('treenode');
      const isListNodeArray = type.toLowerCase().includes('listnode') && (type.includes('[]') || type.includes('list'));
      const isListNode = type.toLowerCase().includes('listnode') && !type.includes('[]');
      const isTreeNode = type.toLowerCase().includes('treenode') && !type.includes('[]');
      
      if (isNode) {
        const isGraph = problem.functionName.toLowerCase().includes('clone') || 
                        problem.className.toLowerCase().includes('graph');
        if (isGraph) {
          declarations.push(`int[][] adj_${name} = ${value};
        Node[] nodes_${name} = new Node[adj_${name}.length];
        for (int idx = 0; idx < adj_${name}.length; idx++) {
            nodes_${name}[idx] = new Node(idx + 1);
        }
        for (int idx = 0; idx < adj_${name}.length; idx++) {
            for (int neighborIndex : adj_${name}[idx]) {
                nodes_${name}[idx].neighbors.add(nodes_${name}[neighborIndex - 1]);
            }
        }
        Node ${name} = nodes_${name}.length > 0 ? nodes_${name}[0] : null;`);
        } else {
          declarations.push(`int[][] adj_${name} = ${value};
        Node[] nodes_${name} = new Node[adj_${name}.length];
        for (int idx = 0; idx < adj_${name}.length; idx++) {
            nodes_${name}[idx] = new Node(adj_${name}[idx][0]);
        }
        for (int idx = 0; idx < adj_${name}.length; idx++) {
            if (idx < adj_${name}.length - 1) {
                nodes_${name}[idx].next = nodes_${name}[idx + 1];
            }
            int randIdx = adj_${name}[idx][1];
            if (randIdx != -1) {
                nodes_${name}[idx].random = nodes_${name}[randIdx];
            }
        }
        Node ${name} = nodes_${name}.length > 0 ? nodes_${name}[0] : null;`);
        }
      } else if (isListNodeArray) {
        declarations.push(`int[][] lists_vals_${name} = ${value};
        ListNode[] ${name} = new ListNode[lists_vals_${name}.length];
        for (int i = 0; i < lists_vals_${name}.length; i++) {
            ListNode head = null;
            ListNode tail = null;
            for (int val : lists_vals_${name}[i]) {
                ListNode node = new ListNode(val);
                if (head == null) head = node;
                else tail.next = node;
                tail = node;
            }
            ${name}[i] = head;
        }`);
      } else if (isListNode) {
        declarations.push(`int[] vals_${name} = ${value};
        ListNode ${name} = null;
        ListNode tail_${name} = null;
        for (int val : vals_${name}) {
            ListNode node = new ListNode(val);
            if (${name} == null) ${name} = node;
            else tail_${name}.next = node;
            tail_${name} = node;
        }`);
      } else if (isTreeNode) {
        declarations.push(`Integer[] vals_${name} = ${value};
        TreeNode ${name} = null;
        if (vals_${name}.length > 0 && vals_${name}[0] != null) {
            ${name} = new TreeNode(vals_${name}[0]);
            java.util.Queue<TreeNode> queue_${name} = new java.util.LinkedList<>();
            queue_${name}.add(${name});
            int idx_${name} = 1;
            while (!queue_${name}.isEmpty() && idx_${name} < vals_${name}.length) {
                TreeNode curr = queue_${name}.poll();
                if (idx_${name} < vals_${name}.length && vals_${name}[idx_${name}] != null) {
                    curr.left = new TreeNode(vals_${name}[idx_${name}]);
                    queue_${name}.add(curr.left);
                }
                idx_${name}++;
                if (idx_${name} < vals_${name}.length && vals_${name}[idx_${name}] != null) {
                    curr.right = new TreeNode(vals_${name}[idx_${name}]);
                    queue_${name}.add(curr.right);
                }
                idx_${name}++;
            }
        }`);
      } else if (type.includes('int[][]')) {
        declarations.push(`int[][] ${name} = ${value};`);
      } else if (type.includes('int[]')) {
        declarations.push(`int[] ${name} = ${value};`);
      } else if (type.includes('int')) {
        declarations.push(`int ${name} = ${value};`);
      } else if (type.includes('String')) {
        declarations.push(`String ${name} = ${value};`);
      } else if (type.includes('double')) {
        declarations.push(`double ${name} = ${value};`);
      } else if (type.includes('boolean')) {
        declarations.push(`boolean ${name} = ${value};`);
      } else if (type.includes('List')) {
        declarations.push(`java.util.List<Integer> ${name} = new java.util.ArrayList<>();`);
      } else {
        declarations.push(`Object ${name} = ${value};`);
      }
    }
    
    return declarations.join('\n        ');
  }

  private generateJavaMethodCall(problem: ProblemConfig, inputArgs: string): string {
    const returnType = problem.outputType;
    const isVoid = returnType.toLowerCase() === 'void';
    const isNode = returnType.toLowerCase().includes('node') && !returnType.toLowerCase().includes('listnode') && !returnType.toLowerCase().includes('treenode');
    const isListNode = returnType.toLowerCase().includes('listnode');
    const isTreeNode = returnType.toLowerCase().includes('treenode');

    if (isVoid) {
      const targetParam = problem.inputNames[0] || '';
      const targetType = problem.inputTypes[0] || '';
      let printStmt = '';
      if (targetParam) {
        if (targetType.includes('int[]')) {
          printStmt = `StringBuilder sb = new StringBuilder();
        for (int i = 0; i < ${targetParam}.length; i++) {
            if (i > 0) sb.append(" ");
            sb.append(${targetParam}[i]);
        }
        String output = sb.toString();`;
        } else if (targetType.includes('List')) {
          printStmt = `StringBuilder sb = new StringBuilder();
        for (int i = 0; i < ${targetParam}.size(); i++) {
            if (i > 0) sb.append(" ");
            sb.append(${targetParam}.get(i));
        }
        String output = sb.toString();`;
        } else {
          printStmt = `String output = String.valueOf(${targetParam});`;
        }
      } else {
        printStmt = `String output = "";`;
      }
      return `sol.${problem.functionName}(${inputArgs});
        ${printStmt}`;
    }

    if (isListNode) {
      return `ListNode result = sol.${problem.functionName}(${inputArgs});
        StringBuilder sb = new StringBuilder();
        ListNode curr = result;
        while (curr != null) {
            sb.append(curr.val).append(curr.next == null ? "" : " ");
            curr = curr.next;
        }
        String output = sb.toString();`;
    }

    if (isTreeNode) {
      return `TreeNode result = sol.${problem.functionName}(${inputArgs});
        StringBuilder sb = new StringBuilder();
        sb.append("[");
        if (result != null) {
            java.util.List<TreeNode> queue = new java.util.ArrayList<>();
            queue.add(result);
            int ptr = 0;
            while (ptr < queue.size()) {
                TreeNode curr = queue.get(ptr++);
                if (curr != null) {
                    queue.add(curr.left);
                    queue.add(curr.right);
                }
            }
            int lastNonNull = queue.size() - 1;
            while (lastNonNull >= 0 && queue.get(lastNonNull) == null) {
                lastNonNull--;
            }
            for (int i = 0; i <= lastNonNull; i++) {
                if (i > 0) sb.append(",");
                TreeNode n = queue.get(i);
                if (n == null) {
                    sb.append("null");
                } else {
                    int nodeVal = 0;
                    try {
                        java.lang.reflect.Field f = n.getClass().getDeclaredField("data");
                        f.setAccessible(true);
                        nodeVal = f.getInt(n);
                    } catch (Exception _e) {
                        try {
                            java.lang.reflect.Field f = n.getClass().getDeclaredField("val");
                            f.setAccessible(true);
                            nodeVal = f.getInt(n);
                        } catch (Exception _ex) {}
                    }
                    sb.append(nodeVal);
                }
            }
        }
        sb.append("]");
        String output = sb.toString();`;
    }

    if (isNode) {
      const isGraph = problem.functionName.toLowerCase().includes('clone') || 
                      problem.className.toLowerCase().includes('graph');
      if (isGraph) {
        return `Node result = sol.${problem.functionName}(${inputArgs});
        StringBuilder sb = new StringBuilder();
        sb.append("[");
        if (result != null) {
            java.util.Map<Node, Integer> nodeToId = new java.util.HashMap<>();
            java.util.List<Node> queue = new java.util.ArrayList<>();
            queue.add(result);
            nodeToId.put(result, 1);
            int currentId = 1;
            int ptr = 0;
            while (ptr < queue.size()) {
                Node curr = queue.get(ptr++);
                for (Node neighbor : curr.neighbors) {
                    if (!nodeToId.containsKey(neighbor)) {
                        nodeToId.put(neighbor, ++currentId);
                        queue.add(neighbor);
                    }
                }
            }
            java.util.List<Node> sortedNodes = new java.util.ArrayList<>(queue);
            sortedNodes.sort(java.util.Comparator.comparingInt(n -> nodeToId.get(n)));
            for (int i = 0; i < sortedNodes.size(); i++) {
                if (i > 0) sb.append(",");
                sb.append("[");
                Node curr = sortedNodes.get(i);
                for (int j = 0; j < curr.neighbors.size(); j++) {
                    if (j > 0) sb.append(",");
                    sb.append(nodeToId.get(curr.neighbors.get(j)));
                }
                sb.append("]");
            }
        }
        sb.append("]");
        String output = sb.toString();`;
      } else {
        return `Node result = sol.${problem.functionName}(${inputArgs});
        StringBuilder sb = new StringBuilder();
        sb.append("[");
        if (result != null) {
            java.util.List<Node> list = new java.util.ArrayList<>();
            java.util.Map<Node, Integer> nodeToIndex = new java.util.HashMap<>();
            Node curr = result;
            int idx = 0;
            while (curr != null) {
                list.add(curr);
                nodeToIndex.put(curr, idx++);
                curr = curr.next;
            }
            for (int i = 0; i < list.size(); i++) {
                if (i > 0) sb.append(",");
                Node node = list.get(i);
                int randIdx = node.random != null ? nodeToIndex.get(node.random) : -1;
                sb.append("[").append(node.val).append(",").append(randIdx == -1 ? "null" : String.valueOf(randIdx)).append("]");
            }
        }
        sb.append("]");
        String output = sb.toString();`;
      }
    }
    
    if (returnType.includes('int[]') || returnType.includes('List')) {
      return `java.util.List<String> result = sol.${problem.functionName}(${inputArgs});
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < result.size(); i++) {
            if (i > 0) sb.append(" ");
            sb.append(result.get(i));
        }
        String output = sb.toString();`;
    } else if (returnType.includes('int')) {
      return `int result = sol.${problem.functionName}(${inputArgs});
        String output = String.valueOf(result);`;
    } else if (returnType.includes('boolean')) {
      return `boolean result = sol.${problem.functionName}(${inputArgs});
        String output = String.valueOf(result);`;
    } else if (returnType.includes('String')) {
      return `String result = sol.${problem.functionName}(${inputArgs});
        String output = result;`;
    } else {
      return `Object result = sol.${problem.functionName}(${inputArgs});
        String output = "";
        if (result == null) {
            output = "null";
        } else if (result instanceof boolean[]) {
            output = java.util.Arrays.toString((boolean[]) result);
        } else if (result instanceof int[]) {
            output = java.util.Arrays.toString((int[]) result);
        } else if (result instanceof double[]) {
            output = java.util.Arrays.toString((double[]) result);
        } else if (result instanceof Object[]) {
            output = java.util.Arrays.deepToString((Object[]) result);
        } else {
            output = String.valueOf(result);
        }`;
    }
  }

  private generatePythonWrapper(userCode: string, testCase: TestCase, problem: ProblemConfig): string {
    const inputs = this.parseInput(testCase.input, problem.inputTypes, 'python');
    
    let prepCode = '';
    const pyArgs: string[] = [];
    
    for (let i = 0; i < problem.inputTypes.length; i++) {
      const type = problem.inputTypes[i];
      const name = problem.inputNames[i];
      const value = inputs[i];
      const isNode = type.toLowerCase().includes('node') && !type.toLowerCase().includes('listnode') && !type.toLowerCase().includes('treenode');
      const isListNodeArray = type.toLowerCase().includes('listnode') && (type.includes('[]') || type.includes('list') || type.includes('vector'));
      const isListNode = type.toLowerCase().includes('listnode') && !type.includes('[]');
      const isTreeNode = type.toLowerCase().includes('treenode') && !type.includes('[]');
      
      if (isNode) {
        const isGraph = problem.functionName.toLowerCase().includes('clone') || 
                        problem.className.toLowerCase().includes('graph');
        if (isGraph) {
          prepCode += `    adj_${name} = ${value}
    nodes_${name} = [Node(idx + 1) for idx in range(len(adj_${name}))]
    for idx in range(len(adj_${name})):
        nodes_${name}[idx].neighbors = [nodes_${name}[n - 1] for n in adj_${name}[idx]]
    ${name} = nodes_${name}[0] if nodes_${name} else None\n`;
        } else {
          prepCode += `    adj_${name} = ${value}
    nodes_${name} = [Node(x[0]) for x in adj_${name}]
    for idx in range(len(adj_${name})):
        if idx < len(adj_${name}) - 1:
            nodes_${name}[idx].next = nodes_${name}[idx + 1]
        rand_idx = adj_${name}[idx][1]
        if rand_idx != -1:
            nodes_${name}[idx].random = nodes_${name}[rand_idx]
    ${name} = nodes_${name}[0] if nodes_${name} else None\n`;
        }
        pyArgs.push(name);
      } else if (isListNodeArray) {
        prepCode += `    lists_vals_${name} = ${value}
    ${name} = []
    for vals in lists_vals_${name}:
        head = None
        tail = None
        for val in vals:
            node = ListNode(val)
            if not head: head = node
            else: tail.next = node
            tail = node
        ${name}.append(head)\n`;
        pyArgs.push(name);
      } else if (isListNode) {
        prepCode += `    vals_${name} = ${value}
    ${name} = None
    tail_${name} = None
    for val in vals_${name}:
        node = ListNode(val)
        if not ${name}: ${name} = node
        else: tail_${name}.next = node
        tail_${name} = node\n`;
        pyArgs.push(name);
      } else if (isTreeNode) {
        prepCode += `    vals_${name} = ${value}
    ${name} = None
    if vals_${name} and vals_${name}[0] is not None:
        nodes_${name} = [TreeNode(x) if x is not None else None for x in vals_${name}]
        child_idx = 1
        for idx in range(len(nodes_${name})):
            if nodes_${name}[idx] is not None:
                if child_idx < len(nodes_${name}):
                    nodes_${name}[idx].left = nodes_${name}[child_idx]
                    child_idx += 1
                if child_idx < len(nodes_${name}):
                    nodes_${name}[idx].right = nodes_${name}[child_idx]
                    child_idx += 1
        ${name} = nodes_${name}[0]\n`;
        pyArgs.push(name);
      } else {
        prepCode += `    ${name} = ${value}\n`;
        pyArgs.push(name);
      }
    }
    
    const inputArgs = pyArgs.join(', ');
    const isVoid = problem.outputType.toLowerCase() === 'void';
    const targetName = isVoid ? problem.inputNames[0] : 'result';
    const hasSolutionClass = /\bclass\s+Solution\b/.test(userCode);
    const callPrefix = hasSolutionClass ? 'sol.' : '';
    const instCode = hasSolutionClass ? '    sol = Solution()\n' : '';
    
    return `${this.injectCustomClasses(userCode, 'python', problem)}

def main():
${instCode}${prepCode}
    ${isVoid ? `${callPrefix}${problem.functionName}(${inputArgs})` : `result = ${callPrefix}${problem.functionName}(${inputArgs})`}
    
    target = ${targetName}
    if target is None:
        print("")
        return
        
    if hasattr(target, 'neighbors'):
        node_to_id = {target: 1}
        queue = [target]
        ptr = 0
        while ptr < len(queue):
            curr = queue[ptr]
            ptr += 1
            for neighbor in curr.neighbors:
                if neighbor not in node_to_id:
                    node_to_id[neighbor] = len(node_to_id) + 1
                    queue.append(neighbor)
        out = []
        for node in queue:
            out.append("[" + ",".join(map(str, [node_to_id[n] for n in node.neighbors])) + "]")
        print("[" + ",".join(out) + "]")
    elif hasattr(target, 'random'):
        nodes_list = []
        node_to_idx = {}
        curr = target
        while curr is not None:
            node_to_idx[curr] = len(nodes_list)
            nodes_list.append(curr)
            curr = curr.next
        out = []
        for n in nodes_list:
            rand_idx = node_to_idx[n.random] if n.random is not None else -1
            out.append(f"[{n.val},{'null' if rand_idx == -1 else rand_idx}]")
        print("[" + ",".join(out) + "]")
    elif isinstance(target, ListNode) or (target and hasattr(target, 'val') and hasattr(target, 'next')):
        curr = target
        out = []
        while curr is not None:
            out.append(str(curr.val))
            curr = curr.next
        print(' '.join(out))
    elif isinstance(target, TreeNode) or (target and hasattr(target, 'val') and hasattr(target, 'left')):
        queue = [target]
        ptr = 0
        while ptr < len(queue):
            curr = queue[ptr]
            ptr += 1
            if curr is not None:
                queue.append(curr.left)
                queue.append(curr.right)
        while queue and queue[-1] is None:
            queue.pop()
        out = ["null" if x is None else str(x.val) for x in queue]
        print("[" + ",".join(out) + "]")
    elif isinstance(target, (list, tuple)):
        if len(target) > 0 and isinstance(target[0], (list, tuple)):
            print(' '.join([' '.join(map(str, sub)) for sub in target]))
        else:
            print(' '.join(map(str, target)))
    else:
        print(target)

if __name__ == "__main__":
    main()`;
  }

  private generateJavascriptWrapper(userCode: string, testCase: TestCase, problem: ProblemConfig): string {
    const inputs = this.parseInput(testCase.input, problem.inputTypes, 'javascript');
    
    let prepCode = '';
    const jsArgs: string[] = [];
    
    for (let i = 0; i < problem.inputTypes.length; i++) {
      const type = problem.inputTypes[i];
      const name = problem.inputNames[i];
      const value = inputs[i];
      const isNode = type.toLowerCase().includes('node') && !type.toLowerCase().includes('listnode') && !type.toLowerCase().includes('treenode');
      const isListNodeArray = type.toLowerCase().includes('listnode') && (type.includes('[]') || type.includes('list') || type.includes('vector'));
      const isListNode = type.toLowerCase().includes('listnode') && !type.includes('[]');
      const isTreeNode = type.toLowerCase().includes('treenode') && !type.includes('[]');
      
      if (isNode) {
        const isGraph = problem.functionName.toLowerCase().includes('clone') || 
                        problem.className.toLowerCase().includes('graph');
        if (isGraph) {
          prepCode += `const adj_${name} = ${value};
const nodes_${name} = adj_${name}.map((_, idx) => new Node(idx + 1));
for (let idx = 0; idx < adj_${name}.length; idx++) {
    nodes_${name}[idx].neighbors = adj_${name}[idx].map(n => nodes_${name}[n - 1]);
}
const ${name} = nodes_${name}.length > 0 ? nodes_${name}[0] : null;\n`;
        } else {
          prepCode += `const adj_${name} = ${value};
const nodes_${name} = adj_${name}.map(x => new Node(x[0]));
for (let idx = 0; idx < adj_${name}.length; idx++) {
    if (idx < adj_${name}.length - 1) {
        nodes_${name}[idx].next = nodes_${name}[idx + 1];
    }
    const randIdx = adj_${name}[idx][1];
    if (randIdx !== -1) {
        nodes_${name}[idx].random = nodes_${name}[randIdx];
    }
}
const ${name} = nodes_${name}.length > 0 ? nodes_${name}[0] : null;\n`;
        }
        jsArgs.push(name);
      } else if (isListNodeArray) {
        prepCode += `const lists_vals_${name} = ${value};
const ${name} = lists_vals_${name}.map(vals => {
    let head = null;
    let tail = null;
    for (const val of vals) {
        const node = new ListNode(val);
        if (!head) head = node;
        else tail.next = node;
        tail = node;
    }
    return head;
});\n`;
        jsArgs.push(name);
      } else if (isListNode) {
        prepCode += `const vals_${name} = ${value};
let ${name} = null;
let tail_${name} = null;
for (const val of vals_${name}) {
    const node = new ListNode(val);
    if (!${name}) ${name} = node;
    else tail_${name}.next = node;
    tail_${name} = node;
}\n`;
        jsArgs.push(name);
      } else if (isTreeNode) {
        prepCode += `const vals_${name} = ${value};
let ${name} = null;
if (vals_${name}.length > 0 && vals_${name}[0] !== null) {
    const nodes_${name} = vals_${name}.map(x => x !== null ? new TreeNode(x) : null);
    let childIdx = 1;
    for (let idx = 0; idx < nodes_${name}.length; idx++) {
        if (nodes_${name}[idx] !== null) {
            if (childIdx < nodes_${name}.length) {
                nodes_${name}[idx].left = nodes_${name}[childIdx++];
            }
            if (childIdx < nodes_${name}.length) {
                nodes_${name}[idx].right = nodes_${name}[childIdx++];
            }
        }
    }
    ${name} = nodes_${name}[0];
}\n`;
        jsArgs.push(name);
      } else {
        prepCode += `const ${name} = ${value};\n`;
        jsArgs.push(name);
      }
    }
    
    const inputArgs = jsArgs.join(', ');
    const isVoid = problem.outputType.toLowerCase() === 'void';
    const targetName = isVoid ? problem.inputNames[0] : 'result';
    const hasSolutionClass = /\bclass\s+Solution\b/.test(userCode);
    const callPrefix = hasSolutionClass ? 'sol.' : '';
    const instCode = hasSolutionClass ? 'const sol = new Solution();\n' : '';
    
    return `${this.injectCustomClasses(userCode, 'javascript', problem)}

${instCode}${prepCode}
${isVoid ? `${callPrefix}${problem.functionName}(${inputArgs});` : `const result = ${callPrefix}${problem.functionName}(${inputArgs});`}

const target = ${targetName};
if (target === null || target === undefined) {
    console.log('');
} else if (target && target.neighbors !== undefined) {
    const nodeToId = new Map();
    const queue = [target];
    nodeToId.set(target, 1);
    let ptr = 0;
    while (ptr < queue.length) {
        const curr = queue[ptr++];
        for (const neighbor of curr.neighbors) {
            if (!nodeToId.has(neighbor)) {
                nodeToId.set(neighbor, nodeToId.size + 1);
                queue.push(neighbor);
            }
        }
    }
    const out = queue.map(node => "[" + node.neighbors.map(n => nodeToId.get(n)).join(",") + "]");
    console.log("[" + out.join(",") + "]");
} else if (target && target.random !== undefined) {
    const nodesList = [];
    const nodeToIdx = new Map();
    let curr = target;
    while (curr !== null) {
        nodeToIdx.set(curr, nodesList.length);
        nodesList.push(curr);
        curr = curr.next;
    }
    const out = nodesList.map(n => {
        const randIdx = n.random !== null ? nodeToIdx.get(n.random) : -1;
        return \`[\${n.val},\${randIdx === -1 ? 'null' : randIdx}]\`;
    });
    console.log("[" + out.join(",") + "]");
} else if (target && target.next !== undefined && target.val !== undefined) {
    const out = [];
    let curr = target;
    while (curr !== null) {
        out.push(curr.val);
        curr = curr.next;
    }
    console.log(out.join(' '));
} else if (target && target.val !== undefined && (target.left !== undefined || target.right !== undefined)) {
    const queue = [target];
    let ptr = 0;
    while (ptr < queue.length) {
        const curr = queue[ptr++];
        if (curr !== null) {
            queue.push(curr.left);
            queue.push(curr.right);
        }
    }
    while (queue.length > 0 && queue[queue.length - 1] === null) {
        queue.pop();
    }
    const out = queue.map(n => n === null ? 'null' : n.val);
    console.log("[" + out.join(",") + "]");
} else if (Array.isArray(target)) {
    if (target.length > 0 && Array.isArray(target[0])) {
        console.log(target.map(sub => sub.join(' ')).join(' '));
    } else {
        console.log(target.join(' '));
    }
} else {
    console.log(target);
}`;
  }

  private generateCppWrapper(userCode: string, testCase: TestCase, problem: ProblemConfig): string {
    const inputs = this.parseInput(testCase.input, problem.inputTypes, 'cpp');
    const inputArgs = problem.inputNames.join(', ');
    const isVoid = problem.outputType.toLowerCase() === 'void';
    const hasClassSolution = /\bclass\s+Solution\b/.test(userCode) || /\bstruct\s+Solution\b/.test(userCode);
    const callPrefix = hasClassSolution ? "sol." : "";
    const solInst = hasClassSolution ? "Solution sol;\n    " : "";
    
    return `#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <utility>
#include <tuple>
#include <queue>
#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
using namespace std;

// Formatter for std::pair
template<typename T1, typename T2>
ostream& operator<<(ostream& os, const pair<T1, T2>& p) {
    return os << p.first << " " << p.second;
}

// Formatter for std::tuple
template<typename Tuple, size_t... Is>
void print_tuple_helper(ostream& os, const Tuple& t, index_sequence<Is...>) {
    ((os << (Is == 0 ? "" : " ") << get<Is>(t)), ...);
}

template<typename... Args>
ostream& operator<<(ostream& os, const tuple<Args...>& t) {
    print_tuple_helper(os, t, index_sequence_for<Args...>{});
    return os;
}

${this.injectCustomClasses(userCode, 'cpp', problem)}

int main() {
    ${solInst}${this.generateCppVariableDeclarations(problem, inputs)}
    
    ${isVoid ? `${callPrefix}${problem.functionName}(${inputArgs});` : `auto result = ${callPrefix}${problem.functionName}(${inputArgs});`}
    
    ${isVoid ? this.generateCppVoidOutputFormatting(problem) : this.generateCppOutputFormatting(problem.outputType, problem.functionName, problem.className)}
    
    return 0;
}`;
  }

  private generateCppVariableDeclarations(problem: ProblemConfig, inputs: string[]): string {
    const declarations: string[] = [];
    
    for (let i = 0; i < problem.inputTypes.length; i++) {
      const type = problem.inputTypes[i];
      const name = problem.inputNames[i];
      const value = inputs[i];
      
      const isNode = type.toLowerCase().includes('node') && !type.toLowerCase().includes('listnode') && !type.toLowerCase().includes('treenode');
      const isListNodeArray = type.toLowerCase().includes('listnode') && (type.includes('[]') || type.includes('vector') || type.includes('list'));
      const isListNode = type.toLowerCase().includes('listnode') && !type.includes('[]');
      const isTreeNode = type.toLowerCase().includes('treenode') && !type.includes('[]');

      if (isNode) {
        const isGraph = problem.functionName.toLowerCase().includes('clone') || 
                        problem.className.toLowerCase().includes('graph');
        if (isGraph) {
          declarations.push(`vector<vector<int>> adj_${name} = ${value};
    vector<Node*> nodes_${name}(adj_${name}.size());
    for (int idx = 0; idx < adj_${name}.size(); idx++) {
        nodes_${name}[idx] = new Node(idx + 1);
    }
    for (int idx = 0; idx < adj_${name}.size(); idx++) {
        for (int neighborIndex : adj_${name}[idx]) {
            nodes_${name}[idx]->neighbors.push_back(nodes_${name}[neighborIndex - 1]);
        }
    }
    Node* ${name} = nodes_${name}.size() > 0 ? nodes_${name}[0] : NULL;`);
        } else {
          declarations.push(`vector<vector<int>> adj_${name} = ${value};
    vector<Node*> nodes_${name}(adj_${name}.size());
    for (int idx = 0; idx < adj_${name}.size(); idx++) {
        nodes_${name}[idx] = new Node(adj_${name}[idx][0]);
    }
    for (int idx = 0; idx < adj_${name}.size(); idx++) {
        if (idx < adj_${name}.size() - 1) {
            nodes_${name}[idx]->next = nodes_${name}[idx + 1];
        }
        int randIdx = adj_${name}[idx][1];
        if (randIdx != -1) {
            nodes_${name}[idx]->random = nodes_${name}[randIdx];
        }
    }
    Node* ${name} = nodes_${name}.size() > 0 ? nodes_${name}[0] : NULL;`);
        }
      } else if (isListNodeArray) {
        declarations.push(`vector<vector<int>> lists_vals_${name} = ${value};
    vector<ListNode*> ${name}(lists_vals_${name}.size());
    for (int i = 0; i < lists_vals_${name}.size(); i++) {
        ListNode* head = nullptr;
        ListNode* tail = nullptr;
        for (int val : lists_vals_${name}[i]) {
            ListNode* node = new ListNode(val);
            if (head == nullptr) head = node;
            else tail->next = node;
            tail = node;
        }
        ${name}[i] = head;
    }`);
      } else if (isListNode) {
        declarations.push(`vector<int> vals_${name} = ${value};
    ListNode* ${name} = nullptr;
    ListNode* tail_${name} = nullptr;
    for (int val : vals_${name}) {
        ListNode* node = new ListNode(val);
        if (${name} == nullptr) ${name} = node;
        else tail_${name}->next = node;
        tail_${name} = node;
    }`);
      } else if (isTreeNode) {
        declarations.push(`vector<string> vals_${name} = ${value};
    TreeNode* ${name} = nullptr;
    if (vals_${name}.size() > 0 && vals_${name}[0] != "null") {
        vector<TreeNode*> nodes_${name}(vals_${name}.size(), nullptr);
        for (int idx = 0; idx < vals_${name}.size(); idx++) {
            if (vals_${name}[idx] != "null" && !vals_${name}[idx].empty()) {
                string s_${name} = "";
                for (char ch : vals_${name}[idx]) {
                    if (isdigit(ch) || ch == '-') s_${name} += ch;
                }
                if (!s_${name}.empty()) {
                    nodes_${name}[idx] = new TreeNode(stoi(s_${name}));
                }
            }
        }
        int childIdx = 1;
        for (int idx = 0; idx < nodes_${name}.size(); idx++) {
            if (nodes_${name}[idx] != nullptr) {
                if (childIdx < nodes_${name}.size()) {
                    nodes_${name}[idx]->left = nodes_${name}[childIdx++];
                }
                if (childIdx < nodes_${name}.size()) {
                    nodes_${name}[idx]->right = nodes_${name}[childIdx++];
                }
            }
        }
        ${name} = nodes_${name}[0];
    }`);
      } else if (type.includes('vector<int>')) {
        declarations.push(`vector<int> ${name} = ${value};`);
      } else if (type.includes('int') && !type.includes('<')) {
        declarations.push(`int ${name} = ${value};`);
      } else if (type.includes('string')) {
        declarations.push(`string ${name} = ${value};`);
      } else if (type.includes('double')) {
        declarations.push(`double ${name} = ${value};`);
      } else if (type.includes('bool')) {
        declarations.push(`bool ${name} = ${value};`);
      } else {
        declarations.push(`auto ${name} = ${value};`);
      }
    }
    
    return declarations.join('\n    ');
  }

  private generateCppVoidOutputFormatting(problem: ProblemConfig): string {
    const name = problem.inputNames[0];
    const type = problem.inputTypes[0] || '';
    if (!name) return `cout << "" << endl;`;

    if (type.includes('vector')) {
      return `for (size_t i = 0; i < ${name}.size(); i++) {
        if (i > 0) cout << " ";
        cout << ${name}[i];
    }
    cout << endl;`;
    }
    return `cout << ${name} << endl;`;
  }

  private generateCppOutputFormatting(outputType: string, functionName: string = '', className: string = ''): string {
    const isNode = outputType.toLowerCase().includes('node') && !outputType.toLowerCase().includes('listnode') && !outputType.toLowerCase().includes('treenode');
    const isListNode = outputType.toLowerCase().includes('listnode') && !outputType.includes('[]');
    const isTreeNode = outputType.toLowerCase().includes('treenode') && !outputType.includes('[]');

    if (isListNode) {
      return `ListNode* curr = result;
    while (curr != nullptr) {
        cout << curr->val << (curr->next == nullptr ? "" : " ");
        curr = curr->next;
    }
    cout << endl;`;
    }

    if (isTreeNode) {
      return `if (result == nullptr) {
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
    }

    if (isNode) {
      const isGraph = functionName.toLowerCase().includes('clone') || 
                      className.toLowerCase().includes('graph');
      if (isGraph) {
        return `#include <queue>
    #include <unordered_map>
    cout << "[";
    if (result != NULL) {
        unordered_map<Node*, int> nodeToId;
        vector<Node*> queueList;
        queueList.push_back(result);
        nodeToId[result] = 1;
        int currentId = 1;
        int ptr = 0;
        while (ptr < queueList.size()) {
            Node* curr = queueList[ptr++];
            for (Node* neighbor : curr->neighbors) {
                if (nodeToId.find(neighbor) == nodeToId.end()) {
                    nodeToId[neighbor] = ++currentId;
                    queueList.push_back(neighbor);
                }
            }
        }
        for (int i = 0; i < queueList.size(); i++) {
            if (i > 0) cout << ",";
            cout << "[";
            Node* curr = queueList[i];
            for (int j = 0; j < curr->neighbors.size(); j++) {
                if (j > 0) cout << ",";
                cout << nodeToId[curr->neighbors[j]];
            }
            cout << "]";
        }
    }
    cout << "]" << endl;`;
      } else {
        return `#include <unordered_map>
    cout << "[";
    if (result != NULL) {
        vector<Node*> list;
        unordered_map<Node*, int> nodeToIndex;
        Node* curr = result;
        int idx = 0;
        while (curr != NULL) {
            list.push_back(curr);
            nodeToIndex[curr] = idx++;
            curr = curr->next;
        }
        for (int i = 0; i < list.size(); i++) {
            if (i > 0) cout << ",";
            Node* node = list[i];
            int randIdx = node->random != NULL ? nodeToIndex[node->random] : -1;
            cout << "[" << node->val << ",";
            if (randIdx == -1) cout << "null";
            else cout << randIdx;
            cout << "]";
        }
    }
    cout << "]" << endl;`;
      }
    } else if (outputType.includes('vector<vector')) {
      return `for (size_t i = 0; i < result.size(); i++) {
        if (i > 0) cout << " ";
        for (size_t j = 0; j < result[i].size(); j++) {
            if (j > 0) cout << " ";
            cout << result[i][j];
        }
    }
    cout << endl;`;
    } else if (outputType.includes('vector')) {
      return `for (size_t i = 0; i < result.size(); i++) {
        if (i > 0) cout << " ";
        cout << result[i];
    }
    cout << endl;`;
    } else if (outputType.includes('string')) {
      return `cout << result << endl;`;
    } else if (outputType.includes('void')) {
      return ``;
    }
    return `cout << result << endl;`;
  }
}

export default new CodeWrapperGenerator();