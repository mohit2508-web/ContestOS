import React from 'react';

interface Props {
  content: string;
}

export default function MarkdownRenderer({ content }: Props) {
  if (!content) return null;
  console.log("[Kryptavia OS] MarkdownRenderer v2.0 active");

  // Clean multiline image URLs (especially Base64 data URLs containing newlines/spaces)
  let normalizedContent = String(content || '')
    .replace(/!\[([^\]\r\n]+)\]\((data:image\/[A-Za-z0-9+/=\r\n\s]+)\)/gi, (_m, alt, src) => {
      return `![${alt.trim()}](${src.replace(/[\r\n\s]+/g, '')})`;
    })
    .replace(/!\[([\s\S]*?)\]\((data:image\/[\s\S]*?)\)/gi, (_m, alt, src) => {
      return `![${alt.trim()}](${src.replace(/[\r\n\s]+/g, '')})`;
    });

  const lines = normalizedContent.split('\n');
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
    // Match any markdown image tag ![alt](src)
    const imgRegex = /!\[(.*?)\]\((.*?)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = imgRegex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push(parseFormattedText(text.substring(lastIdx, match.index)));
      }
      const imgSrc = match[2].startsWith('data:image/') ? match[2].replace(/[\r\n\s]+/g, '') : match[2].trim();
      parts.push(
        <span key={`img-${match.index}`} className="block my-3 text-center w-full">
          <img
            src={imgSrc}
            alt={match[1] || 'Figure'}
            className="max-w-[90%] max-h-72 rounded-xl border border-white/15 shadow-2xl inline-block object-contain bg-zinc-950 p-2"
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

  let tableBuffer: string[] = [];

  const flushTableBuffer = (keyIdx: number) => {
    if (tableBuffer.length > 0) {
      const rows = tableBuffer.map(r => r.split('|').map(c => c.trim()).filter(Boolean));
      // Filter out divider line e.g. ["---", "---"]
      const validRows = rows.filter(row => !row.every(cell => /^[-:]+$/.test(cell)));

      if (validRows.length > 0) {
        const headers = validRows[0];
        const bodyRows = validRows.slice(1);

        elements.push(
          <div key={`table-group-${keyIdx}`} className="my-4 overflow-x-auto rounded-xl border border-white/15 bg-[#10111a] shadow-2xl">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-gradient-to-r from-white/[0.08] to-white/[0.02] border-b border-white/15">
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="px-4 py-2.5 font-mono font-bold text-amber-400 uppercase tracking-wider text-[11px]">
                      {parseInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-white/[0.03] transition-colors">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-4 py-2.5 font-mono text-gray-300 whitespace-nowrap">
                        {cell.toLowerCase() === 'int' || cell.toLowerCase() === 'integer' ? (
                          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-bold">int</span>
                        ) : cell.toLowerCase() === 'varchar' || cell.toLowerCase() === 'string' ? (
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">varchar</span>
                        ) : cell.toLowerCase() === 'datetime' || cell.toLowerCase() === 'date' ? (
                          <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded text-[10px] font-bold">datetime</span>
                        ) : (
                          parseInline(cell)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      tableBuffer = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      flushQuoteBuffer(index);
      flushTableBuffer(index);
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

    // Markdown Table detection
    if (trimmed.startsWith('|')) {
      flushQuoteBuffer(index);
      tableBuffer.push(trimmed);
      return;
    } else {
      flushTableBuffer(index);
    }

    // Table Header section detection e.g. Table: Employee or **Table: Employee**
    if (/^(#|\*\*)*\s*(Table|Entity):\s*/i.test(trimmed)) {
      flushTableBuffer(index);
      flushQuoteBuffer(index);
      const tableName = trimmed.replace(/^(#|\*\*)*\s*(Table|Entity):\s*/i, '').replace(/\**/g, '').trim();
      elements.push(
        <div key={`table-title-${index}`} className="mt-5 mb-2 flex items-center gap-2">
          <div className="p-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
          </div>
          <h3 className="text-sm font-bold text-white font-mono">Table: {tableName}</h3>
        </div>
      );
      return;
    }

    const unquotedCandidate = trimmed.replace(/^>\s*/, '');
    const isHeaderCandidate = /^(\*\*|###)?\s*(Example|Constraints|Input Format|Output Format)/i.test(unquotedCandidate);

    // Check if line contains a standalone Markdown Image tag
    const isImgMatch = unquotedCandidate.match(/!\[(.*?)\]\((data:image\/[^\s)]+|https?:\/\/[^\s)]+|\/uploads\/[^\s)]+|blob:[^\s)]+)\)/i);
    if (isImgMatch) {
      flushQuoteBuffer(index);
      flushTableBuffer(index);
      const altText = isImgMatch[1] || 'Figure';
      const rawSrc = isImgMatch[2];
      const imgSrc = rawSrc.startsWith('data:image/') ? rawSrc.replace(/[\r\n\s]+/g, '') : rawSrc.trim();
      elements.push(
        <div key={`img-line-${index}`} className="my-4 flex justify-center w-full">
          <img
            src={imgSrc}
            alt={altText}
            className="max-w-[90%] max-h-72 rounded-xl border border-white/15 shadow-2xl object-contain bg-zinc-950 p-2"
          />
        </div>
      );
      return;
    }

    // Blockquote handling (groups consecutive lines starting with > into one styled card)
    if (trimmed.startsWith('>') && !isHeaderCandidate) {
      quoteBuffer.push(trimmed.replace(/^>\s*/, ''));
      return;
    } else {
      flushQuoteBuffer(index);
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

  // Flush remaining buffers
  flushQuoteBuffer(lines.length);
  flushTableBuffer(lines.length);

  return <div className="prose prose-invert max-w-none text-sm space-y-1">{elements}</div>;
}
