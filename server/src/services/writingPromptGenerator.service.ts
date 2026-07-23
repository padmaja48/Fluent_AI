export type WritingModuleId =
  | 'sentence-control'
  | 'paragraph-building'
  | 'cohesion'
  | 'tone-and-register'
  | 'argument-development';

export type WritingTaskType =
  | 'email'
  | 'letter'
  | 'note'
  | 'message'
  | 'report'
  | 'summary'
  | 'review'
  | 'narrative'
  | 'opinion'
  | 'argument'
  | 'essay'
  | 'formal-request'
  | 'proposal';

export type WritingItemOutput = {
  stem: string;
  passageText: string;
  correctAnswer: string;
  distractors: string[];
  explanation: string;
  hints: string[];
  minWords: number;
  evaluationCriteria: string;
  moduleType: WritingModuleId;
  moduleLabel: string;
  taskType: WritingTaskType;
};

const CRITERIA_BY_LEVEL: Record<string, string> = {
  A1: 'grammar accuracy, basic vocabulary, and clear meaning',
  A2: 'correct grammar, appropriate vocabulary, and a clear message with a reason',
  B1: 'well-organised paragraphs, connectors, appropriate tone, and a supported opinion',
  B2: 'coherent structure, precise vocabulary, balanced argument, and professional register',
  C1: 'sophisticated cohesion, nuanced argument, precise register, and critical thinking',
  C2: 'near-native fluency, rhetorical effectiveness, lexical precision, and subtle reasoning',
};

const MIN_WORDS_BY_LEVEL: Record<string, number> = {
  A1: 25,
  A2: 45,
  B1: 90,
  B2: 130,
  C1: 170,
  C2: 220,
};

const TOPICS = [
  'remote work',
  'public transport',
  'local volunteering',
  'health routines',
  'city planning',
  'technology in education',
  'cultural festivals',
  'environmental policy',
  'career development',
  'customer service',
  'travel planning',
  'team communication',
  'budget management',
  'media literacy',
  'workplace safety',
  'community sports',
  'housing costs',
  'food sustainability',
  'language learning',
  'digital privacy',
];

const AUDIENCES = [
  'a teacher',
  'a manager',
  'a client',
  'a neighbour',
  'a colleague',
  'a community group',
  'a supplier',
  'a mentor',
  'a local council',
  'a project team',
];

