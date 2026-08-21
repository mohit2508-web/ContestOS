import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { CAPGEMINI_AI_LITERACY_BANK, AiLiteracyScenario } from '../data/capgeminiAiLiteracyBank';
import {
  Building2,
  Lock,
  Unlock,
  Briefcase,
  Award,
  FileText,
  Code2,
  BookOpen,
  MessageSquare,
  Sparkles,
  ChevronLeft,
  ExternalLink,
  ThumbsUp,
  BrainCircuit,
  CheckCircle2,
  Play
} from 'lucide-react';
import { useNotify } from '../components/notifications';

interface MaterialItem {
  id: string;
  title: string;
  materialType: 'PROBLEM' | 'QUIZ' | 'PDF_GUIDE' | 'ROUND_INTEL';
  contentUrl?: string;
  dataJson?: any;
}

interface TranscriptItem {
  id: string;
  roleTitle: string;
  location?: string;
  experience: string;
  difficulty: string;
  upvotes: number;
}

interface VaultData {
  id: string;
  name: string;
  slug: string;
  companyName: string;
  brandColor: string;
  logoUrl?: string;
  targetCtc?: string;
  examPattern?: string;
  description?: string;
  isUnlocked: boolean;
  accessCodePlain?: string;
}

const DEFAULT_CAPGEMINI_MATERIALS: MaterialItem[] = [
  {
    id: 'capg-ai-literacy-1',
    title: 'Capgemini AI Literacy Assessment Questions (Scenario-based MCQs)',
    materialType: 'QUIZ',
    contentUrl: '',
    dataJson: {
      isAiLiteracy: true,
      topic: 'AI Literacy & Enterprise LLM Architecture',
      questionCount: 5,
      scenarioText: `A multinational enterprise deploys an internal AI assistant to answer employee questions related to travel reimbursement, leave eligibility, payroll exceptions, relocation support, and approval workflows. The assistant is designed to combine system instructions, long conversation history, and retrieved excerpts from several HR policy documents into a single prompt. Early testing shows strong performance in short interactions. However, during real use, employees often paste long email trails, attach multiple policy extracts, and ask several follow-up questions in the same session. In those longer interactions, the assistant begins to omit eligibility conditions that were explicitly mentioned earlier, contradicts answers it gave in previous turns, and occasionally responds as if it has "forgotten" the initial context of the conversation. The engineering team confirms that the source policies are current and correct, and that the model is not being retrained during any of these exchanges.`,
      questions: [
        {
          id: 'q1',
          number: 'Q 01',
          title: 'Primary Technical Reason for Ignored Context & Inconsistencies',
          questionText: 'Based on the system design and the observed pattern that reliability degrades mainly in long, document-heavy interactions, which explanation most accurately identifies the primary technical reason the assistant starts ignoring earlier policy details and producing inconsistent responses even though the source documents and the model itself have not changed?',
          options: [
            'A. The most likely explanation is that the tokenizer silently converts older policy excerpts into compressed semantic summaries after several turns, which prevents the model from using precise earlier wording and leads to contradictions.',
            'B. The most likely explanation is that the model gradually retrains itself on every user conversation once enough turns have accumulated, causing the original policy knowledge encoded in the model\'s parameters to drift during the same session.',
            'C. The most likely explanation is that the total prompt is approaching or exceeding the model\'s effective context window, causing earlier tokens to be truncated or to have much weaker influence during answer generation.',
            'D. The most likely explanation is that the assistant is intentionally designed to discard earlier context as soon as more than one policy document is attached, regardless of whether additional model capacity is available.'
          ],
          correctOptionIndex: 2,
          correctAnswerLetter: 'C',
          explanation: 'In Transformer-based LLMs, as conversation history and attached documents accumulate, the input prompt reaches or exceeds the model\'s effective context window. This causes earlier tokens to either get truncated or suffer from attention degradation (Lost-in-the-middle phenomenon), leading the model to "forget" earlier stated constraints.'
        },
        {
          id: 'q2',
          number: 'Q 02',
          title: 'Enterprise-Grade Prompt Strategy for Policy Citation & Refusal',
          questionText: 'The HR operations team now wants to redesign the prompting approach so that the assistant produces more reliable answers, cites the policy source it used, and explicitly declines to answer when the supplied material is insufficient. Which prompt strategy would be the most appropriate enterprise-grade improvement for achieving that outcome?',
          options: [
            'A. Instruct the model in the system prompt to restrict its answers strictly to the provided document excerpts, mandate citation of specific policy section titles for every claim, and explicitly state "Information not available in policy documents" when the context lacks sufficient details.',
            'B. Increase the sampling temperature to 0.9 to allow the model more creative flexibility when synthesizing across multiple conflicting policy documents.',
            'C. Remove the system instructions completely and rely solely on user follow-up questions to steer the model towards accurate policy sections.',
            'D. Append a disclaimer at the end of the prompt telling the user to double-check all generated answers against the internal intranet wiki.'
          ],
          correctOptionIndex: 0,
          correctAnswerLetter: 'A',
          explanation: 'Grounded enterprise prompt engineering relies on strict system instructions: constraining answers strictly to retrieved context excerpts, mandating source citations for auditability, and enforcing explicit refusal when context is missing.'
        },
        {
          id: 'q3',
          number: 'Q 03',
          title: 'System Architecture Solution for Context Degradation in Multi-turn RAG',
          questionText: 'To permanently prevent context degradation and memory loss in multi-turn HR assistant conversations, which system architecture enhancement should the engineering team implement?',
          options: [
            'A. Implement a Dynamic RAG (Retrieval-Augmented Generation) pipeline with automatic conversation summarization and vector semantic retrieval for previous turns.',
            'B. Retrain the foundation model every hour using the previous hour\'s employee conversation logs.',
            'C. Force users to re-login after every 2 messages to reset the token limit.',
            'D. Disable all system prompts and pass only the latest single message as input.'
          ],
          correctOptionIndex: 0,
          correctAnswerLetter: 'A',
          explanation: 'Implementing a Dynamic RAG pipeline with automatic conversation summarization ensures essential previous turn context is condensed and retrieved without exceeding the context window limit.'
        },
        {
          id: 'q4',
          number: 'Q 04',
          title: 'Temperature & Top-P Sampling for Fact-based Corporate Q&A',
          questionText: 'When configuring the sampling parameters for a factual corporate HR policy bot, which parameter setup minimizes hallucination while ensuring deterministic, exact answers?',
          options: [
            'A. Set Temperature = 0.0 to 0.2 and Top-P = 0.1 to enforce deterministic greedy decoding on verified policy facts.',
            'B. Set Temperature = 1.0 and Top-P = 1.0 to maximize creative problem solving across complex employee queries.',
            'C. Set Temperature = 2.0 to randomly select tokens across all possible dictionary vocabulary words.',
            'D. Temperature settings do not affect hallucination or output determinism in LLMs.'
          ],
          correctOptionIndex: 0,
          correctAnswerLetter: 'A',
          explanation: 'Low temperature (0.0 to 0.2) reduces random sampling variance, forcing the model to choose high-probability deterministic tokens grounded in facts.'
        },
        {
          id: 'q5',
          number: 'Q 05',
          title: 'Enterprise PII & Data Privacy Compliance in Generative AI',
          questionText: 'Before sending employee email trails and salary documents to a public cloud LLM endpoint, which security control must be implemented in the pre-processing pipeline?',
          options: [
            'A. Implement a PII (Personally Identifiable Information) Redaction & Anonymization Layer to mask SSNs, employee IDs, and names.',
            'B. Encrypt the prompt text using Base64 encoding before passing it to the API endpoint.',
            'C. Change the font style of the email text to monospace before submitting.',
            'D. No pre-processing is needed since public cloud APIs automatically encrypt and delete all user prompts instantly.'
          ],
          correctOptionIndex: 0,
          correctAnswerLetter: 'A',
          explanation: 'Enterprise AI compliance mandates strict pre-processing PII masking (names, employee IDs, financial numbers) before transmitting prompts to external LLM APIs.'
        }
      ]
    }
  },
  {
    id: 'capg-coding-sheet',
    title: 'Capgemini Core Coding Assessment Sheet 2026',
    materialType: 'PROBLEM',
    contentUrl: '',
    dataJson: { topic: 'DSA & Pseudocode', problemCount: 15, level: 'Medium' }
  },
  {
    id: 'capg-pdf-guide',
    title: 'Capgemini System Design & Interview Prep Guide (PDF)',
    materialType: 'PDF_GUIDE',
    contentUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
  }
];

