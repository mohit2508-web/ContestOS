import { evaluateWithPlaywright } from './services/webDevEvaluatorV2';
import { evaluateWebDev } from './services/webDevEvaluator';
import prisma from './lib/prisma';

async function main() {
  const problem = await prisma.problem.findUnique({
    where: { id: '1fcf031b-0ee9-40a5-9c70-035af88970df' },
    include: { testCases: true }
  });

  if (!problem) return;

  const starter = problem.starterCode as any;

  // Full candidate working JS implementation
  const candidateJs = `
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

  console.log('--- TESTING EVALUATE WITH PLAYWRIGHT (V2) ---');
  const resV2 = await evaluateWithPlaywright({
    html: starter.html,
    css: starter.css,
    js: candidateJs,
    testCases: problem.testCases,
    timeoutMs: 15000
  });

  console.log('Playwright V2 Results:');
  console.log(JSON.stringify(resV2, null, 2));

  console.log('\n--- TESTING EVALUATE WITH JSDOM (V1) ---');
  const resV1 = await evaluateWebDev({
    html: starter.html,
    css: starter.css,
    js: candidateJs,
    testCases: problem.testCases
  });

  console.log('JSDOM V1 Results:');
  console.log(JSON.stringify(resV1, null, 2));
}

main().finally(() => prisma.$disconnect());
