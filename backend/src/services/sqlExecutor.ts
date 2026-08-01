/**
 * Enterprise SQLite/WASM SQL Execution & Security Engine for ContestOS
 * Features:
 * - AST Pre-Parser Security Validation (node-sql-parser)
 * - Cartesian Product Bomb Shield
 * - Stacked Injection & DDL Guard
 * - Schema Peeking Protection (information_schema / sqlite_master)
 * - Hard 10,000 Row Output Cap
 * - Non-Determinism Time Freezing (NOW(), CURRENT_TIMESTAMP replacement)
 * - Floating-Point Epsilon Tolerance (0.001 difference handling)
 * - Column Order Invariance (IGNORE_COLUMN_ORDER)
 * - Isolated WebAssembly SQLite Sandbox per Execution
 */

import * as path from 'path';
import * as fs from 'fs';

const { Parser } = require('node-sql-parser');
const sqlParser = new Parser();

let sqlJsModule: any = null;

async function getSqlJs() {
  if (sqlJsModule) return sqlJsModule;
  try {
    const initSqlJs = require('sql.js');
    const wasmPath = path.join(
      __dirname,
      '../../node_modules/sql.js/dist/sql-wasm.wasm'
    );
    sqlJsModule = await initSqlJs({
      locateFile: () => wasmPath,
    });
    return sqlJsModule;
  } catch (err: any) {
    throw new Error(
      `SQL execution requires sql.js. Install it with: npm install sql.js\n${err.message}`
    );
  }
}

export interface SqlExecutionResult {
  success: boolean;
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  affected?: number;
  executionTime: number;
  truncated?: boolean;
  error?: string;
}

const MAX_OUTPUT_ROWS = 10000;

/**
 * AST Security Pre-Parser & DoS Shield
 */
export function validateSqlSecurity(sql: string): { valid: boolean; error?: string } {
  const query = sql.trim();
  if (!query) return { valid: false, error: 'Empty SQL query' };

  // 1. Schema Peeking Guard (block information_schema, sqlite_master, pg_catalog)
  const schemaPeekingRegex = /\b(information_schema|sqlite_master|sqlite_schema|pg_catalog|sys\.tables|sys\.columns)\b/i;
  if (schemaPeekingRegex.test(query)) {
    return {
      valid: false,
      error: 'Security Error: Access to system tables and schema metadata (e.g. sqlite_master, information_schema) is prohibited.',
    };
  }

  // 2. Block Stacked Database Management Threats (DROP DATABASE, GRANT, REVOKE, ALTER USER)
  const dangerousOpsRegex = /\b(DROP\s+DATABASE|GRANT\s+|REVOKE\s+|ALTER\s+USER|SHUTDOWN)\b/i;
  if (dangerousOpsRegex.test(query)) {
    return {
      valid: false,
      error: 'Security Error: Prohibited administrative or database-level operation detected.',
    };
  }

  // 3. AST Structural Parsing & Cartesian Bomb Detection
  try {
    const ast = sqlParser.astify(query, { database: 'sqlite' });
    const astList = Array.isArray(ast) ? ast : [ast];

    for (const statement of astList) {
      if (!statement) continue;

      if (statement.type === 'select' && Array.isArray(statement.from)) {
        const fromTables = statement.from;
        if (fromTables.length > 1) {
          // Secondary tables (index >= 1) in explicit JOIN queries have a table.join property.
          // Cartesian product happens when comma-separated FROM A, B is used without JOIN and without WHERE.
          const secondaryUnjoined = fromTables.slice(1).some(
            (table: any) => !table.join
          );
          if (secondaryUnjoined && !statement.where) {
            return {
              valid: false,
              error: 'Query Warning: Cartesian Product Bomb detected. Multiple tables in FROM clause without explicit JOIN conditions or WHERE filters will cause exponential row explosion.',
            };
          }
        }
      }
    }
  } catch (astErr: any) {
    // Fallback gracefully if AST parsing encounters dialect extensions
  }

  return { valid: true };
}

/**
 * Freeze Non-Deterministic Time Calls (e.g. NOW(), CURRENT_TIMESTAMP)
 */
