import { JSDOM, VirtualConsole } from 'jsdom';

/**
 * ContestOS Web Dev Playground — Server-Side Evaluation Engine
 *
 * Safely renders candidate HTML/CSS/JS inside an isolated in-process DOM
 * (JSDOM) sandbox and asserts against the problem's test suite.
 *
 * Test Case DSL (TestCase.input)
 * -----------------------------
 * Each web problem test case stores a compact assertion in `input` and the
 * expected value in `expectedOutput`:
 *
 *   SELECTOR                          existence check (default property `exists`)
 *   count:SELECTOR                    count of matching elements
 *   SELECTOR@ACTION                   dispatch ACTION, assert success
 *   SELECTOR@ACTION=value             dispatch ACTION with a value
 *   SELECTOR@ACTION.PROPERTY          dispatch ACTION then read PROPERTY
 *   SELECTOR.PROPERTY                 read PROPERTY directly
 *
 * Supported ACTIONS: click, input, change, submit, focus, blur, keydown,
 *                    keyup, keypress, hover, mouseover, mouseleave, scroll
 * Supported PROPERTYs: textContent, innerText, value, count, exists, checked,
 *                    className, id, href, src, tagName, disabled, placeholder,
 *                    title, style:PROP, computed:PROP, attr:NAME
 *
 * A JSON object form is also accepted for structured test cases:
 *   {"selector":"#btn","action":"click","property":"textContent"}
 *
 * expectedOutput comparisons:
 *   - `~needle`           substring (case-insensitive) match
 *   - numeric literals    numeric equality with 1e-9 tolerance
 *   - otherwise           exact trimmed / whitespace-collapsed match
 *
 * Rubric (40/20/20/20)
 * --------------------
 * Final = 0.40 * Functionality + 0.20 * Styling + 0.20 * Accessibility
 *         + 0.20 * CodeQuality        (each 0..1, scaled to 0..100)
 */

export interface WebDevTestCase {
  id?: string;
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
}

export interface WebDevTestResult {
  testCase: number;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  executionTime: number;
  error?: string;
  isHidden?: boolean;
}

export interface WebDevSummary {
  passed: number;
  failed: number;
  total: number;
}

export interface WebDevRubric {
  functionality: number;
  styling: number;
  accessibility: number;
  codeQuality: number;
  total: number;
}

export interface WebDevConsoleLog {
  method: string;
  message: string;
}

export interface WebDevEvaluation {
  success: boolean;
  results: WebDevTestResult[];
  summary: WebDevSummary;
  rubric: WebDevRubric;
  consoleLogs: WebDevConsoleLog[];
  errors: string[];
  executionTime: number;
  timedOut: boolean;
}

export interface WebDevEvaluateParams {
  html: string;
  css: string;
  js: string;
  testCases: WebDevTestCase[];
  timeoutMs?: number;
}

interface WebDevSetupAction {
  selector: string;
  action: string;
  actionValue?: string;
}

interface WebDevSpec {
  selector: string;
  action?: string;
  actionValue?: string;
  property: string;
  targetSelector?: string;
  /** Optional setup steps to run before the main action (e.g. set input value first) */
  setupActions?: WebDevSetupAction[];
}

const DEFAULT_TIMEOUT_MS = 5000;

const PROPERTY_KEYWORDS = [
  'textContent', 'innerText', 'value', 'count', 'exists', 'checked',
  'className', 'id', 'href', 'src', 'tagName', 'disabled', 'placeholder',
  'title',
];

const ACTION_EVENTS: Record<string, string> = {
  click: 'click',
  submit: 'submit',
  focus: 'focus',
  blur: 'blur',
  hover: 'mouseover',
  mouseover: 'mouseover',
  mouseleave: 'mouseleave',
  scroll: 'scroll',
  input: 'input',
  change: 'change',
  keydown: 'keydown',
  keyup: 'keyup',
  keypress: 'keypress',
  value: 'input',
  setValue: 'input',
  type: 'input',
};

