import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  if (!content) return null;

  return (
    <div className={`prose prose-invert max-w-none text-xs leading-relaxed space-y-2 ${className}`}>
      {content.split('\n\n').map((paragraph, idx) => {
        if (paragraph.startsWith('```')) {
          const codeContent = paragraph.replace(/```[a-z]*/g, '').trim();
          return (
            <pre key={idx} className="bg-black/60 border border-white/10 p-3 rounded-xl font-mono text-[11px] text-amber-300 overflow-x-auto my-2">
              <code>{codeContent}</code>
            </pre>
          );
        }
        
        if (paragraph.startsWith('- ') || paragraph.startsWith('* ')) {
          const items = paragraph.split('\n');
          return (
            <ul key={idx} className="list-disc pl-5 space-y-1 text-gray-300">
              {items.map((item, itemIdx) => (
                <li key={itemIdx}>{item.replace(/^[-*]\s+/, '')}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={idx} className="text-gray-300 whitespace-pre-wrap">
            {paragraph}
          </p>
        );
      })}
    </div>
  );
}
