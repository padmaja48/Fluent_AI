import fs from 'fs';
import path from 'path';

import type { CompanyQuestionEntry, ExperienceLevel } from './promptBuilder';
import {
  getCompanyQuestionsDataDir,
  slugifyCompanyName,
  type CompanyQuestionBankFile,
} from './companyQuestionBank';

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_QUESTIONS_BEFORE_SKIP_AI = 5;

const memoryCache = new Map<string, { fetchedAt: number; bank: CompanyQuestionBankFile }>();

const QUESTION_STARTERS =
  /^(?:tell me|describe|explain|how would|how do|what is|what are|why do|why would|walk me through|can you|could you|given|implement|design|write|discuss|share|talk about|have you|do you|what was|what would|what happens|when would|where would|which|compare|outline|present|solve|find|calculate|analyze|evaluate|justify|define|list|name|state|summarize|if you|suppose|imagine|debug|optimize|refactor|trade.?off)/i;

const NOISE_PATTERNS = [
  /\bclick here\b/i,
  /\bread more\b/i,
  /\bsign in\b/i,
  /\bcookie/i,
  /\bprivacy policy\b/i,
  /\bterms of service\b/i,
  /\binterview experience at\b/i,
  /\b\d+\s*(?:comments|answers|views|upvotes)\b/i,
  /\b(?:glassdoor|leetcode|geeksforgeeks|indeed|ambitionbox|prepinsta)\.com\b/i,
];

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const cleanSnippet = (value: string) =>
  decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const classifyQuestionType = (question: string): CompanyQuestionEntry['type'] => {
  const lower = question.toLowerCase();
  if (/\b(?:design|architecture|scalab|distributed|microservice|system)\b/.test(lower)) return 'system_design';
  if (/\b(?:algorithm|complexity|implement|code|array|tree|graph|linked list|dynamic programming|sort|search|leetcode|hackerrank|coding|dsa|data structure)\b/.test(lower)) {
    return 'coding';
  }
  if (/\b(?:tell me about a time|describe a situation|behavioral|conflict|teamwork|leadership|star|when did you|situation where)\b/.test(lower)) {
    return 'behavioral';
  }
  if (/\b(?:what would you do|scenario|suppose|imagine|if you were|production issue|failure)\b/.test(lower)) {
    return 'situational';
  }
  return 'technical';
};

const normalizeQuestion = (question: string) =>
  question
    .replace(/^[\d.)\-\s]+/, '')
    .replace(/\s+/g, ' ')
    .replace(/\?$/, '?')
    .trim();

const isLikelyInterviewQuestion = (text: string) => {
  const question = normalizeQuestion(text);
  if (question.length < 20 || question.length > 320) return false;
  if (NOISE_PATTERNS.some((pattern) => pattern.test(question))) return false;
  if (!question.endsWith('?') && !QUESTION_STARTERS.test(question)) return false;
  if (/^(?:yes|no|maybe|thanks|hello|hi)\b/i.test(question)) return false;
  return true;
};

export const extractQuestionsFromText = (text: string, source = 'web research'): CompanyQuestionEntry[] => {
  const candidates = new Set<string>();

  const sentenceMatches = text.match(/[^.!?\n]{20,320}[?.!]/g) ?? [];
  sentenceMatches.forEach((match) => {
    const question = normalizeQuestion(match.replace(/[.!]+$/, '?'));
    if (isLikelyInterviewQuestion(question)) candidates.add(question);
  });

  text
    .split(/(?<=[.!?])\s+|[\n•]|(?:\d+[.)]\s+)/g)
    .map((part) => normalizeQuestion(part))
    .filter(isLikelyInterviewQuestion)
    .forEach((question) => candidates.add(question));

  return Array.from(candidates).map((question) => ({
    question,
    type: classifyQuestionType(question),
    source,
  }));
};

const searchDuckDuckGoSnippets = async (query: string) => {
  if (process.env.NODE_ENV === 'test') return [] as string[];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'FluentAIInterviewResearch/2.0' },
    });
    if (!response.ok) return [];

    const html = await response.text();
    return Array.from(
      html.matchAll(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<div[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/div>/gi),
    )
      .map((match) => cleanSnippet(match[1] || match[2] || ''))
      .filter((snippet) => snippet.length > 30);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
};

const buildSearchQueries = (companyLabel: string, role: string) => {
  const year = new Date().getFullYear();
  const prevYear = year - 1;
  return [
    `${companyLabel} ${role} interview questions ${prevYear} ${year}`,
    `${companyLabel} interview experience questions glassdoor ${prevYear}`,
    `${companyLabel} ${role} coding interview leetcode discuss`,
    `${companyLabel} campus placement interview questions geeksforgeeks`,
    `${companyLabel} ${role} HR technical round questions`,
  ];
};

const matchRoleKey = (requestedRole: string, availableRoles: string[]) => {
  const normalized = requestedRole.trim().toLowerCase();
  const exact = availableRoles.find((key) => key.toLowerCase() === normalized);
  if (exact) return exact;

  const partial = availableRoles.find(
    (key) => normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized),
  );
  return partial ?? 'Software Engineer';
};

const readCachedBank = (slug: string): CompanyQuestionBankFile | null => {
  const filePath = path.join(getCompanyQuestionsDataDir(), `${slug}.json`);
  if (!fs.existsSync(filePath)) return null;

  try {
    const bank = JSON.parse(fs.readFileSync(filePath, 'utf8')) as CompanyQuestionBankFile & {
      fetchedAt?: string;
      source?: string;
    };
    if (!bank.fetchedAt) return bank;
    const age = Date.now() - new Date(bank.fetchedAt).getTime();
    return age <= CACHE_TTL_MS ? bank : null;
  } catch {
    return null;
  }
};

