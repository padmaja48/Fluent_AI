import OpenAI from 'openai';
import { env } from '../config/env';
import { ReadingPassagePool, type IReadingPassagePoolEntry } from '../models/ReadingPassagePool';

const openai = env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_BASE_URL })
  : null;
const groq = env.GROQ_API_KEY
  ? new OpenAI({ apiKey: env.GROQ_API_KEY, baseURL: env.GROQ_BASE_URL })
  : null;

export type ReadingGenre =
  | 'narrative'
  | 'expository'
  | 'argumentative'
  | 'biographical'
  | 'scientific'
  | 'business-case'
  | 'historical'
  | 'news-report'
  | 'dialogue-based';

export type DifficultyTier = 'Beginner' | 'Intermediate' | 'Advanced';

export type StructuralStyle =
  | 'opens-with-question'
  | 'opens-with-statistic'
  | 'opens-with-anecdote'
  | 'opens-with-definition'
  | 'chronological'
  | 'thematic'
  | 'first-person'
  | 'third-person'
  | 'objective-report';

export type RecentPassageRecord = {
  openingLine: string;
  topicDomain: string;
  genre: ReadingGenre;
  statisticSnippet?: string;
  createdAt: number;
};

export type PassageBrief = {
  genre: ReadingGenre;
  topicDomain: string;
  structuralStyle: StructuralStyle;
  difficultyTier: DifficultyTier;
  wordCountRange: [number, number];
  cefrLevel: string;
  context?: string;
  seed: number;
  exclusions: RecentPassageRecord[];
};

export type GeneratedPassagePayload = {
  title: string;
  passageText: string;
  genre: ReadingGenre;
  topicDomain: string;
  structuralStyle: StructuralStyle;
  difficultyTier: DifficultyTier;
  vocabularyTerm?: string;
  vocabularyMeaning?: string;
  inferenceAnchor?: string;
  mainIdea?: string;
  keyDetail?: string;
};

export type ReadingCompetency =
  | 'skim reading'
  | 'specific detail'
  | 'vocabulary in context'
  | 'author purpose'
  | 'logical connection';

export type ReadingItemOutput = {
  title: string;
  passageText: string;
  stem: string;
  correctAnswer: string;
  distractors: string[];
  explanation: string;
  competency?: string;
};

export const READING_GENRES: ReadingGenre[] = [
  'narrative',
  'expository',
  'argumentative',
  'biographical',
  'scientific',
  'business-case',
  'historical',
  'news-report',
  'dialogue-based',
];

export const TOPIC_DOMAINS = [
  'science',
  'environment',
  'technology',
  'history',
  'workplace',
  'health',
  'culture',
  'psychology',
  'current affairs',
  'arts',
  'sports',
  'education',
  'urban planning',
  'economics',
  'architecture',
] as const;

export const STRUCTURAL_STYLES: StructuralStyle[] = [
  'opens-with-question',
  'opens-with-statistic',
  'opens-with-anecdote',
  'opens-with-definition',
  'chronological',
  'thematic',
  'first-person',
  'third-person',
  'objective-report',
];

export const META_BANNED_PHRASES = [
  'taken together, the passage suggests',
  'the writer leaves one conclusion implicit rather than stating it directly',
  'several phrases reward careful rereading rather than skimming',
  'context clues help infer the writer\'s underlying assumption',
  'the passage mixes concrete examples with broader claims',
  'readers should notice how details across paragraphs connect',
  'three themes recur whenever',
  'the sequence begins in',
  'the passage groups evidence by concept',
  'the text rewards synthesis across paragraphs',
  'careful reading—not guessing from one sentence',
  'careful reading-not guessing from one sentence',
];

export const BANNED_PHRASES = [
  'increased participation by forty percent',
  'it was a big problem for everyone',
  'now things are better',
  'my name is',
  'i decided to help',
  'we have increased participation',
  ...META_BANNED_PHRASES,
];

export const DEFAULT_POOL_SIZE_PER_TIER = 250;
const MAX_RECENT_PASSAGES = 30;
const BATCH_DELAY_MS = 750;

const recentPassages: RecentPassageRecord[] = [];
let poolCache: Map<DifficultyTier, GeneratedPassagePayload[]> | null = null;

