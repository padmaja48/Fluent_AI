import OpenAI from 'openai';
import { env } from '../config/env';

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

export const BANNED_PHRASES = [
  'increased participation by forty percent',
  'it was a big problem for everyone',
  'now things are better',
  'my name is',
  'i decided to help',
  'we have increased participation',
];

const MAX_RECENT_PASSAGES = 30;
const recentPassages: RecentPassageRecord[] = [];

const DIFFICULTY_BY_CEFR: Record<string, DifficultyTier> = {
  A1: 'Beginner',
  A2: 'Beginner',
  B1: 'Intermediate',
  B2: 'Intermediate',
  C1: 'Advanced',
  C2: 'Advanced',
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

const TOPIC_SNIPPETS: Record<string, string[]> = {
  science: [
    'Researchers recently examined how small changes in temperature affect insect migration.',
    'Laboratory records show that the sample behaved differently under low humidity.',
    'The experiment was designed to test whether the chemical reaction would slow after twelve hours.',
  ],
  environment: [
    'Coastal wetlands filter runoff before it reaches open water, yet many sites remain unmapped.',
    'Urban tree cover can lower afternoon temperatures, though planting alone does not guarantee shade within five years.',
    'Recycling rates vary sharply between districts because collection schedules differ.',
  ],
  technology: [
    'Software updates often patch security flaws that users never notice until a breach is reported.',
    'Voice assistants rely on models trained with enormous datasets, which raises questions about consent.',
    'A pilot program tested whether offline devices could still sync data once per day.',
  ],
  history: [
    'Archival letters reveal that merchants adapted trade routes long before official treaties were signed.',
    'The museum exhibit compares two reconstruction methods used after the fire of 1842.',
    'Historians disagree about whether the reform began in the capital or in provincial towns.',
  ],
  workplace: [
    'Hybrid schedules changed how teams document decisions, especially when members work across time zones.',
    'The onboarding guide now separates mandatory compliance steps from optional skill modules.',
    'Managers noted that brief written summaries reduced confusion after video meetings.',
  ],
  health: [
    'Sleep researchers tracked how screen use before midnight influenced recovery among shift workers.',
    'Clinic staff found that appointment reminders lowered missed visits more than longer intake forms.',
    'Nutrition labels help some shoppers, but others rely on habit rather than reading percentages.',
  ],
  culture: [
    'The festival program mixes traditional performances with contemporary installations in the same venue.',
    'Local archives preserve dialect recordings that younger speakers rarely hear in daily conversation.',
    'Curators chose works that challenge assumptions about who belongs in the national canon.',
  ],
  psychology: [
    'Studies suggest that people underestimate how much context shapes quick judgments.',
    'Memory tests show that retelling a story can subtly alter details listeners later treat as facts.',
    'Therapists sometimes use structured diaries to help clients notice patterns across weeks.',
  ],
  'current affairs': [
    'City councils debated whether fare subsidies should target students or low-income commuters first.',
    'A recent report compared housing permits issued in the last quarter with population growth.',
    'Journalists verified claims by cross-checking public budget documents released online.',
  ],
  arts: [
    'The composer reworked the opening motif after hearing how it sounded in an empty hall.',
    'Printmakers experimented with layered ink because the first proofs lacked depth.',
    'Critics praised the novel for shifting perspective without announcing the change explicitly.',
  ],
  sports: [
    'Coaches adjusted training loads after GPS data showed uneven sprint volumes across the squad.',
    'The referee review panel published clips to explain decisions that spectators questioned.',
    'Youth leagues introduced shorter matches to keep players engaged during hot afternoons.',
  ],
  education: [
    'Teachers piloted peer feedback rubrics so students could revise drafts before final grading.',
    'The library extended evening hours during exam weeks, which reduced queue times at printers.',
    'Administrators compared attendance patterns between lecture halls and seminar rooms.',
  ],
  'urban planning': [
    'Planners mapped pedestrian crossings where traffic speed exceeded safe limits for school routes.',
    'A corridor study weighed bus lanes against parking loss near small retailers.',
    'Residents requested clearer signage because construction detours changed weekly.',
  ],
  economics: [
    'Analysts tracked how export delays affected prices for imported components.',
    'The survey asked households whether inflation changed their long-term savings goals.',
    'Small firms reported that delayed invoices strained cash flow more than interest rates did.',
  ],
  architecture: [
    'Architects chose cross-ventilation over sealed glazing to reduce cooling demand.',
    'The renovation preserved the facade while replacing interior supports hidden from the street.',
    'Material samples were tested for fire resistance before the council approved the design.',
  ],
};

const pick = <T,>(items: T[], seed: number, salt = 0): T => items[(seed + salt) % items.length];

const hashSeed = (...parts: Array<string | number>): number => {
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

export const mapCefrToDifficultyTier = (cefrLevel: string): DifficultyTier =>
  DIFFICULTY_BY_CEFR[cefrLevel] ?? 'Intermediate';

export const getWordCountRangeForTier = (tier: DifficultyTier): [number, number] => WORD_COUNT_BY_TIER[tier];

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
    '- Include some information the reader must infer or connect across sentences.',
    '- Do NOT use a community-helper narrative unless genre is biographical and topic fits.',
    '- Do NOT include round participation statistics or generic filler such as "things are better now".',
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
  return BANNED_PHRASES.some((phrase) => normalized.includes(phrase));
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
  ]
    .filter(Boolean)
    .join(' ');
};