const writeCachedBank = (slug: string, bank: CompanyQuestionBankFile & { fetchedAt?: string; source?: string }) => {
  const dir = getCompanyQuestionsDataDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${slug}.json`), `${JSON.stringify(bank, null, 2)}\n`, 'utf8');
};

const dedupeQuestions = (entries: CompanyQuestionEntry[]) => {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = entry.question.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export type EnsureCompanyQuestionsInput = {
  companyName: string;
  companyLabel?: string;
  role: string;
  experienceLevel: ExperienceLevel;
  forceRefresh?: boolean;
};

export const fetchCompanyQuestionsFromWeb = async ({
  companyLabel,
  role,
  experienceLevel,
}: {
  companyLabel: string;
  role: string;
  experienceLevel: ExperienceLevel;
}): Promise<CompanyQuestionEntry[]> => {
  const queries = buildSearchQueries(companyLabel, role);
  const snippets: string[] = [];

  for (const query of queries) {
    snippets.push(...(await searchDuckDuckGoSnippets(query)));
  }

  const combined = snippets.join('\n');
  const extracted = dedupeQuestions(extractQuestionsFromText(combined, `web ${new Date().getFullYear()}`));

  if (experienceLevel === 'fresher') {
    return extracted.filter(
      (entry) => entry.type !== 'system_design' || /lite|basic|high level|overview/i.test(entry.question),
    );
  }

  return extracted;
};

export const ensureCompanyQuestions = async ({
  companyName,
  companyLabel,
  role,
  experienceLevel,
  forceRefresh = false,
}: EnsureCompanyQuestionsInput): Promise<{
  questions: CompanyQuestionEntry[];
  mode: 'verified' | 'web_research' | 'generic';
  companyLabel: string;
  fromCache: boolean;
}> => {
  const slug = slugifyCompanyName(companyName);
  const label = companyLabel ?? companyName;
  const cacheKey = `${slug}:${role}:${experienceLevel}`;

  if (!forceRefresh) {
    const memory = memoryCache.get(cacheKey);
    if (memory && Date.now() - memory.fetchedAt <= CACHE_TTL_MS) {
      const roleKey = matchRoleKey(role, Object.keys(memory.bank.roles));
      const entries =
        memory.bank.roles[roleKey]?.[experienceLevel] ??
        memory.bank.roles[roleKey]?.experienced ??
        memory.bank.roles[roleKey]?.fresher ??
        [];
      if (entries.length) {
        return { questions: entries, mode: 'web_research', companyLabel: label, fromCache: true };
      }
    }

    const cached = readCachedBank(slug);
    if (cached) {
      memoryCache.set(cacheKey, { fetchedAt: Date.now(), bank: cached });
      const roleKey = matchRoleKey(role, Object.keys(cached.roles));
      const entries =
        cached.roles[roleKey]?.[experienceLevel] ??
        cached.roles[roleKey]?.experienced ??
        cached.roles[roleKey]?.fresher ??
        [];
      if (entries.length) {
        return { questions: entries, mode: 'web_research', companyLabel: label, fromCache: true };
      }
    }
  }

  const researched = await fetchCompanyQuestionsFromWeb({ companyLabel: label, role, experienceLevel });
  if (researched.length) {
    const roleKey = matchRoleKey(role, ['Software Engineer', role]);
    const bank: CompanyQuestionBankFile & { fetchedAt: string; source: string } = {
      company: label,
      fetchedAt: new Date().toISOString(),
      source: 'web_research',
      roles: {
        [roleKey]: {
          [experienceLevel]: researched,
        },
      },
    };

    const existing = readCachedBank(slug);
    if (existing) {
      bank.roles = {
        ...existing.roles,
        [roleKey]: {
          ...(existing.roles[roleKey] ?? {}),
          [experienceLevel]: dedupeQuestions([
            ...(existing.roles[roleKey]?.[experienceLevel] ?? []),
            ...researched,
          ]),
        },
      };
    }

    writeCachedBank(slug, bank);
    memoryCache.set(cacheKey, { fetchedAt: Date.now(), bank });

    return {
      questions: researched,
      mode: 'web_research',
      companyLabel: label,
      fromCache: false,
    };
  }

  return { questions: [], mode: 'generic', companyLabel: label, fromCache: false };
};

export const companyQuestionsToGenerated = (
  entries: CompanyQuestionEntry[],
  companyLabel: string,
): import('./ai.service').GeneratedQuestion[] =>
  entries.map((entry, index) => ({
    question: entry.question,
    expectedSignals:
      entry.type === 'behavioral'
        ? ['STAR structure', 'specific example', 'clear outcome']
        : entry.type === 'coding'
        ? ['approach explanation', 'complexity analysis', 'edge cases']
        : entry.type === 'system_design'
        ? ['components and flow', 'trade-offs', 'scalability considerations']
        : ['accurate explanation', 'practical example', 'role relevance'],
    questionType:
      entry.type === 'behavioral'
        ? 'behavioural'
        : entry.type === 'situational'
        ? 'situational'
        : 'technical',
    resumeReference: `${companyLabel} reported question (${entry.source ?? 'web research'})`,
    difficulty:
      entry.type === 'coding' || entry.type === 'system_design'
        ? 'medium-hard'
        : entry.type === 'behavioral'
        ? 'behavioral'
        : index === 0
        ? 'easy'
        : 'medium',
    topic: `${companyLabel} interview pattern`,
    followUpIntent: 'deepen' as const,
  }));

export const hasEnoughCompanyQuestions = (count: number) => count >= MIN_QUESTIONS_BEFORE_SKIP_AI;

export { MIN_QUESTIONS_BEFORE_SKIP_AI };
