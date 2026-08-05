export interface SectionRulesConfig {
  negativeMarkingRatio: number; // e.g. 0.25 (-25% of points for incorrect answer) or 0
  allowPartialCredit: boolean;
  navigationPolicy: 'FREE' | 'FORWARD_ONLY';
  pooledTimeMinutes: number;
  allowScratchpad: boolean;
  allowedQuestionTypes: string[];
}

export const DEFAULT_SECTION_RULES: SectionRulesConfig = {
  negativeMarkingRatio: 0.25,
  allowPartialCredit: true,
  navigationPolicy: 'FREE',
  pooledTimeMinutes: 30,
  allowScratchpad: true,
  allowedQuestionTypes: [
    'SINGLE_SELECT',
    'MULTI_SELECT',
    'TRUE_FALSE',
    'NUMERIC',
    'CODE_OUTPUT',
    'CODE_ORDER',
    'SLIDER',
    'HOTSPOT',
  ],
};