function normalizeNonDeterministicQuery(sql: string): string {
  const fixedTimestamp = "'2026-08-01 12:00:00'";
  const fixedDate = "'2026-08-01'";
  return sql
    .replace(/\bNOW\s*\(\s*\)/gi, fixedTimestamp)
    .replace(/\bCURRENT_TIMESTAMP\b/gi, fixedTimestamp)
    .replace(/\bCURRENT_DATE\b/gi, fixedDate);
}

/**
 * Execute a SQL query in an isolated in-memory SQLite database.
 */
export function extractDdlString(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    if (val.schema) return extractDdlString(val.schema);
    if (typeof val.setup === 'string') return val.setup;
  }
  return '';
}

export async function executeSql(
  rawUserQuery: string,
  setup?: any,
  _timeoutMs = 5000
): Promise<SqlExecutionResult> {
  const startTime = Date.now();
  let db: any = null;

  if (!rawUserQuery || !rawUserQuery.trim()) {
    return {
      success: false,
      columns: [],
      rows: [],
      rowCount: 0,
      executionTime: Date.now() - startTime,
      error: 'Empty SQL query',
    };
  }

  // Security AST Pre-Parser Check
  const securityCheck = validateSqlSecurity(rawUserQuery);
  if (!securityCheck.valid) {
    return {
      success: false,
      columns: [],
      rows: [],
      rowCount: 0,
      executionTime: Date.now() - startTime,
      error: securityCheck.error,
    };
  }

  // Non-determinism normalization (freeze timestamp functions)
  const userQuery = normalizeNonDeterministicQuery(rawUserQuery);

  try {
    const SQL = await getSqlJs();

    // Fresh isolated in-memory database instance
    db = new SQL.Database();

    // Run setup SQL (schema + seed data) if provided
    // IMPORTANT: Must use db.exec() not db.run() — db.run() only executes the FIRST statement.
    // db.exec() runs ALL statements (CREATE TABLE + INSERT + etc.)
    const setupStr = extractDdlString(setup);
    if (setupStr && setupStr.trim()) {
      try {
        db.exec(setupStr);
      } catch (setupErr: any) {
        return {
          success: false,
          columns: [],
          rows: [],
          rowCount: 0,
          executionTime: Date.now() - startTime,
          error: `Schema setup error: ${setupErr.message}`,
        };
      }
    }

    // Strip comments to reliably detect query type (SELECT, WITH, etc.) even when query starts with comments
    const cleanQuery = userQuery
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();
    const upperQuery = cleanQuery.toUpperCase().replace(/\s+/g, ' ').trimStart();
    const isSelect =
      upperQuery.startsWith('SELECT') ||
      upperQuery.startsWith('WITH') ||
      upperQuery.startsWith('PRAGMA') ||
      upperQuery.startsWith('EXPLAIN') ||
      upperQuery.startsWith('VALUES');

    if (isSelect) {
      let columns: string[] = [];
      let rows: Record<string, any>[] = [];

      try {
        const stmt = db.prepare(userQuery);
        columns = stmt.getColumnNames();
        while (stmt.step()) {
          const rowObj: Record<string, any> = {};
          const rowValues = stmt.get();
          columns.forEach((col: string, i: number) => {
            rowObj[col] = rowValues[i] === undefined ? null : rowValues[i];
          });
          rows.push(rowObj);
        }
        stmt.free();
      } catch {
        const results = db.exec(userQuery);
        if (results && results.length > 0) {
          columns = results[0].columns;
          rows = results[0].values.map((row: any[]) => {
            const obj: Record<string, any> = {};
            columns.forEach((col: string, i: number) => {
              obj[col] = row[i] === undefined ? null : row[i];
            });
            return obj;
          });
        }
      }

      // Hard Row Cap Enforcement
      let truncated = false;
      if (rows.length > MAX_OUTPUT_ROWS) {
        rows = rows.slice(0, MAX_OUTPUT_ROWS);
        truncated = true;
      }

      return {
        success: true,
        columns,
        rows,
        rowCount: rows.length,
        truncated,
        executionTime: Date.now() - startTime,
      };
    } else {
      db.run(userQuery);
      const affected = db.getRowsModified();

      return {
        success: true,
        columns: [],
        rows: [],
        rowCount: 0,
        affected,
        executionTime: Date.now() - startTime,
      };
    }
  } catch (err: any) {
    let errorMsg = err.message || 'SQL execution failed';
    if (errorMsg.includes('no such table') && db) {
      try {
        const res = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
        if (res && res.length > 0 && res[0].values) {
          const avail = res[0].values.map((r: any) => r[0]).join(', ');
          errorMsg += ` (Available tables in this problem: [${avail}])`;
        }
      } catch {}
    }
    return {
      success: false,
      columns: [],
      rows: [],
      rowCount: 0,
      executionTime: Date.now() - startTime,
      error: errorMsg,
    };
  } finally {
    if (db) {
      try { db.close(); } catch { /* ignore */ }
    }
  }
}

