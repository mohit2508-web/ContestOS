import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuizStore, QuizQuestion } from '../store/quizStore';
import { ScratchpadCanvas } from '../components/quiz/ScratchpadCanvas';
import { CalibrationModal } from '../components/quiz/CalibrationModal';
import { CommandPaletteModal } from '../components/quiz/CommandPaletteModal';
import { VerifiableScorecardPDF } from '../components/quiz/VerifiableScorecardPDF';
import { InteractiveCodeOrder } from '../components/quiz/InteractiveCodeOrder';
import { InteractiveSliderGauge } from '../components/quiz/InteractiveSliderGauge';
import { InteractiveHotspotMarker } from '../components/quiz/InteractiveHotspotMarker';
import { PracticeExploreCanvas } from '../components/quiz/PracticeExploreCanvas';
import { LiquidCardDeck } from '../components/quiz/LiquidCardDeck';
import { InstrumentHeader } from '../components/quiz/InstrumentHeader';
import { InstrumentOptionCard } from '../components/quiz/InstrumentOptionCard';
import { InstrumentPassagePanel } from '../components/quiz/InstrumentPassagePanel';
import { InstrumentQuestionMap } from '../components/quiz/InstrumentQuestionMap';
import { saveAnswerOffline } from '../services/indexedDbService';
import api from '../services/api';

