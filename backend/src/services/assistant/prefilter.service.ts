import { AssistantStage } from '../../types/assistant.types';

const MIN_LENGTH = 15;

const DEFLECTION_PATTERNS = [
  /\byou (choose|decide|recommend|pick|tell me)\b/i,
  /\bwhat should i (use|do)\b/i,
  /\bidk\b/i,
  /\b(best|correct|complete) (approach|solution|code)\b/i,
  /^(hi+|hey|hello|sup|pls|please|hlo|helo)$/i,
  /\bgenerate (the )?(correct )?(complete )?code\b/i,
  /\bgive (me )?(the )?code\b/i,
  /\bwrite (the )?code\b/i,
  /\bsolution\b/i,
  // Anti-Jailbreak & Prompt Injection Protections
  /\b(ignore|forget|override|bypass)\b.*\b(instruction|rule|restriction|system|prompt|previous)\b/i,
  /\b(pretend|roleplay|simulate)\b.*\b(over|ended|free|developer|helpful|mode|assistant)\b/i,
  /\b(you are|act as)\b.*\b(free|unrestricted|god|admin|helpful)\b/i,
  /\b(code dedo|solution do|answer btao|code likho|poora code|direct code)\b/i,
];

export const STAGE_REDIRECTS: Record<AssistantStage, string> = {
  PROBLEM: "This is a technical assessment. Please describe the problem in detail: explain the inputs, expected outputs, AND key constraints/edge cases (e.g., NULL trees).",
  DATA_STRUCTURE: "I need to evaluate YOUR data structure choice. What data structure(s) will you use, and what is the Space Complexity O(...) of your approach?",
  APPROACH: "Please detail YOUR step-by-step logic: how do you calculate LCM using GCD, how do you handle NULL base cases, and what is the Time Complexity O(...)?",
  AWAITING_CODE_REQUEST: "Understood! You have demonstrated algorithmic understanding. Type 'generate code' or ask to generate starter implementation.",
  CODE_GEN: "The starter code has been generated. You can refine the code by explaining specific changes or click 'Insert in Editor'.",
  REFINEMENT: "You can refine the code by explaining specific changes to the logic."
};

export const STAGE_NEXT_QUESTIONS: Record<AssistantStage, string> = {
  PROBLEM: "Good summary! Now, what data structure(s) will you use to solve this, and what is the Space Complexity O(...) of your approach?",
  DATA_STRUCTURE: "Great choice! Now explain your step-by-step logic: how do you calculate LCM using GCD, how do you handle NULL base cases, and what is the Time Complexity O(...)?",
  APPROACH: "Understood! You have demonstrated solid algorithmic understanding. Ask to generate the starter implementation.",
  AWAITING_CODE_REQUEST: "Generating the starter code implementation...",
  CODE_GEN: "Here is your starter code implementation. You can click 'Insert in Editor' to move it into the coding panel.",
  REFINEMENT: "I have updated the code according to your specified changes."
};

const KEY_CONCEPT_WORDS = ['recursion', 'recursive', 'binary tree', 'tree node', 'pointers', 'in-place', 'lcm', 'gcd', 'queue', 'stack', 'null check', 'base case'];

export function extractMirrorWord(rawText: string): string | null {
  const lower = (rawText || '').toLowerCase();
  for (const word of KEY_CONCEPT_WORDS) {
    if (lower.includes(word)) return word;
  }
  return null;
}