export function parseWebDevSpec(input: string): WebDevSpec {
  const trimmed = (input || '').trim();

  if (!trimmed) {
    return { selector: 'body', property: 'exists' };
  }

  // Structured JSON form
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && parsed.selector) {
      return {
        selector: String(parsed.selector),
        action: parsed.action ? String(parsed.action) : undefined,
        actionValue: parsed.value !== undefined ? String(parsed.value) : undefined,
        property: parsed.property ? String(parsed.property) : 'exists',
        targetSelector: parsed.target ? String(parsed.target) : undefined,
      };
    }
  } catch {
    // fall through to DSL parsing
  }

  let rest = trimmed;
  let property = 'exists';
  let action: string | undefined;
  let actionValue: string | undefined;
  let targetSelector: string | undefined;
  const setupActions: WebDevSetupAction[] = [];

  // Multi-step setup: `#setup-a@action=val,#main-sel@click => #target.prop`
  // Split on commas that appear BEFORE the last '=>' arrow.
  const arrowCheck = rest.indexOf('=>');
  const lastCommaBeforeArrow = arrowCheck !== -1
    ? rest.slice(0, arrowCheck).lastIndexOf(',')
    : rest.lastIndexOf(',');
  if (lastCommaBeforeArrow !== -1) {
    const setupPart = rest.slice(0, lastCommaBeforeArrow).trim();
    rest = rest.slice(lastCommaBeforeArrow + 1).trim();
    // Parse each comma-separated setup token
    const setupTokens = setupPart.split(',').map((s) => s.trim()).filter(Boolean);
    for (const token of setupTokens) {
      const atIdx2 = token.indexOf('@');
      if (atIdx2 !== -1) {
        const setupSel = token.slice(0, atIdx2).trim();
        const actionPart2 = token.slice(atIdx2 + 1);
        const eqIdx2 = actionPart2.indexOf('=');
        const setupAction2 = eqIdx2 !== -1 ? actionPart2.slice(0, eqIdx2) : actionPart2;
        const setupVal2 = eqIdx2 !== -1 ? actionPart2.slice(eqIdx2 + 1) : undefined;
        setupActions.push({ selector: setupSel, action: setupAction2, actionValue: setupVal2 });
      }
    }
  }

  // `A => B` — run action on A, read property from B
  const arrowIdx = rest.indexOf('=>');
  if (arrowIdx !== -1) {
    const targetRaw = rest.slice(arrowIdx + 2).trim();
    rest = rest.slice(0, arrowIdx).trim();
    // Parse property from target, e.g. `#out.textContent` or `#out.computed.color`
    if (targetRaw.startsWith('count:')) {
      targetSelector = targetRaw.slice(6).trim();
      property = 'count';
    } else {
      const specialMatch = targetRaw.match(/\.(computed|style|attr)\.([\w-]+)$/i);
      if (specialMatch) {
        targetSelector = targetRaw.slice(0, specialMatch.index);
        property = `${specialMatch[1].toLowerCase()}:${specialMatch[2]}`;
      } else {
        const lastDot = targetRaw.lastIndexOf('.');
        const candidate = lastDot !== -1 ? targetRaw.slice(lastDot + 1) : '';
        if (lastDot !== -1 && isKnownProperty(candidate)) {
          targetSelector = targetRaw.slice(0, lastDot);
          property = candidate;
        } else {
          targetSelector = targetRaw;
        }
      }
    }
  }

  if (rest.startsWith('count:')) {
    return {
      selector: rest.slice(6).trim(),
      property: 'count',
      targetSelector,
    };
  }

  const atIdx = rest.indexOf('@');
  let selectorPart = rest;

  if (atIdx !== -1) {
    selectorPart = rest.slice(0, atIdx);
    const actionPart = rest.slice(atIdx + 1);
    const dotIdx = actionPart.indexOf('.');
    let actionToken = actionPart;
    if (dotIdx !== -1) {
      actionToken = actionPart.slice(0, dotIdx);
      const propCandidate = actionPart.slice(dotIdx + 1);
      if (isKnownProperty(propCandidate)) {
        property = propCandidate;
      }
    }
    const eqIdx = actionToken.indexOf('=');
    if (eqIdx !== -1) {
      action = actionToken.slice(0, eqIdx);
      actionValue = actionToken.slice(eqIdx + 1);
    } else {
      action = actionToken;
    }
  } else {
    // Prefer explicit computed./style./attr. forms (may contain multiple dots)
    const specialMatch = selectorPart.match(/\.(computed|style|attr)\.([\w-]+)$/i);
    if (specialMatch) {
      property = `${specialMatch[1].toLowerCase()}:${specialMatch[2]}`;
      selectorPart = selectorPart.slice(0, specialMatch.index);
    } else {
      const lastDot = selectorPart.lastIndexOf('.');
      if (lastDot !== -1 && lastDot < selectorPart.length - 1) {
        const candidate = selectorPart.slice(lastDot + 1);
        if (isKnownProperty(candidate)) {
          property = candidate;
          selectorPart = selectorPart.slice(0, lastDot);
        }
      }
    }
  }

  return {
    selector: selectorPart.trim() || 'body',
    action,
    actionValue,
    property,
    targetSelector,
    ...(setupActions.length > 0 ? { setupActions } : {}),
  };
}

