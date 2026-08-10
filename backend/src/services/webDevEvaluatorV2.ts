/**
 * Kryptavia OS Web Dev Playground — Playwright-Based Server-Side Evaluation Engine (V2)
 *
 * This is the production-grade evaluator used for "/submit" route.
 * It uses a real headless Chromium browser (Playwright) instead of JSDOM.
 *
 * WHY PLAYWRIGHT INSTEAD OF JSDOM:
 *  - Real browser: CSS computed styles, layout, real DataTransfer in drag events
 *  - Real keyboard events: Enter key, Tab, Escape work natively
 *  - Real DOM mutations: .remove(), .appendChild(), classList updates
 *  - No NLP parsing needed: uses structured JSON test case steps directly
 *  - Zero false positives: what you see in browser = what evaluator sees
 *
 * Test Case Format (NEW — Structured JSON):
 * ------------------------------------------
 * Input field contains JSON:
 * {
 *   "steps": [
 *     { "action": "type",  "selector": "#task-input", "value": "Hello" },
 *     { "action": "click", "selector": "#add-btn" }
 *   ],
 *   "assert": {
 *     "selector": "#todo .count",
 *     "property": "textContent",
 *     "expected": "1",
 *     "matchMode": "exact"   // or "contains" or "numeric"
 *   }
 * }
 * expectedOutput field = "1"  (directly matched — no NLP)
 *
 * Also supports legacy DSL format via parseWebDevSpec (backward-compatible).
 */

import { chromium, Browser, BrowserContext } from 'playwright';
import type { Page } from 'playwright';
import { evaluateWebDev, WebDevTestCase, WebDevTestResult, WebDevSummary, WebDevRubric, WebDevEvaluation, WebDevConsoleLog } from './webDevEvaluator';

// ─── Singleton Browser Instance ───────────────────────────────────────────────
// We keep ONE browser instance alive for the lifetime of the process.
// Each submission gets its own BrowserContext (isolated, fast ~30ms).
let _browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!_browser || !_browser.isConnected()) {
    _browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
  }
  return _browser;
}

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface StructuredStep {
  action: 'type' | 'click' | 'drag' | 'press' | 'select' | 'hover' | 'dragstart' | 'drop' | 'dblclick';
  selector: string;
  value?: string;
  targetSelector?: string; // For drag → drop target
  key?: string;             // For press actions e.g. "Enter"
}

interface StructuredAssert {
  selector: string;
  property: 'textContent' | 'count' | 'exists' | 'value' | 'className' | 'checked' | 'disabled' | string;
  expected: string;
  matchMode?: 'exact' | 'contains' | 'numeric';
}

interface StructuredTestCase {
  steps: StructuredStep[];
  assert: StructuredAssert;
}

