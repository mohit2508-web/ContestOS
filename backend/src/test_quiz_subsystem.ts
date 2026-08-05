import prisma from './lib/prisma';
import { materializeQuizAttempt, encryptQuizPayload, decryptQuizPayload } from './services/quizMaterializer';
import { evaluateQuizResponse } from './services/quizEvaluator';
import { detectSynchronizedCheating, isQuizSessionFrozen, setQuizSessionFreeze } from './services/proctoringService';

async function runQuizIntegrationSuite() {
  console.log('🧪 Starting ContestOS Quiz Subsystem Automated Integration Suite...\n');

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

  // TEST GROUP 1: AES-256-GCM Encryption & Decryption
  console.log('--- TEST GROUP 1: AES-256-GCM Encryption & Decryption ---');
  const sessionToken = 'candidate-session-token-secret-12345';
  const originalPayload = {
    attemptQuestionId: 'aq-test-101',
    questionType: 'SINGLE_SELECT',
    content: 'What is 2 + 2?',
    options: [
      { id: 'opt-a', content: '4', displayOrder: 1 },
      { id: 'opt-b', content: '5', displayOrder: 2 },
    ],
  };

  const encrypted = encryptQuizPayload(originalPayload, sessionToken);
  assert(typeof encrypted.ciphertext === 'string' && encrypted.ciphertext.length > 20, 'Payload is encrypted to hex ciphertext');
  assert(encrypted.ciphertext !== JSON.stringify(originalPayload), 'Ciphertext does not expose plaintext json');

  const decrypted = decryptQuizPayload(encrypted, sessionToken);
  assert(decrypted.content === 'What is 2 + 2?' && decrypted.options.length === 2, 'Decrypted payload matches original plaintext');

  // TEST GROUP 2: Scoring & Evaluation Engine
  console.log('\n--- TEST GROUP 2: Scoring & Evaluation Engine ---');
  // Single Select Correct
  const res1 = evaluateQuizResponse({
    questionType: 'SINGLE_SELECT',
    points: 4.0,
    negativeMarking: 1.0,
    options: [
      { id: 'o1', isCorrect: true },
      { id: 'o2', isCorrect: false },
    ],
    selectedOptionIds: ['o1'],
  });
  assert(res1.isCorrect && res1.scoreAwarded === 4.0, 'Single select correct awards full points (4.0)');

  // Single Select Wrong
  const res2 = evaluateQuizResponse({
    questionType: 'SINGLE_SELECT',
    points: 4.0,
    negativeMarking: 1.0,
    options: [
      { id: 'o1', isCorrect: true },
      { id: 'o2', isCorrect: false },
    ],
    selectedOptionIds: ['o2'],
  });
  assert(!res2.isCorrect && res2.scoreAwarded === -1.0, 'Single select wrong applies negative deduction (-1.0)');

  // Multi-Select Full Correct
  const res3 = evaluateQuizResponse({
    questionType: 'MULTI_SELECT',
    points: 4.0,
    negativeMarking: 1.0,
    options: [
      { id: 'o1', isCorrect: true },
      { id: 'o2', isCorrect: true },
      { id: 'o3', isCorrect: false },
    ],
    selectedOptionIds: ['o1', 'o2'],
  });
  assert(res3.isCorrect && res3.scoreAwarded === 4.0, 'Multi-select fully correct awards full points (4.0)');

  // Multi-Select Weighted Partial Credit (1 correct, 0 incorrect out of 2)
  const res4 = evaluateQuizResponse({
    questionType: 'MULTI_SELECT',
    points: 4.0,
    negativeMarking: 1.0,
    options: [
      { id: 'o1', isCorrect: true },
      { id: 'o2', isCorrect: true },
      { id: 'o3', isCorrect: false },
    ],
    selectedOptionIds: ['o1'],
  });
  assert(!res4.isCorrect && res4.scoreAwarded === 2.0, 'Multi-select partial credit awards weighted half points (2.0)');

  // Numeric Evaluation
  const res5 = evaluateQuizResponse({
    questionType: 'NUMERIC',
    points: 4.0,
    negativeMarking: 1.0,
    options: [],
    numericAnswer: 12.0001,
    expectedNumericAnswer: 12,
    numericTolerance: 1e-3,
  });
  assert(res5.isCorrect && res5.scoreAwarded === 4.0 * 1.0, 'Numeric answer within tolerance is marked correct');

  // CODE_ORDER Partial Credit Rubric
  const resCodeOrder = evaluateQuizResponse({
    questionType: 'CODE_ORDER',
    points: 4.0,
    negativeMarking: 1.0,
    options: [],
    orderedBlockIds: ['b-1', 'b-2', 'b-3'],
    expectedOrderBlockIds: ['b-1', 'b-2', 'b-3'],
  });
  assert(resCodeOrder.isCorrect && resCodeOrder.scoreAwarded === 4.0, 'Code Order fully correct awards full points (4.0)');

  // SLIDER Tolerance Bands Rubric
  const resSlider = evaluateQuizResponse({
    questionType: 'SLIDER',
    points: 4.0,
    negativeMarking: 1.0,
    options: [],
    numericAnswer: 102,
    expectedNumericAnswer: 100,
    toleranceFull: 2,
    tolerancePartial: 5,
  });
  assert(resSlider.isCorrect && resSlider.scoreAwarded === 4.0, 'Slider within full tolerance awards 100% points (4.0)');

  // HOTSPOT Multi-region Overlap Rubric
  const resHotspot = evaluateQuizResponse({
    questionType: 'HOTSPOT',
    points: 4.0,
    negativeMarking: 1.0,
    options: [],
    selectedHotspotIds: ['hs-1', 'hs-2'],
    expectedHotspotIds: ['hs-1', 'hs-2'],
  });
  assert(resHotspot.isCorrect && resHotspot.scoreAwarded === 4.0, 'Hotspot multi-region overlap awards full points (4.0)');

  // Fetch or create a test user
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'quiz-test-user@contestos.internal',
        name: 'Quiz Test User',
        password: 'hashed-password-123',
        role: 'STUDENT',
      },
    });
  }

  // TEST GROUP 3: Synchronized Cheating Detection
  console.log('\n--- TEST GROUP 3: Synchronized Cheating Detector ---');
  const section = await prisma.contestSection.findFirst();
  const contestId = section?.contestId || 'demo-contest';
  const qId = 'test-q-99';
  const ip = '192.168.1.50';

  const isCheatCandidateA = await detectSynchronizedCheating(user.id, contestId, qId, ip, ['opt-1', 'opt-2']);
  assert(!isCheatCandidateA, 'First submission on IP is normal (not flagged)');

  const isCheatCandidateB = await detectSynchronizedCheating('user-cand-B-other', contestId, qId, ip, ['opt-1', 'opt-2']);
  assert(isCheatCandidateB, 'Rapid duplicate submission (<500ms) on same IP triggers anomaly flag');

  // TEST GROUP 4: Proctor Live Session Freeze
  console.log('\n--- TEST GROUP 4: Proctor Live Session Freeze ---');
  const testUserId = user.id;
  assert(!isQuizSessionFrozen(testUserId, contestId), 'Initial quiz session is unfrozen');

  setQuizSessionFreeze(testUserId, contestId, true);
  assert(isQuizSessionFrozen(testUserId, contestId), 'Session is frozen after proctor freeze command');

  setQuizSessionFreeze(testUserId, contestId, false);
  assert(!isQuizSessionFrozen(testUserId, contestId), 'Session is unfrozen after proctor unfreeze command');

  // TEST GROUP 5: Per-Attempt Materialization
  console.log('\n--- TEST GROUP 5: Per-Attempt Materialization ---');
  if (section) {
    const matA = await materializeQuizAttempt(user.id, contestId, section.id);
    assert(matA.length > 0, 'Materialized questions for candidate');
    assert(Array.isArray(matA[0].optionOrderMap), 'Candidate option order map is an array');
  } else {
    console.log('Skipping DB materialization check (no section in DB)');
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 Results: ${passedTests}/${totalTests} assertions passed`);
  console.log(`${'='.repeat(60)}`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runQuizIntegrationSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Quiz integration suite error:', err);
    process.exit(1);
  });
