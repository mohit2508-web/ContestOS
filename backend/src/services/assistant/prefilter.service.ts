import { AssistantStage } from '../../types/assistant.types';

/* ============================================================
 * TEXT UTILS — stemmer + Levenshtein fuzzy matcher (no deps)
 * ============================================================ */

export function stem(word: string): string {
  let w = word.toLowerCase();
  const suffixes = [
    'ational', 'ization', 'fulness', 'iveness', 'ousness',
    'ically', 'ingly', 'edly', 'ement',
    'ing', 'edly', 'ive', 'ize', 'ise', 'tion', 'sion',
    'ed', 'es', 'ly', 's',
  ];
  for (const suf of suffixes) {
    if (w.length - suf.length >= 3 && w.endsWith(suf)) {
      w = w.slice(0, w.length - suf.length);
      break;
    }
  }
  return w;
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

export function stemmedTokens(text: string): string[] {
  return tokenize(text).map(stem);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev: number[] = new Array(b.length + 1);
  const curr: number[] = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

export function fuzzyTokenMatch(tokenStem: string, conceptStem: string): boolean {
  if (tokenStem === conceptStem) return true;
  if (conceptStem.length <= 3) return false;
  const maxDist = conceptStem.length >= 7 ? 2 : 1;
  return levenshtein(tokenStem, conceptStem) <= maxDist;
}

/* ============================================================
 * DEFLECTION DETECTOR
 * ============================================================ */

export interface DeflectionResult {
  isDeflection: boolean;
  matchedPattern: string | null;
}

const DEFLECTION_STEM_SETS: string[][] = [
  ['you', 'decid'], ['you', 'choos'], ['you', 'recommend'], ['you', 'pick'],
  ['you', 'tell'], ['you', 'suggest'], ['you', 'know', 'best'],
  ['what', 'should', 'i', 'us'], ['what', 'should', 'i', 'do'],
  ['best', 'approach', 'possibl'], ['best', 'solut'], ['correct', 'complet', 'code'],
  ['generat', 'code'], ['idk'], ['dont', 'know'], ['not', 'sure', 'what'],
];

const FILLER_ONLY = new Set([
  'hi', 'hii', 'hiii', 'hey', 'hello', 'sup', 'yo', 'ok', 'okay', 'sure',
  'yes', 'no', 'k', 'kk', 'test', 'hmm', 'cool',
]);

function stemSetPresent(messageStems: string[], patternStems: string[]): boolean {
  return patternStems.every((p) => messageStems.includes(p));
}

export function detectDeflection(text: string, stage: string): DeflectionResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { isDeflection: true, matchedPattern: 'empty' };

  const lower = trimmed.toLowerCase();
  if (FILLER_ONLY.has(lower)) return { isDeflection: true, matchedPattern: 'filler_only' };

  const msgStems = stemmedTokens(trimmed);
  for (const pattern of DEFLECTION_STEM_SETS) {
    if (pattern[0] === 'generat' && stage === 'AWAITING_CODE_REQUEST') continue;
    if (stemSetPresent(msgStems, pattern)) {
      return { isDeflection: true, matchedPattern: pattern.join('+') };
    }
  }
  if (trimmed.length < 12 && !/[{}()<>]/.test(trimmed)) {
    return { isDeflection: true, matchedPattern: 'too_short' };
  }
  return { isDeflection: false, matchedPattern: null };
}

/* ============================================================
 * TEMPLATES — response variety + redirects
 * ============================================================ */

export const WELCOME_MESSAGE = `Hi! I'm here to help you think through this problem before you start coding.

Here's how this works: I'll ask you a few quick questions — first about the problem itself, then your data structure choice, then your approach. Once you've walked me through your thinking, I'll generate starter code based on exactly what you described.

A couple of things that help this go smoothly:
- Be specific — mention the actual inputs, outputs, and constraints rather than just naming the problem
- When I ask about your approach, walk me through the logic step by step
- I can't write the full solution for you upfront, but once we've talked through your plan, I'll get you a solid starting point

Ready when you are — go ahead and describe the problem in your own words.`;

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const STAGE_QUESTIONS: Record<string, string[]> = {
  PROBLEM: [
    'Go ahead — describe the problem in your own words: what are the inputs, the expected output, and the key constraints?',
    "Let's start with the problem itself — what are the inputs, the expected output, and anything you'd call out as a constraint?",
  ],
  DATA_STRUCTURE: [
    'What data structure(s) will you use here, and what space complexity does that give you?',
    'What would you reach for to solve this, and why — what space complexity are you looking at?',
  ],
  APPROACH: [
    'Walk me through your step-by-step logic — how do you compute the LCM, how do you handle the NULL cases, and what recursion structure are you using?',
    'Talk me through your approach: the core LCM computation, how NULL cases are handled, and how the recursion is structured.',
  ],
  AWAITING_CODE_REQUEST: [
    "That covers it. Whenever you're ready, just say \"generate the code\" and I'll put together a starting point based on what you described.",
  ],
};

export const REDIRECTS: Record<string, string[]> = {
  PROBLEM: [
    "I want to make sure we're on the same page — can you walk me through the actual inputs, the expected output, and any constraints, rather than just the problem name?",
    "Let's slow down for a second — what specifically are the inputs and outputs here, and what constraints do you see?",
  ],
  DATA_STRUCTURE: [
    "Naming the structure is a start, but I'd like to hear why it fits and what space complexity you're expecting.",
    "Tell me a bit more — why does that data structure make sense here, and what's the space cost?",
  ],
  APPROACH: [
    "I need a bit more detail on the actual steps — how are you handling the NULL cases and computing the LCM?",
    "Can you walk me through this more concretely — the base cases and how the LCM gets computed?",
  ],
  AWAITING_CODE_REQUEST: [
    'Just say "generate the code" whenever you\'re ready, and I\'ll put together starter code based on your plan.',
  ],
  BUDGET_EXHAUSTED: [
    "We've used up the available assistant time for this question — you're all set to continue directly in the editor from here.",
  ],
};

export const ACK_PREFIXES = ['Got it.', 'Makes sense.', 'That tracks.', 'Okay, good.'];
export const STOPWORDS = new Set(['two', 'one', 'the', 'a', 'an', 'of', 'to', 'is', 'in', 'if']);

export function extractMirrorWord(rawText: string, matchedConceptIds: string[], conceptDefs: any[]): string | null {
  if (!matchedConceptIds || matchedConceptIds.length === 0) return null;
  const firstConcept = conceptDefs.find((c) => c.id === matchedConceptIds[0]);
  if (!firstConcept) return null;
  const lower = rawText.toLowerCase();
  for (const trigger of firstConcept.triggers) {
    if (trigger.includes(' ') && lower.includes(trigger)) return `"${trigger}"`;
    const firstWord = trigger.split(' ')[0];
    if (!STOPWORDS.has(firstWord) && firstWord.length > 3 && lower.includes(firstWord)) {
      return `"${firstWord}"`;
    }
  }
  return null;
}

export function nextStageName(current: string): string {
  const STAGE_SEQUENCE = ['PROBLEM', 'DATA_STRUCTURE', 'APPROACH', 'AWAITING_CODE_REQUEST', 'CODE_GEN'];
  const idx = STAGE_SEQUENCE.indexOf(current);
  return STAGE_SEQUENCE[Math.min(idx + 1, STAGE_SEQUENCE.length - 1)];
}

export function buildAckAndNextQuestion(stageJustCompleted: string, rawText: string, matchedConceptIds: string[], conceptDefs: any[]): string {
  const ack = pick(ACK_PREFIXES);
  const mirror = extractMirrorWord(rawText, matchedConceptIds, conceptDefs);
  const nextQ = pick(STAGE_QUESTIONS[nextStageName(stageJustCompleted)]);
  const mirrorClause = mirror ? ` Since you mentioned ${mirror}, ` : ' ';
  return `${ack}${mirrorClause}${nextQ}`;
}

export function buildRedirect(stage: string): string {
  return pick(REDIRECTS[stage] || REDIRECTS.PROBLEM);
}

export function isRawCodePasted(text: string): boolean {
  const trimmed = (text || '').trim();
  const codePatterns = [
    /\b(def\s+\w+|function\s+\w+|public\s+class\s+\w+|struct\s+\w+|class\s+\w+)\b/i,
    /\b(return\s+None|return\s+null|return\s+nullptr|return\s+\w+;)\b/i,
    /\b(getattr\(|malloc\(|new\s+\w+\(|printf\(|cout\s*<<)\b/i,
    /->\s*\w+:/,
    /{\s*\n.*}/s,
    /;\s*\n\s*\w+/
  ];
  return codePatterns.some(pattern => pattern.test(trimmed));
}

export function preFilterReject(text: string, stage: AssistantStage): boolean {
  const res = detectDeflection(text, stage);
  return res.isDeflection;
}

export function getDynamicRedirectReply(candidateText: string, stage: AssistantStage): string {
  return buildRedirect(stage);
}
