import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { CefrContent, CefrLevel, LsrwSkill } from '../src/models/CefrContent';
import { env } from '../src/config/env';
import { synthesizeSpeech } from '../src/services/voice.service';
import { uploadBuffer } from '../src/services/storage.service';

dotenv.config();

type Question = {
  type: 'MCQ' | 'Open' | 'GapFill' | 'TrueFalse';
  prompt: string;
  options?: string[];
  answer: string | boolean;
  explanation?: string;
};

type ContentItem = {
  seedKey: string;
  level: CefrLevel;
  skill: LsrwSkill;
  title: string;
  content: string;
  questions: Question[];
  modelAnswer?: string;
  metadata?: Record<string, unknown>;
};

const LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const listeningTargets: Record<CefrLevel, number> = { A1: 80, A2: 120, B1: 180, B2: 250, C1: 350, C2: 450 };
const themes: Record<CefrLevel, string> = {
  A1: 'daily routine',
  A2: 'travel',
  B1: 'environment',
  B2: 'technology',
  C1: 'economics',
  C2: 'philosophy and ethics',
};

const supportWords: Record<CefrLevel, string[]> = {
  A1: 'morning home work bus lunch friend simple plan today clear easy time'.split(' '),
  A2: 'ticket station hotel map journey luggage visitor booking delay tomorrow comfortable route'.split(' '),
  B1: 'community recycling weather river garden volunteers local choices improve protect future habit'.split(' '),
  B2: 'platform device privacy automation network users digital service efficient reliable evidence'.split(' '),
  C1: 'markets productivity investment inflation policy households negotiation resilience incentives forecast'.split(' '),
  C2: 'judgment autonomy dignity responsibility ambiguity consequence principle fairness conscience interpretation'.split(' '),
};

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean);

const fitWords = (text: string, target: number, level: CefrLevel) => {
  const current = words(text);
  if (current.length > target) return `${current.slice(0, target).join(' ').replace(/[,.!?;:]$/, '')}.`;
  const additions: string[] = [];
  let index = 0;
  while (current.length + additions.length < target) {
    additions.push(supportWords[level][index % supportWords[level].length]);
    index += 1;
  }
  return `${text.trim()} ${additions.join(' ')}.`;
};

const questionSet = (title: string, level: CefrLevel, theme: string): Question[] => [
  {
    type: 'MCQ',
    prompt: `What is the main topic of "${title}"?`,
    options: [theme, 'a sports result', 'a cooking recipe', 'a film review'],
    answer: theme,
  },
  {
    type: 'MCQ',
    prompt: 'Which detail is most important for understanding the message?',
    options: ['A practical action or reason is given', 'The speaker changes countries', 'The story is about a celebrity', 'No problem is mentioned'],
    answer: 'A practical action or reason is given',
  },
  {
    type: 'MCQ',
    prompt: 'How should the listener respond?',
    options: ['Notice the situation and infer the next step', 'Ignore the speaker tone', 'Choose the longest sentence', 'Focus only on one name'],
    answer: 'Notice the situation and infer the next step',
  },
  {
    type: 'Open',
    prompt: 'In one or two sentences, explain the main idea.',
    answer: `The script is about ${theme} at ${level} level and includes a clear situation, key detail, and likely next action.`,
  },
];

