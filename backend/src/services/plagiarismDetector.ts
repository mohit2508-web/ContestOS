import * as crypto from "crypto";

interface CodeAnalysis {
  hash: string;
  tokens: string[];
  normalized: string;
  lineCount: number;
  avgLineLength: number;
}

interface ComparisonResult {
  similarity: number;
  method: string;
  tokenSimilarity: number;
  structuralSimilarity: number;
  matchedChunks: Array<{ start: number; end: number; similarity: number }>;
}

interface PlagiarismResult {
  isPlagiarized: boolean;
  similarity: number;
  matches: Array<{
    code: string;
    similarity: number;
    matchPercentage: number;
  }>;
  analysis: {
    tokenSimilarity: number;
    structuralSimilarity: number;
    exactMatch: boolean;
  };
}

const MAX_CACHE_SIZE = 500;
const CODE_DB_MAX_SIZE = 1000;
const CACHE_TTL_MS = 300_000;

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

function evictIfNeeded<K, V>(map: Map<K, V>, maxSize: number): void {
  if (map.size >= maxSize) {
    const keys = [...map.keys()];
    for (let i = 0; i < Math.ceil(maxSize * 0.2); i++) {
      map.delete(keys[i]);
    }
  }
}

function evictExpired<V>(map: Map<string, CacheEntry<V>>): void {
  const now = Date.now();
  for (const [key, entry] of map) {
    if (now >= entry.expiresAt) {
      map.delete(key);
    }
  }
}