const DIFFICULTY_BY_CEFR: Record<string, DifficultyTier> = {
  A1: 'Beginner',
  A2: 'Beginner',
  B1: 'Intermediate',
  B2: 'Intermediate',
  C1: 'Advanced',
  C2: 'Advanced',
};

const CEFR_BY_TIER: Record<DifficultyTier, string[]> = {
  Beginner: ['A1', 'A2'],
  Intermediate: ['B1', 'B2'],
  Advanced: ['C1', 'C2'],
};

const WORD_COUNT_BY_TIER: Record<DifficultyTier, [number, number]> = {
  Beginner: [120, 180],
  Intermediate: [200, 300],
  Advanced: [300, 450],
};

const CEFR_VOCAB_GUIDANCE: Record<DifficultyTier, string> = {
  Beginner:
    'Use CEFR A1-A2 vocabulary: common everyday words, mostly short-to-medium sentences, mostly explicit literal information.',
  Intermediate:
    'Use CEFR B1-B2 vocabulary: include some academic or less-common words, mix sentence lengths with occasional complex sentences, include light inference.',
  Advanced:
    'Use CEFR C1-C2 vocabulary: sophisticated and domain-specific terms where appropriate, longer complex sentences with subordinate clauses, denser information requiring inference and synthesis.',
};

const VOCABULARY_BANK: Record<DifficultyTier, Array<{ term: string; meaning: string; wrong: string[] }>> = {
  Beginner: [
    { term: 'routine', meaning: 'a regular way of doing things', wrong: ['a sudden surprise', 'a formal punishment', 'a type of food'] },
    { term: 'notice', meaning: 'to become aware of something', wrong: ['to forget completely', 'to sell publicly', 'to travel quickly'] },
    { term: 'local', meaning: 'belonging to a nearby area', wrong: ['from another country', 'very expensive', 'impossible to reach'] },
    { term: 'support', meaning: 'help or assistance', wrong: ['a type of competition', 'a legal penalty', 'a musical instrument'] },
    { term: 'simple', meaning: 'easy to understand', wrong: ['very dangerous', 'extremely rare', 'officially forbidden'] },
  ],
  Intermediate: [
    { term: 'initiative', meaning: 'a new plan or action to achieve something', wrong: ['a problem that cannot be solved', 'a type of financial penalty', 'a formal complaint'] },
    { term: 'assess', meaning: 'to evaluate or judge the quality of something', wrong: ['to ignore completely', 'to celebrate publicly', 'to replace immediately'] },
    { term: 'sustainable', meaning: 'able to continue for a long time without causing harm', wrong: ['very expensive to maintain', 'impossible to repeat', 'only useful in the short term'] },
    { term: 'transparent', meaning: 'open and easy to understand', wrong: ['secret and difficult to access', 'physically see-through only', 'very complicated to explain'] },
    { term: 'collaborate', meaning: 'to work together with others', wrong: ['to compete against others', 'to work completely alone', 'to give up on a task'] },
  ],
  Advanced: [
    { term: 'tentative', meaning: 'not certain or final', wrong: ['completely decided', 'very confident', 'officially approved'] },
    { term: 'facilitate', meaning: 'to make a process easier or help it happen', wrong: ['to stop a process from starting', 'to take complete control', 'to formally object to a plan'] },
    { term: 'paradigm', meaning: 'a typical pattern or model of thinking', wrong: ['a minor spelling error', 'a temporary emotion', 'a physical barrier'] },
    { term: 'contentious', meaning: 'likely to cause disagreement', wrong: ['widely accepted without debate', 'completely irrelevant', 'purely decorative'] },
    { term: 'corroborate', meaning: 'to confirm with supporting evidence', wrong: ['to contradict directly', 'to ignore silently', 'to exaggerate for effect'] },
  ],
};

const pick = <T,>(items: T[], seed: number, salt = 0): T => items[(seed + salt) % items.length];

export const hashSeed = (...parts: Array<string | number>): number => {
  const raw = parts.join(':');
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const countWords = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

const firstLine = (text: string): string => text.trim().split(/\n+/)[0]?.trim() ?? '';

export const normalizeOpening = (line: string): string =>
  line
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 6)
    .join(' ');