// ─── HTML Document Builder ────────────────────────────────────────────────────
function buildDocument(html: string, css: string, js: string): string {
  const safeHtml = html || '';
  const safeCss = css || '';
  const safeJs = js || '';

  // Fix DOMContentLoaded timing: if DOM already loaded, run init immediately
  const wrappedJs = `
(function() {
  var _realDocAdd = document.addEventListener;
  var _realWinAdd = window.addEventListener;

  function triggerImmediate(fn, type, target) {
    try {
      if (typeof fn === 'function') {
        fn({ type: type, target: target, defaultPrevented: false });
      } else if (fn && typeof fn.handleEvent === 'function') {
        fn.handleEvent({ type: type, target: target, defaultPrevented: false });
      }
    } catch(e) {
      if (typeof console !== 'undefined') console.error('[Kryptavia OS]', e);
    }
  }

  document.addEventListener = function(type, listener, options) {
    if ((type === 'DOMContentLoaded' || type === 'load') && (document.readyState === 'complete' || document.readyState === 'interactive')) {
      triggerImmediate(listener, type, document);
      return;
    }
    return _realDocAdd.call(document, type, listener, options);
  };

  window.addEventListener = function(type, listener, options) {
    if ((type === 'DOMContentLoaded' || type === 'load') && (document.readyState === 'complete' || document.readyState === 'interactive')) {
      triggerImmediate(listener, type, window);
      return;
    }
    return _realWinAdd.call(window, type, listener, options);
  };

  try {
    Object.defineProperty(window, 'onload', {
      set: function(fn) {
        if (typeof fn === 'function') triggerImmediate(fn, 'load', window);
      },
      get: function() { return null; },
      configurable: true
    });
  } catch(e) {}

  try {
    ${safeJs}
  } catch(e) {
    if (typeof console !== 'undefined') console.error('[Kryptavia OS]', e.message);
  }
})();
`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Kryptavia OS Playground</title>
  <style>${safeCss}</style>
</head>
<body>
${safeHtml}
<script>${wrappedJs}</script>
</body>
</html>`;
}

// ─── Step Executor ────────────────────────────────────────────────────────────
async function executeStep(page: Page, step: StructuredStep): Promise<void> {
  const el = page.locator(step.selector).first();

  switch (step.action) {
    case 'type':
      await el.fill(step.value ?? '');
      break;

    case 'click':
      await el.click({ timeout: 3000 });
      break;

    case 'dblclick':
      await el.dblclick({ timeout: 3000 });
      break;

    case 'hover':
      await el.hover({ timeout: 3000 });
      break;

    case 'press':
      await page.keyboard.press(step.key ?? step.value ?? 'Enter');
      break;

    case 'select':
      await el.selectOption(step.value ?? '');
      break;

    case 'drag': {
      // Real drag-and-drop via Playwright's dragTo
      const target = page.locator(step.targetSelector ?? step.value ?? 'body').first();
      await el.dragTo(target, { timeout: 5000 });
      break;
    }

    case 'dragstart':
    case 'drop': {
      // Simulate via evaluate for complex dataTransfer scenarios
      await page.evaluate(({ selector, action }: { selector: string; action: string }) => {
        const el = document.querySelector(selector) as HTMLElement | null;
        if (!el) return;
        const dataStore: Record<string, string> = {};
        const dataTransfer = {
          setData: (type: string, val: string) => { dataStore[type] = val; },
          getData: (type: string) => dataStore[type] || '',
          effectAllowed: 'move',
          dropEffect: 'move',
          types: [] as string[],
          files: [] as File[],
          items: [] as DataTransferItem[],
          clearData: () => {},
        } as unknown as DataTransfer;
        const evt = new DragEvent(action, { bubbles: true, cancelable: true, dataTransfer });
        el.dispatchEvent(evt);
      }, { selector: step.selector, action: step.action });
      break;
    }

    default:
      // Fallback: try click
      try { await el.click({ timeout: 2000 }); } catch { /* ignore */ }
  }

  // Short settle after each interaction
  await page.waitForTimeout(50);
}

// ─── Property Reader ──────────────────────────────────────────────────────────
async function readProperty(page: Page, assert: StructuredAssert): Promise<string> {
  const { selector, property } = assert;

  if (property === 'count') {
    const count = await page.locator(selector).count();
    return String(count);
  }

  if (property === 'exists') {
    const count = await page.locator(selector).count();
    return count > 0 ? 'true' : 'false';
  }

  // Text content
  if (property === 'textContent' || property === 'innerText') {
    try {
      const text = await page.locator(selector).first().innerText({ timeout: 2000 });
      return (text ?? '').trim();
    } catch {
      return '';
    }
  }

  // Form value
  if (property === 'value') {
    try {
      return await page.locator(selector).first().inputValue({ timeout: 2000 });
    } catch {
      return '';
    }
  }

  // Boolean attributes
  if (property === 'checked') {
    try {
      return String(await page.locator(selector).first().isChecked({ timeout: 2000 }));
    } catch {
      return 'false';
    }
  }

  if (property === 'disabled') {
    try {
      return String(await page.locator(selector).first().isDisabled({ timeout: 2000 }));
    } catch {
      return 'false';
    }
  }

  // Generic attribute or JS property
  try {
    const result = await page.locator(selector).first().evaluate(
      (el: Element, prop: string) => {
        // Handle attr:name
        if (prop.startsWith('attr:')) {
          return el.getAttribute(prop.slice(5)) ?? '';
        }
        // Handle style:prop
        if (prop.startsWith('style:')) {
          const styleProp = prop.slice(6);
          return (el as HTMLElement).style?.[styleProp as any] ?? '';
        }
        // Handle computed:prop
        if (prop.startsWith('computed:')) {
          const computedProp = prop.slice(9);
          return window.getComputedStyle(el)[computedProp as any] ?? '';
        }
        // Generic DOM property
        return String((el as any)[prop] ?? '');
      },
      property,
      { timeout: 2000 }
    );
    return (result ?? '').trim();
  } catch {
    return '';
  }
}

// ─── Smart Comparison ─────────────────────────────────────────────────────────
function compareResult(actual: string, assert: StructuredAssert): boolean {
  let expected = assert.expected ?? '';
  // Auto-extract quoted number/target if expected is a sentence e.g. "becomes '1'" or "equals '3'"
  if (expected.length > 10 && (expected.includes("'") || expected.includes('"'))) {
    const extractedMatch = expected.match(/(?:becomes|equals|is|count|value|to)\s+['"]([^'"]+)['"]/i);
    if (extractedMatch) {
      expected = extractedMatch[1];
    }
  }

  const matchMode = assert.matchMode ?? 'exact';
  const a = actual.toLowerCase().trim();
  const e = expected.toLowerCase().trim();

  if (!e) return a === '';

  if (matchMode === 'contains' || e.startsWith('~')) {
    const needle = e.startsWith('~') ? e.slice(1) : e;
    return a.includes(needle);
  }

  if (matchMode === 'numeric') {
    const an = parseFloat(actual);
    const en = parseFloat(expected);
    return !isNaN(an) && !isNaN(en) && Math.abs(an - en) < 1e-9;
  }

  // Numeric auto-detect
  const an = parseFloat(actual);
  const en = parseFloat(expected);
  if (!isNaN(an) && !isNaN(en)) {
    return Math.abs(an - en) < 1e-9;
  }

  // Exact match (whitespace-collapsed)
  return a === e;
}

// ─── Test Case Parser ─────────────────────────────────────────────────────────
function parseStructuredTestCase(input: string, expectedOutput: string): StructuredTestCase | null {
  try {
    const parsed = JSON.parse((input ?? '').trim());
    if (parsed?.steps && parsed?.assert) {
      // Ensure expected is set from expectedOutput if not in assert
      if (parsed.assert.expected === undefined) {
        parsed.assert.expected = expectedOutput;
      }
      return parsed as StructuredTestCase;
    }
    // Simple JSON { selector, action, value, property }
    if (parsed?.selector) {
      return {
        steps: parsed.action ? [{
          action: parsed.action,
          selector: parsed.selector,
          value: parsed.value,
        }] : [],
        assert: {
          selector: parsed.selector,
          property: parsed.property ?? 'textContent',
          expected: expectedOutput,
        },
      };
    }
  } catch { /* not JSON */ }
  return null;
}

// ─── Main Evaluator ───────────────────────────────────────────────────────────
export async function evaluateWithPlaywright(params: {
  html: string;
  css: string;
  js: string;
  testCases: WebDevTestCase[];
  timeoutMs?: number;
}): Promise<WebDevEvaluation> {
  const { html, css, js, testCases, timeoutMs = 10000 } = params;
  const startTime = Date.now();
  const results: WebDevTestResult[] = [];
  const consoleLogs: WebDevConsoleLog[] = [];
  const errors: string[] = [];
  let timedOut = false;

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    try {
      browser = await getBrowser();
    } catch (browserErr: any) {
      console.warn('[WebDevEvaluatorV2] Playwright browser launch failed, falling back to evaluateWebDev (JSDOM):', browserErr.message);
      return evaluateWebDev({ html, css, js, testCases });
    }
    const documentHtml = buildDocument(html, css, js);

    for (let idx = 0; idx < testCases.length; idx++) {
      const tc = testCases[idx];
      const tcStart = Date.now();

      // Each test case gets a fresh isolated browser context
      context = await browser.newContext();
      const page = await context.newPage();

      // Capture console logs
      page.on('console', (msg) => {
        consoleLogs.push({ method: msg.type(), message: msg.text() });
      });

      let actualOutput = '';
      let testError: string | undefined;
      let passed = false;
      let structured: StructuredTestCase | null = null;

      try {
        await page.setContent(documentHtml, { waitUntil: 'domcontentloaded', timeout: 5000 });
        // Allow scripts to settle
        await page.waitForTimeout(200);

        // Detect structured JSON or legacy DSL
        structured = parseStructuredTestCase(tc.input, tc.expectedOutput);

        if (structured) {
          // Execute all interaction steps
          for (const step of structured.steps) {
            try {
              await executeStep(page, step);
            } catch (stepErr: any) {
              testError = `Step error: ${stepErr?.message || stepErr}`;
            }
          }

          // Read the asserted property
          actualOutput = await readProperty(page, structured.assert);
          passed = compareResult(actualOutput, structured.assert);
        } else {
          // Legacy DSL fallback: try to read selector existence/property
          const selector = tc.input.trim();
          const count = await page.locator(selector).count();
          actualOutput = count > 0 ? 'true' : 'false';
          passed = actualOutput === (tc.expectedOutput ?? 'true');
        }
      } catch (err: any) {
        testError = err?.message || String(err);
        actualOutput = '';
        passed = false;
      } finally {
        try { await context.close(); } catch { /* ignore */ }
        context = null;
      }

      console.log(`\n  🧪 [Test ${idx + 1}/${testCases.length}]`);
      if (structured) {
        console.log(`     Steps: ${JSON.stringify(structured.steps)}`);
        console.log(`     Assert: ${structured.assert.selector} [${structured.assert.property}] | Expected: "${structured.assert.expected}"`);
        console.log(`     Actual Read: "${actualOutput}"`);
      } else {
        console.log(`     Legacy: "${tc.input}" | Expected: "${tc.expectedOutput}" | Actual: "${actualOutput}"`);
      }
      if (testError) {
        console.log(`     ⚠️ Error: ${testError}`);
      }
      console.log(`     Result: ${passed ? '✅ PASSED' : '❌ FAILED'}`);

      results.push({
        testCase: idx + 1,
        passed,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput,
        executionTime: Date.now() - tcStart,
        error: testError,
        isHidden: tc.isHidden || false,
      });

      // Global timeout check
      if (Date.now() - startTime > timeoutMs) {
        timedOut = true;
        break;
      }
    }
  } catch (err: any) {
    errors.push(err?.message || String(err));
    timedOut = Date.now() - startTime > timeoutMs;
  } finally {
    if (context) { try { await context.close(); } catch { /* ignore */ } }
    // Note: We do NOT close the browser — it's a singleton kept alive for reuse
  }

  const summary: WebDevSummary = {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
  };

  const functionalityScore = summary.total > 0
    ? Math.round((summary.passed / summary.total) * 100) / 100
    : 0;

  const rubric: WebDevRubric = {
    functionality: functionalityScore,
    styling: 0.8,         // Default — visual scoring needs screenshot comparison
    accessibility: 0.7,  // Default — axe-core scan can be added later
    codeQuality: 0.8,     // Default — eslint scoring can be added later
    total: Math.round(
      (0.4 * functionalityScore + 0.2 * 0.8 + 0.2 * 0.7 + 0.2 * 0.8) * 100
    ),
  };

  return {
    success: summary.failed === 0 && errors.length === 0,
    results,
    summary,
    rubric,
    consoleLogs,
    errors,
    executionTime: Date.now() - startTime,
    timedOut,
  };
}

// ─── Graceful Browser Shutdown ────────────────────────────────────────────────
// Call this when the server shuts down to release browser resources
export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close().catch(() => {});
    _browser = null;
  }
}
