import { SOCRATIC_QUESTION_BANK, SocraticProblem } from '../../data/socraticQuestionBank';
import {
  detectDeflection,
  buildRedirect,
  buildAckAndNextQuestion,
  WELCOME_MESSAGE
} from './prefilter.service';
import { scoreConcepts } from './gateClassifier.service';
import { generateStaticCode } from './codeGen.service';

export type Stage = 'PROBLEM' | 'DATA_STRUCTURE' | 'APPROACH' | 'AWAITING_CODE_REQUEST' | 'CODE_GEN' | 'REFINEMENT';
const STAGE_ORDER: Stage[] = ['PROBLEM', 'DATA_STRUCTURE', 'APPROACH', 'AWAITING_CODE_REQUEST', 'CODE_GEN', 'REFINEMENT'];

export interface TranscriptTurn {
  turn: number;
  role: 'candidate' | 'assistant';
  stage: Stage;
  text: string;
  meta: Record<string, unknown>;
  at: string;
}

export interface AssistantSession {
  key: string;
  sessionId: string;
  userId: string;
  problemId: string;
  problem: SocraticProblem;
  stage: Stage;
  captured: { PROBLEM: string | null; DATA_STRUCTURE: string | null; APPROACH: string | null };
  matchedConcepts: { PROBLEM: string[]; DATA_STRUCTURE: string[]; APPROACH: string[] };
  turnCountThisStage: number;
  codeGenerated: boolean;
  creditsUsed: number;
  creditBudget: number;
  tokensUsed: number;
  tokenBudget: number;
  transcript: TranscriptTurn[];
  createdAt: string;
  welcomeSent: boolean;
  questionMeta: {
    language: string;
    noMain: boolean;
    inPlaceRequired: boolean;
    functionSignature: string;
    readonlyBoilerplate: string;
    problemStatement: string;
  };
}

export interface AssistantMessageResponse {
  reply: string;
  stage: Stage;
  stageAdvanced: boolean;
  tokensUsed: number;
  tokenBudget: number;
  code?: string | null;
  canInsert?: boolean;
}

const sessionStoreMap = new Map<string, AssistantSession>();

export function sessionKey(sessionId: string, problemId?: string): string {
  return problemId ? `${sessionId}:${problemId}` : sessionId;
}

export async function getOrCreateSession(
  sessionId: string,
  userId: string = 'candidate_1',
  problemId: string = 'lcm_of_two_trees',
  language: string = 'c'
): Promise<AssistantSession> {
  const actualProbId = problemId || 'lcm_of_two_trees';
  const key = sessionKey(sessionId, actualProbId);
  const existing = sessionStoreMap.get(key);
  if (existing) return existing;

  const problem = SOCRATIC_QUESTION_BANK[actualProbId] || SOCRATIC_QUESTION_BANK['lcm_of_two_trees'];

  const session: AssistantSession = {
    key,
    sessionId,
    userId,
    problemId: actualProbId,
    problem,
    stage: 'PROBLEM',
    captured: { PROBLEM: null, DATA_STRUCTURE: null, APPROACH: null },
    matchedConcepts: { PROBLEM: [], DATA_STRUCTURE: [], APPROACH: [] },
    turnCountThisStage: 0,
    codeGenerated: false,
    creditsUsed: 0,
    creditBudget: 200,   // Per-session turn budget (each candidate gets 200 AI turns)
    tokensUsed: 0,
    tokenBudget: 2000,  // Per-student token budget (2000 tokens per session)
    transcript: [],
    createdAt: new Date().toISOString(),
    welcomeSent: false,
    questionMeta: {
      language,
      noMain: true,
      inPlaceRequired: true,
      functionSignature: problem.functionSignatureByLanguage[language] || problem.functionSignatureByLanguage['c'],
      readonlyBoilerplate: '',
      problemStatement: problem.description
    }
  };

  sessionStoreMap.set(key, session);
  return session;
}

export function saveSessionState(session: AssistantSession): void {
  sessionStoreMap.set(session.key, session);
}

function nextStage(current: Stage): Stage {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx === -1 || idx === STAGE_ORDER.length - 1) return current;
  return STAGE_ORDER[idx + 1];
}

function logTranscript(session: AssistantSession, role: 'candidate' | 'assistant', text: string, meta: Record<string, unknown> = {}): void {
  session.transcript.push({
    turn: session.transcript.length + 1,
    role,
    stage: session.stage,
    text,
    meta,
    at: new Date().toISOString()
  });
}

