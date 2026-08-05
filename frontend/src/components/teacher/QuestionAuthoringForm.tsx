import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

// ───────── Types ─────────
type AssessmentType =
  | 'CODING_DSA' | 'SQL' | 'WEB_DEV' | 'MCQ_TECHNICAL'
  | 'APTITUDE_NUMERICAL' | 'VERBAL_REASONING' | 'LOGICAL_ABSTRACT'
  | 'PSYCHOMETRIC' | 'SJT' | 'SUBJECTIVE_ESSAY';

type BloomsLevel = 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate';

const TYPE_META: Record<AssessmentType, { label: string; icon: string; color: string }> = {
  CODING_DSA: { label: 'DSA Coding', icon: '💻', color: 'text-indigo-400' },
  SQL: { label: 'SQL Challenge', icon: '🗃️', color: 'text-orange-400' },
  WEB_DEV: { label: 'Web Dev', icon: '🌐', color: 'text-purple-400' },
  MCQ_TECHNICAL: { label: 'Technical MCQ', icon: '📝', color: 'text-blue-400' },
  APTITUDE_NUMERICAL: { label: 'Numerical Aptitude', icon: '🔢', color: 'text-emerald-400' },
  VERBAL_REASONING: { label: 'Verbal Reasoning', icon: '📖', color: 'text-cyan-400' },
  LOGICAL_ABSTRACT: { label: 'Logical / Abstract', icon: '🧩', color: 'text-amber-400' },
  PSYCHOMETRIC: { label: 'Psychometric', icon: '🧠', color: 'text-pink-400' },
  SJT: { label: 'Situational Judgement', icon: '⚖️', color: 'text-rose-400' },
  SUBJECTIVE_ESSAY: { label: 'Subjective / Essay', icon: '✍️', color: 'text-zinc-400' },
};

