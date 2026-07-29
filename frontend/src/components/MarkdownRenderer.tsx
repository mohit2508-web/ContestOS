import React from 'react';

interface Props {
  content: string;
}

export default function MarkdownRenderer({ content }: Props) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  let quoteBuffer: string[] = [];

  const parseFormattedText = (str: string): React.ReactNode[] => {
    // Regex splits by **bold**, `inline code`, or *italic*
    const tokens = str.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);
    return tokens.map((token, i) => {
      if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
        return (
          <strong key={i} className="font-bold text-white">
            {token.slice(2, -2)}
          </strong>
        );
      }
      if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
        return (
          <code key={i} className="bg-white/10 text-amber-300 font-mono text-xs px-1.5 py-0.5 rounded border border-white/10">
            {token.slice(1, -1)}
          </code>
        );
      }
      if (token.startsWith('*') && token.endsWith('*') && token.length >= 2 && !token.startsWith('**')) {
        return (
          <em key={i} className="italic text-gray-200">
            {token.slice(1, -1)}
          </em>
        );
      }
      return token;
    });
  };

  const parseInline = (text: string): React.ReactNode => {
    // If text contains markdown image syntax ![alt](src) anywhere
    const imgRegex = /!\[(.*?)\]\((.*?)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = imgRegex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push(parseFormattedText(text.substring(lastIdx, match.index)));
      }
      parts.push(
        <span key={`img-${match.index}`} className="block my-2.5 text-center">
          <img
            src={match[2]}
            alt={match[1] || 'Figure'}
            className="max-w-[85%] max-h-56 rounded-xl border border-white/10 shadow-lg inline-block object-contain bg-black/40 p-1.5"
          />
        </span>
      );
      lastIdx = imgRegex.lastIndex;
    }

    if (parts.length > 0) {
      if (lastIdx < text.length) {
        parts.push(parseFormattedText(text.substring(lastIdx)));
      }
      return parts;
    }

    return parseFormattedText(text);
  };

  const flushQuoteBuffer = (keyIdx: number) => {
    if (quoteBuffer.length > 0) {
      elements.push(
        <div key={`quote-group-${keyIdx}`} className="bg-[#0b0c14] border border-white/10 rounded-xl p-3.5 my-3 font-mono text-xs text-amber-300 leading-relaxed shadow-xl space-y-1 overflow-x-auto">
          {quoteBuffer.map((qLine, qIdx) => (
            <div key={qIdx} className="whitespace-pre-wrap">{parseInline(qLine)}</div>
          ))}
        </div>
      );
      quoteBuffer = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      flushQuoteBuffer(index);
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${index}`} className="bg-black/50 border border-white/10 rounded-lg p-2.5 my-1.5 overflow-x-auto font-mono text-xs text-amber-300 leading-snug shadow-inner">
            <code>{codeBuffer.join('\n')}</code>
          </pre>
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    // Blockquote handling (groups consecutive lines starting with > into one styled card)
    if (trimmed.startsWith('>')) {
      quoteBuffer.push(trimmed.replace(/^>\s*/, ''));
      return;
    } else {
      flushQuoteBuffer(index);
    }

    // Standalone Markdown Image line
    const standaloneImgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (standaloneImgMatch) {
      elements.push(
        <div key={`img-line-${index}`} className="my-2.5 flex justify-center">
          <img
            src={standaloneImgMatch[2]}
            alt={standaloneImgMatch[1] || 'Figure'}
            className="max-w-[85%] max-h-56 rounded-xl border border-white/10 shadow-lg object-contain bg-black/40 p-1.5"
          />
        </div>
      );
      return;
    }

    if (line.startsWith('# ')) {
      elements.push(<h1 key={index} className="text-2xl font-extrabold text-white my-3 tracking-tight">{parseInline(line.replace(/^#\s+/, ''))}</h1>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={index} className="text-xl font-bold text-white my-2.5 tracking-tight">{parseInline(line.replace(/^##\s+/, ''))}</h2>);
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={index} className="text-base font-bold text-white my-2">{parseInline(line.replace(/^###\s+/, ''))}</h3>);
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <li key={index} className="text-sm text-gray-300 ml-4 list-disc my-1 leading-relaxed">
          {parseInline(trimmed.replace(/^[-*]\s+/, ''))}
        </li>
      );
    } else if (trimmed.length > 0) {
      elements.push(
        <div key={index} className="text-sm text-gray-300 leading-relaxed my-1 whitespace-pre-wrap">
          {parseInline(line)}
        </div>
      );
    }
  });

  // Flush remaining quotes if any
  flushQuoteBuffer(lines.length);

  return <div className="prose prose-invert max-w-none text-sm space-y-1">{elements}</div>;
}