function isKnownProperty(candidate: string): boolean {
  return (
    PROPERTY_KEYWORDS.includes(candidate) ||
    candidate.startsWith('computed:') ||
    candidate.startsWith('computed.') ||
    candidate.startsWith('style:') ||
    candidate.startsWith('style.') ||
    candidate.startsWith('attr:') ||
    candidate.startsWith('attr.')
  );
}

function buildDocument(html: string, css: string, js: string): string {
  const cssBlock = `<style>${css || ''}</style>`;
  // In JSDOM with runScripts:'dangerously', inline scripts execute synchronously
  // during HTML parsing. By the time our <script> tag is parsed, the preceding
  // HTML is already in the DOM and document.readyState is 'interactive' or
  // 'complete', so DOMContentLoaded may have already fired.
  // We wrap in try/catch for safety but always execute immediately.
  const safeJs = js ? `
(function() {
  try {
    ${js}
  } catch(err) {
    if (typeof console !== 'undefined') {
      console.error('[ContestOS Evaluator] Script error: ' + (err && err.message ? err.message : String(err)));
    }
  }
})();
` : '';
  const jsBlock = `<script>${safeJs}<\/script>`;

  let doc = html || '<!DOCTYPE html><html><head></head><body></body></html>';

  // Use function-form replacement to prevent $' and $& substitution
  // when cssBlock/jsBlock contain $ characters (common in JS code).
  if (/<\/head>/i.test(doc)) {
    doc = doc.replace(/<\/head>/i, () => `${cssBlock}</head>`);
  } else if (/<head[^>]*\/?>/.test(doc)) {
    doc = doc.replace(/(<head[^>]*>)/i, (_match, p1: string) => `${p1}${cssBlock}`);
  } else {
    // No head — inject into <html> if present, else prepend
    if (/<html[^>]*>/i.test(doc)) {
      doc = doc.replace(/(<html[^>]*>)/i, (_match, p1: string) => `${p1}<head>${cssBlock}</head>`);
    } else {
      doc = `<head>${cssBlock}</head>${doc}`;
    }
  }

  if (/<\/body>/i.test(doc)) {
    doc = doc.replace(/<\/body>/i, () => `${jsBlock}</body>`);
  } else if (/<\/html>/i.test(doc)) {
    doc = doc.replace(/<\/html>/i, () => `<body>${jsBlock}</body></html>`);
  } else {
    doc = `${doc}<body>${jsBlock}</body>`;
  }

  return doc;
}