const extractStatisticSnippet = (text: string): string | undefined => {
  const match = text.match(/\b\d{1,3}(?:\.\d+)?\s*(?:percent|%|million|billion|thousand)\b/i);
  return match?.[0]?.toLowerCase();
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const getPoolSizeFromEnv = (): number => {
  const raw = process.env.READING_POOL_SIZE;
  if (!raw) return DEFAULT_POOL_SIZE_PER_TIER;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_POOL_SIZE_PER_TIER;
};

export const mapCefrToDifficultyTier = (cefrLevel: string): DifficultyTier =>
  DIFFICULTY_BY_CEFR[cefrLevel] ?? 'Intermediate';

export const getWordCountRangeForTier = (tier: DifficultyTier): [number, number] => WORD_COUNT_BY_TIER[tier];

const entryToPayload = (entry: IReadingPassagePoolEntry | GeneratedPassagePayload): GeneratedPassagePayload => ({
  title: entry.title,
  passageText: entry.passageText,
  genre: entry.genre,
  topicDomain: entry.topicDomain,
  structuralStyle: entry.structuralStyle,
  difficultyTier: entry.difficultyTier,
  vocabularyTerm: entry.vocabularyTerm,
  vocabularyMeaning: entry.vocabularyMeaning,
  inferenceAnchor: entry.inferenceAnchor,
  mainIdea: entry.mainIdea,
  keyDetail: entry.keyDetail,
});

export const selectContentBrief = (input: {
  cefrLevel: string;
  context?: string;
  seed: number;
  recent?: RecentPassageRecord[];
}): PassageBrief => {
  const difficultyTier = mapCefrToDifficultyTier(input.cefrLevel);
  const seed = input.seed;
  const recent = input.recent ?? getRecentPassages();
  const recentGenres = recent.slice(0, 3).map((item) => item.genre);
  const recentTopics = recent.slice(0, 5).map((item) => item.topicDomain);

  let genre = pick(READING_GENRES, seed, 3);
  let topicDomain = pick([...TOPIC_DOMAINS], seed, 11);
  let guard = 0;
  while (guard < 12 && (recentGenres.includes(genre) || recentTopics.includes(topicDomain))) {
    genre = pick(READING_GENRES, seed, 3 + guard * 5);
    topicDomain = pick([...TOPIC_DOMAINS], seed, 11 + guard * 7);
    guard += 1;
  }

  return {
    genre,
    topicDomain,
    structuralStyle: pick(STRUCTURAL_STYLES, seed, 17),
    difficultyTier,
    wordCountRange: getWordCountRangeForTier(difficultyTier),
    cefrLevel: input.cefrLevel,
    context: input.context,
    seed,
    exclusions: recent,
  };
};

export const buildPassagePrompt = (brief: PassageBrief): { systemPrompt: string; userPrompt: string } => {
  const [minWords, maxWords] = brief.wordCountRange;
  const exclusionLines = brief.exclusions.slice(0, 12).map((item, idx) => {
    const stat = item.statisticSnippet ? ` statistic "${item.statisticSnippet}"` : '';
    return `${idx + 1}. genre=${item.genre}, topic=${item.topicDomain}, opening="${item.openingLine.slice(0, 90)}"${stat}`;
  });

  const systemPrompt = [
    'You write original English reading-comprehension passages for language learners.',
    'Return strict JSON only. Do not include markdown.',
    CEFR_VOCAB_GUIDANCE[brief.difficultyTier],
    'Write only the passage itself — never meta-commentary about "the passage", "the reader", "careful reading", "context clues", or test instructions.',
    'Avoid formulaic problem-solution-happy-ending arcs unless genre is narrative and even then vary framing.',
    'Never reuse specific statistics, names, or phrasing patterns from the exclusion list.',
    `Banned phrases: ${BANNED_PHRASES.join('; ')}.`,
  ].join(' ');

  const userPrompt = [
    `Write an original ${brief.genre} passage about ${brief.topicDomain}.`,
    `CEFR level: ${brief.cefrLevel}. Difficulty tier: ${brief.difficultyTier}.`,
    `Structural style: ${brief.structuralStyle}. Target length: ${minWords}-${maxWords} words.`,
    brief.context ? `Optional learner context theme: ${brief.context}.` : '',
    'Requirements:',
    '- Use varied sentence openings and natural compound/complex sentences appropriate to the tier.',
    '- Include some information the audience must infer or connect across sentences, but do this inside the content — do not explain that you are doing it.',
    '- Do NOT use a community-helper narrative unless genre is biographical and topic fits.',
    '- Do NOT include round participation statistics or generic filler such as "things are better now".',
    '- Do NOT mention "the passage", "the reader", "careful rereading", or reading-test strategy in the passage text.',
    exclusionLines.length
      ? `Avoid repeating these recent passages:\n${exclusionLines.join('\n')}`
      : 'No recent passages to avoid.',
    'Return JSON with keys:',
    '{ "title": string, "passageText": string, "vocabularyTerm": string, "vocabularyMeaning": string, "inferenceAnchor": string, "mainIdea": string, "keyDetail": string }',
  ]
    .filter(Boolean)
    .join('\n');

  return { systemPrompt, userPrompt };
};

export const getRecentPassages = (): RecentPassageRecord[] => [...recentPassages];

export const clearRecentPassages = (): void => {
  recentPassages.length = 0;
};

export const recordRecentPassage = (payload: GeneratedPassagePayload): RecentPassageRecord => {
  const record: RecentPassageRecord = {
    openingLine: firstLine(payload.passageText),
    topicDomain: payload.topicDomain,
    genre: payload.genre,
    statisticSnippet: extractStatisticSnippet(payload.passageText),
    createdAt: Date.now(),
  };
  recentPassages.unshift(record);
  if (recentPassages.length > MAX_RECENT_PASSAGES) {
    recentPassages.length = MAX_RECENT_PASSAGES;
  }
  return record;
};

export const containsBannedPhrase = (text: string): boolean => {
  const normalized = text.toLowerCase();
  return BANNED_PHRASES.some((phrase) => normalized.includes(phrase.toLowerCase()));
};

export const containsMetaCommentary = (text: string): boolean => containsBannedPhrase(text);

export const hasDuplicateSentenceBlock = (text: string): boolean => {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim().toLowerCase().replace(/\s+/g, ' '))
    .filter((sentence) => sentence.length > 20);

  const seen = new Set<string>();
  for (const sentence of sentences) {
    if (seen.has(sentence)) return true;
    seen.add(sentence);
  }

  for (let i = 0; i < sentences.length - 1; i += 1) {
    const block = `${sentences[i]} ${sentences[i + 1]}`;
    const rest = sentences.slice(i + 2).join(' ');
    if (rest.includes(block)) return true;
  }

  return false;
};

