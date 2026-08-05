export interface EvaluationInput {
  questionType: string;
  points: number;
  negativeMarking: number;
  options: Array<{ id: string; isCorrect: boolean }>;
  selectedOptionIds?: string[];
  numericAnswer?: number | null;
  expectedNumericAnswer?: number | null;
  numericTolerance?: number;
  toleranceFull?: number;
  tolerancePartial?: number;
  textAnswer?: string | null;
  expectedTextAnswer?: string | null;
  orderedBlockIds?: string[];
  expectedOrderBlockIds?: string[];
  selectedHotspotIds?: string[];
  expectedHotspotIds?: string[];
}

export interface EvaluationOutput {
  isCorrect: boolean;
  scoreAwarded: number;
  accuracyRatio: number; // 0.0 to 1.0
}

/**
 * Evaluates candidate responses with rubrics for standard & interactive question types:
 * - Single Select / Multi-Select / Numeric / Fill Blank
 * - CODE_ORDER: Partial credit ratio (placed_correct / total)
 * - SLIDER: Tolerance bands (full credit vs partial credit)
 * - HOTSPOT: Multi-region overlap ratio scoring
 */
export function evaluateQuizResponse(input: EvaluationInput): EvaluationOutput {
  const {
    questionType,
    points,
    negativeMarking,
    options,
    selectedOptionIds = [],
    numericAnswer,
    expectedNumericAnswer,
    numericTolerance = 1e-4,
    toleranceFull,
    tolerancePartial,
    textAnswer,
    expectedTextAnswer,
    orderedBlockIds = [],
    expectedOrderBlockIds = [],
    selectedHotspotIds = [],
    expectedHotspotIds = [],
  } = input;

  if (questionType === 'SINGLE_SELECT' || questionType === 'TRUE_FALSE' || questionType === 'CODE_OUTPUT') {
    const correctOptions = options.filter((o) => o.isCorrect).map((o) => o.id);
    if (selectedOptionIds.length === 1 && correctOptions.includes(selectedOptionIds[0])) {
      return { isCorrect: true, scoreAwarded: points, accuracyRatio: 1.0 };
    } else if (selectedOptionIds.length > 0) {
      return { isCorrect: false, scoreAwarded: -Math.abs(negativeMarking), accuracyRatio: 0.0 };
    } else {
      return { isCorrect: false, scoreAwarded: 0, accuracyRatio: 0.0 };
    }
  }

  if (questionType === 'MULTI_SELECT') {
    if (!selectedOptionIds || selectedOptionIds.length === 0) {
      return { isCorrect: false, scoreAwarded: 0, accuracyRatio: 0.0 };
    }

    const correctIds = new Set(options.filter((o) => o.isCorrect).map((o) => o.id));
    const totalCorrect = correctIds.size;
    if (totalCorrect === 0) return { isCorrect: false, scoreAwarded: 0, accuracyRatio: 0.0 };

    let correctSelected = 0;
    let incorrectSelected = 0;

    for (const id of selectedOptionIds) {
      if (correctIds.has(id)) correctSelected++;
      else incorrectSelected++;
    }

    const rawRatio = (correctSelected - incorrectSelected) / totalCorrect;
    const accuracyRatio = Math.max(0, rawRatio);
    const isFullyCorrect = correctSelected === totalCorrect && incorrectSelected === 0;

    if (isFullyCorrect) {
      return { isCorrect: true, scoreAwarded: points, accuracyRatio: 1.0 };
    } else if (accuracyRatio > 0) {
      return { isCorrect: false, scoreAwarded: Number((accuracyRatio * points).toFixed(2)), accuracyRatio };
    } else {
      return { isCorrect: false, scoreAwarded: -Math.abs(negativeMarking), accuracyRatio: 0.0 };
    }
  }

  // Interactive Type 1: CODE_ORDER
  if (questionType === 'CODE_ORDER') {
    if (!orderedBlockIds || orderedBlockIds.length === 0 || expectedOrderBlockIds.length === 0) {
      return { isCorrect: false, scoreAwarded: 0, accuracyRatio: 0.0 };
    }
    let placedCorrect = 0;
    for (let i = 0; i < expectedOrderBlockIds.length; i++) {
      if (orderedBlockIds[i] === expectedOrderBlockIds[i]) {
        placedCorrect++;
      }
    }
    const accuracyRatio = Number((placedCorrect / expectedOrderBlockIds.length).toFixed(2));
    const isFullyCorrect = placedCorrect === expectedOrderBlockIds.length;

    if (isFullyCorrect) {
      return { isCorrect: true, scoreAwarded: points, accuracyRatio: 1.0 };
    } else if (accuracyRatio > 0) {
      return { isCorrect: false, scoreAwarded: Number((accuracyRatio * points).toFixed(2)), accuracyRatio };
    } else {
      return { isCorrect: false, scoreAwarded: -Math.abs(negativeMarking), accuracyRatio: 0.0 };
    }
  }

  // Interactive Type 2: SLIDER (Tolerance Bands)
  if (questionType === 'SLIDER' || questionType === 'NUMERIC') {
    if (numericAnswer != null && expectedNumericAnswer != null) {
      const diff = Math.abs(numericAnswer - expectedNumericAnswer);
      const fullTol = toleranceFull ?? numericTolerance;
      const partTol = tolerancePartial ?? fullTol * 2.5;

      if (diff <= fullTol) {
        return { isCorrect: true, scoreAwarded: points, accuracyRatio: 1.0 };
      } else if (diff <= partTol) {
        return { isCorrect: false, scoreAwarded: Number((0.5 * points).toFixed(2)), accuracyRatio: 0.5 };
      } else {
        return { isCorrect: false, scoreAwarded: -Math.abs(negativeMarking), accuracyRatio: 0.0 };
      }
    }
    return { isCorrect: false, scoreAwarded: 0, accuracyRatio: 0.0 };
  }

  // Interactive Type 3: HOTSPOT (Multi-region Overlap)
  if (questionType === 'HOTSPOT') {
    if (!selectedHotspotIds || selectedHotspotIds.length === 0 || expectedHotspotIds.length === 0) {
      return { isCorrect: false, scoreAwarded: 0, accuracyRatio: 0.0 };
    }
    const expectedSet = new Set(expectedHotspotIds);
    let hit = 0;
    let miss = 0;

    for (const id of selectedHotspotIds) {
      if (expectedSet.has(id)) hit++;
      else miss++;
    }

    const accuracyRatio = Math.max(0, (hit - miss) / expectedHotspotIds.length);
    const isFullyCorrect = hit === expectedHotspotIds.length && miss === 0;

    if (isFullyCorrect) {
      return { isCorrect: true, scoreAwarded: points, accuracyRatio: 1.0 };
    } else if (accuracyRatio > 0) {
      return { isCorrect: false, scoreAwarded: Number((accuracyRatio * points).toFixed(2)), accuracyRatio };
    } else {
      return { isCorrect: false, scoreAwarded: -Math.abs(negativeMarking), accuracyRatio: 0.0 };
    }
  }

  if (questionType === 'FILL_BLANK') {
    const cleanUser = (textAnswer || '').trim().toLowerCase();
    const cleanExpected = (expectedTextAnswer || '').trim().toLowerCase();

    if (cleanUser && cleanUser === cleanExpected) {
      return { isCorrect: true, scoreAwarded: points, accuracyRatio: 1.0 };
    } else if (cleanUser) {
      return { isCorrect: false, scoreAwarded: -Math.abs(negativeMarking), accuracyRatio: 0.0 };
    }
    return { isCorrect: false, scoreAwarded: 0, accuracyRatio: 0.0 };
  }

  return { isCorrect: false, scoreAwarded: 0, accuracyRatio: 0.0 };
}
