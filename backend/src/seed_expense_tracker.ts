import prisma from './lib/prisma';
import { evaluateWithPlaywright } from './services/webDevEvaluatorV2';

const problemData = {
  title: "Interactive Expense Tracker with Category Filter",
  description: `Build a responsive Expense Tracker application with real-time total summary calculations and dynamic category filtering.

### Requirements:
1. **Adding Expenses**:
   - User inputs an expense description in \`#title-input\` and amount in \`#amount-input\` (number).
   - User selects a category from \`#category-select\` (options: \`food\`, \`travel\`, \`bills\`, \`entertainment\`).
   - Clicking \`#add-expense-btn\` creates an \`.expense-card\` inside \`#expense-list\`.
   - Each \`.expense-card\` displays description, category, amount, and a \`.delete-btn\` button.
   - Clears inputs after adding.

2. **Dynamic Total Calculation**:
   - \`#total-amount\` textContent must display the sum of all currently visible expense amounts.

3. **Filtering**:
   - Selecting a category from \`#filter-select\` filters visible \`.expense-card\` elements.
   - Selecting \`all\` shows all expenses.

4. **Deleting Expenses**:
   - Clicking \`.delete-btn\` on any \`.expense-card\` removes it from DOM and updates \`#total-amount\`.`,
  difficulty: "MEDIUM",
  problemType: "web-dev",
  tags: JSON.stringify(["DOM", "JavaScript", "Events", "Array Methods"]),
  sampleInput: "Title: Groceries, Amount: 50, Category: food -> Click #add-expense-btn",
  sampleOutput: "#total-amount displays 50; #expense-list contains 1 .expense-card",
  constraints: "Inputs must be validated (non-empty title, positive numeric amount > 0).",
  starterCode: {
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Expense Tracker</title>
</head>
<body>
  <div class="app-container">
    <h2>Expense Tracker</h2>
    
    <div class="form-card">
      <input id="title-input" type="text" placeholder="Expense description..." />
      <input id="amount-input" type="number" placeholder="Amount ($)" />
      <select id="category-select">
        <option value="food">Food</option>
        <option value="travel">Travel</option>
        <option value="bills">Bills</option>
        <option value="entertainment">Entertainment</option>
      </select>
      <button id="add-expense-btn">Add Expense</button>
    </div>

    <div class="filter-bar">
      <label>Filter By:</label>
      <select id="filter-select">
        <option value="all">All Categories</option>
        <option value="food">Food</option>
        <option value="travel">Travel</option>
        <option value="bills">Bills</option>
        <option value="entertainment">Entertainment</option>
      </select>
    </div>

    <div class="summary-card">
      Total Expenses: $<span id="total-amount">0</span>
    </div>

    <ul id="expense-list"></ul>
  </div>
</body>
</html>`,
    css: `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; }
.app-container { max-width: 500px; margin: 0 auto; background: #1e293b; padding: 24px; border-radius: 12px; }
h2 { margin-bottom: 16px; text-align: center; color: #38bdf8; }
.form-card { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
input, select { padding: 10px; border-radius: 6px; border: 1px solid #334155; background: #0f172a; color: white; }
#add-expense-btn { padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
#add-expense-btn:hover { background: #2563eb; }
.filter-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.summary-card { background: #0f172a; padding: 12px; border-radius: 6px; text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 16px; }
#total-amount { color: #4ade80; }
#expense-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
.expense-card { background: #334155; padding: 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; }
.delete-btn { background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; }`,
    javascript: `// Initialize Expense Tracker
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  const addBtn = document.getElementById('add-expense-btn');
  if (addBtn) addBtn.addEventListener('click', addExpense);
  
  const filterSel = document.getElementById('filter-select');
  if (filterSel) filterSel.addEventListener('change', filterExpenses);
}

function addExpense() {
  // TODO: Read title, amount, category
  // TODO: Validate inputs
  // TODO: Create .expense-card with .delete-btn
  // TODO: Update #total-amount
}

function filterExpenses() {
  // TODO: Show/hide .expense-card elements based on filter selection
  // TODO: Update #total-amount for visible items
}`
  },
  testCases: [
    {
      input: JSON.stringify({
        steps: [
          { action: "type", selector: "#title-input", value: "Groceries" },
          { action: "type", selector: "#amount-input", value: "50" },
          { action: "select", selector: "#category-select", value: "food" },
          { action: "click", selector: "#add-expense-btn" }
        ],
        assert: { selector: "#total-amount", property: "textContent", expected: "50" }
      }),
      expectedOutput: "50",
      isHidden: false
    },
    {
      input: JSON.stringify({
        steps: [
          { action: "type", selector: "#title-input", value: "Groceries" },
          { action: "type", selector: "#amount-input", value: "50" },
          { action: "select", selector: "#category-select", value: "food" },
          { action: "click", selector: "#add-expense-btn" }
        ],
        assert: { selector: "#expense-list .expense-card", property: "count", expected: "1" }
      }),
      expectedOutput: "1",
      isHidden: false
    },
    {
      input: JSON.stringify({
        steps: [
          { action: "type", selector: "#title-input", value: "Flight ticket" },
          { action: "type", selector: "#amount-input", value: "150" },
          { action: "select", selector: "#category-select", value: "travel" },
          { action: "click", selector: "#add-expense-btn" },
          { action: "type", selector: "#title-input", value: "Dinner" },
          { action: "type", selector: "#amount-input", value: "30" },
          { action: "select", selector: "#category-select", value: "food" },
          { action: "click", selector: "#add-expense-btn" }
        ],
        assert: { selector: "#total-amount", property: "textContent", expected: "180" }
      }),
      expectedOutput: "180",
      isHidden: true
    },
    {
      input: JSON.stringify({
        steps: [
          { action: "type", selector: "#title-input", value: "Lunch" },
          { action: "type", selector: "#amount-input", value: "20" },
          { action: "select", selector: "#category-select", value: "food" },
          { action: "click", selector: "#add-expense-btn" },
          { action: "click", selector: "#expense-list .expense-card .delete-btn" }
        ],
        assert: { selector: "#total-amount", property: "textContent", expected: "0" }
      }),
      expectedOutput: "0",
      isHidden: true
    }
  ]
};

// Reference Solution JS
const solutionJs = `
let expenses = [];

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  const addBtn = document.getElementById('add-expense-btn');
  if (addBtn) addBtn.addEventListener('click', addExpense);
  
  const filterSel = document.getElementById('filter-select');
  if (filterSel) filterSel.addEventListener('change', render);
}

function addExpense() {
  const titleInput = document.getElementById('title-input');
  const amountInput = document.getElementById('amount-input');
  const categorySelect = document.getElementById('category-select');

  const title = titleInput.value.trim();
  const amount = parseFloat(amountInput.value);
  const category = categorySelect.value;

  if (!title || isNaN(amount) || amount <= 0) return;

  const item = { id: Date.now(), title, amount, category };
  expenses.push(item);

  titleInput.value = '';
  amountInput.value = '';

  render();
}

function deleteExpense(id) {
  expenses = expenses.filter(e => e.id !== id);
  render();
}

function render() {
  const list = document.getElementById('expense-list');
  const filterSel = document.getElementById('filter-select');
  const filterVal = filterSel ? filterSel.value : 'all';

  list.innerHTML = '';
  let total = 0;

  expenses.forEach(item => {
    if (filterVal !== 'all' && item.category !== filterVal) return;

    total += item.amount;

    const li = document.createElement('li');
    li.className = 'expense-card';
    li.dataset.category = item.category;

    const info = document.createElement('span');
    info.textContent = item.title + ' ($' + item.amount + ') [' + item.category + ']';
    li.appendChild(info);

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.textContent = 'Delete';
    delBtn.onclick = function() { deleteExpense(item.id); };
    li.appendChild(delBtn);

    list.appendChild(li);
  });

  const totalEl = document.getElementById('total-amount');
  if (totalEl) totalEl.textContent = String(total);
}
`;

async function main() {
  console.log('🚀 Seeding Problem to CockroachDB Database...');

  // Search existing or create
  const existing = await prisma.problem.findFirst({
    where: { title: problemData.title }
  });

  let problemId = existing?.id;

  if (existing) {
    console.log(`Found existing problem ID: ${problemId}`);
    // Delete existing test cases
    await prisma.testCase.deleteMany({ where: { problemId } });
    await prisma.problem.update({
      where: { id: problemId },
      data: {
        description: problemData.description,
        starterCode: problemData.starterCode as any,
      }
    });
  } else {
    const created = await prisma.problem.create({
      data: {
        title: problemData.title,
        slug: "interactive-expense-tracker-with-category-filter-" + Date.now(),
        description: problemData.description,
        difficulty: problemData.difficulty,
        category: "Web Development",
        problemType: problemData.problemType,
        starterCode: problemData.starterCode as any,
      }
    });
    problemId = created.id;
    console.log(`Created new problem ID: ${problemId}`);
  }

  // Create test cases
  for (let i = 0; i < problemData.testCases.length; i++) {
    const tc = problemData.testCases[i];
    await prisma.testCase.create({
      data: {
        problemId: problemId!,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: tc.isHidden,
        order: i + 1,
      }
    });
  }

  console.log('✅ Problem & Test Cases Seeded successfully!');

  // Verify against Playwright Evaluator
  console.log('\n🧪 Verifying Reference Solution against Playwright V2 Evaluator...');

  const evaluation = await evaluateWithPlaywright({
    html: problemData.starterCode.html,
    css: problemData.starterCode.css,
    js: solutionJs,
    testCases: problemData.testCases.map((tc, idx) => ({
      id: `tc-${idx}`,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      isHidden: tc.isHidden
    })),
    timeoutMs: 15000
  });

  console.log('\n📊 Playwright Evaluation Result:');
  console.log(`Total: ${evaluation.summary.total} | Passed: ${evaluation.summary.passed} | Failed: ${evaluation.summary.failed}`);
  console.log(`Score: ${evaluation.rubric.total}/100`);

  if (evaluation.summary.passed === evaluation.summary.total) {
    console.log('🎉 100% PERFECT VERIFICATION! Solution passed all test cases!');
  } else {
    console.error('❌ Verification warning:', evaluation.results);
  }

  console.log('\n============================================================');
  console.log('JSON IMPORT PAYLOAD (FOR PORTAL MAPPING):');
  console.log('============================================================');
  console.log(JSON.stringify({ id: problemId, ...problemData, solutionJs }, null, 2));
}

main().finally(() => prisma.$disconnect());
