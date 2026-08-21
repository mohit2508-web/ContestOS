export type AssistantStage = 
  | 'PROBLEM'
  | 'DATA_STRUCTURE'
  | 'APPROACH'
  | 'AWAITING_CODE_REQUEST'
  | 'CODE_GEN'
  | 'REFINEMENT';

export interface QuestionMeta {
  language: string;
  noMain: boolean;
  inPlaceRequired: boolean;
  functionSignature: string;
  readonlyBoilerplate: string;
  problemStatement: string;
}

export interface CapturedAnswers {
  problem_summary: string | null;
  ds_choice: string | null;
  approach: string | null;
}

export interface SessionState {
  sessionId: string;
  userId: string;
  problemId: string | null;
  stage: AssistantStage;
  captured: CapturedAnswers;
  tokensUsed: number;
  tokenBudget: number;
  turnCountThisStage: number;
  codeGenerated: boolean;
  questionMeta: QuestionMeta;
}

export interface GateResult {
  complete: boolean;
  reason: string;
  confidence: number;
  tokensUsed?: number;
}

export interface AssistantMessageResponse {
  reply: string;
  stage: AssistantStage;
  stageAdvanced: boolean;
  tokensUsed: number;
  tokenBudget: number;
  code?: string | null;
  canInsert: boolean;
}
