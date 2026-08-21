import axios from 'axios';
import { AssistantStage, GateResult, QuestionMeta } from '../../types/assistant.types';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

const STAGE_REQUIREMENTS: Record<AssistantStage, string> = {
  PROBLEM: "Candidate must describe the problem in their own words: inputs (two tree roots), expected output (merged tree with node-wise LCM), and key constraints (in-place modification / reuse tree nodes).",
  DATA_STRUCTURE: "Candidate must specify data structure(s) (e.g. binary tree + recursion / pointers) and justify their choice for the problem constraints.",
  APPROACH: "Candidate must outline step-by-step recursive merge logic: null handling, LCM calculation for corresponding nodes, recursive calls on left and right subtrees, returning modified root.",
  AWAITING_CODE_REQUEST: "Candidate is requesting starter code generation.",
  CODE_GEN: "Starter code is already generated.",
  REFINEMENT: "Candidate is requesting specific logic refinements."
};

export async function callGateClassifier(
  stage: AssistantStage,
  candidateText: string,
  questionMeta: QuestionMeta
): Promise<GateResult> {
  const textLower = candidateText.toLowerCase().trim();

  // If Anthropic API Key is set, call Claude Haiku
  if (ANTHROPIC_API_KEY) {
    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 150,
          temperature: 0,
          system: `You are a strict coding assessment AI evaluator for a C programming test. Do not be lenient.
Reject any response that asks the AI to choose, restates the question verbatim, is generic filler, or lacks technical substance.
Return ONLY valid JSON matching this format:
{"complete": boolean, "reason": "string", "confidence": number}`,
          messages: [
            {
              role: 'user',
              content: `CURRENT STAGE: ${stage}
STAGE REQUIREMENT: ${STAGE_REQUIREMENTS[stage]}
REQUIRED SIGNATURE: ${questionMeta.functionSignature}

Candidate's response:
"""${candidateText}"""`
            }
          ]
        },
        {
          headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          timeout: 8000
        }
      );

      const responseText = response.data.content[0]?.text || '';
      const cleanJson = responseText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      return {
        complete: Boolean(parsed.complete),
        reason: String(parsed.reason || ''),
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
        tokensUsed: response.data.usage?.input_tokens + response.data.usage?.output_tokens || 40
      };
    } catch (err) {
      console.warn('Anthropic API call failed or timed out, using fallback heuristic classifier:', (err as any).message);
    }
  }

  // Fallback Heuristic Evaluator (Dev/Offline Mode)
  return heuristicGateClassifier(stage, textLower);
}

function heuristicGateClassifier(stage: AssistantStage, textLower: string): GateResult {
  if (stage === 'PROBLEM') {
    const hasInputs = textLower.includes('input') || textLower.includes('root') || textLower.includes('tree') || textLower.includes('two') || textLower.includes('given') || textLower.includes('array') || textLower.includes('val');
    const hasOutput = textLower.includes('output') || textLower.includes('ouptut') || textLower.includes('lcm') || textLower.includes('merge') || textLower.includes('result') || textLower.includes('value') || textLower.includes('return') || /\d+/.test(textLower);
    const hasConstraint = textLower.includes('memory') || textLower.includes('place') || textLower.includes('space') || textLower.includes('reuse') || textLower.includes('node') || textLower.includes('stack') || textLower.includes('modifi') || textLower.includes('int') || textLower.includes('tree') || textLower.includes('constraint') || textLower.includes('given') || textLower.includes('is');
    
    // If candidate provides a reasonable explanation of inputs and output
    if ((hasInputs && hasOutput) || (hasInputs && textLower.length > 20) || (hasOutput && textLower.length > 20)) {
      return { complete: true, reason: 'Problem description provided with inputs and outputs.', confidence: 0.9, tokensUsed: 30 };
    }
    return { complete: false, reason: 'Please describe the inputs and expected output of the problem.', confidence: 0.8, tokensUsed: 20 };
  }

  if (stage === 'DATA_STRUCTURE') {
    const hasDS = textLower.includes('tree') || textLower.includes('binary') || textLower.includes('node') || textLower.includes('pointer') || textLower.includes('array') || textLower.includes('list') || textLower.includes('struct') || textLower.includes('class') || textLower.includes('int') || textLower.includes('use');
    
    if (hasDS || textLower.length > 15) {
      return { complete: true, reason: 'Data structure choice provided.', confidence: 0.9, tokensUsed: 30 };
    }
    return { complete: false, reason: 'Please specify the data structure (e.g. binary tree / struct / array) you plan to use.', confidence: 0.8, tokensUsed: 20 };
  }

  if (stage === 'APPROACH') {
    const hasNullHandling = textLower.includes('null') || textLower.includes('base') || textLower.includes('empty') || textLower.includes('if') || textLower.includes('check');
    const hasLogic = textLower.includes('lcm') || textLower.includes('gcd') || textLower.includes('merge') || textLower.includes('value') || textLower.includes('combine') || textLower.includes('calculate') || textLower.includes('loop') || textLower.includes('recur') || textLower.includes('step') || textLower.includes('call') || textLower.includes('solve');
    
    if (hasNullHandling || hasLogic || textLower.length > 15) {
      return { complete: true, reason: 'Algorithmic approach outlined.', confidence: 0.9, tokensUsed: 30 };
    }
    return { complete: false, reason: 'Please describe your step-by-step logic or approach to solve the problem.', confidence: 0.8, tokensUsed: 20 };
  }

  return { complete: true, reason: 'Default pass for stage.', confidence: 1.0, tokensUsed: 10 };
}