export const validatePassageQuality = (payload: GeneratedPassagePayload): string[] => {
  const issues: string[] = [];
  if (!payload.passageText?.trim()) issues.push('empty passage');
  if (countWords(payload.passageText) < Math.floor(WORD_COUNT_BY_TIER[payload.difficultyTier][0] * 0.7)) {
    issues.push('too short');
  }
  if (containsBannedPhrase(payload.passageText)) issues.push('banned phrase');
  if (containsMetaCommentary(payload.passageText)) issues.push('meta commentary');
  if (hasDuplicateSentenceBlock(payload.passageText)) issues.push('duplicate sentence block');
  if (isTooSimilarToRecent(payload)) issues.push('too similar to recent');
  return issues;
};

export const isTooSimilarToRecent = (
  payload: GeneratedPassagePayload,
  recent: RecentPassageRecord[] = recentPassages,
): boolean => {
  const opening = normalizeOpening(firstLine(payload.passageText));
  const stat = extractStatisticSnippet(payload.passageText);

  return recent.some((item, idx) => {
    const sameOpening = normalizeOpening(item.openingLine) === opening;
    const sameTopicTooSoon = idx < 3 && item.topicDomain === payload.topicDomain;
    const sameGenreTooSoon = idx < 2 && item.genre === payload.genre;
    const sameStat =
      Boolean(stat) && Boolean(item.statisticSnippet) && stat === item.statisticSnippet && idx < 8;
    return sameOpening || sameTopicTooSoon || sameGenreTooSoon || sameStat;
  });
};