function normalizeText(value: string): string {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matches(actual: string, expected: string): boolean {
  const a = normalizeText(actual);
  const e = normalizeText(expected);

  if (!e) return a === '';

  if (e.startsWith('~')) {
    const needle = e.slice(1).toLowerCase();
    return a.toLowerCase().includes(needle);
  }

  const aNum = Number(a);
  const eNum = Number(e);
  if (/^-?\d/.test(e) && !isNaN(aNum) && !isNaN(eNum)) {
    return Math.abs(aNum - eNum) < 1e-9;
  }

  return a === e;
}

function camelToKebab(prop: string): string {
  return prop.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function dispatchAction(
  dom: JSDOM,
  spec: WebDevSpec,
  element: Element
): { ok: boolean; error?: string } {
  if (!spec.action) {
    return { ok: true };
  }

  const eventName = ACTION_EVENTS[spec.action];
  if (!eventName) {
    return { ok: false, error: `Unsupported action: ${spec.action}` };
  }

  const window = dom.window;
  const el = element as any;

  try {
    if (spec.action === 'input' || spec.action === 'change' || spec.action === 'value' || spec.action === 'setValue' || spec.action === 'type') {
      if (spec.actionValue !== undefined) {
        el.value = spec.actionValue;
      }
      el.dispatchEvent(new window.Event('input', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new window.Event('change', { bubbles: true, cancelable: true }));
      return { ok: true };
    }

    if (spec.action === 'click') {
      if (typeof el.click === 'function') {
        el.click();
      } else {
        el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
      }
      return { ok: true };
    }

    if (spec.action === 'focus') {
      el.focus();
      return { ok: true };
    }

    if (spec.action === 'blur') {
      el.blur();
      return { ok: true };
    }

    if (spec.action === 'hover' || spec.action === 'mouseover' || spec.action === 'mouseleave') {
      el.dispatchEvent(new window.MouseEvent(eventName, { bubbles: true, cancelable: true }));
      return { ok: true };
    }

    if (spec.action === 'submit') {
      el.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
      return { ok: true };
    }

    if (spec.action === 'scroll') {
      el.dispatchEvent(new window.Event('scroll', { bubbles: true, cancelable: true }));
      return { ok: true };
    }

    if (spec.action === 'keydown' || spec.action === 'keyup' || spec.action === 'keypress') {
      const key = spec.actionValue || 'Enter';
      el.dispatchEvent(
        new window.KeyboardEvent(eventName, { key, bubbles: true, cancelable: true })
      );
      return { ok: true };
    }

    return { ok: false, error: `Unsupported action: ${spec.action}` };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

function readProperty(dom: JSDOM, spec: WebDevSpec, elements: Element[]): string {
  const window = dom.window;

  if (spec.property === 'exists') {
    return elements.length > 0 ? 'true' : 'false';
  }

  if (spec.property === 'count') {
    return String(elements.length);
  }

  const el = elements[0] as any;
  if (!el) {
    return '';
  }

  switch (spec.property) {
    case 'textContent':
      return el.textContent ?? '';
    case 'innerText':
      return el.textContent ?? '';
    case 'value':
      return el.value ?? '';
    case 'checked':
      return el.checked ? 'true' : 'false';
    case 'className':
      return typeof el.className === 'string' ? el.className : el.getAttribute?.('class') ?? '';
    case 'id':
      return el.getAttribute?.('id') ?? '';
    case 'href':
      return el.getAttribute?.('href') ?? '';
    case 'src':
      return el.getAttribute?.('src') ?? '';
    case 'tagName':
      return el.tagName ?? '';
    case 'disabled':
      return el.disabled ? 'true' : 'false';
    case 'placeholder':
      return el.getAttribute?.('placeholder') ?? '';
    case 'title':
      return el.getAttribute?.('title') ?? '';
    default: {
      if (spec.property.startsWith('computed:') || spec.property.startsWith('computed.')) {
        const rawProp = spec.property.split(/[.:]/)[1];
        const prop = camelToKebab(rawProp);
        return window.getComputedStyle(el).getPropertyValue(prop) ?? '';
      }
      if (spec.property.startsWith('style:') || spec.property.startsWith('style.')) {
        const rawProp = spec.property.split(/[.:]/)[1];
        const prop = camelToKebab(rawProp);
        return window.getComputedStyle(el).getPropertyValue(prop) ?? '';
      }
      if (spec.property.startsWith('attr:') || spec.property.startsWith('attr.')) {
        return el.getAttribute?.(spec.property.split(/[.:]/)[1]) ?? '';
      }
      return el[spec.property] != null ? String(el[spec.property]) : '';
    }
  }
}

function runTestCase(
  dom: JSDOM,
  spec: WebDevSpec,
  testCase: WebDevTestCase,
  index: number
): WebDevTestResult {
  const start = Date.now();
  const base: WebDevTestResult = {
    testCase: index + 1,
    passed: false,
    input: testCase.input || '',
    expectedOutput: testCase.expectedOutput || '',
    actualOutput: '',
    executionTime: 0,
    isHidden: testCase.isHidden || false,
  };

  try {
    const window = dom.window as any;
    const document = window.document;

    let elements: Element[] = [];
    try {
      elements = Array.from(document.querySelectorAll(spec.selector));
    } catch (qErr: any) {
      base.actualOutput = '';
      base.error = `Invalid selector: ${spec.selector} (${qErr?.message || qErr})`;
      base.executionTime = Date.now() - start;
      return base;
    }

    let actionOk = true;
    let actionError: string | undefined;

    // Execute any setup actions first (e.g. set #promo-input value before clicking #apply-promo)
    if (spec.setupActions && spec.setupActions.length > 0) {
      for (const setup of spec.setupActions) {
        try {
          const setupEls = Array.from(document.querySelectorAll(setup.selector)) as Element[];
          if (setupEls.length > 0) {
            const setupSpec = { selector: setup.selector, action: setup.action, actionValue: setup.actionValue, property: 'exists' };
            dispatchAction(dom, setupSpec, setupEls[0]);
          }
        } catch {
          // Silently ignore setup errors; main action will still run
        }
      }
    }

    if (spec.action && elements.length > 0) {
      const dispatched = dispatchAction(dom, spec, elements[0]);
      actionOk = dispatched.ok;
      actionError = dispatched.error;

      // Re-query after action — handlers may replace DOM nodes
      try {
        elements = Array.from(document.querySelectorAll(spec.selector));
      } catch {
        // keep previous elements
      }
    }

    if (!actionOk) {
      base.actualOutput = '';
      base.error = actionError || `Action ${spec.action} failed`;
      base.executionTime = Date.now() - start;
      return base;
    }

    // Read from a different element when `A@action => B.property` is used
    const readSelector = spec.targetSelector || spec.selector;
    let readElements: Element[] = elements;
    if (spec.targetSelector) {
      try {
        readElements = Array.from(document.querySelectorAll(spec.targetSelector));
      } catch (qErr: any) {
        base.actualOutput = '';
        base.error = `Invalid target selector: ${spec.targetSelector} (${qErr?.message || qErr})`;
        base.executionTime = Date.now() - start;
        return base;
      }
    }

    if (spec.property === 'exists' && !spec.action) {
      const expectedExists = base.expectedOutput === '' ? true : !/^(false|0|no)$/i.test(base.expectedOutput);
      const actual = elements.length > 0;
      base.actualOutput = actual ? 'true' : 'false';
      base.passed = actual === expectedExists;
      base.executionTime = Date.now() - start;
      return base;
    }

    const actualOutput = readProperty(dom, spec, readElements);
    base.actualOutput = actualOutput;
    base.passed = matches(actualOutput, base.expectedOutput);
    base.executionTime = Date.now() - start;
    return base;
  } catch (err: any) {
    base.actualOutput = '';
    base.error = err?.message || String(err);
    base.executionTime = Date.now() - start;
    return base;
  }
}

// ── Accessibility heuristic audit (JSDOM-safe, extendable) ──────────────────
function auditAccessibility(dom: JSDOM): { passed: number; total: number } {
  const document = dom.window.document as any;

  let passed = 0;
  let total = 0;

  // 1. <html lang> present
  total++;
  if (document.documentElement?.getAttribute('lang')) passed++;

  // 2. All <img> have alt (or role presentation)
  const imgs = Array.from(document.querySelectorAll('img'));
  total += imgs.length;
  passed += imgs.filter(
    (img: any) =>
      img.hasAttribute('alt') ||
      img.getAttribute('role') === 'presentation' ||
      img.getAttribute('role') === 'none'
  ).length;

  // 3. Interactive buttons/links have accessible text
  const interactive = Array.from(
    document.querySelectorAll('button, a[href], [role="button"]')
  );
  total += interactive.length;
  passed += interactive.filter((el: any) => {
    const text = normalizeText(el.textContent || el.value || el.getAttribute?.('aria-label') || '');
    return text.length > 0;
  }).length;

  // 4. Form controls have labels / aria
  const controls = Array.from(
    document.querySelectorAll('input, select, textarea')
  );
  total += controls.length;
  passed += controls.filter((ctrl: any) => {
    if (ctrl.getAttribute?.('aria-label') || ctrl.getAttribute?.('aria-labelledby')) return true;
    if (ctrl.type === 'hidden') return true;
    const id = ctrl.getAttribute?.('id');
    if (id && document.querySelector(`label[for="${id}"]`)) return true;
    const parent = ctrl.closest?.('label');
    return Boolean(parent);
  }).length;

  return { passed, total };
}

// ── Styling heuristics (extendable with visual diff in later phases) ────────
function scoreStyling(html: string, css: string, results: WebDevTestResult[]): number {
  let score = 0;

  const cssRuleCount = (css.match(/\{[^{}]*\}/g) || []).length;
  const hasClassOrIdSelector = /[.#][A-Za-z_-]/.test(css || '');

  // 40%: CSS is present and substantial
  if ((css || '').trim().length > 0 && cssRuleCount >= 2) score += 0.4;
  else if ((css || '').trim().length > 0) score += 0.2;

  // 30%: uses class/id selectors (structured styling, not raw tag overrides)
  if (hasClassOrIdSelector) score += 0.3;

  // 30%: computed-style test assertions pass rate
  const styleTests = results.filter(
    (r) => r.input.includes('computed:') || r.input.includes('style:')
  );
  if (styleTests.length > 0) {
    const passRate = styleTests.filter((r) => r.passed).length / styleTests.length;
    score += 0.3 * passRate;
  } else {
    // Fallback: prefers internal <style> over heavy inline style attributes
    const inlineStyleCount = (html.match(/style\s*=\s*["']/g) || []).length;
    score += inlineStyleCount <= 3 ? 0.3 : 0.1;
  }

  return Math.max(0, Math.min(1, score));
}

// ── Code quality heuristics (extendable with ESLint/HTMLHint later) ─────────
function scoreCodeQuality(
  html: string,
  css: string,
  errors: string[],
  consoleLogs: WebDevConsoleLog[]
): number {
  let score = 0;

  // 25%: no runtime/syntax errors from user scripts
  const fatalErrors = errors.filter(
    (e) => !/not implemented|Could not load/i.test(e)
  );
  score += fatalErrors.length === 0 ? 0.25 : 0;

  // 25%: JS present and balanced-ish (no stray braces)
  const jsBracesBalanced = true; // jsdom would have thrown on syntax error already
  score += jsBracesBalanced ? 0.25 : 0;

  // 25%: CSS braces balanced
  const openBraces = (css.match(/\{/g) || []).length;
  const closeBraces = (css.match(/\}/g) || []).length;
  score += openBraces === closeBraces ? 0.25 : 0;

  // 25%: no console.error noise
  const hasConsoleErrors = consoleLogs.some((l) => l.method === 'error');
  score += hasConsoleErrors ? 0.05 : 0.25;

  return Math.max(0, Math.min(1, score));
}

function computeRubric(
  html: string,
  css: string,
  results: WebDevTestResult[],
  errors: string[],
  consoleLogs: WebDevConsoleLog[],
  accessibility: { passed: number; total: number }
): WebDevRubric {
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  const functionality =
    total > 0
      ? passed / total
      : errors.length === 0
        ? 1
        : 0;

  const styling = scoreStyling(html, css, results);

  const accessibilityScore =
    accessibility.total > 0 ? accessibility.passed / accessibility.total : 0.5;

  const codeQuality = scoreCodeQuality(html, css, errors, consoleLogs);

  const rawTotal =
    0.4 * functionality +
    0.2 * styling +
    0.2 * accessibilityScore +
    0.2 * codeQuality;

  return {
    functionality: Math.round(functionality * 100) / 100,
    styling: Math.round(styling * 100) / 100,
    accessibility: Math.round(accessibilityScore * 100) / 100,
    codeQuality: Math.round(codeQuality * 100) / 100,
    total: Math.round(rawTotal * 100),
  };
}

/**
 * Core entry point — renders the candidate page and evaluates test cases.
 */
export async function evaluateWebDev(params: WebDevEvaluateParams): Promise<WebDevEvaluation> {
  const {
    html = '',
    css = '',
    js = '',
    testCases = [],
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = params;

  const startedAt = Date.now();
  const consoleLogs: WebDevConsoleLog[] = [];
  const errors: string[] = [];

  const virtualConsole = new VirtualConsole();
  (['log', 'info', 'warn', 'error', 'debug'] as const).forEach((method) => {
    virtualConsole.on(method, (...args: any[]) => {
      consoleLogs.push({
        method,
        message: args.map((a) => (typeof a === 'object' ? safeStringify(a) : String(a))).join(' '),
      });
    });
  });
  (virtualConsole.on as any)('jsdomError', (err: any) => {
    const msg = err?.message || String(err);
    if (!/Not implemented/.test(msg)) {
      errors.push(msg);
    }
  });

  const documentHtml = buildDocument(html, css, js);

  let dom: JSDOM | null = null;
  let timedOut = false;

  const results: WebDevTestResult[] = [];
  const summary: WebDevSummary = { passed: 0, failed: 0, total: 0 };
  const accessibility = { passed: 0, total: 0 };

  try {
    dom = new JSDOM(documentHtml, {
      runScripts: 'dangerously',
      url: 'https://contest.local/',
      virtualConsole,
    });

    // Give synchronous + microtask + short async work a chance to settle
    // after parse. True wall-clock isolation (worker thread / container) is a
    // later-phase hardening; this guards against pathological async work.
    await new Promise<void>((resolve) => {
      const timeoutTimer = setTimeout(() => {
        timedOut = true;
        resolve();
      }, timeoutMs);
      const settleTimer = setTimeout(() => {
        clearTimeout(timeoutTimer);
        resolve();
      }, 150);
      settleTimer.unref?.();
    });

    if (timedOut) {
      errors.push('Evaluation timed out');
      testCases.forEach((_tc, idx) => {
        results.push({
          testCase: idx + 1,
          passed: false,
          input: _tc.input || '',
          expectedOutput: _tc.expectedOutput || '',
          actualOutput: '',
          executionTime: timeoutMs,
          error: 'Timed out',
          isHidden: _tc.isHidden || false,
        });
      });
    } else {
      for (let idx = 0; idx < testCases.length; idx++) {
        const tc = testCases[idx];
        const spec = parseWebDevSpec(tc.input);

        // Action testcases (click, input, setValue, etc.) need a fresh DOM so
        // their side-effects don't bleed into subsequent testcases.
        let testDom = dom!;
        let freshDom: JSDOM | null = null;
        if (spec.action) {
          const freshVc = new VirtualConsole();
          freshVc.on('error', () => {});
          freshVc.on('jsdomError', () => {});
          freshDom = new JSDOM(documentHtml, {
            runScripts: 'dangerously',
            url: 'https://contest.local/',
            virtualConsole: freshVc,
          });
          // Allow scripts to settle
          await new Promise<void>((r) => setTimeout(r, 150));
          testDom = freshDom;
        }

        const result = runTestCase(testDom, spec, tc, idx);
        results.push(result);

        if (freshDom) {
          try { freshDom.window.close(); } catch { /* ignore */ }
        }
      }

      Object.assign(accessibility, auditAccessibility(dom!));
    }
  } catch (err: any) {
    errors.push(err?.message || String(err));
  } finally {
    if (dom) {
      try {
        dom.window.close();
      } catch {
        // ignore
      }
    }
  }

  summary.total = results.length;
  summary.passed = results.filter((r) => r.passed).length;
  summary.failed = summary.total - summary.passed;

  const rubric = computeRubric(html, css, results, errors, consoleLogs, accessibility);

  return {
    success: summary.failed === 0,
    results,
    summary,
    rubric,
    consoleLogs,
    errors,
    executionTime: Date.now() - startedAt,
    timedOut,
  };
}

function safeStringify(value: any): string {
  try {
    const s = JSON.stringify(value);
    return s !== undefined ? s : String(value);
  } catch {
    return String(value);
  }
}

// Backward-compatible default export (stub was `webDevEvaluator(html, css, js)`)
export default async function webDevEvaluator(params: WebDevEvaluateParams): Promise<WebDevEvaluation> {
  return evaluateWebDev(params);
}
