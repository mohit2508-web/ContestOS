import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { TokenUsageBar } from './TokenUsageBar';
import { InsertInEditorButton } from './InsertInEditorButton';

interface Message {
  id: string;
  role: 'assistant' | 'candidate';
  text: string;
  code?: string | null;
  canInsert?: boolean;
}

interface VibeAssistantPanelProps {
  onInsertCode: (code: string) => void;
  onHideAssistant?: () => void;
  isDayMode?: boolean;
  language?: string;
}

export const VibeAssistantPanel: React.FC<VibeAssistantPanelProps> = ({
  onInsertCode,
  onHideAssistant,
  isDayMode = true,
  language = 'cpp'
}) => {
  const [sessionId] = useState(() => `capgemini_${Date.now()}`);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init_welcome',
      role: 'assistant',
      text: `Let's begin! **Please describe the problem in your own words** what are the inputs, expected output, and key constraints.`
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tokensUsed, setTokensUsed] = useState(869);
  const [tokenBudget] = useState(2000);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text || isLoading || tokensUsed >= tokenBudget) return;

    const candidateMsg: Message = {
      id: `cand_${Date.now()}`,
      role: 'candidate',
      text
    };

    setMessages(prev => [...prev, candidateMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const apiHost = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      const response = await axios.post(`${apiHost}/api/assistant/${sessionId}/message`, {
        text,
        language,
        userId: 'candidate_17100641'
      });

      const resData = response.data;
      if (resData.success) {
        setTokensUsed(resData.tokensUsed || tokensUsed + 40);
        const assistantMsg: Message = {
          id: `asst_${Date.now()}`,
          role: 'assistant',
          text: resData.reply,
          code: resData.code,
          canInsert: resData.canInsert
        };
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: 'assistant',
            text: 'I encountered an error processing your request. Please try again.'
          }
        ]);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          text: 'Network error connecting to AI evaluation engine.'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex flex-col h-full font-sans text-xs transition-colors duration-200 ${
      isDayMode ? 'bg-[#f4f7fb] text-gray-900' : 'bg-[#14161f] text-gray-100'
    }`}>
      {/* Header Bar */}
      <div className={`h-9 px-3 border-b flex items-center justify-between shrink-0 ${
        isDayMode ? 'bg-[#f4f6f8] border-gray-200' : 'bg-[#181a24] border-zinc-800'
      }`}>
        <span className={`font-bold text-xs ${isDayMode ? 'text-gray-700' : 'text-zinc-200'}`}>Your Coding Assistant</span>
      </div>

      {/* Main Chat Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Soft Rounded Welcome Card (Theme-Aware) */}
        <div className={`rounded-2xl p-4 text-[11px] space-y-2.5 shadow-xs border ${
          isDayMode 
            ? 'bg-[#dce8f3] border-[#c4daec] text-gray-800' 
            : 'bg-[#1c2333] border-[#29344c] text-zinc-200'
        }`}>
          <div>
            <h3 className={`font-bold text-xs ${isDayMode ? 'text-gray-900' : 'text-white'}`}>Welcome to the Vibe Coding Assessment!</h3>
            <p className={`font-medium ${isDayMode ? 'text-gray-700' : 'text-zinc-300'}`}>I'm your AI coding assistant. Here's how this works:</p>
          </div>

          <div>
            <h4 className={`font-bold uppercase text-[10px] tracking-wide mb-1 ${isDayMode ? 'text-gray-900' : 'text-amber-400'}`}>HOW IT WORKS:</h4>
            <ol className="list-decimal list-inside space-y-0.5 leading-relaxed pl-1 font-medium">
              <li>First, <strong>describe the problem</strong> in your own words</li>
              <li>I'll ask about the <strong>data structures</strong> you plan to use</li>
              <li>Then I'll ask about your <strong>approach</strong> to solving it</li>
              <li>Based on YOUR explanation, I'll generate starter code</li>
              <li>You can then refine the code by explaining specific changes</li>
              <li>Use the <strong>"Insert in Editor"</strong> button to move code to the editor</li>
              <li>Adjust the code for your specific problem, compile, and test</li>
            </ol>
          </div>

          <div>
            <h4 className={`font-bold uppercase text-[10px] tracking-wide mb-1 ${isDayMode ? 'text-gray-900' : 'text-amber-400'}`}>DO's:</h4>
            <ul className="list-disc list-inside space-y-0.5 leading-relaxed pl-1 font-medium">
              <li>Describe the problem clearly (inputs, outputs, and constraints)</li>
              <li>Explain your approach and reasoning</li>
              <li>Tell me WHAT logic to change and WHY when asking for improvements</li>
              <li>Use "Insert in Editor" to bring code into the editor and modify it yourself</li>
            </ul>
          </div>

          <div>
            <h4 className={`font-bold uppercase text-[10px] tracking-wide mb-1 ${isDayMode ? 'text-gray-900' : 'text-amber-400'}`}>DON'Ts:</h4>
            <ul className="list-disc list-inside space-y-0.5 leading-relaxed pl-1 font-medium">
              <li>Don't ask me for the complete solution or answer</li>
              <li>Don't ask me to "optimize it" or "fix it" without explaining the logic</li>
              <li>Don't ask off-topic or unrelated questions</li>
            </ul>
          </div>
        </div>

        {/* Dynamic Chat Messages */}
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'candidate' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[88%] rounded-2xl p-3.5 shadow-xs text-[11px] leading-relaxed relative ${
                msg.role === 'candidate'
                  ? 'bg-[#334155] text-white rounded-tr-sm self-end'
                  : isDayMode 
                    ? 'bg-[#dce8f3] border border-[#c8dce8] text-[#1e293b] rounded-tl-sm'
                    : 'bg-[#1c2333] border border-[#29344c] text-zinc-100 rounded-tl-sm'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.text}</div>

              {msg.code && (
                <div className="mt-2.5 bg-gray-950 text-emerald-400 p-3 rounded-lg font-mono text-[11px] overflow-x-auto border border-zinc-800">
                  <pre>{msg.code}</pre>
                  {msg.canInsert && (
                    <InsertInEditorButton code={msg.code} onInsert={onInsertCode} />
                  )}
                </div>
              )}

              {/* Timestamp inside bubble matching reference image */}
              <div className={`text-[9px] text-right mt-1 font-mono opacity-60 ${
                msg.role === 'candidate' ? 'text-gray-300' : isDayMode ? 'text-gray-600' : 'text-zinc-400'
              }`}>
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className={`rounded-2xl p-3 flex items-center gap-2 border text-xs ${
              isDayMode ? 'bg-[#dce8f3] border-[#c8dce8] text-gray-700' : 'bg-[#1c2333] border-zinc-800 text-zinc-400'
            }`}>
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
              AI Assistant is thinking...
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Textarea Footer (Exact Match of Reference Image) */}
      <div className={`p-3 border-t shrink-0 ${
        isDayMode ? 'bg-white border-gray-200' : 'bg-[#181a24] border-zinc-800'
      }`}>
        <div className="relative flex items-center">
          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value.slice(0, 500))}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type your message here"
            disabled={tokensUsed >= tokenBudget}
            rows={2}
            className={`w-full resize-none border rounded-xl p-2.5 pr-10 text-xs focus:outline-none focus:border-blue-500 ${
              isDayMode 
                ? 'bg-white border-gray-300 text-gray-900 placeholder-gray-400' 
                : 'bg-[#14161f] border-zinc-700 text-white placeholder-zinc-500'
            }`}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isLoading || tokensUsed >= tokenBudget}
            className={`absolute right-2.5 bottom-3 p-1.5 rounded-lg cursor-pointer transition flex items-center justify-center ${
              isDayMode 
                ? 'bg-[#cbdff2] hover:bg-blue-600 hover:text-white text-gray-700' 
                : 'bg-[#29344c] hover:bg-blue-600 hover:text-white text-zinc-200'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>

        <div className="flex items-center justify-between px-1 text-[10px] mt-1.5">
          <span className={`font-mono text-[10px] ${isDayMode ? 'text-gray-500' : 'text-zinc-400'}`}>
            Tokens used: {tokensUsed} / {tokenBudget}
          </span>
          <span className={`font-mono text-[10px] ${isDayMode ? 'text-gray-400' : 'text-zinc-500'}`}>
            {inputText.length} / 500
          </span>
        </div>

        {/* Green Token Progress Bar matching Reference Image */}
        <div className="w-full bg-gray-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-1">
          <div 
            className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
            style={{ width: `${Math.min(100, (tokensUsed / tokenBudget) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};
