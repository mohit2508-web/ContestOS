import React, { useState } from 'react';
import Editor from "@monaco-editor/react";
import { executeCode } from '../../lib/piston';

interface ScratchpadRunnerProps {
  onBack: () => void;
  contestTitle: string;
}

const TEMPLATES: Record<string, string> = {
  python: `def solve():\n    # Write your scratchpad code here\n    print("Hello from the Secure Sandbox!")\n\nsolve()`,
  javascript: `function solve() {\n    // Write your scratchpad code here\n    console.log("Hello from the Secure Sandbox!");\n}\n\nsolve();`,
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your scratchpad code here\n    cout << "Hello from the Secure Sandbox!" << endl;\n    return 0;\n}`,
  java: `public class Main {\n    public static void main(String[] args) {\n        // Write your scratchpad code here\n        System.out.println("Hello from the Secure Sandbox!");\n    }\n}`,
  c: `#include <stdio.h>\n\nint main() {\n    // Write your scratchpad code here\n    printf("Hello from the Secure Sandbox!\\n");\n    return 0;\n}`
};

export const ScratchpadRunner: React.FC<ScratchpadRunnerProps> = ({ onBack, contestTitle }) => {
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(TEMPLATES.python);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    setCode(TEMPLATES[newLang] || '');
  };

  const handleRun = async () => {
    setRunning(true);
    setOutput('Compiling and running in sandbox...');
    try {
      const result = await executeCode(language, code, input);
      if (result.success) {
        setOutput(result.output || 'No output.');
      } else {
        setOutput(result.error || result.output || 'Execution failed.');
      }
    } catch (err: any) {
      setOutput(`Error: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto bg-zinc-950 border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col h-[75vh]">
      {/* Sandbox Header */}
      <div className="flex justify-between items-center pb-4 border-b border-white/10 mb-4 flex-shrink-0">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            Lobby Code Sandbox
          </h2>
          <p className="text-[10px] text-gray-400 mt-0.5">Pre-boarding warm-up editor for: <span className="text-[var(--accent-blue)] font-bold">{contestTitle}</span></p>
        </div>
        
        <div className="flex items-center gap-3">
          <select 
            value={language} 
            onChange={handleLanguageChange}
            className="bg-zinc-900 text-white text-xs px-3 py-1.5 rounded-xl border border-white/10 outline-none focus:border-blue-500"
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="cpp">C++</option>
            <option value="java">Java</option>
            <option value="c">C</option>
          </select>

          <button 
            onClick={onBack}
            className="px-4 py-1.5 border border-white/10 text-gray-400 text-xs font-bold rounded-xl hover:bg-white/5 transition"
          >
            Tear Off Ticket
          </button>
        </div>
      </div>

      {/* Editor & Running Panel */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4 mb-4">
        {/* Monaco Editor Panel */}
        <div className="flex-1 min-h-0 border border-white/10 rounded-xl overflow-hidden bg-[#1e1e1e]">
          <Editor
            height="100%"
            language={language === 'cpp' ? 'cpp' : language === 'c' ? 'c' : language === 'java' ? 'java' : language === 'javascript' ? 'javascript' : 'python'}
            theme="vs-dark"
            value={code}
            onChange={(val) => setCode(val || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: "on",
              roundedSelection: false,
              scrollBeyondLastLine: false,
              readOnly: running,
              automaticLayout: true
            }}
          />
        </div>

        {/* Input/Output Sidebar */}
        <div className="w-full md:w-80 flex flex-col gap-4 flex-shrink-0">
          {/* Custom Input */}
          <div className="h-1/3 flex flex-col">
            <label className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wide">Custom Input</label>
            <textarea 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Provide stdin input here..."
              className="flex-1 bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-blue-500 resize-none font-mono"
            />
          </div>

          {/* Execution Output */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Console Output</label>
              <button 
                onClick={() => setOutput('')}
                className="text-[9px] text-gray-500 hover:text-gray-300"
              >
                Clear
              </button>
            </div>
            <pre className="flex-1 bg-black border border-white/10 rounded-xl p-3 text-xs text-gray-300 overflow-y-auto font-mono whitespace-pre-wrap select-text">
              {output}
            </pre>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex-shrink-0 flex justify-end">
        <button 
          onClick={handleRun}
          disabled={running}
          className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-extrabold rounded-xl transition disabled:opacity-50 flex items-center gap-2 shadow-lg"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {running ? 'Executing...' : 'Run Warmup Code'}
        </button>
      </div>
    </div>
  );
};