const padToWordCount = (text: string, target: number, seed: number): string => {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= target) {
    return parts.slice(0, target).join(' ').replace(/[,.!?;:]$/, '.') + '.';
  }
  const fillers = [
    'Readers should notice how details across paragraphs connect.',
    'The writer leaves one conclusion implicit rather than stating it directly.',
    'Several phrases reward careful rereading rather than skimming.',
    'Context clues help infer the writer\'s underlying assumption.',
    'The passage mixes concrete examples with broader claims.',
  ];
  let expanded = text.trim();
  let cursor = 0;
  while (countWords(expanded) < target && cursor < 20) {
    expanded += ` ${pick(fillers, seed, cursor + 29)}`;
    cursor += 1;
  }
  return expanded.replace(/\s+/g, ' ').trim();
};

const tierSentence = (tier: DifficultyTier, simple: string, mid: string, advanced: string): string => {
  if (tier === 'Beginner') return simple;
  if (tier === 'Intermediate') return mid;
  return advanced;
};

const buildProceduralPassage = (brief: PassageBrief): GeneratedPassagePayload => {
  const { genre, topicDomain, structuralStyle, difficultyTier, seed, wordCountRange } = brief;
  const snippets = TOPIC_SNIPPETS[topicDomain] ?? TOPIC_SNIPPETS.science;
  const lead = pick(snippets, seed, 1);
  const second = pick(snippets, seed, 5);
  const third = pick(snippets, seed, 9);
  const vocab = pick(VOCABULARY_BANK[difficultyTier], seed, 13);
  const [minWords, maxWords] = wordCountRange;
  const targetWords = minWords + (seed % (Math.max(maxWords - minWords, 1) + 1));

  const openings: Record<StructuralStyle, string> = {
    'opens-with-question': tierSentence(
      difficultyTier,
      `Why do experts pay close attention to ${topicDomain}? ${lead}`,
      `Why has ${topicDomain} become harder to summarise in a single headline? ${lead}`,
      `What assumptions about ${topicDomain} survive scrutiny once evidence from multiple settings is compared? ${lead}`,
    ),
    'opens-with-statistic': tierSentence(
      difficultyTier,
      `In one recent survey, nearly ${18 + (seed % 17)}% of respondents linked ${topicDomain} with daily decisions. ${second}`,
      `Figures from the last fiscal year suggest a ${12 + (seed % 23)}% shift in how institutions discuss ${topicDomain}. ${second}`,
      `Although a ${7 + (seed % 11)}% variation may appear modest, analysts argue it reframes long-standing claims about ${topicDomain}. ${second}`,
    ),
    'opens-with-anecdote': tierSentence(
      difficultyTier,
      `During a routine visit last spring, a technician noticed something unusual about ${topicDomain}. ${lead}`,
      `A colleague returned from fieldwork with notes that challenged a familiar story about ${topicDomain}. ${lead}`,
      `The account begins with a minor oversight that later proved instructive for specialists in ${topicDomain}. ${lead}`,
    ),
    'opens-with-definition': tierSentence(
      difficultyTier,
      `${topicDomain} refers to ideas and practices that shape how communities interpret evidence. ${second}`,
      `In professional writing, ${topicDomain} often denotes systems whose parts interact in ways readers must infer. ${second}`,
      `${topicDomain}, as used here, names a field where interpretation depends as much on method as on conclusion. ${second}`,
    ),
    chronological: tierSentence(
      difficultyTier,
      `The sequence begins in ${2010 + (seed % 10)}, when teams first recorded the pattern. ${lead}`,
      `Early observations from ${2004 + (seed % 15)} set constraints that later researchers could not ignore. ${lead}`,
      `Tracing decisions across ${1998 + (seed % 20)} and ${2016 + (seed % 8)} reveals how assumptions hardened into policy. ${lead}`,
    ),
    thematic: tierSentence(
      difficultyTier,
      `Three themes recur whenever ${topicDomain} is discussed in public forums. ${second}`,
      `The passage groups evidence by concept rather than by date because ${topicDomain} resists a single timeline. ${second}`,
      `Instead of narrating events in order, the text examines tensions that define contemporary ${topicDomain}. ${second}`,
    ),
    'first-person': tierSentence(
      difficultyTier,
      `I did not expect ${topicDomain} to appear in my weekly report, yet the data pointed that way. ${third}`,
      `When I reviewed the files, I realised how much of ${topicDomain} depends on context we rarely document. ${third}`,
      `I have spent years following ${topicDomain}, and the latest findings still unsettle a comfortable narrative. ${third}`,
    ),
    'third-person': tierSentence(
      difficultyTier,
      `${pick(['Dr Chen', 'Ms Alvarez', 'Mr Okonkwo', 'Dr Patel', 'Ms Nguyen'], seed, 2)} studies ${topicDomain} at a regional institute. ${lead}`,
      `${pick(['The analyst', 'The curator', 'The engineer', 'The editor'], seed, 4)} examines ${topicDomain} without claiming the last word on the subject. ${lead}`,
      `${pick(['One researcher', 'A policy adviser', 'An independent reviewer'], seed, 6)} treats ${topicDomain} as a field where caution and curiosity must coexist. ${lead}`,
    ),
    'objective-report': tierSentence(
      difficultyTier,
      `Official minutes from Tuesday note that ${topicDomain} will be reviewed again next month. ${second}`,
      `The briefing summarises ${topicDomain} in neutral language, separating observation from recommendation. ${second}`,
      `According to the draft report, ${topicDomain} raises operational questions that staff have not yet resolved. ${second}`,
    ),
  };

  const genreBodies: Record<ReadingGenre, string[]> = {
    narrative: [
      tierSentence(
        difficultyTier,
        `The scene shifts when a delayed message forces characters to reconsider their plan. Although no one states the outcome immediately, the final paragraph implies that patience mattered more than speed.`,
        `Midway through the account, a misunderstanding complicates the route forward; readers infer the resolution only after noticing how earlier details about weather and timing align.`,
        `Tension accumulates through small reversals rather than a single crisis, and the closing image suggests continuity rather than triumph.`,
      ),
    ],
    expository: [
      tierSentence(
        difficultyTier,
        `The next section explains how the process works and why labels can mislead newcomers. Examples clarify the difference between cause and correlation without using jargon.`,
        `Subsequent paragraphs compare two models, noting where each fits and where neither accounts for recent findings.`,
        `The exposition alternates concrete instances with abstract principles so readers must track how each paragraph extends the last.`,
      ),
    ],
    argumentative: [
      tierSentence(
        difficultyTier,
        `Some commentators favour quick restrictions, yet the writer argues that gradual standards preserve flexibility. Counterpoints appear, but the text stops short of declaring a winner.`,
        `Critics claim the issue is overstated; the author responds with evidence that is suggestive rather than definitive, inviting readers to judge the balance of proof.`,
        `The argument hinges on a distinction readers must infer between immediate costs and longer commitments.`,
      ),
    ],
    biographical: [
      tierSentence(
        difficultyTier,
        `Raised in a port city, the subject later moved into research that few classmates predicted. The profile emphasises choices rather than awards.`,
        `Early setbacks shaped a method characterised by ${vocab.term} inquiry, a phrase the text expects readers to interpret from context.`,
        `The biography avoids hagiography by acknowledging disagreements that continued even after public recognition.`,
      ),
    ],
    scientific: [
      tierSentence(
        difficultyTier,
        `Methods are described plainly: samples were tagged, measured twice, and compared under controlled lighting. The summary does not claim certainty beyond the tested range.`,
        `Peer reviewers requested clearer limits, so the revised section distinguishes hypothesis from observed effect.`,
        `Technical terms appear sparingly; when they do, surrounding sentences supply enough context for inference.`,
      ),
    ],
    'business-case': [
      tierSentence(
        difficultyTier,
        `The case follows a team evaluating trade-offs between cost, speed, and reputation. Stakeholders disagree, and the memo records dissent instead of smoothing it away.`,
        `Financial projections are presented with assumptions readers must notice in footnote language embedded in the prose.`,
        `The recommendation is conditional, which means the main idea depends on linking budget constraints to customer trust.`,
      ),
    ],
    historical: [
      tierSentence(
        difficultyTier,
        `Primary sources disagree about timing, so the historian presents both accounts and explains what each omits.`,
        `Material evidence from the period complicates a popular story taught in simplified textbooks.`,
        `The account connects local decisions to wider pressures without reducing either to heroism or failure.`,
      ),
    ],
    'news-report': [
      tierSentence(
        difficultyTier,
        `Officials declined to comment beyond the prepared statement, while residents interviewed on Thursday described conflicting experiences.`,
        `The report separates verified figures from estimates and marks where confirmation is still pending.`,
        `Background paragraphs supply context so readers understand why the announcement arrived earlier than expected.`,
      ),
    ],
    'dialogue-based': [
      tierSentence(
        difficultyTier,
        `"We should publish the summary first," said one voice. "Not if the numbers change overnight," replied another. The exchange reveals priorities without naming them outright.`,
        `Short exchanges alternate with narration, and readers infer agreement only from what participants decide to do next.`,
        `The dialogue avoids exposition dumps; instead, characters disagree about what ${topicDomain} requires in practice.`,
      ),
    ],
  };

  const opening = openings[structuralStyle];
  const body = pick(genreBodies[genre], seed, 19);
  const closing = tierSentence(
    difficultyTier,
    `Taken together, the passage suggests that careful reading—not guessing from one sentence—reveals the writer's main point.`,
    `Readers who connect the opening claim with the later example can infer a conclusion the writer never labels explicitly, which is why the middle section matters as much as the introduction.`,
    `The text rewards synthesis across paragraphs: neither the first paragraph nor the last alone captures the full argument without the intervening evidence, qualifications, and counterpoints that the writer deliberately leaves for the reader to assemble.`,
  );

  const advancedExtension =
    difficultyTier === 'Advanced'
      ? ' Rather than presenting a single decisive verdict, the writer layers qualifications, alternative readings, and methodological limits that a hurried reader could easily miss.'
      : '';

  const passageText = padToWordCount(`${opening}\n\n${body}${advancedExtension}\n\n${closing}`, targetWords, seed);
  const title = `${genre.replace('-', ' ')} reading: ${topicDomain} (${brief.cefrLevel})`;

  return {
    title,
    passageText,
    genre,
    topicDomain,
    structuralStyle,
    difficultyTier,
    vocabularyTerm: vocab.term,
    vocabularyMeaning: vocab.meaning,
    inferenceAnchor: 'Readers must connect details across paragraphs to infer the writer\'s conclusion.',
    mainIdea: `The passage examines ${topicDomain} from a ${genre} perspective without relying on a generic success story.`,
    keyDetail: second,
  };
};

