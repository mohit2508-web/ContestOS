/**
 * Formats problem description by cleaning Base64 image URLs, placing Input/Output Format
 * at their appropriate place above Examples, and injecting Main, Example 1, Example 2,
 * and Example 3 figures at their exact correct locations.
 */
export const formatProblemDescriptionWithImages = (description: string, imagesInput: any): string => {
  let desc = description || '';
  let images = imagesInput || {};
  if (typeof images === 'string') {
    try { images = JSON.parse(images); } catch (e) {}
  }
  if (typeof images !== 'object' || !images) return desc;

  const cleanUrl = (url: any): string => {
    if (typeof url !== 'string') return '';
    let u = url.trim();
    if (u.startsWith('data:image/')) {
      u = u.replace(/[\r\n\s]+/g, '');
    }
    return u;
  };

  const isValidUrl = (url: string) => {
    return url.length > 5 && (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('data:image/') ||
      url.startsWith('/uploads/') ||
      url.startsWith('/api/uploads/') ||
      url.startsWith('blob:')
    );
  };

  // 1. Strip any existing figure markdown tags and conflicting raw ``` codeblock wrappers around examples
  desc = desc.replace(/^>\s*/gm, ''); // strip any accidental leading blockquote markers from entire text
  desc = desc.replace(/```\s*\n\s*(Input:[\s\S]*?)```/gi, (_m, inner) => inner.trim()); // strip ``` around Input/Output blocks
  desc = desc.replace(/```/g, ''); // strip any remaining raw codeblock ticks in example sections
  desc = desc.replace(/!\[(Example \d+|Main|Figure).*?\]\(.*?\)\n\n?/gi, '');

  // 1.5 Reorder Input Format & Output Format: Move them up above Examples / Main Figure
  const inputFormatRegex = /(?:\n\n|\n)?(?:\*\*|###)?\s*Input\s*Format\s*\(stdin\)[:\-.]*[\s\S]*?(?=(?:\*\*|###)?\s*Output\s*Format|(?:\*\*|###)?\s*Example|(?:\*\*|###)?\s*Constraints|$)/i;
  const outputFormatRegex = /(?:\n\n|\n)?(?:\*\*|###)?\s*Output\s*Format\s*\(stdout\)[:\-.]*[\s\S]*?(?=(?:\*\*|###)?\s*Example|(?:\*\*|###)?\s*Constraints|$)/i;

  let inputFormatBlock = '';
  let outputFormatBlock = '';

  const inputMatch = desc.match(inputFormatRegex);
  if (inputMatch) {
    inputFormatBlock = inputMatch[0].trim();
    desc = desc.replace(inputFormatRegex, '');
  }

  const outputMatch = desc.match(outputFormatRegex);
  if (outputMatch) {
    outputFormatBlock = outputMatch[0].trim();
    desc = desc.replace(outputFormatRegex, '');
  }

  const formatSection = [inputFormatBlock, outputFormatBlock].filter(Boolean).join('\n\n');

  if (formatSection) {
    const ex1Regex = /(?:###\s*|\*\*\s*)?Example\s*1\b[:\-.]*\s*(?:\*\*)?[:\-.]*/i;
    const constraintsRegex = /(?:###\s*|\*\*\s*)?Constraints\b[:\-.]*\s*(?:\*\*)?[:\-.]*/i;
    if (ex1Regex.test(desc)) {
      desc = desc.replace(ex1Regex, (match) => `${formatSection}\n\n${match}`);
    } else if (constraintsRegex.test(desc)) {
      desc = desc.replace(constraintsRegex, (match) => `${formatSection}\n\n${match}`);
    } else {
      desc += `\n\n${formatSection}\n\n`;
    }
  }

  const mainUrl = cleanUrl(images.main);
  const ex1Url = cleanUrl(images.example1);
  const ex2Url = cleanUrl(images.example2);
  const ex3Url = cleanUrl(images.example3);

  // 2. Inject Main Figure before Example 1 heading (or before Constraints / top of description)
  if (isValidUrl(mainUrl) && !desc.includes(mainUrl)) {
    const ex1Regex = /(?:###\s*|\*\*\s*)?Example\s*1\b[:\-.]*\s*(?:\*\*)?[:\-.]*/i;
    const constraintsRegex = /(?:###\s*|\*\*\s*)?Constraints\b[:\-.]*\s*(?:\*\*)?[:\-.]*/i;
    if (ex1Regex.test(desc)) {
      desc = desc.replace(ex1Regex, (match) => `![Main Figure](${mainUrl})\n\n${match}`);
    } else if (constraintsRegex.test(desc)) {
      desc = desc.replace(constraintsRegex, (match) => `![Main Figure](${mainUrl})\n\n${match}`);
    } else {
      desc = `![Main Figure](${mainUrl})\n\n${desc}`;
    }
  }

  // 3. Inject Example 1 Figure under Example 1 heading
  if (isValidUrl(ex1Url) && !desc.includes(ex1Url)) {
    const ex1Regex = /(?:###\s*|\*\*\s*)?Example\s*1\b[:\-.]*\s*(?:\*\*)?[:\-.]*/i;
    if (ex1Regex.test(desc)) {
      desc = desc.replace(ex1Regex, (match) => `${match}\n\n![Example 1 Figure](${ex1Url})\n\n`);
    } else {
      desc += `\n\n![Example 1 Figure](${ex1Url})\n\n`;
    }
  }

  // 4. Inject Example 2 Figure under Example 2 heading
  if (isValidUrl(ex2Url) && !desc.includes(ex2Url)) {
    const ex2Regex = /(?:###\s*|\*\*\s*)?Example\s*2\b[:\-.]*\s*(?:\*\*)?[:\-.]*/i;
    if (ex2Regex.test(desc)) {
      desc = desc.replace(ex2Regex, (match) => `${match}\n\n![Example 2 Figure](${ex2Url})\n\n`);
    } else {
      desc += `\n\n![Example 2 Figure](${ex2Url})\n\n`;
    }
  }

  // 5. Inject Example 3 Figure under Example 3 heading
  if (isValidUrl(ex3Url) && !desc.includes(ex3Url)) {
    const ex3Regex = /(?:###\s*|\*\*\s*)?Example\s*3\b[:\-.]*\s*(?:\*\*)?[:\-.]*/i;
    if (ex3Regex.test(desc)) {
      desc = desc.replace(ex3Regex, (match) => `${match}\n\n![Example 3 Figure](${ex3Url})\n\n`);
    } else {
      desc += `\n\n![Example 3 Figure](${ex3Url})\n\n`;
    }
  }

  // 6. Clean up line wrapping for blockquote lines: ensure empty lines around blockquotes & image tags
  let lines = desc.split('\n');
  let inExampleBlock = false;
  let resultLines: string[] = [];
  for (let line of lines) {
    const trimmed = line.trim();
    if (/^\s*(\*\*|\*)?(Input|Output|Explanation):/i.test(line)) {
      inExampleBlock = true;
      resultLines.push(`> ${line.replace(/\r$/, '')}  `);
    } else if (inExampleBlock && (trimmed === '' || /^\s*(\*\*|\*)?(Example|\d+|Constraints|Main|Input Format|Output Format|!\[)/i.test(line))) {
      inExampleBlock = false;
      resultLines.push(''); // add empty line to close blockquote container
      resultLines.push(line);
    } else if (inExampleBlock) {
      resultLines.push(`> ${line.replace(/\r$/, '')}  `);
    } else {
      resultLines.push(line);
    }
  }

  return resultLines.join('\n');
};
