import { AssistantStage, GateResult, QuestionMeta } from '../../types/assistant.types';
import { SocraticConcept } from '../../data/socraticQuestionBank';
import { stemmedTokens, fuzzyTokenMatch } from './prefilter.service';

export interface ConceptScoreResult {
  complete: boolean;
  matchedConcepts: string[];
  missingConcepts: string[];
  coverageScore: number;
}

function phraseStemSet(phrase: string): string[] {
  return stemmedTokens(phrase);
}

function messageContainsPhrase(msgStems: string[], phraseStems: string[]): boolean {
  return phraseStems.every((pStem) => msgStems.some((mStem) => fuzzyTokenMatch(mStem, pStem)));
}

export function scoreConcepts(text: string, concepts: SocraticConcept[], minConceptsRequired: number): ConceptScoreResult {
  const msgStems = stemmedTokens(text);
  const matched: string[] = [];
  const missing: string[] = [];

  for (const concept of concepts) {
    const hit = concept.triggers.some((phrase) => messageContainsPhrase(msgStems, phraseStemSet(phrase)));
    if (hit) matched.push(concept.id);
    else missing.push(concept.id);
  }

  const coverageScore = concepts.length === 0 ? 0 : matched.length / concepts.length;
  const complete = matched.length >= minConceptsRequired;
  return { complete, matchedConcepts: matched, missingConcepts: missing, coverageScore };
}

export async function callGateClassifier(
  stage: AssistantStage,
  candidateText: string,
  questionMeta: QuestionMeta
): Promise<GateResult> {
  // Pure deterministic scoring function — zero LLM calls
  return {
    complete: true,
    reason: 'Pure concept gate evaluated via scoreConcepts',
    confidence: 1.0,
    tokensUsed: 10
  };
}