const listeningBase = (level: CefrLevel, index: number, format: string) => {
  const theme = themes[level];
  const titles = {
    A1: ['A Normal Morning', 'Lunch at Work', 'Evening Plans'],
    A2: ['The Delayed Train', 'A Hotel Check-in', 'A City Bus Tour'],
    B1: ['Cleaning the River Path', 'A School Garden Plan', 'Less Plastic at the Market'],
    B2: ['A New App at Work', 'Privacy in a Smart Home', 'Robots in the Warehouse'],
    C1: ['A Local Price Shock', 'Small Firms and Interest Rates', 'A Debate on Wage Policy'],
    C2: ['The Honest Machine', 'Choosing for Future People', 'A Rule for Difficult Cases'],
  }[level];
  const title = titles[index - 1];

  const bodyByLevel: Record<CefrLevel, string[]> = {
    A1: [
      'Mina wakes at six. She washes, eats rice cakes, and checks her blue bag. Her father asks if she has her key. Mina says yes and walks to the bus stop. She meets Ravi there. They talk about class and the small test after lunch.',
      'Arun works in a shop. At one o clock, he opens his lunch box. His friend Leela has tea and a banana. They sit near the window. Leela says the shop is quiet today. Arun says they can clean the front table before customers return.',
      'Nila calls her brother. She wants to buy milk, bread, and fruit before dinner. Her brother is at the park, so he says he can meet her near the corner shop. They plan to cook at home and watch a short film.',
    ],
    A2: [
      'Reporter: The train to Hill Town is twenty minutes late because rain has slowed traffic near the bridge. Passengers with online tickets should wait on platform two. A station worker says the delay is short and the train will leave before noon.',
      'Clerk: Welcome to Lake View Hotel. Guest: I booked one room for two nights. Clerk: I can see your booking. Breakfast starts at seven, and the lift is on your left. Guest: Thank you. Is the museum far from here? Clerk: Ten minutes by bus.',
      'Guide: Good morning, everyone. Our city bus tour begins at the old post office. Please keep your ticket until the end. We will stop at the river, the market, and the science museum. If you need help, ask me before each stop.',
    ],
    B1: [
      'Interviewer: Why did your group clean the river path? Volunteer: People used it every day, but bottles and snack packets were everywhere. We wanted families to walk safely again. At first, only six people came. Later, a school club joined us, and the local shop gave bags.',
      'News reader: Greenfield School will turn an empty corner of its playground into a vegetable garden. Teachers say the project will help students learn biology in a practical way. Parents have offered tools, while older students will record plant growth and water use.',
      'Conversation: Ben says the market now charges for plastic bags. Aisha thinks this is fair because many bags ended up near the canal. Ben worries older shoppers may forget cloth bags. Aisha suggests signs at the entrance and a small discount for reusable bags.',
    ],
    B2: [
      'Academic talk: The company introduced a scheduling app to reduce missed appointments. The app sends reminders, predicts busy hours, and lets staff exchange shifts. Early results look positive, but some employees say constant notifications make them feel watched rather than supported.',
      'Interview: Smart home devices can save energy, but they also collect detailed information about family routines. The designer says privacy should be built into the product, not added later. Users need clear settings, local storage options, and warnings when data leaves the home.',
      'News feature: A regional warehouse has started using small robots to move boxes between shelves. Managers report fewer lifting injuries and faster packing times. However, workers need new training, and the union wants guarantees that automation will change tasks rather than simply remove jobs.',
    ],
    C1: [
      'Economic report: Food prices in the coastal district rose after storms damaged transport links. The issue is not only supply. Traders also face higher insurance costs and uncertain delivery times. Families with fixed incomes are changing shopping habits, while small restaurants are shortening menus.',
      'Panel discussion: When interest rates rise, small firms often delay equipment purchases. One economist argues this protects them from risky debt. Another says delayed investment can weaken productivity for years. The disagreement shows why policy makers must consider timing, confidence, and unequal access to credit.',
      'Interview: A proposed wage policy has divided local employers. Supporters say higher pay improves retention and demand. Critics worry about thin margins in seasonal businesses. The mayor suggests a phased plan with tax relief, but the debate remains focused on who carries the transition cost.',
    ],
    C2: [
      'Philosophy seminar: Imagine a machine that always tells the truth, even when tact would prevent harm. Some students call it morally pure; others call it socially careless. The lecturer argues that honesty is not a single virtue but a practice shaped by intention, consequence, and relationship.',
      'Academic dialogue: We often make choices for people who do not yet exist, such as future citizens affected by climate decisions. The ethical problem is representation. They cannot consent, reward us, or complain. Yet our policies may narrow or expand the conditions of their freedom.',
      'Radio essay: Rules help us act consistently, but hard cases expose their limits. A doctor, a judge, and a teacher may all follow rules while still needing judgment. The question is not whether principles matter, but when moral attention requires a careful exception.',
    ],
  };

  return {
    title,
    format,
    script: fitWords(bodyByLevel[level][index - 1], listeningTargets[level], level),
  };
};

const buildListening = (): ContentItem[] =>
  LEVELS.flatMap((level) =>
    ['casual conversation', 'news-style report', 'academic or interview format'].map((format, idx) => {
      const item = listeningBase(level, idx + 1, format);
      return {
        seedKey: `cefr:${level}:L:${idx + 1}`,
        level,
        skill: 'L',
        title: item.title,
        content: item.script,
        questions: questionSet(item.title, level, themes[level]),
        metadata: {
          theme: themes[level],
          format,
          targetWordCount: listeningTargets[level],
          actualWordCount: words(item.script).length,
        },
      };
    }),
  );

const readingTemplates = (level: CefrLevel, index: number) => {
  const theme = themes[level];
  const titles = [`${theme} in a local story`, `${theme} and a careful choice`];
  const content = fitWords(
    `This original passage explores ${theme} through a realistic situation for ${level} learners. The first paragraph gives clear background and introduces a problem. The second paragraph explains how people respond, what changes, and why the result matters. One key sentence includes a blank: The group decided to _____ because the first plan was too expensive. Readers should notice details, sequence, and opinion rather than guess from single words.`,
    { A1: 95, A2: 125, B1: 170, B2: 220, C1: 290, C2: 340 }[level],
    level,
  );
  return { title: titles[index - 1], content };
};

const buildReading = (): ContentItem[] =>
  LEVELS.flatMap((level) =>
    [1, 2].map((idx) => {
      const reading = readingTemplates(level, idx);
      return {
        seedKey: `cefr:${level}:R:${idx}`,
        level,
        skill: 'R',
        title: reading.title,
        content: reading.content,
        questions: [
          { type: 'GapFill', prompt: 'Complete the sentence: The group decided to _____.', answer: 'change the plan' },
          {
            type: 'MCQ',
            prompt: 'What should readers mainly understand?',
            options: ['The problem and response', 'Only the names', 'A recipe', 'A sports score'],
            answer: 'The problem and response',
          },
          { type: 'TrueFalse', prompt: 'The passage includes a reason for a decision.', answer: true },
        ],
        metadata: { theme: themes[level], passageNumber: idx },
      };
    }),
  );