export const buildRegenerationExclusions = (recent: RecentPassageRecord[]): string => {
  if (!recent.length) return '';
  const latest = recent[0];
  return [
    `Do not use genre "${latest.genre}".`,
    `Do not use topic domain "${latest.topicDomain}".`,
    `Do not open with a sentence similar to: "${latest.openingLine.slice(0, 100)}".`,
    latest.statisticSnippet ? `Do not reuse statistic pattern "${latest.statisticSnippet}".` : '',
    'Avoid community-helper narratives and generic problem-to-happy-ending arcs.',
    'Never mention the passage, the reader, or reading-test instructions in the text.',
  ]
    .filter(Boolean)
    .join(' ');
};

const extractJson = <T,>(text: string): T => {
  const cleaned = text.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  return JSON.parse(cleaned) as T;
};

const assertAiProviderConfigured = (): void => {
  if (env.AI_PROVIDER === 'openai' && openai) return;
  if (env.AI_PROVIDER === 'groq' && groq) return;
  throw new Error(
    `Reading passage generation requires ${env.AI_PROVIDER.toUpperCase()}_API_KEY. Run npm run seed:reading-pool after configuring AI credentials.`,
  );
};

const generateJson = async <T,>(prompt: string, systemPrompt: string, attempt = 0): Promise<T> => {
  assertAiProviderConfigured();

  try {
    if (env.AI_PROVIDER === 'openai' && openai) {
      const client = openai as unknown as {
        responses: {
          create(input: {
            model: string;
            input: string;
            text: { format: { type: 'json_object' } };
          }): Promise<{ output_text: string }>;
        };
      };
      const response = await client.responses.create({
        model: env.OPENAI_MODEL,
        input: `${systemPrompt}\n\n${prompt}`,
        text: { format: { type: 'json_object' } },
      });
      return extractJson<T>(response.output_text);
    }

    if (env.AI_PROVIDER === 'groq' && groq) {
      const response = await groq.chat.completions.create({
        model: env.GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      });
      return extractJson<T>(response.choices[0]?.message?.content ?? '{}');
    }
  } catch (error) {
    const retryAfterHeader = (error as { headers?: { 'retry-after'?: string } })?.headers?.['retry-after'];
    const retryAfterMs = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) * 1000 : 0;
    if (attempt < 3 && retryAfterMs > 0) {
      await sleep(retryAfterMs + 500);
      return generateJson<T>(prompt, systemPrompt, attempt + 1);
    }
    throw error;
  }

  throw new Error('No AI provider available for reading passage generation.');
};

type AiPassageResponse = {
  title: string;
  passageText: string;
  vocabularyTerm?: string;
  vocabularyMeaning?: string;
  inferenceAnchor?: string;
  mainIdea?: string;
  keyDetail?: string;
};

export const generateReadingPassage = async (input: {
  cefrLevel: string;
  context?: string;
  seed?: number;
}): Promise<GeneratedPassagePayload> => {
  const seed = input.seed ?? hashSeed(input.cefrLevel, input.context ?? '', Date.now());
  let brief = selectContentBrief({ cefrLevel: input.cefrLevel, context: input.context, seed });
  let attempts = 0;

  while (attempts < 5) {
    const { systemPrompt, userPrompt } = buildPassagePrompt(brief);
    const aiResult = await generateJson<AiPassageResponse>(userPrompt, systemPrompt);
    const payload: GeneratedPassagePayload = {
      title: aiResult.title,
      passageText: aiResult.passageText,
      genre: brief.genre,
      topicDomain: brief.topicDomain,
      structuralStyle: brief.structuralStyle,
      difficultyTier: brief.difficultyTier,
      vocabularyTerm: aiResult.vocabularyTerm,
      vocabularyMeaning: aiResult.vocabularyMeaning,
      inferenceAnchor: aiResult.inferenceAnchor,
      mainIdea: aiResult.mainIdea,
      keyDetail: aiResult.keyDetail,
    };

    const issues = validatePassageQuality(payload);
    if (!issues.length) {
      recordRecentPassage(payload);
      return payload;
    }

    brief = selectContentBrief({
      cefrLevel: input.cefrLevel,
      context: `${input.context ?? ''} ${buildRegenerationExclusions(getRecentPassages())} Avoid: ${issues.join(', ')}`.trim(),
      seed: seed + attempts + 17,
      recent: getRecentPassages(),
    });
    attempts += 1;
  }

  throw new Error(
    `Failed to generate a valid reading passage for ${input.cefrLevel} after ${attempts} attempts.`,
  );
};