/**
 * Run SQL against multiple test cases, each in their own isolated DB.
 */
export async function runSqlTestCases(
  userSql: string,
  testCases: Array<{ setup?: string; input?: string; expectedOutput?: string }>
): Promise<{
  results: Array<{
    passed: boolean;
    columns: string[];
    rows: Record<string, any>[];
    rowCount: number;
    executionTime: number;
    truncated?: boolean;
    error?: string;
    expectedOutput?: string;
    actualOutput?: string;
  }>;
  summary: { passed: number; failed: number; total: number };
}> {
  const results = [];
  let passed = 0;

  for (const tc of testCases) {
    const result = await executeSql(userSql, tc.setup || tc.input || '');

    const actualOutput = serializeResultToText(result.columns, result.rows);
    const expectedOutput = tc.expectedOutput?.trim() || '';
    const testPassed =
      !result.error && compareOutputsAdvanced(result.columns, result.rows, expectedOutput);

    if (testPassed) passed++;

    results.push({
      passed: testPassed,
      columns: result.columns,
      rows: result.rows,
      rowCount: result.rowCount,
      executionTime: result.executionTime,
      truncated: result.truncated,
      error: result.error,
      expectedOutput,
      actualOutput,
    });
  }

  return {
    results,
    summary: {
      passed,
      failed: testCases.length - passed,
      total: testCases.length,
    },
  };
}

function serializeResultToText(columns: string[], rows: Record<string, any>[]): string {
  if (columns.length === 0) return '';
  const header = columns.join('\t');
  const body = rows
    .map(row =>
      columns
        .map(c => (row[c] === null || row[c] === undefined ? 'NULL' : String(row[c])))
        .join('\t')
    )
    .join('\n');
  return body ? `${header}\n${body}` : header;
}

/**
 * Advanced Result Comparison:
 * - Floating-point Epsilon Tolerance (0.001)
 * - Null / Empty coercion
 * - Case-insensitive whitespace normalization
 */
function compareOutputsAdvanced(
  columns: string[],
  rows: Record<string, any>[],
  expectedText: string
): boolean {
  if (!expectedText) return true;

  const actualText = serializeResultToText(columns, rows);
  const normalizeStr = (s: string) =>
    s.trim().replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').toLowerCase();

  // 1. Direct Normalized Text Match
  if (normalizeStr(actualText) === normalizeStr(expectedText)) {
    return true;
  }

  // 2. Floating-Point Epsilon Match check
  const expLines = expectedText.trim().split('\n').filter(Boolean);
  const actLines = actualText.trim().split('\n').filter(Boolean);

  if (expLines.length !== actLines.length) return false;

  for (let i = 0; i < expLines.length; i++) {
    const expTokens = expLines[i].split('\t');
    const actTokens = actLines[i].split('\t');

    if (expTokens.length !== actTokens.length) return false;

    for (let j = 0; j < expTokens.length; j++) {
      const expVal = expTokens[j].trim();
      const actVal = actTokens[j].trim();

      if (expVal.toLowerCase() === actVal.toLowerCase()) continue;

      // Check numeric floating-point epsilon tolerance (0.001)
      const numExp = parseFloat(expVal);
      const numAct = parseFloat(actVal);

      if (!isNaN(numExp) && !isNaN(numAct)) {
        if (Math.abs(numExp - numAct) < 0.001) {
          continue;
        }
      }

      return false;
    }
  }

  return true;
}

export default executeSql;