const hashSeed = (...parts: Array<string | number>): number => {
  const raw = parts.join(':');
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const pick = <T,>(items: T[], seed: number, salt = 0): T => items[(seed + salt) % items.length];

type PromptFrame = {
  taskType: WritingTaskType;
  buildStem: (input: {
    levelId: string;
    context: string;
    topic: string;
    audience: string;
    variant: number;
  }) => string;
};

const MODULE_FRAMES: Record<WritingModuleId, PromptFrame[]> = {
  'sentence-control': [
    {
      taskType: 'email',
      buildStem: ({ audience, context, topic }) =>
        `Write a short email to ${audience} explaining one change related to ${topic} in your ${context} situation.`,
    },
    {
      taskType: 'message',
      buildStem: ({ audience, context }) =>
        `Write a brief message to ${audience} requesting clarification about a ${context} schedule.`,
    },
    {
      taskType: 'note',
      buildStem: ({ topic, context }) =>
        `Write a polite note describing a problem with ${topic} and one action you want taken in your ${context} setting.`,
    },
    {
      taskType: 'formal-request',
      buildStem: ({ audience, topic }) =>
        `Write a formal request to ${audience} asking for support with ${topic}. State what you need and why.`,
    },
    {
      taskType: 'letter',
      buildStem: ({ context, topic }) =>
        `Write a short letter responding to feedback you received about ${topic} during a recent ${context} activity.`,
    },
    {
      taskType: 'summary',
      buildStem: ({ topic, audience }) =>
        `Summarise in three or four sentences the main outcome of a discussion with ${audience} about ${topic}.`,
    },
    {
      taskType: 'report',
      buildStem: ({ context, topic }) =>
        `Write a concise status update about ${topic} for colleagues involved in ${context}.`,
    },
    {
      taskType: 'narrative',
      buildStem: ({ context, topic }) =>
        `Describe in a short paragraph what happened when ${topic} affected your ${context} plans last week.`,
    },
    {
      taskType: 'email',
      buildStem: ({ audience, topic, variant }) =>
        `Compose an email to ${audience} confirming next steps after a meeting about ${topic}. Include one deadline (day ${variant + 3}).`,
    },
    {
      taskType: 'message',
      buildStem: ({ context, topic }) =>
        `Write a message apologising for a delay linked to ${topic} and explain how you will fix it in a ${context} context.`,
    },
    {
      taskType: 'note',
      buildStem: ({ audience, context }) =>
        `Leave a note for ${audience} with two instructions they should follow before the next ${context} session.`,
    },
    {
      taskType: 'proposal',
      buildStem: ({ topic, context }) =>
        `Propose one practical improvement to ${topic} in your ${context} environment. Keep the proposal to one short paragraph.`,
    },
    {
      taskType: 'review',
      buildStem: ({ topic, audience }) =>
        `Write a short review for ${audience} evaluating whether a recent ${topic} initiative worked.`,
    },
    {
      taskType: 'letter',
      buildStem: ({ context, topic }) =>
        `Write a letter thanking someone for help with ${topic} after a difficult ${context} experience.`,
    },
    {
      taskType: 'formal-request',
      buildStem: ({ audience, topic, context }) =>
        `Request permission from ${audience} to adjust a ${context} plan because of ${topic}.`,
    },
    {
      taskType: 'summary',
      buildStem: ({ topic }) =>
        `In four sentences, explain the cause, effect, and next step for a recent issue involving ${topic}.`,
    },
    {
      taskType: 'email',
      buildStem: ({ audience, context }) =>
        `Email ${audience} to confirm attendance and list one question you will raise about ${context}.`,
    },
    {
      taskType: 'message',
      buildStem: ({ topic, audience }) =>
        `Send a message to ${audience} sharing one positive result and one remaining challenge related to ${topic}.`,
    },
    {
      taskType: 'note',
      buildStem: ({ context, topic }) =>
        `Write a reminder note about ${topic} for people joining a ${context} event tomorrow.`,
    },
    {
      taskType: 'report',
      buildStem: ({ topic, audience }) =>
        `Draft a brief incident report for ${audience} after a minor problem involving ${topic}.`,
    },
  ],
  'paragraph-building': [
    {
      taskType: 'narrative',
      buildStem: ({ context, topic }) =>
        `Write one paragraph narrating how you handled ${topic} during a ${context} experience.`,
    },
    {
      taskType: 'report',
      buildStem: ({ topic, audience }) =>
        `Write a paragraph reporting key findings from a short survey about ${topic} conducted with ${audience}.`,
    },
    {
      taskType: 'summary',
      buildStem: ({ context, topic }) =>
        `Summarise in one paragraph the most important lessons from a ${context} project focused on ${topic}.`,
    },
    {
      taskType: 'review',
      buildStem: ({ topic }) =>
        `Write a paragraph reviewing a tool or service connected to ${topic}. Include one strength and one weakness.`,
    },
    {
      taskType: 'opinion',
      buildStem: ({ topic, context }) =>
        `Write a paragraph explaining your opinion on whether ${topic} improves ${context}. Support your view with reasons.`,
    },
    {
      taskType: 'proposal',
      buildStem: ({ topic, audience }) =>
        `Write a paragraph proposing a pilot programme about ${topic} for ${audience}.`,
    },
    {
      taskType: 'narrative',
      buildStem: ({ topic, variant }) =>
        `Describe in one paragraph a turning point in week ${variant + 1} of a initiative related to ${topic}.`,
    },
    {
      taskType: 'report',
      buildStem: ({ context, topic }) =>
        `Write a paragraph comparing two options for addressing ${topic} in a ${context} setting.`,
    },
    {
      taskType: 'summary',
      buildStem: ({ audience, topic }) =>
        `Summarise for ${audience} the progress made on ${topic} this month.`,
    },
    {
      taskType: 'review',
      buildStem: ({ context, topic }) =>
        `Review in one paragraph a recent ${context} event that focused on ${topic}.`,
    },
    {
      taskType: 'argument',
      buildStem: ({ topic }) =>
        `Write a paragraph arguing that investment in ${topic} should increase, with two supporting points.`,
    },
    {
      taskType: 'narrative',
      buildStem: ({ topic, audience }) =>
        `Tell in one paragraph how ${audience} responded when you introduced a change involving ${topic}.`,
    },
    {
      taskType: 'report',
      buildStem: ({ topic, context }) =>
        `Report in one paragraph on risks linked to ${topic} that emerged during ${context}.`,
    },
    {
      taskType: 'opinion',
      buildStem: ({ topic }) =>
        `Write an opinion paragraph on whether ${topic} is overrated in public debate.`,
    },
    {
      taskType: 'proposal',
      buildStem: ({ context, topic }) =>
        `Propose in one paragraph a low-cost way to improve ${topic} within ${context}.`,
    },
    {
      taskType: 'summary',
      buildStem: ({ topic, audience }) =>
        `Write a paragraph summarising feedback from ${audience} about ${topic}.`,
    },
    {
      taskType: 'review',
      buildStem: ({ topic, context }) =>
        `Evaluate in one paragraph whether current ${context} practices for ${topic} are effective.`,
    },
    {
      taskType: 'narrative',
      buildStem: ({ context, topic, variant }) =>
        `Write a paragraph describing how ${topic} changed daily routines in ${context} over ${variant + 2} weeks.`,
    },
    {
      taskType: 'report',
      buildStem: ({ audience, topic }) =>
        `Prepare a paragraph for ${audience} explaining budget implications of ${topic}.`,
    },
    {
      taskType: 'argument',
      buildStem: ({ topic, context }) =>
        `Build one argumentative paragraph claiming ${topic} is essential for successful ${context}.`,
    },
  ],
  cohesion: [
    {
      taskType: 'report',
      buildStem: ({ topic }) =>
        `Write a paragraph about ${topic} using at least four different linking words (e.g., however, therefore, meanwhile, in addition).`,
    },
    {
      taskType: 'narrative',
      buildStem: ({ context, topic }) =>
        `Describe a sequence of events related to ${topic} in ${context}. Use clear time connectors throughout.`,
    },
    {
      taskType: 'argument',
      buildStem: ({ topic }) =>
        `Write a paragraph presenting two sides of an issue about ${topic}. Use contrast connectors accurately.`,
    },
    {
      taskType: 'summary',
      buildStem: ({ audience, topic }) =>
        `Summarise advice you would give ${audience} about ${topic}, linking each sentence logically to the next.`,
    },
    {
      taskType: 'proposal',
      buildStem: ({ context, topic }) =>
        `Write a connected paragraph proposing steps to improve ${topic} in ${context}. Number the stages in prose.`,
    },
    {
      taskType: 'report',
      buildStem: ({ topic, variant }) =>
        `Explain in one paragraph how ${topic} affects three different groups. Use reference words (this, these, such) to avoid repetition.`,
    },
    {
      taskType: 'narrative',
      buildStem: ({ topic }) =>
        `Write a short cause-and-effect paragraph about ${topic}, showing how one decision led to another outcome.`,
    },
    {
      taskType: 'opinion',
      buildStem: ({ context, topic }) =>
        `Express an opinion on ${topic} in ${context}, linking reasons with because, although, and as a result.`,
    },
    {
      taskType: 'summary',
      buildStem: ({ topic }) =>
        `Write a process paragraph explaining how a team should respond to a challenge involving ${topic}.`,
    },
    {
      taskType: 'argument',
      buildStem: ({ topic, audience }) =>
        `Argue in one paragraph that ${audience} should prioritise ${topic}, using cohesive chains between sentences.`,
    },
    {
      taskType: 'report',
      buildStem: ({ context, topic }) =>
        `Report on a meeting about ${topic} in ${context}, using paragraph transitions that show agreement and disagreement.`,
    },
    {
      taskType: 'narrative',
      buildStem: ({ topic, variant }) =>
        `Narrate a day-by-day account (${variant + 2} days) of resolving an issue linked to ${topic}.`,
    },
    {
      taskType: 'proposal',
      buildStem: ({ topic }) =>
        `Propose a timeline for implementing changes to ${topic}, connecting each phase with sequence markers.`,
    },
    {
      taskType: 'summary',
      buildStem: ({ audience, topic }) =>
        `Write a cohesive summary for ${audience} comparing past and current approaches to ${topic}.`,
    },
    {
      taskType: 'opinion',
      buildStem: ({ topic, context }) =>
        `Give your view on ${topic} within ${context}, ensuring each sentence builds on the previous one.`,
    },
    {
      taskType: 'report',
      buildStem: ({ topic }) =>
        `Write a paragraph analysing why efforts to improve ${topic} sometimes fail, linking causes and effects clearly.`,
    },
    {
      taskType: 'argument',
      buildStem: ({ context, topic }) =>
        `Construct an argument paragraph about ${topic} that moves from problem to evidence to recommendation in ${context}.`,
    },
    {
      taskType: 'narrative',
      buildStem: ({ topic, audience }) =>
        `Describe how ${audience} changed their approach to ${topic} after receiving new information.`,
    },
    {
      taskType: 'summary',
      buildStem: ({ topic }) =>
        `Summarise two competing solutions for ${topic} and explain how they connect to the same goal.`,
    },
    {
      taskType: 'proposal',
      buildStem: ({ topic, context }) =>
        `Draft a paragraph linking short-term and long-term actions for ${topic} in ${context}.`,
    },
  ],
  'tone-and-register': [
    {
      taskType: 'email',
      buildStem: ({ audience, topic }) =>
        `Write a formal email to ${audience} requesting information about ${topic}.`,
    },
    {
      taskType: 'message',
      buildStem: ({ audience, context }) =>
        `Write an informal message to ${audience} inviting them to a ${context} activity.`,
    },
    {
      taskType: 'letter',
      buildStem: ({ topic }) =>
        `Write a formal complaint letter about a service failure related to ${topic}. Remain professional throughout.`,
    },
    {
      taskType: 'email',
      buildStem: ({ audience, topic }) =>
        `Write a diplomatic email to ${audience} disagreeing politely with a decision about ${topic}.`,
    },
    {
      taskType: 'note',
      buildStem: ({ context, topic }) =>
        `Write a semi-formal note to staff about new guidelines for ${topic} in ${context}.`,
    },
    {
      taskType: 'letter',
      buildStem: ({ audience, topic }) =>
        `Write a thank-you letter to ${audience} for support with ${topic}. Match tone to a professional relationship.`,
    },
    {
      taskType: 'email',
      buildStem: ({ topic, context }) =>
        `Email a senior manager about risks involving ${topic} during ${context}. Use confident but respectful language.`,
    },
    {
      taskType: 'message',
      buildStem: ({ audience, topic }) =>
        `Reply to ${audience} in a friendly tone after they criticised your work on ${topic}.`,
    },
    {
      taskType: 'formal-request',
      buildStem: ({ audience, topic }) =>
        `Submit a formal request to ${audience} for approval of a ${topic} proposal.`,
    },
    {
      taskType: 'letter',
      buildStem: ({ context, topic }) =>
        `Write a letter of apology to a client after a ${context} error involving ${topic}.`,
    },
    {
      taskType: 'email',
      buildStem: ({ audience, topic, variant }) =>
        `Invite ${audience} to a briefing on ${topic}. Adjust formality to a workplace setting (session ${variant + 1}).`,
    },
    {
      taskType: 'note',
      buildStem: ({ topic }) =>
        `Write a public notice about ${topic} that is clear for general readers yet authoritative.`,
    },
    {
      taskType: 'message',
      buildStem: ({ audience, context }) =>
        `Message ${audience} to decline an invitation related to ${context} without causing offence.`,
    },
    {
      taskType: 'letter',
      buildStem: ({ topic, audience }) =>
        `Write a recommendation letter supporting ${audience}'s work on ${topic}.`,
    },
    {
      taskType: 'email',
      buildStem: ({ topic, context }) =>
        `Write to a vendor negotiating terms for ${topic} services in ${context}. Keep tone firm and courteous.`,
    },
    {
      taskType: 'formal-request',
      buildStem: ({ audience, topic }) =>
        `Request an extension from ${audience} for a deadline connected to ${topic}.`,
    },
    {
      taskType: 'note',
      buildStem: ({ context, topic }) =>
        `Draft an internal announcement about ${topic} policy changes in ${context}.`,
    },
    {
      taskType: 'message',
      buildStem: ({ topic }) =>
        `Respond to a rumour about ${topic} on a team chat channel with calm, factual language.`,
    },
    {
      taskType: 'letter',
      buildStem: ({ audience, topic }) =>
        `Write a formal inquiry to ${audience} about compliance requirements for ${topic}.`,
    },
    {
      taskType: 'email',
      buildStem: ({ context, topic }) =>
        `Congratulate a partner on success with ${topic} while noting one area for improvement in ${context}.`,
    },
  ],
  'argument-development': [
    {
      taskType: 'opinion',
      buildStem: ({ topic }) =>
        `Do you believe ${topic} should be a priority for public funding? Write a paragraph with your claim and two reasons.`,
    },
    {
      taskType: 'argument',
      buildStem: ({ topic, context }) =>
        `Argue for or against expanding ${topic} programmes in ${context}. Include a counterpoint and response.`,
    },
    {
      taskType: 'essay',
      buildStem: ({ topic }) =>
        `Write an argumentative paragraph on whether ${topic} creates more opportunities than risks.`,
    },
    {
      taskType: 'opinion',
      buildStem: ({ context, topic }) =>
        `State your position on mandatory training for ${topic} in ${context}. Support it with evidence-style examples.`,
    },
    {
      taskType: 'argument',
      buildStem: ({ topic, audience }) =>
        `Persuade ${audience} to adopt a new policy on ${topic}. Anticipate one objection.`,
    },
    {
      taskType: 'essay',
      buildStem: ({ topic }) =>
        `Examine whether long-term benefits of ${topic} outweigh short-term costs.`,
    },
    {
      taskType: 'opinion',
      buildStem: ({ topic, variant }) =>
        `Take a clear stance on proposal ${variant + 1} for reforming ${topic}. Defend your view in one paragraph.`,
    },
    {
      taskType: 'argument',
      buildStem: ({ context, topic }) =>
        `Build an argument that ${context} institutions should collaborate more on ${topic}.`,
    },
    {
      taskType: 'essay',
      buildStem: ({ topic, audience }) =>
        `Write a paragraph challenging a popular assumption about ${topic} held by ${audience}.`,
    },
    {
      taskType: 'opinion',
      buildStem: ({ topic }) =>
        `Is regulation of ${topic} too strict or too weak? Answer in a structured paragraph.`,
    },
    {
      taskType: 'argument',
      buildStem: ({ topic }) =>
        `Argue that ethical considerations must guide decisions about ${topic}, even when profits are affected.`,
    },
    {
      taskType: 'essay',
      buildStem: ({ context, topic }) =>
        `Discuss whether technological solutions alone can solve ${topic} challenges in ${context}.`,
    },
    {
      taskType: 'opinion',
      buildStem: ({ audience, topic }) =>
        `Convince ${audience} that ignoring ${topic} will create future problems.`,
    },
    {
      taskType: 'argument',
      buildStem: ({ topic, variant }) =>
        `Develop an argument comparing two policy options for ${topic} (Option ${variant + 1} vs Option ${variant + 2}).`,
    },
    {
      taskType: 'essay',
      buildStem: ({ topic }) =>
        `Write a paragraph evaluating whether media coverage of ${topic} is balanced.`,
    },
    {
      taskType: 'opinion',
      buildStem: ({ context, topic }) =>
        `Should ${context} leaders speak publicly about ${topic}? Give reasons and a brief conclusion.`,
    },
    {
      taskType: 'argument',
      buildStem: ({ topic }) =>
        `Construct an argument that education about ${topic} should begin earlier in school curricula.`,
    },
    {
      taskType: 'essay',
      buildStem: ({ topic, audience }) =>
        `Analyse for ${audience} whether current evidence supports major investment in ${topic}.`,
    },
    {
      taskType: 'opinion',
      buildStem: ({ topic }) =>
        `Present a nuanced opinion on whether ${topic} helps or harms social equality.`,
    },
    {
      taskType: 'argument',
      buildStem: ({ context, topic }) =>
        `Argue that ${context} policy on ${topic} should be revised, using claim, evidence, and rebuttal.`,
    },
  ],
};

export const buildWritingPromptItem = (input: {
  level: { id: string; order?: number };
  context: string;
  competency: string;
  index: number;
  module: { id: WritingModuleId; label: string };
}): WritingItemOutput => {
  const levelId = input.level.id;
  const seed = hashSeed(levelId, input.module.id, input.context, input.competency, input.index);
  const topic = pick(TOPICS, seed, 3);
  const audience = pick(AUDIENCES, seed, 9);
  const frames = MODULE_FRAMES[input.module.id];
  const frame = pick(frames, seed, input.index);
  const variant = (seed + input.index) % 20;
  const stem = frame.buildStem({
    levelId,
    context: input.context,
    topic,
    audience,
    variant,
  });
  const criteria = CRITERIA_BY_LEVEL[levelId] ?? CRITERIA_BY_LEVEL.B1;
  const minWords = MIN_WORDS_BY_LEVEL[levelId] ?? MIN_WORDS_BY_LEVEL.B1;

  return {
    stem,
    passageText: `Writing task (${input.module.label}) · Level ${levelId}\n\nRespond in at least ${minWords} words. Your answer will be evaluated for: ${criteria}.`,
    correctAnswer: `A strong response addresses the prompt directly, stays organised, uses appropriate vocabulary and grammar for ${levelId}, and meets the minimum length.`,
    distractors: [],
    explanation: `This task practices ${input.competency} through ${frame.taskType} writing in the ${input.module.label} module.`,
    hints: [
      `Module focus: ${input.module.label}`,
      `Task type: ${frame.taskType}`,
      `Minimum length: ${minWords} words`,
      `Context theme: ${input.context}`,
    ],
    minWords,
    evaluationCriteria: criteria,
    moduleType: input.module.id,
    moduleLabel: input.module.label,
    taskType: frame.taskType,
  };
};

export const getMinWordsForLevel = (levelId: string): number => MIN_WORDS_BY_LEVEL[levelId] ?? MIN_WORDS_BY_LEVEL.B1;

export const normalizeWritingStem = (stem: string): string =>
  stem
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 8)
    .join(' ');

export const getWritingFrameCount = (moduleId: WritingModuleId): number => MODULE_FRAMES[moduleId].length;