function setWithTtl<V>(map: Map<string, CacheEntry<V>>, key: string, value: V, ttlMs: number = CACHE_TTL_MS): void {
  evictIfNeeded(map, MAX_CACHE_SIZE);
  map.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function getWithTtl<V>(map: Map<string, CacheEntry<V>>, key: string): V | undefined {
  const entry = map.get(key);
  if (!entry) return undefined;
  if (Date.now() >= entry.expiresAt) {
    map.delete(key);
    return undefined;
  }
  return entry.value;
}

export class PlagiarismDetector {
  private codeDatabase: Map<string, CodeAnalysis> = new Map();
  private plagiarismCache: Map<string, CacheEntry<PlagiarismResult>> = new Map();

  tokenize(code: string): string[] {
    const tokens: string[] = [];
    const patterns = [
      /\b(if|else|elif|for|while|def|class|return|import|from|as|try|except|finally|with|lambda|yield|async|await)\b/g,
      /[a-zA-Z_][a-zA-Z0-9_]*/g,
      /[+\-*/%=<>!&|^~?:]+/g,
      /[{}\[\]().]/g,
      /".*?"|'.*?'/g,
      /\d+/g,
      /#.*$/gm,
    ];

    const tempCode = code
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/#.*$/gm, "");

    patterns.forEach((pattern) => {
      const matches = tempCode.match(pattern) || [];
      tokens.push(...matches.map((m) => m.toLowerCase()));
    });

    return tokens;
  }

  normalizeCode(code: string): string {
    return code
      .replace(/\s+/g, " ")
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/#.*$/gm, "")
      .replace(/"[^"]*"/g, '"STR"')
      .replace(/'[^']*'/g, "'STR'")
      .replace(/\d+/g, "NUM")
      .trim()
      .toLowerCase();
  }

  analyzeCode(code: string): CodeAnalysis {
    const hash = crypto.createHash("sha256").update(code).digest("hex");
    const tokens = this.tokenize(code);
    const normalized = this.normalizeCode(code);
    const lines = code.split("\n").filter((l) => l.trim());
    const lineCount = lines.length;
    const avgLineLength = lines.reduce((acc, l) => acc + l.length, 0) / Math.max(lineCount, 1);

    return { hash, tokens, normalized, lineCount, avgLineLength };
  }

  jaccardSimilarity(tokens1: string[], tokens2: string[]): number {
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  cosineSimilarity(tokens1: string[], tokens2: string[]): number {
    const allTokens = Array.from(new Set([...tokens1, ...tokens2]));
    const freq1: Map<string, number> = new Map();
    const freq2: Map<string, number> = new Map();

    tokens1.forEach((t) => freq1.set(t, (freq1.get(t) || 0) + 1));
    tokens2.forEach((t) => freq2.set(t, (freq2.get(t) || 0) + 1));

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    allTokens.forEach((token) => {
      const f1 = freq1.get(token) || 0;
      const f2 = freq2.get(token) || 0;
      dotProduct += f1 * f2;
      norm1 += f1 * f1;
      norm2 += f2 * f2;
    });

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2) || 1);
  }

  longestCommonSubsequence(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    return dp[m][n];
  }

  structuralSimilarity(code1: string, code2: string): number {
    const normalized1 = this.normalizeCode(code1);
    const normalized2 = this.normalizeCode(code2);

    const lcsLength = this.longestCommonSubsequence(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);

    return maxLength > 0 ? lcsLength / maxLength : 0;
  }

  compareCodes(code1: string, code2: string): ComparisonResult {
    const analysis1 = this.analyzeCode(code1);
    const analysis2 = this.analyzeCode(code2);

    const tokenSim = this.cosineSimilarity(analysis1.tokens, analysis2.tokens);
    const structSim = this.structuralSimilarity(code1, code2);

    const similarity = tokenSim * 0.6 + structSim * 0.4;

    return {
      similarity: Math.round(similarity * 100) / 100,
      method: "hybrid",
      tokenSimilarity: Math.round(tokenSim * 100) / 100,
      structuralSimilarity: Math.round(structSim * 100) / 100,
      matchedChunks: [],
    };
  }

  checkPlagiarism(
    code: string,
    compareAgainst: string[] = [],
    threshold: number = 0.7
  ): PlagiarismResult {
    const cacheKey = `plagiarism:check:${crypto.createHash('md5').update(code).digest('hex')}:${threshold}:${compareAgainst.length}`;
    const cached = getWithTtl(this.plagiarismCache, cacheKey);
    if (cached) return cached;

    const analysis = this.analyzeCode(code);

    const matches: Array<{ code: string; similarity: number; matchPercentage: number }> = [];

    for (const compareCode of compareAgainst) {
      if (!compareCode || compareCode.trim() === "") continue;

      const comparison = this.compareCodes(code, compareCode);
      const similarity = comparison.similarity;

      if (similarity >= threshold) {
        matches.push({
          code: compareCode.slice(0, 100) + "...",
          similarity: Math.round(similarity * 100) / 100,
          matchPercentage: Math.round(similarity * 100),
        });
      }
    }

    const exactMatch = matches.some((m) => m.similarity >= 0.95);

    const result: PlagiarismResult = {
      isPlagiarized: matches.length > 0 && matches[0].similarity >= threshold,
      similarity: matches.length > 0 ? matches[0].similarity : 0,
      matches: matches.sort((a, b) => b.similarity - a.similarity),
      analysis: {
        tokenSimilarity: matches.length > 0 ? matches[0].similarity : 0,
        structuralSimilarity: matches.length > 0 ? matches[0].similarity : 0,
        exactMatch,
      },
    };

    if (matches.length > 0) {
      const calc = this.compareCodes(code, result.matches[0].code.replace(/\.\.\.$/, ''));
      result.analysis.tokenSimilarity = calc.tokenSimilarity;
      result.analysis.structuralSimilarity = calc.structuralSimilarity;
    }

    setWithTtl(this.plagiarismCache, cacheKey, result);
    return result;
  }

  async checkInDatabase(
    code: string,
    dbQueryFn: (hash: string) => Promise<string[]>
  ): Promise<PlagiarismResult> {
    const analysis = this.analyzeCode(code);

    const similarCodes = await dbQueryFn(analysis.hash);
    const cacheKey = `plagiarism:db:${analysis.hash}:0.6`;
    const cached = getWithTtl(this.plagiarismCache, cacheKey);
    if (cached) return cached;

    const result = this.checkPlagiarism(code, similarCodes, 0.6);
    evictExpired(this.plagiarismCache);
    setWithTtl(this.plagiarismCache, cacheKey, result);
    return result;
  }

  addToDatabase(code: string): string {
    const analysis = this.analyzeCode(code);
    evictIfNeeded(this.codeDatabase, CODE_DB_MAX_SIZE);
    this.codeDatabase.set(analysis.hash, analysis);
    return analysis.hash;
  }

  getDatabaseSize(): number {
    return this.codeDatabase.size;
  }

  clearDatabase(): void {
    this.codeDatabase.clear();
  }

  generateFingerprint(code: string): string {
    const tokens = this.tokenize(code);
    const sortedTokens = [...tokens].sort();
    return crypto
      .createHash("md5")
      .update(sortedTokens.join("|"))
      .digest("hex");
  }
}

export default new PlagiarismDetector();