const extractJson = <T,>(text: string): T => {
  const cleaned = text.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  return JSON.parse(cleaned) as T;
};

const generateJson = async <T,>(prompt: string, fallback: T, systemPrompt: string): Promise<T> => {
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
    console.warn('Reading passage AI generation failed; using procedural fallback.', error);
  }
  return fallback;
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

  while (attempts < 4) {
    const fallback = buildProceduralPassage(brief);
    const { systemPrompt, userPrompt } = buildPassagePrompt(brief);
    const aiResult = await generateJson<AiPassageResponse>(userPrompt, fallback, systemPrompt);
    const payload: GeneratedPassagePayload = {
      title: aiResult.title || fallback.title,
      passageText: aiResult.passageText || fallback.passageText,
      genre: brief.genre,
      topicDomain: brief.topicDomain,
      structuralStyle: brief.structuralStyle,
      difficultyTier: brief.difficultyTier,
      vocabularyTerm: aiResult.vocabularyTerm || fallback.vocabularyTerm,
      vocabularyMeaning: aiResult.vocabularyMeaning || fallback.vocabularyMeaning,
      inferenceAnchor: aiResult.inferenceAnchor || fallback.inferenceAnchor,
      mainIdea: aiResult.mainIdea || fallback.mainIdea,
      keyDetail: aiResult.keyDetail || fallback.keyDetail,
    };

    if (!containsBannedPhrase(payload.passageText) && !isTooSimilarToRecent(payload)) {
      recordRecentPassage(payload);
      return payload;
    }

    const regenSeed = seed + attempts + 17;
    brief = selectContentBrief({
      cefrLevel: input.cefrLevel,
      context: input.context,
      seed: regenSeed,
      recent: getRecentPassages(),
    });
    const extra = buildRegenerationExclusions(getRecentPassages());
    brief.exclusions = [
      ...brief.exclusions,
      {
        openingLine: firstLine(payload.passageText),
        topicDomain: payload.topicDomain,
        genre: payload.genre,
        statisticSnippet: extractStatisticSnippet(payload.passageText),
        createdAt: Date.now(),
      },
    ];
    if (extra) {
      brief = { ...brief, context: `${brief.context ?? ''} ${extra}`.trim() };
    }
    attempts += 1;
  }

  const finalFallback = buildProceduralPassage(brief);
  recordRecentPassage(finalFallback);
  return finalFallback;
};

export const buildReadingPassageSync = (input: {
  cefrLevel: string;
  context?: string;
  seed: number;
}): GeneratedPassagePayload => {
  let brief = selectContentBrief(input);
  let attempts = 0;
  while (attempts < 6) {
    const payload = buildProceduralPassage(brief);
    if (!containsBannedPhrase(payload.passageText) && !isTooSimilarToRecent(payload)) {
      recordRecentPassage(payload);
      return payload;
    }
    brief = selectContentBrief({ ...input, seed: input.seed + attempts + 23 });
    attempts += 1;
  }
  const payload = buildProceduralPassage(brief);
  recordRecentPassage(payload);
  return payload;
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
      explanation: `Readers should use surrounding context to infer that "${vocab.term}" matches this meaning.`,
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
      correctAnswer: payload.inferenceAnchor ?? 'The closing paragraph extends the opening claim with a conclusion that must be inferred.',
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
  const payload = buildReadingPassageSync({
    cefrLevel: input.level.id,
    context: input.context,
    seed,
  });
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
