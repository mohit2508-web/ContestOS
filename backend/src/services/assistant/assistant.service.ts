import redis from '../../lib/redis';
import { prisma } from '../../lib/prisma';
import { 
  AssistantStage, 
  SessionState, 
  QuestionMeta, 
  AssistantMessageResponse 
} from '../../types/assistant.types';
import { preFilterReject, STAGE_REDIRECTS, STAGE_NEXT_QUESTIONS, getDynamicRedirectReply, getStageNextQuestion } from './prefilter.service';
import { callGateClassifier } from './gateClassifier.service';
import { callCodeGeneration } from './codeGen.service';

const inMemorySessions = new Map<string, SessionState>();

export const DEFAULT_LCM_QUESTION_META: QuestionMeta = {
  language: 'c',
  noMain: true,
  inPlaceRequired: true,
  functionSignature: 'struct TreeNode* LCMOfTrees(struct TreeNode* root1, struct TreeNode* root2)',
  readonlyBoilerplate: `struct TreeNode
{
    int data;
    struct TreeNode* left;
    struct TreeNode* right;
};`,
  problemStatement: `01. LCM of two trees
Given two binary trees root1 and root2. Calculate node-wise LCM of values. 
Re-use existing tree nodes in-place (do not allocate extra memory). Return modified root1.

Explanation:
LCM of:
• (1,4) = 4
• (2,6) = 6
• (3,8) = 24
• (4,null) = 4
• (5,2) = 10
• (9,null) = 9

Sample input:
root1: 2 (left:3, right:5), root2: 5 (left:6, right:3)
Sample Output:
10 (left:6, right:15)`
};

export async function getOrCreateSession(
  sessionId: string,
  userId: string,
  problemId?: string
): Promise<SessionState> {
  const redisKey = `assistant:session:${sessionId}`;

  // 1. Check in-memory cache first
  if (inMemorySessions.has(sessionId)) {
    return inMemorySessions.get(sessionId)!;
  }

  // 2. Check Redis cache
  if (redis) {
    try {
      const cachedStr = await redis.get(redisKey);
      if (cachedStr) {
        const state: SessionState = JSON.parse(cachedStr);
        inMemorySessions.set(sessionId, state);
        return state;
      }
    } catch {
      // Ignore Redis error and proceed
    }
  }

  // 3. Create fresh session
  const newState: SessionState = {
    sessionId,
    userId,
    problemId: problemId || 'lcm_of_two_trees_c',
    stage: 'PROBLEM',
    captured: {
      problem_summary: null,
      ds_choice: null,
      approach: null,
    },
    tokensUsed: 0,
    tokenBudget: 2000,
    turnCountThisStage: 0,
    codeGenerated: false,
    questionMeta: DEFAULT_LCM_QUESTION_META,
  };

  inMemorySessions.set(sessionId, newState);
  if (redis) {
    try {
      await redis.setex(redisKey, 7200, JSON.stringify(newState));
    } catch {}
  }

  return newState;
}

export async function saveSessionState(state: SessionState): Promise<void> {
  inMemorySessions.set(state.sessionId, state);
  if (redis) {
    try {
      await redis.setex(`assistant:session:${state.sessionId}`, 7200, JSON.stringify(state));
    } catch {}
  }
}

export async function processCandidateMessage(
  sessionId: string,
  userId: string,
  candidateMessage: string,
  language: string = 'c'
): Promise<AssistantMessageResponse> {
  const session = await getOrCreateSession(sessionId, userId);
  if (language) {
    session.questionMeta.language = language;
  }

  // Check Token Budget
  if (session.tokensUsed >= session.tokenBudget) {
    return {
      reply: "Token budget limit reached (2,000 max tokens used). You can continue coding directly in the editor.",
      stage: session.stage,
      stageAdvanced: false,
      tokensUsed: session.tokensUsed,
      tokenBudget: session.tokenBudget,
      canInsert: false
    };
  }

  const currentStage = session.stage;

  // Step 1: Pre-filter Check (Zero-cost instantaneous check)
  if (preFilterReject(candidateMessage, currentStage)) {
    const redirectReply = getDynamicRedirectReply(candidateMessage, currentStage);
    return {
      reply: redirectReply,
      stage: currentStage,
      stageAdvanced: false,
      tokensUsed: session.tokensUsed,
      tokenBudget: session.tokenBudget,
      canInsert: false
    };
  }

  // Step 2: Gate Classification (Claude Haiku or heuristic)
  const gateResult = await callGateClassifier(currentStage, candidateMessage, session.questionMeta);
  session.tokensUsed += gateResult.tokensUsed || 20;

  if (!gateResult.complete || gateResult.confidence < 0.6) {
    const redirectReply = getDynamicRedirectReply(candidateMessage, currentStage);
    await saveSessionState(session);
    return {
      reply: redirectReply,
      stage: currentStage,
      stageAdvanced: false,
      tokensUsed: session.tokensUsed,
      tokenBudget: session.tokenBudget,
      canInsert: false
    };
  }

  // Step 3: Gate Passed! Update captured answers & advance stage state
  if (currentStage === 'PROBLEM') {
    session.captured.problem_summary = candidateMessage;
    session.stage = 'DATA_STRUCTURE';
  } else if (currentStage === 'DATA_STRUCTURE') {
    session.captured.ds_choice = candidateMessage;
    session.stage = 'APPROACH';
  } else if (currentStage === 'APPROACH') {
    session.captured.approach = candidateMessage;
    session.stage = 'AWAITING_CODE_REQUEST';
  } else if (currentStage === 'AWAITING_CODE_REQUEST') {
    session.stage = 'CODE_GEN';
  }

  session.turnCountThisStage = 0;

  // Step 4: Code Generation branch vs Templated Question branch
  if (session.stage === 'CODE_GEN') {
    const codeGenResult = await callCodeGeneration(session.captured, session.questionMeta, language);
    session.tokensUsed += codeGenResult.tokensUsed;
    session.codeGenerated = true;
    await saveSessionState(session);

    return {
      reply: codeGenResult.text,
      stage: 'CODE_GEN',
      stageAdvanced: true,
      tokensUsed: session.tokensUsed,
      tokenBudget: session.tokenBudget,
      code: codeGenResult.code,
      canInsert: true
    };
  }

  // Dynamic next question with candidate word mirroring
  const nextQuestion = getStageNextQuestion(session.stage, candidateMessage);
  await saveSessionState(session);

  return {
    reply: nextQuestion,
    stage: session.stage,
    stageAdvanced: true,
    tokensUsed: session.tokensUsed,
    tokenBudget: session.tokenBudget,
    canInsert: false
  };
}
