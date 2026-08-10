import { evaluateWebDev, parseWebDevSpec } from './services/webDevEvaluator';
import process from 'process';

async function runIntegrationSuite() {
  console.log('🧪 Starting Kryptavia OS WebDev Subsystem Automated Integration Suite...\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ PASSED: ${testName}`);
    } else {
      console.error(`  ❌ FAILED: ${testName} ${detail ? `(${detail})` : ''}`);
    }
  }

  // TEST GROUP 1: Spec Parser
  console.log('--- TEST GROUP 1: WebDev Spec Parser ---');
  const s1 = parseWebDevSpec('#btn@click.textContent');
  assert(s1.selector === '#btn' && s1.action === 'click' && s1.property === 'textContent', 'Parses selector@action.property');

  const s2 = parseWebDevSpec('count:li');
  assert(s2.selector === 'li' && s2.property === 'count', 'Parses count: prefix');

  const s3 = parseWebDevSpec('#input@input=John.value');
  assert(s3.selector === '#input' && s3.action === 'input' && s3.actionValue === 'John' && s3.property === 'value', 'Parses action with value');

  const s4 = parseWebDevSpec('{"selector":"#btn","action":"click","property":"textContent"}');
  assert(s4.selector === '#btn' && s4.action === 'click' && s4.property === 'textContent', 'Parses JSON object spec');

  const s5 = parseWebDevSpec('#title');
  assert(s5.selector === '#title' && s5.property === 'exists', 'Plain selector defaults to exists');

  // TEST GROUP 2: Basic DOM Assertions
  console.log('\n--- TEST GROUP 2: Basic DOM Assertions ---');
  const eval1 = await evaluateWebDev({
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Sample</title></head><body><h1 id="title">Hello World</h1><ul><li>A</li><li>B</li><li>C</li></ul></body></html>`,
    css: `#title { color: #333; } ul { list-style: none; padding: 0; } li { margin: 4px 0; }`,
    js: '',
    testCases: [
      { input: '#title.textContent', expectedOutput: 'Hello World' },
      { input: '#title', expectedOutput: 'true' },
      { input: 'count:li', expectedOutput: '3' },
      { input: '#missing', expectedOutput: 'false' },
      { input: 'h1.textContent', expectedOutput: '~Hello' },
    ],
  });
  assert(eval1.summary.passed === 5, 'All 5 basic DOM assertions pass', `passed ${eval1.summary.passed}/5`);
  assert(eval1.results.every((r) => r.executionTime >= 0), 'Each result has executionTime');

  // TEST GROUP 3: Event Dispatch & JS Interaction
  console.log('\n--- TEST GROUP 3: Event Dispatch & JS Interaction ---');
  const eval2 = await evaluateWebDev({
    html: `<button id="btn" onclick="window.__clicks=(window.__clicks||0)+1">Click</button><span id="out">0</span>`,
    css: '',
    js: `document.getElementById('btn').addEventListener('click', function(){ var o=document.getElementById('out'); o.textContent = (parseInt(o.textContent||'0')+1)+''; });`,
    testCases: [
      { input: '#btn@click => #out.textContent', expectedOutput: '1' },
      { input: '#btn@click,#btn@click => #out.textContent', expectedOutput: '2' },
    ],
  });
  assert(eval2.summary.passed === 2, 'Click event increments counter (2 assertions pass)', `passed ${eval2.summary.passed}/2`);

  // TEST GROUP 4: Input Events
  console.log('\n--- TEST GROUP 4: Input Event Value Setting ---');
  const eval3 = await evaluateWebDev({
    html: `<input id="name" /><span id="display"></span>`,
    css: '',
    js: `document.getElementById('name').addEventListener('input', function(){ document.getElementById('display').textContent = this.value; });`,
    testCases: [
      { input: '#name@input=John => #display.textContent', expectedOutput: 'John' },
    ],
  });
  assert(eval3.summary.passed === 1, 'Input event reflects typed value', `passed ${eval3.summary.passed}/1`);

  // TEST GROUP 5: Computed Styles
  console.log('\n--- TEST GROUP 5: Computed Style Assertions ---');
  const eval4 = await evaluateWebDev({
    html: `<div id="box" class="card">Card</div>`,
    css: `#box { color: red; background-color: rgb(0, 0, 255); } .card { font-weight: bold; }`,
    js: '',
    testCases: [
      { input: '#box.style.color', expectedOutput: 'rgb(255, 0, 0)' },
      { input: '#box.computed.background-color', expectedOutput: 'rgb(0, 0, 255)' },
      { input: '#box.computed.font-weight', expectedOutput: 'bold' },
    ],
  });
  assert(eval4.summary.passed === 3, 'Computed styles asserted correctly', `passed ${eval4.summary.passed}/3`);

  // TEST GROUP 6: Rubric Scoring
  console.log('\n--- TEST GROUP 6: Rubric Scoring (40/20/20/20) ---');
  assert(eval1.rubric.total >= 90, 'Fully passing page scores >= 90', `total ${eval1.rubric.total}`);
  assert(eval1.rubric.functionality === 1, 'Functionality = 1.0 when all tests pass');

  const eval5 = await evaluateWebDev({
    html: `<button onclick="x()">No</button>`,
    css: '',
    js: `function x(){ throw new Error('boom'); }`,
    testCases: [{ input: '#missing', expectedOutput: 'true' }],
  });
  assert(eval5.summary.passed === 0, 'Failing test case produces 0 passed');
  assert(eval5.rubric.total < 70, 'Failing page scores < 70', `total ${eval5.rubric.total}`);

  // TEST GROUP 7: Console Capture & Sandbox Isolation
  console.log('\n--- TEST GROUP 7: Console Capture & Sandbox Isolation ---');
  const eval6 = await evaluateWebDev({
    html: `<p id="p">P</p>`,
    css: '',
    js: `console.log('hello from page'); console.error('a warning');`,
    testCases: [],
  });
  assert(eval6.consoleLogs.some((l) => l.method === 'log' && l.message.includes('hello from page')), 'Captures console.log from page JS');
  assert(eval6.consoleLogs.some((l) => l.method === 'error'), 'Captures console.error from page JS');

  // Isolation: global window.__x from one page must not leak into the next
  const eval7a = await evaluateWebDev({
    html: `<p>a</p>`,
    css: '',
    js: `window.__x = 42;`,
    testCases: [],
  });
  const eval7b = await evaluateWebDev({
    html: `<p>b</p>`,
    css: '',
    js: ``,
    testCases: [{ input: 'body.textContent', expectedOutput: 'a' }],
  });
  assert(eval7a.executionTime >= 0, 'First isolated page ran');
  assert(eval7b.summary.passed === 0, 'Second page is isolated (does not contain previous page content)');

  // TEST GROUP 8: Accessibility Audit
  console.log('\n--- TEST GROUP 8: Accessibility Heuristic Audit ---');
  const eval8 = await evaluateWebDev({
    html: `<html lang="en"><body><img src="x.png" alt="chart" /><button>Submit</button><label for="email">Email</label><input id="email" /></body></html>`,
    css: '',
    js: '',
    testCases: [],
  });
  assert(eval8.rubric.accessibility === 1, 'Accessible page audits 1.0', `a11y ${eval8.rubric.accessibility}`);

  const eval9 = await evaluateWebDev({
    html: `<html><body><img src="x.png" /><button></button><input /></body></html>`,
    css: '',
    js: '',
    testCases: [],
  });
  assert(eval9.rubric.accessibility < 0.5, 'Inaccessible page audits < 0.5', `a11y ${eval9.rubric.accessibility}`);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 Results: ${passedTests}/${totalTests} assertions passed`);
  console.log(`${'='.repeat(60)}`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runIntegrationSuite().catch((err) => {
  console.error('Integration suite crashed:', err);
  process.exit(1);
});
