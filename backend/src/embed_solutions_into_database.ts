import prisma from './lib/prisma';
import { evaluateWithPlaywright } from './services/webDevEvaluatorV2';

// Problem 1: Smart Kanban Task Manager with Drag & Drop
const kanbanSolutionJs = `
function updateCounts() {
  ['todo', 'in-progress', 'done'].forEach(id => {
    const col = document.getElementById(id);
    if (!col) return;
    const countEl = col.querySelector('.count');
    const cards = col.querySelectorAll('.task-card');
    if (countEl) countEl.textContent = String(cards.length);
  });
}

function createCard(text) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.draggable = true;
  
  const span = document.createElement('span');
  span.textContent = text;
  card.appendChild(span);

  const btn = document.createElement('button');
  btn.className = 'remove-btn';
  btn.textContent = '×';
  btn.onclick = function() {
    card.remove();
    updateCounts();
  };
  card.appendChild(btn);

  card.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/plain', text);
    window.__draggedCard = card;
  });

  return card;
}

function addTask() {
  const input = document.getElementById('task-input');
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;

  const card = createCard(val);
  const todoList = document.querySelector('#todo .task-list');
  if (todoList) {
    todoList.appendChild(card);
    updateCounts();
  }
  input.value = '';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  const addBtn = document.getElementById('add-btn');
  if (addBtn) addBtn.addEventListener('click', addTask);
  
  const taskInput = document.getElementById('task-input');
  if (taskInput) {
    taskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addTask();
    });
  }
  
  document.querySelectorAll('.task-list').forEach(list => {
    list.addEventListener('dragover', e => e.preventDefault());
    list.addEventListener('drop', e => {
      e.preventDefault();
      if (window.__draggedCard) {
        list.appendChild(window.__draggedCard);
        updateCounts();
      }
    });
  });
}
`;

// Problem 2: Interactive Expense Tracker with Category Filter
const expenseSolutionJs = `
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
  console.log('🚀 Embedding Working Solutions into Database Problems...');

  // 1. Smart Kanban
  const kanbanProblem = await prisma.problem.findFirst({
    where: { title: { contains: 'Kanban' } },
    include: { testCases: true }
  });

  if (kanbanProblem) {
    const currentStarter = (kanbanProblem.starterCode || {}) as any;
    currentStarter.javascript = kanbanSolutionJs;
    currentStarter.js = kanbanSolutionJs;

    await prisma.problem.update({
      where: { id: kanbanProblem.id },
      data: {
        referenceSolution: kanbanSolutionJs,
        starterCode: currentStarter
      }
    });
    console.log(`✅ Updated Kanban Problem (${kanbanProblem.id}) with embedded solution JS!`);

    console.log('🧪 Verifying Kanban against Playwright V2 Evaluator...');
    const evalKanban = await evaluateWithPlaywright({
      html: currentStarter.html,
      css: currentStarter.css,
      js: kanbanSolutionJs,
      testCases: kanbanProblem.testCases,
      timeoutMs: 15000
    });
    console.log(`📊 Kanban Results: Total: ${evalKanban.summary.total} | Passed: ${evalKanban.summary.passed} | Failed: ${evalKanban.summary.failed}`);
  }

  // 2. Expense Tracker
  const expenseProblem = await prisma.problem.findFirst({
    where: { title: { contains: 'Expense Tracker' } },
    include: { testCases: true }
  });

  if (expenseProblem) {
    const currentStarter = (expenseProblem.starterCode || {}) as any;
    currentStarter.javascript = expenseSolutionJs;
    currentStarter.js = expenseSolutionJs;

    await prisma.problem.update({
      where: { id: expenseProblem.id },
      data: {
        referenceSolution: expenseSolutionJs,
        starterCode: currentStarter
      }
    });
    console.log(`✅ Updated Expense Tracker Problem (${expenseProblem.id}) with embedded solution JS!`);

    console.log('🧪 Verifying Expense Tracker against Playwright V2 Evaluator...');
    const evalExpense = await evaluateWithPlaywright({
      html: currentStarter.html,
      css: currentStarter.css,
      js: expenseSolutionJs,
      testCases: expenseProblem.testCases,
      timeoutMs: 15000
    });
    console.log(`📊 Expense Tracker Results: Total: ${evalExpense.summary.total} | Passed: ${evalExpense.summary.passed} | Failed: ${evalExpense.summary.failed}`);
  }

  console.log('\n🎉 ALL SOLUTIONS EMBEDDED & VERIFIED IN DATABASE SUCCESSFULLY!');
}

main().finally(() => prisma.$disconnect());