export const CompanyWorkspacePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [vault, setVault] = useState<VaultData | null>(null);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'AI_LITERACY' | 'ROUNDS' | 'PROBLEMS' | 'PDFS' | 'TRANSCRIPTS'>('AI_LITERACY');
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);

  // AI Literacy MCQ State
  const [selectedScenarioIdx, setSelectedScenarioIdx] = useState<number>(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});
  const [currentQIndex, setCurrentQIndex] = useState<number>(0);

  useEffect(() => {
    const fetchVaultDetails = async () => {
      try {
        const res = await api.get(`/company-vaults/${slug}`);
        if (res.data?.vault && res.data.vault.isUnlocked) {
          setVault(res.data.vault);
          setMaterials(res.data.materials || []);
          setTranscripts(res.data.transcripts || []);
          return;
        }
      } catch (err) {
        console.warn('Backend fetch company workspace fallback active:', err);
      } finally {
        setVault({
          id: slug || 'capgemini-prep',
          name: slug === 'capgemini-prep' ? 'Capgemini Excellence & Coding Vault' : 'Company Placement Vault',
          slug: slug || 'capgemini-prep',
          companyName: slug?.includes('amazon') ? 'Amazon' : slug?.includes('google') ? 'Google' : 'Capgemini',
          brandColor: slug?.includes('amazon') ? '#FF9900' : slug?.includes('google') ? '#4285F4' : '#0091FF',
          targetCtc: '7.5 - 12 LPA',
          examPattern: 'AON Assessment (Pseudocode + Technical MCQ + 2 Coding Problems)',
          description: 'Comprehensive AON-format prep kit for Capgemini Analyst & Senior Software Engineer roles.',
          isUnlocked: true,
        });
        setMaterials(DEFAULT_CAPGEMINI_MATERIALS);
        setLoading(false);
      }
    };

    fetchVaultDetails();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500" />
      </div>
    );
  }

  if (!vault || !vault.isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 animate-pulse">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Secret Vault Locked</h2>
        <p className="text-sm text-slate-400 max-w-md mb-6">
          You need a Secret Access Code from your instructor to view {vault?.companyName || 'this company'} placement materials.
        </p>
        <button
          onClick={() => navigate('/company-materials')}
          className="px-6 py-2.5 rounded-xl font-bold text-xs bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition"
        >
          Return to Vault Directory
        </button>
      </div>
    );
  }

  const color = vault.brandColor || '#FF9900';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/company-materials')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 mb-6 transition"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Company Vaults
        </button>

        {/* Top Header Card with Ambient Brand Glow */}
        <div className="relative rounded-3xl p-8 backdrop-blur-2xl bg-slate-900/90 border border-slate-800 shadow-2xl mb-8 overflow-hidden">
          <div
            className="absolute -top-24 -right-24 w-80 h-80 rounded-full blur-3xl opacity-30 pointer-events-none"
            style={{ backgroundColor: color }}
          />

          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center p-3 bg-slate-950 border shadow-xl shrink-0"
                style={{ borderColor: `${color}50` }}
              >
                {vault.companyName.toLowerCase().includes('capgemini') ? (
                  <svg viewBox="0 0 300 300" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M150 18C198 62 282 118 282 178C282 228 238 272 176 272C146 272 122 258 108 242C92 264 64 282 32 282C20 282 8 276 2 270C42 264 72 232 82 198C32 198 18 154 18 120C18 78 88 34 150 18Z"
                      fill="#0070AD"
                    />
                    <path
                      d="M176 272C238 272 282 228 282 178C282 144 252 110 208 86C214 132 202 180 162 210C142 224 120 234 102 240C116 258 142 272 176 272Z"
                      fill="#0091FF"
                    />
                  </svg>
                ) : vault.logoUrl ? (
                  <img src={vault.logoUrl} alt={vault.companyName} className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-2xl font-black text-white">{vault.companyName.charAt(0)}</span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <Unlock className="w-3 h-3" /> UNLOCKED VAULT
                  </span>
                  {vault.accessCodePlain && (
                    <span className="text-xs font-mono text-cyan-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      Code: {vault.accessCodePlain}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">{vault.name}</h1>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl">{vault.description}</p>
              </div>
            </div>

            {/* Quick Readiness Score Widget */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 shrink-0 w-full lg:w-72">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-slate-300 flex items-center gap-1">
                  <BrainCircuit className="w-3.5 h-3.5 text-cyan-400" /> Placement Readiness
                </span>
                <span className="font-mono font-bold text-cyan-400">85%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full w-[85%]" />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>{materials.length} Practice Items</span>
                <span className="text-emerald-400 font-semibold">High Match</span>
              </div>
            </div>
          </div>

          {/* Key Intel Pills */}
          <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-wrap gap-4 text-xs">
            {vault.targetCtc && (
              <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                <Briefcase className="w-4 h-4" style={{ color }} /> Target Package: <span style={{ color }}>{vault.targetCtc}</span>
              </span>
            )}
            {vault.examPattern && (
              <span className="flex items-center gap-1.5 text-slate-300">
                <Award className="w-4 h-4 text-purple-400" /> Pattern: <span className="text-slate-200">{vault.examPattern}</span>
              </span>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('AI_LITERACY')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition shrink-0 ${
              activeTab === 'AI_LITERACY'
                ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-cyan-400" /> AI Literacy Assessment MCQs
          </button>
          <button
            onClick={() => setActiveTab('ROUNDS')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition shrink-0 ${
              activeTab === 'ROUNDS'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <BrainCircuit className="w-4 h-4" /> Selection Rounds & Intel
          </button>
          <button
            onClick={() => setActiveTab('PROBLEMS')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition shrink-0 ${
              activeTab === 'PROBLEMS'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <Code2 className="w-4 h-4" /> Company Problem Bank ({materials.filter(m => m.materialType === 'PROBLEM').length})
          </button>
          <button
            onClick={() => setActiveTab('PDFS')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition shrink-0 ${
              activeTab === 'PDFS'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" /> PDF Sheets & Notes ({materials.filter(m => m.materialType === 'PDF_GUIDE').length})
          </button>
          <button
            onClick={() => setActiveTab('TRANSCRIPTS')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition shrink-0 ${
              activeTab === 'TRANSCRIPTS'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <MessageSquare className="w-4 h-4" /> Real Transcripts ({transcripts.length})
          </button>
        </div>

        {/* Tab 0: AI Literacy Scenario MCQs */}
        {activeTab === 'AI_LITERACY' && (() => {
          const currentScenario = CAPGEMINI_AI_LITERACY_BANK[selectedScenarioIdx] || CAPGEMINI_AI_LITERACY_BANK[0];
          const questions = currentScenario.questions || [];
          const currentQ = questions[currentQIndex] || questions[0];

          return (
            <div className="space-y-6 animate-fadeIn">
              {/* Header Badge & Topic Banner */}
              <div className="p-6 rounded-3xl backdrop-blur-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-cyan-500/30 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 mb-2">
                    <Sparkles className="w-3.5 h-3.5" /> Official {vault.companyName} AI Literacy Question Bank
                  </div>
                  <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                    AI Literacy — Scenario-Based Technical MCQ Bank
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Select a topic scenario below. Each scenario contains technical sub-questions with explanations.
                  </p>
                </div>
                <div className="px-4 py-2 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs font-mono font-bold text-cyan-400 shrink-0">
                  {CAPGEMINI_AI_LITERACY_BANK.length} Scenarios Available
                </div>
              </div>

              {/* Scenario Topic Filter Bar */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {CAPGEMINI_AI_LITERACY_BANK.map((s, idx) => {
                  const isSelected = selectedScenarioIdx === idx;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedScenarioIdx(idx);
                        setCurrentQIndex(0);
                      }}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)] scale-105 font-black'
                          : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <span>{s.scenarioTitle}</span>
                    </button>
                  );
                })}
              </div>

              {/* Active Theme & Scenario Details Card */}
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg relative overflow-hidden space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                    Theme: {currentScenario.themeTitle}
                  </span>
                  <span className="text-xs font-mono font-bold text-cyan-400">{questions.length} Linked Questions</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-widest">
                  <FileText className="w-4 h-4 text-cyan-400" /> Reference Case Study Scenario (Read Carefully)
                </div>
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs md:text-sm text-slate-200 leading-relaxed font-sans">
                  {currentScenario.scenarioText}
                </div>
              </div>

              {/* Question Stepper Navigation */}
              {questions.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {questions.map((q: any, idx: number) => {
                    const isSelected = currentQIndex === idx;
                    const isAnswered = selectedOptions[q.id] !== undefined;
                    const isRevealed = revealedAnswers[q.id];

                    return (
                      <button
                        key={q.id || idx}
                        onClick={() => setCurrentQIndex(idx)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                          isSelected
                            ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)] scale-105'
                            : isRevealed
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : isAnswered
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                            : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                        }`}
                      >
                        <span>{q.number || `Q ${idx + 1}`}</span>
                        {isAnswered && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Main Question Card */}
              {currentQ && (
                <div className="p-6 md:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-6 animate-fadeIn">
                  <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-bold">
                        {currentQ.number || `Q 0${currentQIndex + 1}`}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">{currentQ.title}</span>
                    </div>
                    <span className="text-xs text-slate-500">Question {currentQIndex + 1} of {questions.length}</span>
                  </div>

                  {/* Question Prompt Text */}
                  <h3 className="text-base md:text-lg font-bold text-white leading-relaxed">
                    {currentQ.questionText}
                  </h3>

                  {/* Options Grid */}
                  <div className="space-y-3 pt-2">
                    {currentQ.options?.map((opt: string, optIdx: number) => {
                      const isOptionSelected = selectedOptions[currentQ.id] === optIdx;
                      const isRevealed = revealedAnswers[currentQ.id];
                      const isCorrectOption = optIdx === currentQ.correctOptionIndex;

                      let cardStyle = 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700';
                      if (isRevealed) {
                        if (isCorrectOption) {
                          cardStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.2)] font-semibold';
                        } else if (isOptionSelected && !isCorrectOption) {
                          cardStyle = 'bg-rose-500/20 border-rose-500 text-rose-200';
                        }
                      } else if (isOptionSelected) {
                        cardStyle = 'bg-cyan-500/15 border-cyan-500 text-cyan-200 font-semibold shadow-[0_0_15px_rgba(6,182,212,0.2)]';
                      }

                      return (
                        <div
                          key={optIdx}
                          onClick={() => {
                            setSelectedOptions(prev => ({ ...prev, [currentQ.id]: optIdx }));
                          }}
                          className={`p-4 rounded-2xl border text-xs md:text-sm transition-all duration-200 cursor-pointer flex items-start gap-3 ${cardStyle}`}
                        >
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5 ${
                              isRevealed && isCorrectOption
                                ? 'bg-emerald-500 text-slate-950'
                                : isOptionSelected
                                ? 'bg-cyan-500 text-slate-950'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {String.fromCharCode(65 + optIdx)}
                          </div>
                          <span className="leading-relaxed">{opt}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions & Explanation Reveal */}
                  <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <button
                      onClick={() => {
                        setRevealedAnswers(prev => ({ ...prev, [currentQ.id]: true }));
                      }}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition cursor-pointer"
                    >
                      Verify Answer & Show Explanation
                    </button>

                    {currentQIndex < questions.length - 1 && (
                      <button
                        onClick={() => setCurrentQIndex(prev => prev + 1)}
                        className="text-xs font-semibold text-cyan-400 hover:underline cursor-pointer"
                      >
                        Next Question →
                      </button>
                    )}
                  </div>

                  {/* Detailed Technical Explanation Box */}
                  {revealedAnswers[currentQ.id] && (
                    <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-xs md:text-sm text-emerald-200 animate-fadeIn space-y-2">
                      <div className="font-bold flex items-center gap-2 text-emerald-400 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Correct Answer: Option {currentQ.correctAnswerLetter}
                      </div>
                      <p className="text-slate-300 text-xs leading-relaxed">
                        {currentQ.explanation}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Tab 1: Selection Rounds & Intel */}
        {activeTab === 'ROUNDS' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" /> {vault.companyName} Selection Process Flowchart
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 relative">
                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest block mb-1">Round 1</span>
                  <h4 className="font-bold text-white text-sm mb-1">Online Assessment (OA)</h4>
                  <p className="text-xs text-slate-400">90 Mins • AON / Hackerearth format (2 Algorithmic Coding + Aptitude).</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block mb-1">Round 2</span>
                  <h4 className="font-bold text-white text-sm mb-1">Technical Interview 1</h4>
                  <p className="text-xs text-slate-400">60 Mins • Data Structures (Trees/Graphs) & Live Pair Programming.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block mb-1">Round 3</span>
                  <h4 className="font-bold text-white text-sm mb-1">Technical Interview 2</h4>
                  <p className="text-xs text-slate-400">60 Mins • System Design, DB Schema & CS Fundamentals.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block mb-1">Round 4</span>
                  <h4 className="font-bold text-white text-sm mb-1">Leadership & HR Fit</h4>
                  <p className="text-xs text-slate-400">45 Mins • Leadership Principles & Behavioral Situational Questions.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Company Problem Bank */}
        {activeTab === 'PROBLEMS' && (
          <div className="space-y-4 animate-fadeIn">
            {materials.filter(m => m.materialType === 'PROBLEM').length === 0 ? (
              <div className="p-8 text-center bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-400">
                No company coding problems added yet.
              </div>
            ) : (
              materials.filter(m => m.materialType === 'PROBLEM').map((m, idx) => (
                <div
                  key={m.id}
                  className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 transition flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-cyan-400 font-mono font-bold text-xs">
                      #{idx + 1}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{m.title}</h4>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                        <span>{m.dataJson?.topic || 'DSA Practice'}</span> • <span>{m.dataJson?.level || 'Medium'}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/playground/ai-assisted')}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 hover:bg-cyan-500 hover:text-slate-950 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" /> Solve Challenge
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: PDF Sheets & Notes */}
        {activeTab === 'PDFS' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Available PDF Guides</h4>
                {materials.filter(m => m.materialType === 'PDF_GUIDE').map((m) => (
                  <div
                    key={m.id}
                    onClick={() => m.contentUrl && setSelectedPdfUrl(m.contentUrl)}
                    className={`p-4 rounded-xl border cursor-pointer transition ${
                      selectedPdfUrl === m.contentUrl
                        ? 'bg-cyan-500/15 border-cyan-500/50 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <h5 className="font-bold text-sm mb-1">{m.title}</h5>
                    <span className="text-xs text-cyan-400 flex items-center gap-1">
                      <BookOpen className="w-3 h-3" /> Click to view document
                    </span>
                  </div>
                ))}
              </div>

              <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 min-h-[400px]">
                {selectedPdfUrl ? (
                  <div className="h-full flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                      <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-cyan-400" /> Embedded PDF Viewer
                      </span>
                      <a
                        href={selectedPdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
                      >
                        Open Fullscreen <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <iframe src={selectedPdfUrl} className="w-full h-[500px] rounded-xl border border-slate-800" title="PDF Viewer" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 py-20">
                    <BookOpen className="w-12 h-12 mb-2" />
                    <p className="text-sm font-semibold">Select a PDF Guide to view contents</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Real Interview Transcripts */}
        {activeTab === 'TRANSCRIPTS' && (
          <div className="space-y-4 animate-fadeIn">
            {transcripts.map((t) => (
              <div key={t.id} className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 text-xs font-bold">
                      {t.roleTitle}
                    </span>
                    {t.location && <span className="text-xs text-slate-400">📍 {t.location}</span>}
                  </div>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <ThumbsUp className="w-3.5 h-3.5 text-cyan-400" /> {t.upvotes} Helpful Votes
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800/60">
                  {t.experience}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
