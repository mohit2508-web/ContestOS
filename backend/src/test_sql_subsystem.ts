import { PrismaClient } from '@prisma/client';
import { executeSql, runSqlTestCases, extractDdlString } from './services/sqlExecutor';

const prisma = new PrismaClient();

async function runIntegrationSuite() {
  console.log('🧪 Starting ContestOS SQL Subsystem Automated Integration Suite...\n');

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

  // TEST 1: DB Canonical Schema Audit
  console.log('--- TEST GROUP 1: Canonical Schema Verification ---');
  const erpProblem = await prisma.problem.findFirst({
    where: { slug: { contains: 'global-erp' } }
  });
  assert(Boolean(erpProblem), 'Global ERP Problem exists in DB');

  const erpDdl = extractDdlString(erpProblem?.starterCode);
  assert(erpDdl.includes('CREATE TABLE Regions') && erpDdl.includes('CREATE TABLE Warehouses'), 'Canonical DDL extracted correctly for Global ERP');

  // TEST 2: Ephemeral Sandbox Isolation
  console.log('\n--- TEST GROUP 2: Ephemeral Sandbox Isolation ---');
  const ddlSetup = "CREATE TABLE TestIsolation (id INT PRIMARY KEY, val VARCHAR(50)); INSERT INTO TestIsolation VALUES (1, 'run1');";
  const run1 = await executeSql("SELECT * FROM TestIsolation;", ddlSetup);
  assert(run1.rowCount === 1, 'Run 1 retrieved 1 row successfully');

  // Second run must be completely isolated in a fresh SQL.Database instance (0 rows carried over)
  const ddlSetup2 = "CREATE TABLE TestIsolation (id INT PRIMARY KEY, val VARCHAR(50));";
  const run2 = await executeSql("SELECT COUNT(*) AS cnt FROM TestIsolation;", ddlSetup2);
  const countVal = run2.rows[0]?.cnt ?? run2.rows[0]?.[Object.keys(run2.rows[0])[0]];
  assert(Number(countVal) === 0, 'Run 2 fresh sandbox isolation verified (0 leftover rows from Run 1)');

  // TEST 3: Sample Row Seeding for Single Query
  console.log('\n--- TEST GROUP 3: Sample Data Seeding ---');
  const deliveryProb = await prisma.problem.findFirst({
    where: { title: { contains: 'Immediate Food Delivery' } },
    include: { testCases: { orderBy: { order: 'asc' }, take: 1 } }
  });
  assert(Boolean(deliveryProb), 'Immediate Food Delivery II Problem exists in DB');

  const deliveryDdl = extractDdlString(deliveryProb?.starterCode);
  const deliverySeedDml = extractDdlString(deliveryProb?.testCases[0]?.input);
  const combinedDeliverySetup = deliveryDdl + '\n' + deliverySeedDml;

  const userDeliveryQuery = `
    SELECT PRINTF('%.2f', AVG(order_date = customer_pref_delivery_date) * 100) AS immediate_percentage
    FROM Delivery
    WHERE (customer_id, order_date) IN (
      SELECT customer_id, MIN(order_date) 
      FROM Delivery
      GROUP BY customer_id
    );
  `;

  const deliveryResult = await executeSql(userDeliveryQuery, combinedDeliverySetup);
  assert(deliveryResult.success === true, 'Single query execution against sample data succeeded');
  assert(deliveryResult.rows.length === 1, 'Query returned 1 sample output row');
  const actualPct = String(deliveryResult.rows[0].immediate_percentage || Object.values(deliveryResult.rows[0])[0]);
  assert(actualPct === '50.00' || actualPct === '50', `Immediate Delivery percentage is 50.00 (got: ${actualPct})`);

  // TEST 4: Table Mismatch Error Diagnostics
  console.log('\n--- TEST GROUP 4: Table Mismatch Diagnostics ---');
  const actorProb = await prisma.problem.findFirst({
    where: { title: { contains: 'Actors and Directors' } }
  });
  assert(Boolean(actorProb), 'Actors and Directors Problem exists in DB');

  const actorDdl = extractDdlString(actorProb?.starterCode);
  const invalidQuery = "SELECT * FROM users ORDER BY user_id;";
  const errorResult = await executeSql(invalidQuery, actorDdl);
  assert(errorResult.success === false, 'Invalid query on missing table failed gracefully');
  assert(errorResult.error?.includes('no such table') === true, 'Error contains "no such table"');
  assert(errorResult.error?.includes('ActorDirector') === true, 'Error trace includes available table hint [ActorDirector]', `Got error: ${errorResult.error}`);

  // TEST 5: Full Test Suite Evaluator
  console.log('\n--- TEST GROUP 5: Test Suite Evaluator ---');
  const actorTestCases = [
    {
      setup: `${actorDdl}\nINSERT INTO ActorDirector VALUES (1, 1, 0), (1, 1, 1), (1, 1, 2);`,
      expectedOutput: "actor_id\tdirector_id\n1\t1"
    }
  ];
  const evalSol = "SELECT actor_id, director_id FROM ActorDirector GROUP BY actor_id, director_id HAVING COUNT(*) >= 3;";
  const suiteResult = await runSqlTestCases(evalSol, actorTestCases);
  assert(suiteResult.summary.passed === 1, 'Test suite evaluator passed 1/1 test cases');

  // TEST 6: Brutal Hard SQL Problem (Human Traffic of Stadium CTE & Window Function Evaluation)
  console.log('\n--- TEST GROUP 6: Brutal Hard SQL (Human Traffic of Stadium) ---');
  const stadiumProb = await prisma.problem.findFirst({
    where: { title: { contains: 'Human Traffic of Stadium' } },
    include: { testCases: { orderBy: { order: 'asc' } } }
  });
  assert(Boolean(stadiumProb), 'Human Traffic of Stadium Problem exists in DB');
  assert(stadiumProb?.testCases.length === 4, 'Human Traffic of Stadium has 4 testcases');

  const stadiumSol = stadiumProb?.referenceSolution || '';
  const stadiumDdl = extractDdlString(stadiumProb?.starterCode);

  const stadiumTCs = (stadiumProb?.testCases || []).map(tc => ({
    setup: `${stadiumDdl}\n${extractDdlString(tc.input)}`,
    expectedOutput: tc.expectedOutput
  }));

  const stadiumResult = await runSqlTestCases(stadiumSol, stadiumTCs);
  assert(stadiumResult.summary.passed === 4, `Brutal Hard SQL solution passed 4/4 test cases (passed: ${stadiumResult.summary.passed})`);

  // TEST 7: 9-Table Enterprise Supply Chain Analytics
  console.log('\n--- TEST GROUP 7: 9-Table Enterprise Supply Chain Analytics ---');
  const supplyChainProb = await prisma.problem.findFirst({
    where: { title: { contains: 'Enterprise Supply Chain' } },
    include: { testCases: { orderBy: { order: 'asc' } } }
  });
  assert(Boolean(supplyChainProb), 'Enterprise Supply Chain Problem exists in DB');
  assert(supplyChainProb?.testCases.length === 2, 'Enterprise Supply Chain has 2 testcases');

  const scSol = supplyChainProb?.referenceSolution || '';
  const scDdl = extractDdlString(supplyChainProb?.starterCode);

  const scTCs = (supplyChainProb?.testCases || []).map(tc => ({
    setup: `${scDdl}\n${extractDdlString(tc.input)}`,
    expectedOutput: tc.expectedOutput
  }));

  const scResult = await runSqlTestCases(scSol, scTCs);
  assert(scResult.summary.passed === 2, `9-Table Enterprise Supply Chain solution passed 2/2 test cases (passed: ${scResult.summary.passed})`);

  console.log(`\n==================================================`);
  console.log(`RESULTS: ${passedTests}/${totalTests} Tests Passed`);
  console.log(`==================================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runIntegrationSuite().catch(err => {
  console.error('Fatal Integration Test Error:', err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