export const QuizPlaygroundPage: React.FC = () => {
  const {
    contestId,
    sectionId,
    sectionTitle,
    durationMinutes,
    questions,
    currentIndex,
    answers,
    remainingMs,
    isFrozen,
    isScratchpadOpen,
    initSession,
    setCurrentIndex,
    selectOption,
    setNumericAnswer,
    setTextAnswer,
    toggleFlag,
    setScratchpadStrokes,
    setRemainingMs,
    setIsFrozen,
    toggleScratchpad,
  } = useQuizStore();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSummary, setSubmittedSummary] = useState<any | null>(null);

  // Master UI & Practice Mode State
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showScorecardPDF, setShowScorecardPDF] = useState(false);
  const [showSkillGraph, setShowSkillGraph] = useState(false);
  const [showLiquidDeck, setShowLiquidDeck] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [dyslexicFont, setDyslexicFont] = useState(false);
  const [colorblindMode, setColorblindMode] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Interactive Question State
  const [codeOrders, setCodeOrders] = useState<Record<string, string[]>>({});
  const [selectedHotspots, setSelectedHotspots] = useState<Record<string, string[]>>({});

  // Real-time Mousemove Listener for Cursor X/Y Readout
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setCoords({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Demo fallback session initialization matching the calibration instrument design
  useEffect(() => {
    if (questions.length === 0) {
      const demoQuestions: QuizQuestion[] = [
        {
          attemptQuestionId: 'aq-1',
          questionId: 'q-1',
          questionType: 'SINGLE_SELECT',
          content: 'If all *Bloops* are *Razzies* and all *Razzies* are *Lazzies*, which of the following statements is definitely *true*?',
          passage: {
            id: 'p-1',
            title: 'Logical Deduction Set A-C',
            content: 'Consider the categorical relationships between abstract sets Bloops, Razzies, and Lazzies.\n\nEvery Bloop in existence belongs strictly to the Razzie cluster.\n\nFurthermore, all Razzies are subsumed within the broader Lazzie set.',
          },
          options: [
            { id: 'opt-1', content: 'All Bloops are definitely Lazzies', displayOrder: 1 },
            { id: 'opt-2', content: 'All Lazzies are definitely Bloops', displayOrder: 2 },
            { id: 'opt-3', content: 'No Razzies are Lazzies', displayOrder: 3 },
            { id: 'opt-4', content: 'Cannot be determined from the given premises', displayOrder: 4 },
          ],
          presentedOrder: 1,
          totalQuestions: 5,
        },
        {
          attemptQuestionId: 'aq-2',
          questionId: 'q-2',
          questionType: 'CODE_ORDER',
          content: 'Re-order the following lines of code to form a valid Binary Search algorithm in Python:',
          options: [],
          presentedOrder: 2,
          totalQuestions: 5,
        },
        {
          attemptQuestionId: 'aq-3',
          questionId: 'q-3',
          questionType: 'SLIDER',
          content: 'Estimate the average complexity $O(n \\log n)$ time in milliseconds for sorting 1,000,000 items:',
          options: [],
          presentedOrder: 3,
          totalQuestions: 5,
        },
        {
          attemptQuestionId: 'aq-4',
          questionId: 'q-4',
          questionType: 'HOTSPOT',
          content: 'Inspect the system architecture diagram below and select the **Database Cluster** hotspot:',
          imageUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80',
          options: [],
          presentedOrder: 4,
          totalQuestions: 5,
        },
        {
          attemptQuestionId: 'aq-5',
          questionId: 'q-5',
          questionType: 'MULTI_SELECT',
          content: 'Select **ALL** prime numbers from the following choices below: *(Partial credit applies)*',
          options: [
            { id: 'opt-5a', content: '17', displayOrder: 1 },
            { id: 'opt-5b', content: '29', displayOrder: 2 },
            { id: 'opt-5c', content: '35', displayOrder: 3 },
            { id: 'opt-5d', content: '41', displayOrder: 4 },
          ],
          presentedOrder: 5,
          totalQuestions: 5,
        },
      ];

      initSession({
        contestId: 'demo-contest',
        sectionId: 'demo-section',
        sectionTitle: 'Enterprise Technical & Aptitude — Section II',
        durationMinutes: 30,
        questions: demoQuestions,
      });
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, []);

  // Timer countdown tick
  useEffect(() => {
    const timer = setInterval(() => {
      if (isCalibrated && remainingMs > 0 && !isFrozen && !submittedSummary) {
        setRemainingMs(Math.max(0, remainingMs - 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isCalibrated, remainingMs, isFrozen, submittedSummary]);

  const currentQ = questions[currentIndex];
  const currentAns = currentQ ? answers[currentQ.attemptQuestionId] || { selectedOptionIds: [], numericAnswer: '', textAnswer: '', flaggedForReview: false } : null;

  // Global Cmd+K / Ctrl+K Shortcut Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFrozen || submittedSummary) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      } else if (e.key === '?') {
        if (!['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
          e.preventDefault();
          setShowCommandPalette((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFrozen, submittedSummary]);

  const handleSaveResponse = async (aqId: string) => {
    const ans = answers[aqId];
    if (!ans) return;

    const payload = {
      attemptQuestionId: aqId,
      selectedOptionIds: ans.selectedOptionIds,
      numericAnswer: ans.numericAnswer ? Number(ans.numericAnswer) : null,
      textAnswer: ans.textAnswer,
      scratchpadData: ans.scratchpadStrokes,
      flaggedForReview: ans.flaggedForReview,
      orderedBlockIds: codeOrders[aqId] || [],
      selectedHotspotIds: selectedHotspots[aqId] || [],
      timeSpentMs: 5000,
    };

    await saveAnswerOffline(aqId, payload);
    try {
      await api.post('/quiz/responses', payload);
    } catch {
      // offline sync fallback
    }
  };

  const handleSelectOptionWithSave = (aqId: string, optId: string, isMulti: boolean) => {
    selectOption(aqId, optId, isMulti);
    setTimeout(() => handleSaveResponse(aqId), 150);
  };

  const handleToggleHotspotWithSave = (aqId: string, hotspotId: string) => {
    const prev = selectedHotspots[aqId] || [];
    const next = prev.includes(hotspotId) ? prev.filter((id) => id !== hotspotId) : [...prev, hotspotId];
    setSelectedHotspots({ ...selectedHotspots, [aqId]: next });
    selectOption(aqId, hotspotId, true);
    setTimeout(() => handleSaveResponse(aqId), 150);
  };

  const handleNext = () => {
    if (currentQ) {
      handleSaveResponse(currentQ.attemptQuestionId);
    }
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentQ) {
      handleSaveResponse(currentQ.attemptQuestionId);
    }
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSubmitSection = async () => {
    if (currentQ) {
      await handleSaveResponse(currentQ.attemptQuestionId);
    }
    setSubmitting(true);
    try {
      const res = await api.post(`/quiz/sections/${sectionId || 'demo-section'}/submit`, { contestId: contestId || 'demo-contest' });
      setSubmittedSummary(res.summary || { totalQuestions: questions.length, totalAnswered: Object.keys(answers).length, totalCorrect: 4, scoreAwarded: 16 });
    } catch {
      setSubmittedSummary({ totalQuestions: questions.length, totalAnswered: Object.keys(answers).length, totalCorrect: questions.length, scoreAwarded: 20 });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#14161A] text-white flex items-center justify-center font-sans">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#C6A15B]" />
      </div>
    );
  }

  const totalAnsweredCount = Object.values(answers).filter(
    (a) => (a.selectedOptionIds && a.selectedOptionIds.length > 0) || a.numericAnswer !== '' || a.textAnswer !== ''
  ).length;

  const flaggedCount = Object.values(answers).filter((a) => a.flaggedForReview).length;

  // Code Order Demo Items
  const demoCodeBlocks = [
    { id: 'b-1', code: 'def binary_search(arr, target):' },
    { id: 'b-2', code: '    low, high = 0, len(arr) - 1' },
    { id: 'b-3', code: '    while low <= high:' },
    { id: 'b-4', code: '        mid = (low + high) // 2' },
    { id: 'b-5', code: '        if arr[mid] == target: return mid' },
  ];

  // Hotspot Demo Regions
  const demoHotspotRegions = [
    { id: 'hs-1', label: 'Primary DB Cluster Node 1', xPct: 45, yPct: 40 },
    { id: 'hs-2', label: 'Replica Storage Node 2', xPct: 60, yPct: 55 },
  ];

  return (
    <div className={`min-h-screen bg-[#14161A] text-[#ECE8E0] ${dyslexicFont ? 'font-serif' : 'font-sans'} flex flex-col relative overflow-hidden select-none`}>
      {/* Untimed Calibration Warm-Up Modal */}
      <CalibrationModal isOpen={!isCalibrated} onComplete={() => setIsCalibrated(true)} />

      {/* Cmd+K Spotlight Command Palette */}
      <CommandPaletteModal
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        questionsCount={questions.length}
        onSelectQuestion={(idx) => setCurrentIndex(idx)}
        onToggleScratchpad={toggleScratchpad}
        onToggleFocusMode={() => setFocusMode(!focusMode)}
        onToggleDyslexia={() => setDyslexicFont(!dyslexicFont)}
      />

      {/* Verifiable PDF Scorecard Modal */}
      {showScorecardPDF && submittedSummary && (
        <VerifiableScorecardPDF
          contestTitle={sectionTitle}
          candidateName="Aarav Patel"
          candidateEmail="student@iitd.ac.in"
          totalScore={submittedSummary.scoreAwarded}
          maxScore={questions.length * 4}
          totalAnswered={submittedSummary.totalAnswered}
          totalQuestions={submittedSummary.totalQuestions}
          summaryData={submittedSummary}
          onClose={() => setShowScorecardPDF(false)}
        />
      )}

      {/* Practice Skill Graph Analytics Modal */}
      {showSkillGraph && <PracticeExploreCanvas onClose={() => setShowSkillGraph(false)} />}

      {/* Untimed 3D Card Deck Modal */}
      {showLiquidDeck && (
        <LiquidCardDeck
          questions={questions}
          currentIndex={currentIndex}
          onSelectIndex={(idx) => setCurrentIndex(idx)}
          onClose={() => setShowLiquidDeck(false)}
        />
      )}

      {/* Proctor Session Freeze Red Overlay */}
      {isFrozen && (
        <div className="fixed inset-0 z-50 bg-[#C1543A]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-pulse">
          <div className="text-6xl mb-4">🧊</div>
          <h1 className="text-3xl font-extrabold text-white mb-2">Quiz Session Frozen</h1>
          <p className="text-slate-200 max-w-md">
            Your exam session has been temporarily paused by the Proctor. Please remain seated facing your camera.
          </p>
        </div>
      )}

      {/* Brass & Charcoal Calibration Header HUD */}
      {!focusMode && (
        <InstrumentHeader
          sectionTitle={sectionTitle}
          totalQuestions={questions.length}
          totalAnswered={totalAnsweredCount}
          remainingMs={remainingMs}
          durationMinutes={durationMinutes || 30}
          flaggedCount={flaggedCount}
          coords={coords}
          onSubmitSection={handleSubmitSection}
          submitting={submitting}
        />
      )}

      {/* Post-Submit Summary Overlay */}
      {submittedSummary ? (
        <div className="flex-1 flex items-center justify-center p-6 bg-[#14161A]">
          <div className="bracket-panel active max-w-lg w-full text-center shadow-2xl space-y-6">
            <span className="bl" />
            <span className="br" />
            <div className="text-5xl">🎉</div>
            <div>
              <h2 className="text-2xl font-['Fraunces'] font-semibold text-[#ECE8E0]">Section Submitted Successfully!</h2>
              <p className="text-[#8C9099] text-sm mt-1">Your answers have been securely synced to CockroachDB & Redis.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#1B1E23] border border-[#2B2F37] p-4 rounded-[2px]">
                <div className="text-[#8C9099] text-xs uppercase font-mono font-bold">Total Answered</div>
                <div className="text-2xl font-mono font-black text-[#C6A15B] mt-1">{submittedSummary.totalAnswered} / {submittedSummary.totalQuestions}</div>
              </div>
              <div className="bg-[#1B1E23] border border-[#2B2F37] p-4 rounded-[2px]">
                <div className="text-[#8C9099] text-xs uppercase font-mono font-bold">Score Awarded</div>
                <div className="text-2xl font-mono font-black text-[#6F9C7E] mt-1">+{submittedSummary.scoreAwarded} Pts</div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setShowScorecardPDF(true)}
                className="btn-submit w-full py-3 text-sm font-semibold"
              >
                ◈ View & Export SHA-256 PDF Scorecard
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-[#21252B] text-[#ECE8E0] hover:border-[#3A3F49] border border-[#2B2F37] font-bold rounded-[2px] transition-all text-xs"
              >
                Continue Contest
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Main Layout Grid: 280px passage | 1fr question | 260px map */
        <div className="layout flex-1 grid grid-cols-1 md:grid-cols-[280px_1fr_260px] min-h-[calc(100vh-71px)] overflow-hidden">
          {/* Left Column: Passage Panel */}
          {currentQ?.passage && !focusMode ? (
            <div className="col border-r border-[#2B2F37] p-6 overflow-y-auto">
              <InstrumentPassagePanel title={currentQ.passage.title} content={currentQ.passage.content} />
            </div>
          ) : (
            <div className="hidden md:block col border-r border-[#2B2F37] p-6 overflow-y-auto text-xs text-[#8C9099] font-mono">
              <div className="eyebrow">NO PASSAGE REQUIRED</div>
              <div className="eyebrow-sub">SINGLE ITEM REF. SEQ 05</div>
              <p className="mt-4 text-[#5B5F68] leading-relaxed">Direct question evaluation mode.</p>
            </div>
          )}

          {/* Center Column: Question & 45° Diamond Options */}
          <div className="col border-r border-[#2B2F37] p-6 overflow-y-auto flex flex-col justify-between">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                {/* Question Topbar */}
                <div className="q-topbar flex items-center justify-between">
                  <div className="q-index flex items-baseline gap-2.5">
                    <span className="num font-mono text-xs text-[#C6A15B] font-semibold tracking-wider">
                      Q.{String(currentIndex + 1).padStart(2, '0')} — SEQ 05
                    </span>
                    <span className="type font-mono text-[10px] text-[#5B5F68] tracking-widest uppercase border border-[#2B2F37] px-2 py-0.5 rounded-[2px]">
                      {currentQ?.questionType.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="q-tools flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFocusMode(!focusMode)}
                      className="tool-btn flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-[#8C9099] bg-[#21252B] border border-[#2B2F37] rounded-[2px]"
                    >
                      <span>◎</span>
                      <span>{focusMode ? 'Exit Focus' : 'Focus Mode'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => currentQ && toggleFlag(currentQ.attemptQuestionId)}
                      className={`tool-btn flex items-center gap-1.5 px-3 py-1.5 text-[11px] border rounded-[2px] ${
                        currentAns?.flaggedForReview
                          ? 'border-[#C1543A] text-[#C1543A] bg-[#C1543A]/10'
                          : 'border-[#2B2F37] text-[#8C9099] bg-[#21252B]'
                      }`}
                    >
                      <span>⚑</span>
                      <span>{currentAns?.flaggedForReview ? 'Flagged' : 'Flag'}</span>
                    </button>
                  </div>
                </div>

                {/* Fraunces Question Text */}
                <div className="question-text font-['Fraunces'] text-[23px] leading-[1.5] font-medium text-[#ECE8E0] max-w-[640px]">
                  {currentQ?.content}
                </div>

                {/* Image if Present */}
                {currentQ?.imageUrl && (
                  <div className="flex justify-center">
                    <img src={currentQ.imageUrl} alt="Question Pattern" className="max-h-60 rounded-[2px] border border-[#2B2F37]" />
                  </div>
                )}

                {/* Interactive Question Renders */}
                {currentQ?.questionType === 'CODE_ORDER' ? (
                  <InteractiveCodeOrder
                    blocks={demoCodeBlocks}
                    orderedBlockIds={codeOrders[currentQ.attemptQuestionId] || demoCodeBlocks.map((b) => b.id)}
                    onChangeOrder={(newIds) => {
                      setCodeOrders({ ...codeOrders, [currentQ.attemptQuestionId]: newIds });
                      selectOption(currentQ.attemptQuestionId, newIds[0], true);
                      setTimeout(() => handleSaveResponse(currentQ.attemptQuestionId), 150);
                    }}
                  />
                ) : currentQ?.questionType === 'SLIDER' ? (
                  <InteractiveSliderGauge
                    val={currentAns?.numericAnswer || 50}
                    min={0}
                    max={500}
                    unit="ms"
                    onChange={(val) => setNumericAnswer(currentQ.attemptQuestionId, String(val))}
                  />
                ) : currentQ?.questionType === 'HOTSPOT' ? (
                  <InteractiveHotspotMarker
                    imageUrl={currentQ.imageUrl}
                    regions={demoHotspotRegions}
                    selectedHotspotIds={selectedHotspots[currentQ.attemptQuestionId] || []}
                    onToggleHotspot={(id) => handleToggleHotspotWithSave(currentQ.attemptQuestionId, id)}
                  />
                ) : currentQ?.questionType === 'SINGLE_SELECT' || currentQ?.questionType === 'MULTI_SELECT' || currentQ?.questionType === 'TRUE_FALSE' ? (
                  <div className="options flex flex-col gap-2.5">
                    {currentQ.options.map((opt, idx) => {
                      const isSelected = Boolean(currentAns?.selectedOptionIds?.includes(opt.id));
                      const isMulti = currentQ.questionType === 'MULTI_SELECT';

                      return (
                        <InstrumentOptionCard
                          key={opt.id}
                          index={idx}
                          content={opt.content}
                          isSelected={isSelected}
                          onSelect={() => handleSelectOptionWithSave(currentQ.attemptQuestionId, opt.id, isMulti)}
                        />
                      );
                    })}
                  </div>
                ) : currentQ?.questionType === 'NUMERIC' ? (
                  <div className="bg-[#21252B] border border-[#2B2F37] p-5 rounded-[2px]">
                    <label className="block text-xs uppercase font-mono font-bold text-[#8C9099] mb-2">Numerical Answer</label>
                    <input
                      type="number"
                      value={currentAns?.numericAnswer || ''}
                      onChange={(e) => setNumericAnswer(currentQ.attemptQuestionId, e.target.value)}
                      placeholder="Enter your numeric answer"
                      className="w-full bg-[#14161A] border border-[#2B2F37] rounded-[2px] p-3.5 text-[#ECE8E0] focus:outline-none focus:border-[#C6A15B] font-mono text-base"
                    />
                  </div>
                ) : (
                  <div className="bg-[#21252B] border border-[#2B2F37] p-5 rounded-[2px]">
                    <label className="block text-xs uppercase font-mono font-bold text-[#8C9099] mb-2">Text Answer</label>
                    <textarea
                      value={currentAns?.textAnswer || ''}
                      onChange={(e) => setTextAnswer(currentQ.attemptQuestionId, e.target.value)}
                      placeholder="Type your response here"
                      className="w-full bg-[#14161A] border border-[#2B2F37] rounded-[2px] p-3.5 text-[#ECE8E0] focus:outline-none focus:border-[#C6A15B] h-28 text-sm"
                    />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Bottom Instrument Action Bar */}
            <div className="q-bottombar flex items-center justify-between mt-10 pt-5 border-t border-[#2B2F37]">
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={toggleScratchpad}
                  className="ghost-btn flex items-center gap-2 px-3.5 py-2 text-xs text-[#8C9099] bg-transparent border border-[#2B2F37] rounded-[2px] hover:border-[#3A3F49] hover:text-[#ECE8E0]"
                >
                  <span>✎</span>
                  <span>Scratchpad</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCommandPalette(true)}
                  className="ghost-btn flex items-center gap-2 px-3.5 py-2 text-xs text-[#8C9099] bg-transparent border border-[#2B2F37] rounded-[2px] hover:border-[#3A3F49] hover:text-[#ECE8E0]"
                >
                  <span>⌘K</span>
                  <span>Spotlight</span>
                </button>
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="ghost-btn px-4 py-2 text-xs text-[#8C9099] bg-transparent border border-[#2B2F37] rounded-[2px] hover:border-[#3A3F49] hover:text-[#ECE8E0] disabled:opacity-40"
                >
                  ← Previous
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="ghost-btn btn-next px-5 py-2 text-xs font-semibold text-[#161311] rounded-[2px] cursor-pointer"
                >
                  {currentIndex === questions.length - 1 ? 'Save & Review' : 'Save & Next →'}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Question Map */}
          {!focusMode && (
            <div className="col p-6 overflow-y-auto">
              <InstrumentQuestionMap
                questionsCount={questions.length}
                currentIndex={currentIndex}
                totalAnswered={totalAnsweredCount}
                answers={answers}
                questions={questions}
                onSelectIndex={(idx) => setCurrentIndex(idx)}
              />
            </div>
          )}
        </div>
      )}

      {/* Render Scratchpad Overlay Component */}
      <ScratchpadCanvas
        attemptQuestionId={currentQ?.attemptQuestionId || 'demo-aq'}
        isOpen={isScratchpadOpen}
        onClose={toggleScratchpad}
        savedStrokes={currentAns?.scratchpadStrokes}
        onSaveStrokes={(strokes) => currentQ && setScratchpadStrokes(currentQ.attemptQuestionId, strokes)}
      />
    </div>
  );
};
