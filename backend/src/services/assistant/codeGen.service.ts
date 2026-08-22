import { SocraticProblem } from '../../data/socraticQuestionBank';

const CONCEPT_PHRASES: Record<string, string> = {
  reasoning_recursion: 'a recursive merge',
  reasoning_complexity: 'O(h) space on the call stack',
  structure_name: 'the existing binary tree structure',
  lcm_gcd_calc: 'GCD-based LCM computation',
  null_case: 'explicit NULL-case handling',
  recurse_children: 'recursing into the left and right children',
  in_place_update: 'an in-place update on root1 (no extra memory)',
  traverse_both: 'processing both trees together, position by position',
};

export function buildPersonalizationComment(matchedConcepts: { DATA_STRUCTURE: string[]; APPROACH: string[] }): string {
  const ids = [...(matchedConcepts.DATA_STRUCTURE || []), ...(matchedConcepts.APPROACH || [])];
  const phrases = ids.map((id) => CONCEPT_PHRASES[id]).filter(Boolean);
  const uniquePhrases = Array.from(new Set(phrases));

  if (uniquePhrases.length === 0) {
    return '// Starter code based on your stated approach.';
  }
  const shuffled = [...uniquePhrases].sort(() => Math.random() - 0.5);
  const chosen = shuffled.slice(0, Math.min(2, shuffled.length));
  return `// Based on your approach — ${chosen.join(' and ')}.`;
}

export interface GeneratedCode {
  language: string;
  code: string;
}

export function generateStaticCode(
  problem: SocraticProblem,
  language: string,
  matchedConcepts: { DATA_STRUCTURE: string[]; APPROACH: string[] }
): GeneratedCode {
  const rawLang = (language || 'c').toLowerCase();
  const langKey = rawLang === 'cpp' ? 'cpp' : rawLang === 'java' ? 'java' : rawLang === 'python' || rawLang === 'py' ? 'python' : rawLang === 'javascript' || rawLang === 'js' ? 'javascript' : 'c';

  const starterTemplate = problem.starterCodeByLanguage[langKey] || problem.starterCodeByLanguage['c'];
  if (!starterTemplate) throw new Error(`No starter code template authored for language: ${language}`);

  const personalization = buildPersonalizationComment(matchedConcepts);
  const code = `${personalization}\n${starterTemplate}`;
  return { language: langKey, code };
}

export async function callCodeGeneration(
  captured: any,
  questionMeta: any,
  language: string = 'c',
  problem?: SocraticProblem,
  matchedConcepts?: any
): Promise<{ text: string; code: string; tokensUsed: number }> {
  if (!problem) {
    const { SOCRATIC_QUESTION_BANK } = require('../../data/socraticQuestionBank');
    problem = SOCRATIC_QUESTION_BANK['lcm_of_two_trees'];
  }

  const { code } = generateStaticCode(problem!, language, matchedConcepts || { DATA_STRUCTURE: [], APPROACH: [] });

  const text = `Here is your customized Starter Code based on your approach. Click **"Insert in Editor"** to load it into your editor and complete your implementation:\n\n\`\`\`${language}\n${code}\n\`\`\``;
  return {
    text,
    code,
    tokensUsed: 10
  };
}
