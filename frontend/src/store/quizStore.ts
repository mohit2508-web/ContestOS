import { create } from 'zustand';

export interface QuizOption {
  id: string;
  content: string;
  imageUrl?: string | null;
  displayOrder: number;
}

export interface QuizQuestion {
  attemptQuestionId: string;
  questionId: string;
  questionType: string;
  content: string;
  imageUrl?: string | null;
  passage?: {
    id: string;
    title?: string | null;
    content: string;
  } | null;
  options: QuizOption[];
  presentedOrder: number;
  totalQuestions: number;
}

export interface UserAnswerState {
  selectedOptionIds: string[];
  numericAnswer: string;
  textAnswer: string;
  flaggedForReview: boolean;
  scratchpadStrokes?: any[];
}

interface QuizState {
  contestId: string | null;
  sectionId: string | null;
  sectionTitle: string;
  durationMinutes: number;
  questions: QuizQuestion[];
  currentIndex: number;
  answers: Record<string, UserAnswerState>; // attemptQuestionId -> UserAnswerState
  remainingMs: number;
  isFrozen: boolean;
  isScratchpadOpen: boolean;
  
  // Actions
  initSession: (data: { contestId: string; sectionId: string; sectionTitle: string; durationMinutes: number; questions: QuizQuestion[] }) => void;
  setCurrentIndex: (index: number) => void;
  selectOption: (attemptQuestionId: string, optionId: string, isMultiSelect: boolean) => void;
  setNumericAnswer: (attemptQuestionId: string, val: string) => void;
  setTextAnswer: (attemptQuestionId: string, val: string) => void;
  toggleFlag: (attemptQuestionId: string) => void;
  setScratchpadStrokes: (attemptQuestionId: string, strokes: any[]) => void;
  setRemainingMs: (ms: number) => void;
  setIsFrozen: (frozen: boolean) => void;
  toggleScratchpad: () => void;
}

export const useQuizStore = create<QuizState>((set) => ({
  contestId: null,
  sectionId: null,
  sectionTitle: 'Aptitude & Reasoning Section',
  durationMinutes: 30,
  questions: [],
  currentIndex: 0,
  answers: {},
  remainingMs: 30 * 60 * 1000,
  isFrozen: false,
  isScratchpadOpen: false,

  initSession: (data) =>
    set({
      contestId: data.contestId,
      sectionId: data.sectionId,
      sectionTitle: data.sectionTitle,
      durationMinutes: data.durationMinutes,
      questions: data.questions,
      currentIndex: 0,
      remainingMs: data.durationMinutes * 60 * 1000,
    }),

  setCurrentIndex: (index) => set({ currentIndex: index }),

  selectOption: (attemptQuestionId, optionId, isMultiSelect) =>
    set((state) => {
      const prev = state.answers[attemptQuestionId] || { selectedOptionIds: [], numericAnswer: '', textAnswer: '', flaggedForReview: false };
      let newSelected: string[];

      if (isMultiSelect) {
        newSelected = prev.selectedOptionIds.includes(optionId)
          ? prev.selectedOptionIds.filter((id) => id !== optionId)
          : [...prev.selectedOptionIds, optionId];
      } else {
        newSelected = [optionId];
      }

      return {
        answers: {
          ...state.answers,
          [attemptQuestionId]: { ...prev, selectedOptionIds: newSelected },
        },
      };
    }),

  setNumericAnswer: (attemptQuestionId, val) =>
    set((state) => {
      const prev = state.answers[attemptQuestionId] || { selectedOptionIds: [], numericAnswer: '', textAnswer: '', flaggedForReview: false };
      return {
        answers: {
          ...state.answers,
          [attemptQuestionId]: { ...prev, numericAnswer: val },
        },
      };
    }),

  setTextAnswer: (attemptQuestionId, val) =>
    set((state) => {
      const prev = state.answers[attemptQuestionId] || { selectedOptionIds: [], numericAnswer: '', textAnswer: '', flaggedForReview: false };
      return {
        answers: {
          ...state.answers,
          [attemptQuestionId]: { ...prev, textAnswer: val },
        },
      };
    }),

  toggleFlag: (attemptQuestionId) =>
    set((state) => {
      const prev = state.answers[attemptQuestionId] || { selectedOptionIds: [], numericAnswer: '', textAnswer: '', flaggedForReview: false };
      return {
        answers: {
          ...state.answers,
          [attemptQuestionId]: { ...prev, flaggedForReview: !prev.flaggedForReview },
        },
      };
    }),

  setScratchpadStrokes: (attemptQuestionId, strokes) =>
    set((state) => {
      const prev = state.answers[attemptQuestionId] || { selectedOptionIds: [], numericAnswer: '', textAnswer: '', flaggedForReview: false };
      return {
        answers: {
          ...state.answers,
          [attemptQuestionId]: { ...prev, scratchpadStrokes: strokes },
        },
      };
    }),

  setRemainingMs: (ms) => set({ remainingMs: ms }),
  setIsFrozen: (frozen) => set({ isFrozen: frozen }),
  toggleScratchpad: () => set((state) => ({ isScratchpadOpen: !state.isScratchpadOpen })),
}));