// ───────── Helper Sub-Components ─────────
function SectionCard({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="bg-black/30 border border-white/8 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2 border-b border-white/8 pb-3">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        {badge && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">{children}</label>;
}

function TextInput({ value, onChange, placeholder, className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500/50 ${className}`}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 4, mono = false }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; mono?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500/50 resize-y ${mono ? 'font-mono text-xs' : ''}`}
    />
  );
}

// ───────── Type-Specific Authoring Panels ─────────

/** DSA Coding */
function CodingDsaPanel() {
  const [problem, setProblem] = useState('');
  const [constraints, setConstraints] = useState('');
  const [starterCode, setStarterCode] = useState('def solution(nums: list[int]) -> int:\n    pass');
  const [refSolution, setRefSolution] = useState('');
  const [testCases, setTestCases] = useState([
    { input: '[2,7,11,15]\n9', output: '[0,1]', isPublic: true, label: 'Example 1' },
    { input: '[3,2,4]\n6', output: '[1,2]', isPublic: false, label: 'Hidden 1' },
    { input: '[1,1000000]\n1000001', output: '[0,1]', isPublic: false, label: 'Edge — Large N' },
  ]);

  const addTestCase = () => setTestCases((prev) => [
    ...prev,
    { input: '', output: '', isPublic: false, label: `Case ${prev.length + 1}` },
  ]);

  return (
    <div className="space-y-5">
      <SectionCard title="Problem Statement" badge="Markdown + LaTeX Supported">
        <FieldLabel>Problem Description</FieldLabel>
        <TextArea value={problem} onChange={setProblem} placeholder="Write the full problem statement here. Use **bold**, `code`, and $O(n)$ for math..." rows={6} />
        <FieldLabel>Constraints</FieldLabel>
        <TextArea value={constraints} onChange={setConstraints} placeholder="e.g. 2 ≤ nums.length ≤ 10⁴ | -10⁹ ≤ nums[i] ≤ 10⁹" rows={3} mono />
      </SectionCard>

      <SectionCard title="Starter Code Template">
        <FieldLabel>Default Starter Code (Python 3)</FieldLabel>
        <TextArea value={starterCode} onChange={setStarterCode} rows={5} mono />
        <FieldLabel>Reference Solution (Private — Reviewer Only)</FieldLabel>
        <TextArea value={refSolution} onChange={setRefSolution} placeholder="Write the optimal reference solution here..." rows={6} mono />
      </SectionCard>

      <SectionCard title="Test Case Engine" badge={`${testCases.length} Cases`}>
        <div className="space-y-3">
          {testCases.map((tc, i) => (
            <div key={i} className="bg-zinc-900 rounded-xl border border-white/8 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={tc.label}
                  onChange={(e) => {
                    const next = [...testCases]; next[i].label = e.target.value; setTestCases(next);
                  }}
                  className="flex-1 bg-black border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-indigo-500/50"
                />
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tc.isPublic}
                    onChange={(e) => {
                      const next = [...testCases]; next[i].isPublic = e.target.checked; setTestCases(next);
                    }}
                    className="accent-indigo-500"
                  />
                  <span className="text-[10px] text-zinc-400 font-medium">Public Sample</span>
                </label>
                <button
                  onClick={() => setTestCases((prev) => prev.filter((_, j) => j !== i))}
                  className="text-[10px] text-red-400 hover:text-red-300 font-bold transition px-2 py-1"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Input</FieldLabel>
                  <TextArea value={tc.input} onChange={(v) => { const next = [...testCases]; next[i].input = v; setTestCases(next); }} rows={2} mono />
                </div>
                <div>
                  <FieldLabel>Expected Output</FieldLabel>
                  <TextArea value={tc.output} onChange={(v) => { const next = [...testCases]; next[i].output = v; setTestCases(next); }} rows={2} mono />
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={addTestCase}
          className="w-full py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-dashed border-indigo-500/40 text-indigo-400 text-xs font-bold rounded-xl transition"
        >
          + Add Test Case
        </button>
      </SectionCard>
    </div>
  );
}

/** SQL Challenge */
function SqlPanel() {
  const [schema, setSchema] = useState('CREATE TABLE employees (\n  id INT PRIMARY KEY,\n  name VARCHAR(100),\n  department VARCHAR(50),\n  salary DECIMAL(10,2)\n);');
  const [sampleData, setSampleData] = useState('INSERT INTO employees VALUES\n  (1, \'Alice\', \'Engineering\', 95000),\n  (2, \'Bob\', \'Marketing\', 70000);');
  const [prompt, setPrompt] = useState('');
  const [refQuery, setRefQuery] = useState('');
  const [expectedOutput, setExpectedOutput] = useState('id | name  | department  | salary\n1  | Alice | Engineering | 95000');

  return (
    <div className="space-y-5">
      <SectionCard title="Schema Definition" badge="DDL">
        <FieldLabel>CREATE TABLE Statements</FieldLabel>
        <TextArea value={schema} onChange={setSchema} rows={8} mono />
      </SectionCard>
      <SectionCard title="Sample Data" badge="DML Seed">
        <FieldLabel>INSERT Statements (shown to candidates)</FieldLabel>
        <TextArea value={sampleData} onChange={setSampleData} rows={5} mono />
      </SectionCard>
      <SectionCard title="Challenge Prompt">
        <FieldLabel>Question / Task Description</FieldLabel>
        <TextArea value={prompt} onChange={setPrompt} placeholder="Write a SQL query to find all employees with salary above the average for their department, ranked by salary descending." rows={4} />
        <FieldLabel>Reference Query (Private)</FieldLabel>
        <TextArea value={refQuery} onChange={setRefQuery} rows={5} mono />
        <FieldLabel>Expected Output Table</FieldLabel>
        <TextArea value={expectedOutput} onChange={setExpectedOutput} rows={4} mono />
      </SectionCard>
    </div>
  );
}

/** Web Dev Challenge */
function WebDevPanel() {
  const [prompt, setPrompt] = useState('');
  const [starterHtml, setStarterHtml] = useState('<!DOCTYPE html>\n<html>\n  <body>\n    <!-- Your implementation here -->\n  </body>\n</html>');
  const [starterCss, setStarterCss] = useState('/* Style your component here */');
  const [starterJs, setStarterJs] = useState('// JavaScript logic here');
  const [evalCriteria, setEvalCriteria] = useState('');

  return (
    <div className="space-y-5">
      <SectionCard title="Challenge Description">
        <FieldLabel>Task Description</FieldLabel>
        <TextArea value={prompt} onChange={setPrompt} placeholder="e.g. Build a responsive navigation bar with hamburger menu for mobile. The nav must collapse on screens < 768px and expand on click." rows={4} />
        <FieldLabel>Evaluation Criteria</FieldLabel>
        <TextArea value={evalCriteria} onChange={setEvalCriteria} placeholder="1. Mobile hamburger menu works\n2. Nav items highlight on hover\n3. Transition animation present\n4. Semantic HTML used" rows={4} />
      </SectionCard>
      <SectionCard title="Starter Code Templates">
        <div className="space-y-4">
          {[
            { label: 'Starter HTML', value: starterHtml, onChange: setStarterHtml },
            { label: 'Starter CSS', value: starterCss, onChange: setStarterCss },
            { label: 'Starter JavaScript', value: starterJs, onChange: setStarterJs },
          ].map((f) => (
            <div key={f.label}>
              <FieldLabel>{f.label}</FieldLabel>
              <TextArea value={f.value} onChange={f.onChange} rows={5} mono />
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

/** Technical MCQ */
function McqTechnicalPanel() {
  const [prompt, setPrompt] = useState('');
  const [options, setOptions] = useState([
    { text: '', isCorrect: true, distractorNote: '' },
    { text: '', isCorrect: false, distractorNote: '' },
    { text: '', isCorrect: false, distractorNote: '' },
    { text: '', isCorrect: false, distractorNote: '' },
  ]);
  const [multiSelect, setMultiSelect] = useState(false);
  const [explanation, setExplanation] = useState('');

  return (
    <div className="space-y-5">
      <SectionCard title="Question Prompt">
        <FieldLabel>Question Text</FieldLabel>
        <TextArea value={prompt} onChange={setPrompt} placeholder="e.g. Which of the following is NOT a characteristic of RESTful APIs?" rows={4} />
        <div className="flex items-center gap-2">
          <input type="checkbox" id="multiSel" checked={multiSelect} onChange={(e) => setMultiSelect(e.target.checked)} className="accent-indigo-500" />
          <label htmlFor="multiSel" className="text-xs text-zinc-400 cursor-pointer">Multi-Select (candidates can pick multiple correct answers)</label>
        </div>
      </SectionCard>

      <SectionCard title="Options & Correct Key" badge={`${options.filter((o) => o.isCorrect).length} Correct`}>
        <div className="space-y-3">
          {options.map((opt, i) => (
            <div key={i} className={`p-3 rounded-xl border space-y-2 ${opt.isCorrect ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/8 bg-zinc-900'}`}>
              <div className="flex items-center gap-3">
                <input
                  type={multiSelect ? 'checkbox' : 'radio'}
                  name="correct"
                  checked={opt.isCorrect}
                  onChange={() => {
                    if (multiSelect) {
                      const next = [...options]; next[i].isCorrect = !next[i].isCorrect; setOptions(next);
                    } else {
                      setOptions(options.map((o, j) => ({ ...o, isCorrect: j === i })));
                    }
                  }}
                  className="accent-emerald-500 flex-shrink-0"
                />
                <input
                  type="text"
                  value={opt.text}
                  onChange={(e) => { const next = [...options]; next[i].text = e.target.value; setOptions(next); }}
                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-indigo-500/50"
                />
                <span className={`text-[10px] font-bold ${opt.isCorrect ? 'text-emerald-400' : 'text-zinc-600'}`}>
                  {opt.isCorrect ? '✓ Correct' : 'Distractor'}
                </span>
              </div>
              {!opt.isCorrect && (
                <input
                  type="text"
                  value={opt.distractorNote}
                  onChange={(e) => { const next = [...options]; next[i].distractorNote = e.target.value; setOptions(next); }}
                  placeholder="Distractor rationale: why a weak candidate might choose this..."
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-400 outline-none focus:border-indigo-500/50"
                />
              )}
            </div>
          ))}
        </div>
        <FieldLabel>Explanation / Solution Commentary</FieldLabel>
        <TextArea value={explanation} onChange={setExplanation} placeholder="Explain why the correct answer is correct and why the distractors are wrong..." rows={3} />
      </SectionCard>
    </div>
  );
}

/** Verbal Reasoning — Passage Bundle */
function VerbalReasoningPanel() {
  const [passage, setPassage] = useState('');
  const [questions, setQuestions] = useState([
    { text: '', options: ['', '', '', ''], correct: 0 },
  ]);

  const addQuestion = () => setQuestions((prev) => [
    ...prev, { text: '', options: ['', '', '', ''], correct: 0 }
  ]);

  return (
    <div className="space-y-5">
      <SectionCard title="Passage Bundle" badge="SHL Standard">
        <FieldLabel>Reading Passage (300–500 words recommended)</FieldLabel>
        <TextArea value={passage} onChange={setPassage} placeholder="Enter the reading passage here. This will be shown to candidates alongside all linked questions." rows={8} />
        <div className="text-[10px] text-zinc-600">
          Word count: {passage.trim().split(/\s+/).filter(Boolean).length} / 500 recommended
        </div>
      </SectionCard>

      <SectionCard title="Linked Questions" badge={`${questions.length} Questions`}>
        {questions.map((q, qi) => (
          <div key={qi} className="space-y-3 p-4 bg-zinc-900 rounded-xl border border-white/8 mb-3">
            <FieldLabel>Question {qi + 1}</FieldLabel>
            <TextArea value={q.text} onChange={(v) => { const n = [...questions]; n[qi].text = v; setQuestions(n); }} placeholder="e.g. What is the author's primary argument in paragraph 2?" rows={2} />
            <div className="grid grid-cols-2 gap-2">
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input type="radio" name={`q${qi}-correct`} checked={q.correct === oi}
                    onChange={() => { const n = [...questions]; n[qi].correct = oi; setQuestions(n); }}
                    className="accent-emerald-500 flex-shrink-0"
                  />
                  <input type="text" value={opt}
                    onChange={(e) => { const n = [...questions]; n[qi].options[oi] = e.target.value; setQuestions(n); }}
                    placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500/50"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        <button onClick={addQuestion} className="w-full py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-dashed border-cyan-500/40 text-cyan-400 text-xs font-bold rounded-xl transition">
          + Add Linked Question
        </button>
      </SectionCard>
    </div>
  );
}

/** Psychometric / Personality (Likert Scale) */
function PsychometricPanel() {
  const [construct, setConstruct] = useState('Conscientiousness (Big-5)');
  const [scaleType, setScaleType] = useState('5-point');
  const [statements, setStatements] = useState([
    { text: '', reverseScore: false },
    { text: '', reverseScore: false },
  ]);

  const addStatement = () => setStatements((prev) => [...prev, { text: '', reverseScore: false }]);

  return (
    <div className="space-y-5">
      <SectionCard title="Construct & Scale Configuration" badge="OCEAN / Big-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Psychological Construct</FieldLabel>
            <select value={construct} onChange={(e) => setConstruct(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50">
              <option>Conscientiousness (Big-5)</option>
              <option>Openness to Experience (Big-5)</option>
              <option>Agreeableness (Big-5)</option>
              <option>Extraversion (Big-5)</option>
              <option>Neuroticism / Emotional Stability (Big-5)</option>
              <option>Resilience (Behavioral)</option>
              <option>Leadership Orientation (Behavioral)</option>
              <option>Integrity & Ethics (Behavioral)</option>
            </select>
          </div>
          <div>
            <FieldLabel>Scale Type</FieldLabel>
            <select value={scaleType} onChange={(e) => setScaleType(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50">
              <option value="5-point">5-Point Likert (1=Strongly Disagree → 5=Strongly Agree)</option>
              <option value="7-point">7-Point Likert (1=Never → 7=Always)</option>
              <option value="4-point">4-Point (Forced Choice — No Neutral)</option>
            </select>
          </div>
        </div>
        <div className="p-3 bg-pink-500/5 border border-pink-500/20 rounded-xl text-xs text-pink-300">
          <strong>Scale Preview:</strong> Strongly Disagree → Disagree → Neutral → Agree → Strongly Agree
        </div>
      </SectionCard>

      <SectionCard title="Statements" badge={`${statements.length} Items`}>
        {statements.map((s, i) => (
          <div key={i} className="flex items-start gap-3 p-3 bg-zinc-900 rounded-xl border border-white/8 mb-3">
            <div className="flex-1 space-y-1.5">
              <TextArea value={s.text} onChange={(v) => { const n = [...statements]; n[i].text = v; setStatements(n); }}
                placeholder={`Statement ${i + 1}: e.g. I prefer to plan tasks in advance rather than improvise...`} rows={2} />
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={s.reverseScore}
                  onChange={(e) => { const n = [...statements]; n[i].reverseScore = e.target.checked; setStatements(n); }}
                  className="accent-pink-500"
                />
                <span className="text-[10px] text-pink-400 font-bold">Reverse-Score Item</span>
                <span className="text-[10px] text-zinc-600">(High score = low trait — psychometric correction applied)</span>
              </label>
            </div>
            <button onClick={() => setStatements((prev) => prev.filter((_, j) => j !== i))}
              className="text-[10px] text-red-400 hover:text-red-300 font-bold transition pt-2">✕</button>
          </div>
        ))}
        <button onClick={addStatement} className="w-full py-2.5 bg-pink-500/10 hover:bg-pink-500/20 border border-dashed border-pink-500/40 text-pink-400 text-xs font-bold rounded-xl transition">
          + Add Statement
        </button>
      </SectionCard>
    </div>
  );
}

/** SJT — Situational Judgement Test */
function SjtPanel() {
  const [scenario, setScenario] = useState('');
  const [context, setContext] = useState('');
  const [responses, setResponses] = useState([
    { text: '', score: 3, rationale: '' },
    { text: '', score: 2, rationale: '' },
    { text: '', score: 1, rationale: '' },
    { text: '', score: 0, rationale: '' },
  ]);

  return (
    <div className="space-y-5">
      <SectionCard title="Scenario Setup" badge="SHL Standard">
        <FieldLabel>Scenario Context (Role / Setting)</FieldLabel>
        <TextInput value={context} onChange={setContext} placeholder="e.g. You are a junior software engineer 3 months into a new role at a fast-paced startup..." />
        <FieldLabel>Situation Description</FieldLabel>
        <TextArea value={scenario} onChange={setScenario} placeholder="Describe the specific workplace dilemma the candidate must respond to. Include relevant details about stakeholders, time pressure, and constraints." rows={6} />
      </SectionCard>

      <SectionCard title="Response Options" badge="Rank from Best (3) to Worst (0)">
        <p className="text-[10px] text-zinc-500 mb-3">
          SHL Standard: Candidates rank or select the MOST and LEAST effective response. Assign effectiveness scores.
        </p>
        {responses.map((r, i) => (
          <div key={i} className="p-4 bg-zinc-900 rounded-xl border border-white/8 space-y-2 mb-3">
            <div className="flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full text-[10px] font-black flex items-center justify-center flex-shrink-0 ${
                r.score === 3 ? 'bg-emerald-500/20 text-emerald-400' :
                r.score === 2 ? 'bg-blue-500/20 text-blue-400' :
                r.score === 1 ? 'bg-amber-500/20 text-amber-400' :
                'bg-red-500/20 text-red-400'}`}>
                {r.score}
              </span>
              <TextArea value={r.text} onChange={(v) => { const n = [...responses]; n[i].text = v; setResponses(n); }}
                placeholder={`Response option ${i + 1}...`} rows={2} />
            </div>
            <div className="flex items-center gap-3 pl-9">
              <select value={r.score} onChange={(e) => { const n = [...responses]; n[i].score = parseInt(e.target.value); setResponses(n); }}
                className="bg-black border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none">
                <option value={3}>3 — Most Effective</option>
                <option value={2}>2 — Effective</option>
                <option value={1}>1 — Ineffective</option>
                <option value={0}>0 — Counter-Productive</option>
              </select>
              <input type="text" value={r.rationale}
                onChange={(e) => { const n = [...responses]; n[i].rationale = e.target.value; setResponses(n); }}
                placeholder="Reviewer rationale (private)"
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-zinc-400 outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>
        ))}
      </SectionCard>
    </div>
  );
}

/** Subjective / Essay */
function SubjectiveEssayPanel() {
  const [prompt, setPrompt] = useState('');
  const [minWords, setMinWords] = useState(150);
  const [maxWords, setMaxWords] = useState(500);
  const [rubric, setRubric] = useState('1. Clarity of argument (0-5 pts)\n2. Use of relevant examples (0-5 pts)\n3. Critical thinking depth (0-5 pts)\n4. Grammar & structure (0-5 pts)');

  return (
    <div className="space-y-5">
      <SectionCard title="Essay Prompt">
        <FieldLabel>Question / Prompt</FieldLabel>
        <TextArea value={prompt} onChange={setPrompt} placeholder="e.g. Discuss the trade-offs between microservices and monolithic architectures. When would you choose one over the other?" rows={5} />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Minimum Word Count</FieldLabel>
            <input type="number" value={minWords} onChange={(e) => setMinWords(parseInt(e.target.value) || 100)}
              className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50" />
          </div>
          <div>
            <FieldLabel>Maximum Word Count</FieldLabel>
            <input type="number" value={maxWords} onChange={(e) => setMaxWords(parseInt(e.target.value) || 500)}
              className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50" />
          </div>
        </div>
      </SectionCard>
      <SectionCard title="Evaluator Rubric Template" badge="Routed to EVALUATOR Queue">
        <FieldLabel>Scoring Rubric (Shared with Evaluator)</FieldLabel>
        <TextArea value={rubric} onChange={setRubric} rows={6} />
        <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs text-amber-300">
          ⚠️ Subjective answers will auto-route to the <strong>EVALUATOR</strong> role queue for human grading using this rubric.
        </div>
      </SectionCard>
    </div>
  );
}

/** Numerical Aptitude */
function AptitudeNumericalPanel() {
  const [prompt, setPrompt] = useState('');
  const [tableData, setTableData] = useState('Year | Revenue (Cr) | Growth %\n2021 | 120           | —\n2022 | 156           | 30%\n2023 | 187           | 19.9%');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correct, setCorrect] = useState(0);
  const [calcAllowed, setCalcAllowed] = useState(false);

  return (
    <div className="space-y-5">
      <SectionCard title="Data Table / Chart Context">
        <FieldLabel>Data Table (Markdown or CSV format)</FieldLabel>
        <TextArea value={tableData} onChange={setTableData} rows={6} mono />
        <div className="flex items-center gap-2">
          <input type="checkbox" id="calc" checked={calcAllowed} onChange={(e) => setCalcAllowed(e.target.checked)} className="accent-emerald-500" />
          <label htmlFor="calc" className="text-xs text-zinc-400 cursor-pointer">Calculator Allowed for this section</label>
        </div>
      </SectionCard>
      <SectionCard title="Question">
        <FieldLabel>Question Prompt</FieldLabel>
        <TextArea value={prompt} onChange={setPrompt} placeholder="Based on the table above, what was the approximate revenue in 2022 if growth was 25% instead of 30%?" rows={3} />
        <FieldLabel>Options</FieldLabel>
        <div className="grid grid-cols-2 gap-3">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="num-correct" checked={correct === i} onChange={() => setCorrect(i)} className="accent-emerald-500 flex-shrink-0" />
              <input type="text" value={opt} onChange={(e) => { const n = [...options]; n[i] = e.target.value; setOptions(n); }}
                placeholder={`(${String.fromCharCode(65 + i)}) e.g. ₹150 Cr`}
                className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-indigo-500/50"
              />
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

/** Logical / Abstract */
function LogicalAbstractPanel() {
  const [prompt, setPrompt] = useState('');
  const [patternDesc, setPatternDesc] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correct, setCorrect] = useState(0);

  return (
    <div className="space-y-5">
      <SectionCard title="Pattern / Sequence Setup">
        <FieldLabel>Question Prompt</FieldLabel>
        <TextArea value={prompt} onChange={setPrompt} placeholder="e.g. What number comes next in the series: 2, 6, 18, 54, ___?" rows={3} />
        <FieldLabel>Pattern Description (for reviewer reference)</FieldLabel>
        <TextArea value={patternDesc} onChange={setPatternDesc} placeholder="Rule: each term is multiplied by 3 (geometric progression, ratio=3)..." rows={2} />
        <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
          <p className="text-[10px] text-amber-400 font-bold">🧩 Image-Based Patterns</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">Image upload support (SVG matrix patterns, Raven's Progressive Matrices) coming in Phase 3.</p>
        </div>
      </SectionCard>
      <SectionCard title="Options">
        <div className="grid grid-cols-2 gap-3">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="log-correct" checked={correct === i} onChange={() => setCorrect(i)} className="accent-amber-500 flex-shrink-0" />
              <input type="text" value={opt} onChange={(e) => { const n = [...options]; n[i] = e.target.value; setOptions(n); }}
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-indigo-500/50"
              />
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ───────── Common Metadata Panel ─────────
function CommonMetadataPanel({
  bloomsLevel, setBloomsLevel,
  jobRole, setJobRole,
  skillTag, setSkillTag,
  targetMinutes, setTargetMinutes,
  difficultyLabel, setDifficultyLabel,
}: any) {
  return (
    <SectionCard title="Taxonomy & IRT Metadata" badge="Required for Peer Review">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <FieldLabel>Bloom's Taxonomy Level</FieldLabel>
          <select value={bloomsLevel} onChange={(e) => setBloomsLevel(e.target.value)}
            className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50">
            {['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate'].map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Target Job Role</FieldLabel>
          <select value={jobRole} onChange={(e) => setJobRole(e.target.value)}
            className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50">
            {['SDE-1 (Backend)', 'Senior Backend Engineer', 'Data Scientist', 'QA Automation Engineer', 'DevOps & Cloud Engineer', 'SDE-1 (Frontend)', 'Product Manager', 'Any Role'].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Difficulty Label</FieldLabel>
          <select value={difficultyLabel} onChange={(e) => setDifficultyLabel(e.target.value)}
            className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50">
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
        </div>
        <div>
          <FieldLabel>Skill / Competency Tag</FieldLabel>
          <TextInput value={skillTag} onChange={setSkillTag} placeholder="e.g. hash-map, verbal-comprehension, big-5-conscientiousness" />
        </div>
        <div>
          <FieldLabel>Target Duration (Minutes)</FieldLabel>
          <input type="number" min={1} max={120} value={targetMinutes} onChange={(e) => setTargetMinutes(parseInt(e.target.value) || 15)}
            className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50"
          />
        </div>
      </div>
    </SectionCard>
  );
}

// ───────── Main Component ─────────
export const QuestionAuthoringForm: React.FC<{ bankId?: string; onSaveSuccess?: () => void }> = ({ bankId, onSaveSuccess }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const typeParam = (searchParams.get('type') as AssessmentType) || 'MCQ_TECHNICAL';
  const scope = searchParams.get('scope') || 'TENANT_PRIVATE';

  const [selectedType, setSelectedType] = useState<AssessmentType>(typeParam);
  const [title, setTitle] = useState('');
  const [bloomsLevel, setBloomsLevel] = useState<BloomsLevel>('Apply');
  const [jobRole, setJobRole] = useState('SDE-1 (Backend)');
  const [skillTag, setSkillTag] = useState('');
  const [targetMinutes, setTargetMinutes] = useState(15);
  const [difficultyLabel, setDifficultyLabel] = useState('Medium');
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const t = searchParams.get('type') as AssessmentType;
    if (t) setSelectedType(t);
  }, [searchParams]);

  const meta = TYPE_META[selectedType];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setFeedbackMsg({ type: 'error', message: 'Item Title is required before submitting for peer review.' }); return; }
    setSubmitting(true);
    setFeedbackMsg(null);
    try {
      await new Promise((r) => setTimeout(r, 600)); // Simulate API call
      setFeedbackMsg({ type: 'success', message: `${meta.icon} "${title}" saved as DRAFT (${selectedType}) → Submitted to Peer Review Queue!` });
      if (onSaveSuccess) onSaveSuccess();
      setTimeout(() => navigate('/governance/reviews'), 1400);
    } catch {
      setFeedbackMsg({ type: 'error', message: 'Network error saving draft.' });
    } finally {
      setSubmitting(false);
    }
  };

  const renderTypePanel = () => {
    switch (selectedType) {
      case 'CODING_DSA': return <CodingDsaPanel />;
      case 'SQL': return <SqlPanel />;
      case 'WEB_DEV': return <WebDevPanel />;
      case 'MCQ_TECHNICAL': return <McqTechnicalPanel />;
      case 'VERBAL_REASONING': return <VerbalReasoningPanel />;
      case 'PSYCHOMETRIC': return <PsychometricPanel />;
      case 'SJT': return <SjtPanel />;
      case 'SUBJECTIVE_ESSAY': return <SubjectiveEssayPanel />;
      case 'APTITUDE_NUMERICAL': return <AptitudeNumericalPanel />;
      case 'LOGICAL_ABSTRACT': return <LogicalAbstractPanel />;
      default: return null;
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {scope === 'PLATFORM_GLOBAL' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 uppercase tracking-wider">
                SME · Platform Global Bank
              </span>
            )}
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Status: DRAFT
            </span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Author New Item<span className={meta.color}>.</span>
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            {meta.icon} <span className={`font-semibold ${meta.color}`}>{meta.label}</span> — All items require mandatory peer review before publication.
          </p>
        </div>
        <Link to={scope === 'PLATFORM_GLOBAL' ? '/governance/sme-bank' : '/governance/banks'}
          className="flex-shrink-0 px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-lg transition text-xs">
          ← Back
        </Link>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div className={`p-4 rounded-xl text-xs font-bold border ${
          feedbackMsg.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            : 'bg-red-500/10 text-red-400 border-red-500/30'
        }`}>
          {feedbackMsg.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Type Switcher */}
        <SectionCard title="Assessment Type">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TYPE_META) as AssessmentType[]).map((t) => {
              const m = TYPE_META[t];
              return (
                <button key={t} type="button" onClick={() => setSelectedType(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                    selectedType === t
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-zinc-900 text-zinc-400 border-white/10 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {m.icon} {m.label}
                </button>
              );
            })}
          </div>
        </SectionCard>

        {/* Item Title */}
        <SectionCard title="Item Title">
          <FieldLabel>Short Descriptive Title (shown in repository)</FieldLabel>
          <TextInput value={title} onChange={setTitle} placeholder={`e.g. Two Sum — Classic Hash Map Pattern`} />
        </SectionCard>

        {/* Type-Specific Panel */}
        {renderTypePanel()}

        {/* Common Taxonomy / IRT Metadata */}
        <CommonMetadataPanel
          bloomsLevel={bloomsLevel} setBloomsLevel={setBloomsLevel}
          jobRole={jobRole} setJobRole={setJobRole}
          skillTag={skillTag} setSkillTag={setSkillTag}
          targetMinutes={targetMinutes} setTargetMinutes={setTargetMinutes}
          difficultyLabel={difficultyLabel} setDifficultyLabel={setDifficultyLabel}
        />

        {/* Submit */}
        <button type="submit" disabled={submitting}
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm uppercase rounded-xl transition shadow-lg shadow-indigo-600/20 disabled:opacity-40 cursor-pointer">
          {submitting ? 'Submitting to Peer Review Queue...' : `Submit ${meta.icon} ${meta.label} Draft for Peer Review →`}
        </button>
      </form>
    </div>
  );
};