const buildWriting = (): ContentItem[] =>
  LEVELS.flatMap((level) =>
    [1, 2].map((idx) => {
      const theme = themes[level];
      const prompt =
        idx === 1
          ? `Write about a personal experience connected to ${theme}. Explain what happened and what you learned.`
          : `Write a short opinion response about ${theme}. Give reasons and one example.`;
      return {
        seedKey: `cefr:${level}:W:${idx}`,
        level,
        skill: 'W',
        title: idx === 1 ? `Experience writing: ${theme}` : `Opinion writing: ${theme}`,
        content: prompt,
        questions: [
          { type: 'Open', prompt: 'Task focus', answer: 'Address all parts of the prompt with clear organisation.' },
          { type: 'Open', prompt: 'Rubric', answer: 'Content, organisation, vocabulary, grammar, and task achievement.' },
        ],
        modelAnswer: fitWords(
          `A strong answer at ${level} level directly addresses ${theme}, gives specific details, and uses linking language. The writer explains the situation, develops one main idea, and finishes with a clear final sentence. The vocabulary is accurate for the level and the grammar supports meaning without distracting the reader.`,
          { A1: 70, A2: 90, B1: 130, B2: 170, C1: 220, C2: 260 }[level],
          level,
        ),
        metadata: {
          rubric: [
            'Task achievement: answers the full prompt',
            'Organisation: clear beginning, development, and ending',
            'Vocabulary: level-appropriate range and accuracy',
            'Grammar: accurate forms with understandable meaning',
          ],
        },
      };
    }),
  );

const buildSpeaking = (): ContentItem[] =>
  LEVELS.flatMap((level) =>
    [1, 2].map((idx) => {
      const theme = themes[level];
      const bullets =
        idx === 1
          ? ['describe the situation', 'say who is involved', 'explain why it matters', 'say what may happen next']
          : ['describe a problem', 'explain one possible solution', 'compare two choices', 'give your opinion'];
      return {
        seedKey: `cefr:${level}:S:${idx}`,
        level,
        skill: 'S',
        title: idx === 1 ? `Long turn: ${theme}` : `Problem card: ${theme}`,
        content: `Speak for one to two minutes about ${theme}. You should ${bullets.join(', ')}.`,
        questions: bullets.map((bullet) => ({ type: 'Open' as const, prompt: bullet, answer: 'Student speaks using relevant detail.' })),
        modelAnswer: `A complete response mentions ${theme}, gives organized details, and uses examples instead of isolated words.`,
        metadata: { taskType: 'IELTS Part 2 inspired original card', bullets },
      };
    }),
  );

const buildContent = () => [...buildListening(), ...buildReading(), ...buildWriting(), ...buildSpeaking()];

const uploadListeningAudio = async (item: ContentItem) => {
  if (!env.ELEVENLABS_API_KEY) {
    return { audioUrl: undefined, audioContentType: undefined, skipped: 'ELEVENLABS_API_KEY is not configured' };
  }

  const audio = await synthesizeSpeech(item.content, 'default', undefined, 'meera', {
    context: 'listening',
    level: item.level,
  });
  const extension = audio.contentType.includes('wav') ? 'wav' : 'mp3';
  const stored = await uploadBuffer(
    {
      buffer: audio.buffer,
      originalname: `${item.seedKey.replace(/[:]/g, '-')}.${extension}`,
      mimetype: audio.contentType,
    } as Express.Multer.File,
    'listening-audio',
  );

  return { audioUrl: stored.url, audioContentType: audio.contentType };
};

const main = async () => {
  await mongoose.connect(env.MONGODB_URI);
  const items = buildContent();
  let audioGenerated = 0;
  let audioSkipped = 0;

  for (const item of items) {
    const audio = item.skill === 'L' ? await uploadListeningAudio(item) : {};
    if ('audioUrl' in audio && audio.audioUrl) audioGenerated += 1;
    if ('skipped' in audio) audioSkipped += 1;

    await CefrContent.updateOne(
      { seedKey: item.seedKey },
      {
        $set: {
          ...item,
          audioUrl: 'audioUrl' in audio ? audio.audioUrl : undefined,
          audioContentType: 'audioContentType' in audio ? audio.audioContentType : undefined,
          metadata: {
            ...(item.metadata ?? {}),
            audioSkippedReason: 'skipped' in audio ? audio.skipped : undefined,
          },
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
  }

  console.log(
    JSON.stringify(
      {
        insertedOrUpdated: items.length,
        listeningItems: items.filter((item) => item.skill === 'L').length,
        audioGenerated,
        audioSkipped,
      },
      null,
      2,
    ),
  );
  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