export const batchGenerateReadingPassagePool = async (input?: {
  targetSizePerTier?: number;
  onProgress?: (progress: { tier: DifficultyTier; completed: number; target: number; poolKey: string }) => void;
}): Promise<{ generated: number; skipped: number; failed: number }> => {
  const targetSizePerTier = input?.targetSizePerTier ?? getPoolSizeFromEnv();
  clearRecentPassages();

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const tier of ['Beginner', 'Intermediate', 'Advanced'] as DifficultyTier[]) {
    let tierGenerated = 0;
    for (let index = 1; index <= targetSizePerTier; index += 1) {
      const cefrLevel = pick(CEFR_BY_TIER[tier], index, 0);
      const poolKey = `${tier}:${String(index).padStart(4, '0')}`;
      const seed = hashSeed(tier, index, cefrLevel);

      try {
        const payload = await generateReadingPassage({ cefrLevel, seed });

        await ReadingPassagePool.findOneAndUpdate(
          { poolKey },
          {
            poolKey,
            difficultyTier: tier,
            cefrLevel,
            title: payload.title,
            passageText: payload.passageText,
            genre: payload.genre,
            topicDomain: payload.topicDomain,
            structuralStyle: payload.structuralStyle,
            vocabularyTerm: payload.vocabularyTerm,
            vocabularyMeaning: payload.vocabularyMeaning,
            inferenceAnchor: payload.inferenceAnchor,
            mainIdea: payload.mainIdea,
            keyDetail: payload.keyDetail,
            generatedAt: new Date(),
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );

        generated += 1;
        tierGenerated += 1;
        input?.onProgress?.({ tier, completed: tierGenerated, target: targetSizePerTier, poolKey });
      } catch (error) {
        failed += 1;
        console.warn(`Failed to generate ${poolKey}:`, error);
      }

      await sleep(BATCH_DELAY_MS);
    }
  }

  poolCache = null;
  return { generated, skipped, failed };
};

export const setReadingPassagePoolForTests = (entries: GeneratedPassagePayload[]): void => {
  poolCache = new Map<DifficultyTier, GeneratedPassagePayload[]>();
  for (const tier of ['Beginner', 'Intermediate', 'Advanced'] as DifficultyTier[]) {
    poolCache.set(
      tier,
      entries.filter((entry) => entry.difficultyTier === tier),
    );
  }
};

export const clearReadingPassagePoolCache = (): void => {
  poolCache = null;
};

export const loadReadingPassagePoolFromDb = async (): Promise<Map<DifficultyTier, GeneratedPassagePayload[]>> => {
  if (poolCache) return poolCache;

  const entries = await ReadingPassagePool.find().sort({ poolKey: 1 }).lean();
  const map = new Map<DifficultyTier, GeneratedPassagePayload[]>([
    ['Beginner', []],
    ['Intermediate', []],
    ['Advanced', []],
  ]);

  for (const entry of entries) {
    const tier = entry.difficultyTier as DifficultyTier;
    const bucket = map.get(tier) ?? [];
    bucket.push(
      entryToPayload({
        title: entry.title,
        passageText: entry.passageText,
        genre: entry.genre as ReadingGenre,
        topicDomain: entry.topicDomain,
        structuralStyle: entry.structuralStyle as StructuralStyle,
        difficultyTier: tier,
        vocabularyTerm: entry.vocabularyTerm,
        vocabularyMeaning: entry.vocabularyMeaning,
        inferenceAnchor: entry.inferenceAnchor,
        mainIdea: entry.mainIdea,
        keyDetail: entry.keyDetail,
      }),
    );
    map.set(tier, bucket);
  }

  poolCache = map;
  return map;
};

export const getPassageFromPool = (cefrLevel: string, seed: number): GeneratedPassagePayload => {
  const tier = mapCefrToDifficultyTier(cefrLevel);
  const bucket = poolCache?.get(tier) ?? [];
  if (!bucket.length) {
    throw new Error(
      `Reading passage pool for ${tier} is empty. Run "npm run seed:reading-pool" before "npm run seed:practice".`,
    );
  }
  return bucket[hashSeed(cefrLevel, seed) % bucket.length];
};