export function getWelcomeMessage(session: AssistantSession): string | null {
  if (session.welcomeSent) return null;
  session.welcomeSent = true;
  logTranscript(session, 'assistant', WELCOME_MESSAGE, { welcome: true });
  saveSessionState(session);
  return WELCOME_MESSAGE;
}

export async function processCandidateMessage(
  sessionId: string,
  userId: string,
  text: string,
  language: string = 'c',
  problemId: string = 'lcm_of_two_trees'
): Promise<AssistantMessageResponse> {
  const session = await getOrCreateSession(sessionId, userId, problemId, language);
  session.questionMeta.language = language;

  if (session.creditsUsed >= session.creditBudget || session.tokensUsed >= session.tokenBudget) {
    const reply = buildRedirect('BUDGET_EXHAUSTED');
    return {
      reply,
      stage: session.stage,
      stageAdvanced: false,
      tokensUsed: session.tokensUsed,
      tokenBudget: session.tokenBudget,
      canInsert: false
    };
  }

  session.creditsUsed += 1;
  session.tokensUsed = Math.min(session.tokenBudget, session.tokensUsed + 100);
  logTranscript(session, 'candidate', text);

  const stage = session.stage;

  // Handle AWAITING_CODE_REQUEST stage
  if (stage === 'AWAITING_CODE_REQUEST') {
    const deflect = detectDeflection(text, stage);
    if (deflect.isDeflection && !/generat|code/i.test(text)) {
      const reply = buildRedirect('AWAITING_CODE_REQUEST');
      logTranscript(session, 'assistant', reply, { gate: 'reject' });
      saveSessionState(session);
      return {
        reply,
        stage: session.stage,
        stageAdvanced: false,
        tokensUsed: session.tokensUsed,
        tokenBudget: session.tokenBudget,
        canInsert: false
      };
    }
    return generateCodeResponse(session, language);
  }

  // Deflection detection check
  const deflection = detectDeflection(text, stage);
  if (deflection.isDeflection) {
    session.turnCountThisStage += 1;
    const reply = buildRedirect(stage);
    logTranscript(session, 'assistant', reply, { gate: 'reject', reason: deflection.matchedPattern });
    saveSessionState(session);
    return {
      reply,
      stage: session.stage,
      stageAdvanced: false,
      tokensUsed: session.tokensUsed,
      tokenBudget: session.tokenBudget,
      canInsert: false
    };
  }

  // Pure Deterministic Concept Scoring Gate
  const stageConfig = session.problem.socraticConfig[stage as 'PROBLEM' | 'DATA_STRUCTURE' | 'APPROACH'];
  const result = scoreConcepts(text, stageConfig.concepts, stageConfig.minConceptsRequired);

  if (!result.complete) {
    session.turnCountThisStage += 1;
    const reply = buildRedirect(stage);
    logTranscript(session, 'assistant', reply, { gate: 'reject', reason: 'insufficient_concept_coverage', matched: result.matchedConcepts });
    saveSessionState(session);
    return {
      reply,
      stage: session.stage,
      stageAdvanced: false,
      tokensUsed: session.tokensUsed,
      tokenBudget: session.tokenBudget,
      canInsert: false
    };
  }

  // Concept Gate PASSED! Advance stage state
  (session.captured as any)[stage] = text;
  (session.matchedConcepts as any)[stage] = result.matchedConcepts;
  session.turnCountThisStage = 0;
  const advancedStage = nextStage(stage);
  session.stage = advancedStage;

  const reply = buildAckAndNextQuestion(stage, text, result.matchedConcepts, stageConfig.concepts);
  logTranscript(session, 'assistant', reply, { gate: 'pass', matched: result.matchedConcepts });
  saveSessionState(session);

  return {
    reply,
    stage: session.stage,
    stageAdvanced: true,
    tokensUsed: session.tokensUsed,
    tokenBudget: session.tokenBudget,
    canInsert: false
  };
}

function generateCodeResponse(session: AssistantSession, language: string): AssistantMessageResponse {
  const { code } = generateStaticCode(session.problem, language, {
    DATA_STRUCTURE: session.matchedConcepts.DATA_STRUCTURE,
    APPROACH: session.matchedConcepts.APPROACH,
  });

  session.stage = 'CODE_GEN';
  session.codeGenerated = true;
  const reply = "Here's a starting point based on what you described:";
  logTranscript(session, 'assistant', code, { code: true, language });
  saveSessionState(session);

  return {
    reply: `${reply}\n\n\`\`\`${language}\n${code}\n\`\`\``,
    stage: 'CODE_GEN',
    stageAdvanced: true,
    tokensUsed: session.tokensUsed,
    tokenBudget: session.tokenBudget,
    code,
    canInsert: true
  };
}
