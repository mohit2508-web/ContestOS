/**
 * ContestOS Web Dev Worker — Isolated Execution Thread
 *
 * SECURITY: This worker runs JSDOM evaluation in an isolated Node.js worker thread.
 * If candidate's JS calls process.exit(), crashes, or hangs — ONLY this worker dies.
 * The main Express server stays alive. Zero crash propagation.
 *
 * Used by: webDevEvaluator.ts (JSDOM path — /evaluate route)
 */
import { workerData, parentPort } from 'worker_threads';
import { evaluateWebDev } from '../services/webDevEvaluator';

async function run() {
  if (!parentPort) return;

  try {
    const { html, css, js, testCases, timeoutMs } = workerData;
    const result = await evaluateWebDev({ html, css, js, testCases, timeoutMs });
    parentPort.postMessage({ success: true, result });
  } catch (err: any) {
    parentPort.postMessage({
      success: false,
      error: err?.message || String(err),
    });
  }
}

run();