export function getStageNextQuestion(stage: AssistantStage, rawText: string = ''): string {
  const mirror = extractMirrorWord(rawText);
  const acks = ['Got it.', 'Understood.', 'Makes sense.', 'Noted.', 'Right on.'];
  const ack = acks[Math.floor(Math.random() * acks.length)];
  const mirrorClause = mirror ? ` Since you mentioned "${mirror}", ` : ' ';

  if (stage === 'DATA_STRUCTURE') {
    return `${ack}${mirrorClause}What data structure(s) will you use to solve this, and what is the Space Complexity O(...) of your approach?`;
  }
  if (stage === 'APPROACH') {
    return `${ack}${mirrorClause}Now explain your step-by-step logic: how do you calculate LCM using GCD, how do you handle NULL base cases, and what is the Time Complexity O(...)?`;
  }
  if (stage === 'AWAITING_CODE_REQUEST') {
    return `${ack}${mirrorClause}You have demonstrated solid algorithmic understanding. Ask to generate the starter implementation when ready.`;
  }
  return STAGE_NEXT_QUESTIONS[stage] || STAGE_NEXT_QUESTIONS.PROBLEM;
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

export function getDynamicRedirectReply(candidateText: string, stage: AssistantStage): string {
  const textLower = (candidateText || '').toLowerCase().trim();

  // If candidate pasted raw code into the chat box
  if (isRawCodePasted(candidateText)) {
    return "Please do not paste code into the chat box! This assessment requires you to explain your thought process in your own words. Please describe your conceptual understanding (inputs, expected outputs, or algorithm) to proceed.";
  }

  // Premature code/solution demands (e.g. "give solution now", "give code", "solution btao", "give answer")
  if (textLower.includes('give solution') || textLower.includes('give me solution') || textLower.includes('give code') || textLower.includes('solution now') || textLower.includes('solution btao') || textLower.includes('code do') || textLower.includes('solution do')) {
    if (stage === 'PROBLEM') {
      return "I know you're eager to get the code! But in this technical assessment, I need to evaluate your problem-solving logic first. Could you start by describing what the inputs and expected outputs are?";
    }
    if (stage === 'DATA_STRUCTURE') {
      return "I understand you want the code! But before we generate it, what data structure(s) will you use to represent the trees, and what is your space complexity O(...)?";
    }
    if (stage === 'APPROACH') {
      return "We're almost there! Before unlocking the starter code, tell me how you plan to handle NULL base cases and calculate LCM using GCD.";
    }
  }

  // Inquisitive / Stuck candidate inputs
  if (textLower.includes('dont know') || textLower.includes("don't know") || textLower.includes('no idea') || textLower.includes('idk') || textLower.includes('help')) {
    return "No worries! Let's break it down together. Take a look at the problem statement on the left. We have two binary trees (`root1` and `root2`). Can you try explaining what we need to calculate for their corresponding nodes?";
  }

  if (textLower.includes('input') || textLower.includes('given')) {
    return "Great! The inputs are two binary tree roots (`root1` and `root2`). Now, what operation should we perform on the node values when we merge them?";
  }

  if (textLower.includes('tree') || textLower.includes('binary')) {
    return "Spot on! It's a binary tree problem. Now, what is the expected output when we merge `root1` and `root2` node-by-node?";
  }

  if (textLower.includes('output') || textLower.includes('result') || textLower.includes('ans')) {
    return "Right! The output is the merged tree. Can you also mention what mathematical calculation (like LCM) is performed at each node?";
  }

  if (textLower.includes('lcm') || textLower.includes('gcd')) {
    return "Exactly, we need to calculate node-wise LCM! Now, what data structure and space complexity will you use for tree traversal?";
  }

  if (stage === 'PROBLEM') {
    return "I'm listening! Could you describe what the inputs are (`root1` & `root2`) and what mathematical operation we perform on their nodes?";
  }

  if (stage === 'DATA_STRUCTURE') {
    return "You're on the right track! What specific data structure (e.g. binary tree / pointers) will you use, and what is your space complexity O(...)?";
  }

  if (stage === 'APPROACH') {
    return "Good start! Could you explain your step-by-step logic, how you handle NULL base cases, and how LCM is calculated using GCD?";
  }

  return STAGE_REDIRECTS[stage];
}

export function preFilterReject(text: string, stage: AssistantStage): boolean {
  const trimmed = text.trim();
  
  if (isRawCodePasted(trimmed)) {
    return true;
  }

  // Special case: In AWAITING_CODE_REQUEST, phrases asking for code are valid!
  if (stage === 'AWAITING_CODE_REQUEST') {
    return false;
  }

  if (trimmed.length < MIN_LENGTH) {
    return true;
  }

  return DEFLECTION_PATTERNS.some(re => re.test(trimmed));
}