const buildQuestionsForCompetency = (
  payload: GeneratedPassagePayload,
  competency: ReadingCompetency,
): Omit<ReadingItemOutput, 'title' | 'passageText'> => {
  const vocab =
    VOCABULARY_BANK[payload.difficultyTier].find((item) => item.term === payload.vocabularyTerm) ??
    pick(VOCABULARY_BANK[payload.difficultyTier], hashSeed(payload.topicDomain, payload.genre), 3);

  const commonWrong = [
    `The passage focuses on an unrelated sports competition.`,
    `The writer argues that ${payload.topicDomain} is no longer relevant to modern life.`,
    `The text claims that readers should ignore context clues and focus on one keyword.`,
  ];

  const byCompetency: Record<ReadingCompetency, Omit<ReadingItemOutput, 'title' | 'passageText'>> = {
    'skim reading': {
      stem: 'What is the main idea of the passage?',
      correctAnswer: payload.mainIdea ?? `The passage explores ${payload.topicDomain} from a ${payload.genre} angle.`,
      distractors: commonWrong,
      explanation: 'The main idea spans the full passage rather than a single detail or example.',
    },
    'specific detail': {
      stem: 'According to the passage, which detail is explicitly stated?',
      correctAnswer: payload.keyDetail ?? `The passage mentions a concrete detail about ${payload.topicDomain}.`,
      distractors: [
        'The writer confirms every prediction with final certainty.',
        'The passage states that no further research is necessary.',
        'The text identifies a celebrity endorsement as the central evidence.',
      ],
      explanation: 'The correct option restates a detail that appears directly in the passage.',
    },
    'vocabulary in context': {
      stem: `In the passage, the word "${vocab.term}" most nearly means:`,
      correctAnswer: payload.vocabularyMeaning ?? vocab.meaning,
      distractors: vocab.wrong,
      explanation: `Use surrounding context to infer that "${vocab.term}" matches this meaning.`,
    },
    'author purpose': {
      stem: 'Why does the writer include the middle section of the passage?',
      correctAnswer: `To develop the ${payload.genre} point with evidence and nuance rather than stating conclusions too quickly.`,
      distractors: [
        'To introduce an unrelated personal biography.',
        'To prove that every opposing view is entirely wrong.',
        'To list vocabulary words without connecting them to the topic.',
      ],
      explanation: 'Author purpose questions ask how a section supports the overall aim of the text.',
    },
    'logical connection': {
      stem: 'What connection should the reader infer between the opening and closing paragraphs?',
      correctAnswer:
        payload.inferenceAnchor ??
        'The closing paragraph extends the opening claim with a conclusion that must be inferred.',
      distractors: [
        'The closing paragraph contradicts the opening by changing topics entirely.',
        'The opening and closing paragraphs repeat the same sentence without adding meaning.',
        'The final paragraph introduces a new statistic that invalidates the introduction.',
      ],
      explanation: 'Logical connection items test whether readers can link ideas across paragraphs.',
    },
  };

  return byCompetency[competency];
};

export const buildReadingItemContent = (input: {
  level: { id: string; order?: number };
  context: string;
  competency: ReadingCompetency;
  index: number;
  module?: { label?: string };
}): ReadingItemOutput => {
  const seed = hashSeed(input.level.id, input.context, input.competency, input.index);
  const payload = getPassageFromPool(input.level.id, seed);
  const question = buildQuestionsForCompetency(payload, input.competency);
  return {
    title: payload.title,
    passageText: payload.passageText,
    stem: question.stem,
    correctAnswer: question.correctAnswer,
    distractors: question.distractors,
    explanation: question.explanation,
    competency: input.competency,
  };
};

export const averageSentenceLength = (text: string): number => {
  const sentences = text.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean);
  if (!sentences.length) return 0;
  const words = sentences.reduce((sum, sentence) => sum + countWords(sentence), 0);
  return words / sentences.length;
};

export const averageSyllablesPerWord = (text: string): number => {
  const tokens = text.toLowerCase().match(/[a-z]+/g) ?? [];
  if (!tokens.length) return 0;
  const syllables = tokens.reduce((sum, word) => sum + estimateSyllables(word), 0);
  return syllables / tokens.length;
};

const estimateSyllables = (word: string): number => {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');
  if (cleaned.length <= 3) return 1;
  const matches = cleaned.replace(/e$/i, '').match(/[aeiouy]+/g);
  return Math.max(1, matches?.length ?? 1);
};
