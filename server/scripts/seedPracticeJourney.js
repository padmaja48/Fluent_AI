const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

require('ts-node/register/transpile-only');
const { buildReadingItemContent } = require('../src/services/readingPassageGenerator.service');

const QUESTIONS_PER_SKILL_LEVEL = 1000;
const MODULES_PER_SKILL_LEVEL = 5;
const QUESTIONS_PER_MODULE = QUESTIONS_PER_SKILL_LEVEL / MODULES_PER_SKILL_LEVEL;

const moduleCatalog = {
  Listening: [
    { id: 'gist-and-purpose', label: 'Gist & Purpose' },
    { id: 'details-and-numbers', label: 'Details & Numbers' },
    { id: 'speaker-intent', label: 'Speaker Intent' },
    { id: 'inference-and-tone', label: 'Inference & Tone' },
    { id: 'sequence-and-action', label: 'Sequence & Action' },
  ],
  Speaking: [
    { id: 'short-response', label: 'Short Response' },
    { id: 'personal-story', label: 'Personal Story' },
    { id: 'role-play', label: 'Role Play' },
    { id: 'discussion', label: 'Discussion' },
    { id: 'follow-up-defense', label: 'Follow-up Defense' },
  ],
  Reading: [
    { id: 'main-idea', label: 'Main Idea' },
    { id: 'detail-search', label: 'Detail Search' },
    { id: 'vocabulary', label: 'Vocabulary' },
    { id: 'purpose-and-tone', label: 'Purpose & Tone' },
    { id: 'logic-and-inference', label: 'Logic & Inference' },
  ],
  Writing: [
    { id: 'sentence-control', label: 'Sentence Control' },
    { id: 'paragraph-building', label: 'Paragraph Building' },
    { id: 'cohesion', label: 'Cohesion' },
    { id: 'tone-and-register', label: 'Tone & Register' },
    { id: 'argument-development', label: 'Argument Development' },
  ],
};

const levels = [
  {
    id: 'A1',
    order: 1,
    descriptor: 'basic words, introductions, simple facts',
    contexts: ['daily routine', 'family', 'classroom', 'food', 'directions'],
  },
  {
    id: 'A2',
    order: 2,
    descriptor: 'short messages, simple past/future plans, familiar tasks',
    contexts: ['shopping', 'travel', 'health', 'work schedule', 'local services'],
  },
  {
    id: 'B1',
    order: 3,
    descriptor: 'connected ideas, opinions, reasons, common workplace situations',
    contexts: ['team updates', 'study plans', 'customer support', 'personal goals', 'community events'],
  },
  {
    id: 'B2',
    order: 4,
    descriptor: 'abstract topics, detailed explanations, tradeoffs, professional scenarios',
    contexts: ['remote work', 'product decisions', 'technical debugging', 'career growth', 'project planning'],
  },
  {
    id: 'C1',
    order: 5,
    descriptor: 'nuanced argument, implicit meaning, synthesis, precise register',
    contexts: ['policy debate', 'research summary', 'stakeholder alignment', 'risk analysis', 'leadership feedback'],
  },
  {
    id: 'C2',
    order: 6,
    descriptor: 'near-native nuance, rhetoric, idioms, ambiguity, sophisticated critique',
    contexts: ['executive briefing', 'academic critique', 'negotiation', 'systems thinking', 'ethics review'],
  },
];

const skills = [
  {
    id: 'Listening',
    order: 1,
    competencies: ['main idea', 'detail recognition', 'speaker intent', 'inference', 'sequence'],
    stem: ({ level, context, competency, index }) =>
      `Listening ${level.id}.${index}: In a ${context} audio clip using ${level.descriptor}, what best captures the ${competency}?`,
  },
  {
    id: 'Speaking',
    order: 2,
    competencies: ['response structure', 'clarity', 'fluency strategy', 'pronunciation focus', 'follow-up handling'],
    stem: ({ level, context, competency, index }) =>
      `Speaking ${level.id}.${index}: For a ${context} prompt at ${level.id}, which response best demonstrates ${competency}?`,
  },
  {
    id: 'Reading',
    order: 3,
    competencies: ['skim reading', 'specific detail', 'vocabulary in context', 'author purpose', 'logical connection'],
    stem: ({ level, context, competency, index }) =>
      `Reading ${level.id}.${index}: Read the ${context} passage and answer the ${competency} question.`,
  },
  {
    id: 'Writing',
    order: 4,
    competencies: ['sentence control', 'paragraph unity', 'cohesion', 'tone', 'argument development'],
    stem: ({ level, context, competency, index }) =>
      `Writing ${level.id}.${index}: For a ${context} writing task at ${level.id}, which revision best improves ${competency}?`,
  },
];

const templates = [
  {
    topic: 'Foundations',
    correct: ({ skill, level, context, competency }) =>
      `Use a clear ${level.id} ${skill.id.toLowerCase()} strategy for ${competency} in the ${context} context.`,
    distractors: ({ context }) => [
      `Ignore the ${context} context and choose the longest answer.`,
      'Focus only on isolated words without checking meaning.',
      'Use a response that is unrelated to the task goal.',
    ],
  },
  {
    topic: 'Accuracy',
    correct: ({ skill, level, competency }) =>
      `Identify the exact cue and answer with accurate ${level.id} ${skill.id.toLowerCase()} evidence for ${competency}.`,
    distractors: () => [
      'Guess from one familiar word only.',
      'Choose an answer because it sounds more formal.',
      'Repeat the question without adding useful information.',
    ],
  },
  {
    topic: 'Fluency',
    correct: ({ level, context }) =>
      `Connect ideas naturally while staying within the ${level.id} task and ${context} situation.`,
    distractors: () => [
      'Use memorized phrases even when they do not fit.',
      'Add many complex words without a clear point.',
      'Avoid answering the main question.',
    ],
  },
  {
    topic: 'Inference',
    correct: ({ competency }) =>
      `Combine explicit clues with context to make a reasonable judgment about ${competency}.`,
    distractors: () => [
      'Treat every indirect clue as irrelevant.',
      'Assume the opposite of the stated information.',
      'Select an extreme claim not supported by evidence.',
    ],
  },
  {
    topic: 'Production',
    correct: ({ skill, level }) =>
      `Produce a focused ${skill.id.toLowerCase()} answer with ${level.id}-appropriate detail and organization.`,
    distractors: () => [
      'List disconnected ideas with no order.',
      'Use a vague answer that could fit any question.',
      'Change the subject to a different task.',
    ],
  },
];

const rotateOptions = (correctAnswer, distractors, index) => {
  const allOptions = [correctAnswer, ...distractors];
  const shift = index % allOptions.length;
  const rotated = [...allOptions.slice(shift), ...allOptions.slice(0, shift)];

  return rotated.map((text) => ({
    text,
    isCorrect: text === correctAnswer,
  }));
};

const buildQuestion = (skill, level, index) => {
  const competency = skill.competencies[(index - 1) % skill.competencies.length];
  const context = level.contexts[(index - 1) % level.contexts.length];
  const template = templates[(index - 1) % templates.length];
  const moduleOrder = Math.floor((index - 1) / QUESTIONS_PER_MODULE) + 1;
  const moduleQuestionOrder = ((index - 1) % QUESTIONS_PER_MODULE) + 1;
  const module = moduleCatalog[skill.id][moduleOrder - 1];
  const correctAnswer = template.correct({ skill, level, context, competency });
  const options = rotateOptions(correctAnswer, template.distractors({ skill, level, context, competency }), index);

  const question = {
    seedKey: `journey:${skill.id}:${level.id}:${String(index).padStart(3, '0')}`,
    stem: skill.stem({ level, context, competency, index }),
    skill: skill.id,
    level: level.id,
    type: 'MCQ',
    options,
    correctAnswer,
    explanation: `Journey ${index}/${QUESTIONS_PER_SKILL_LEVEL} for ${skill.id} ${level.id}: this item practices ${competency} through ${context}.`,
    journeyOrder: index,
    levelOrder: level.order,
    skillOrder: skill.order,
    topic: template.topic,
    competency,
    moduleType: module.id,
    moduleLabel: module.label,
    moduleOrder,
    moduleQuestionOrder,
    status: 'Active',
    updatedAt: new Date(),
  };

  if (skill.id === 'Listening') {
    const listeningItem = buildListeningItem({ level, context, competency, index, module });
    question.passageText = listeningItem.passageText;
    question.audioPrompt = `Listen to clip ${level.id}.${String(index).padStart(4, '0')} about ${context}, then answer the question.`;
    question.stem = listeningItem.stem;
    question.correctAnswer = listeningItem.correctAnswer;
    question.options = rotateOptions(listeningItem.correctAnswer, listeningItem.distractors, index);
    question.explanation = listeningItem.explanation;
  }

  if (skill.id === 'Reading') {
    const readingItem = buildReadingItemContent({ level, context, competency, index, module });
    question.stem = readingItem.stem;
    question.passageText = readingItem.passageText;
    question.audioPrompt = readingItem.title;
    question.correctAnswer = readingItem.correctAnswer;
    question.options = rotateOptions(readingItem.correctAnswer, readingItem.distractors, index);
    question.explanation = readingItem.explanation;
    question.moduleType = 'reading-comprehension';
    question.moduleLabel = 'Reading Comprehension';
    question.competency = readingItem.competency || competency;
  }

  if (skill.id === 'Speaking') {
    const speakingItem = buildSpeakingItem({ level, context, competency, index, module });
    question.type = 'Task';
    question.stem = speakingItem.stem;
    question.passageText = speakingItem.passageText;
    question.correctAnswer = speakingItem.correctAnswer;
    question.options = rotateOptions(speakingItem.correctAnswer, speakingItem.distractors, index);
    question.explanation = speakingItem.explanation;
    question.hints = speakingItem.hints;
  }

  if (skill.id === 'Writing') {
    const writingItem = buildWritingItem({ level, context, competency, index, module });
    question.type = 'MCQ';
    question.stem = writingItem.stem;
    question.passageText = writingItem.passageText;
    question.correctAnswer = writingItem.correctAnswer;
    question.options = rotateOptions(writingItem.correctAnswer, writingItem.distractors, index);
    question.explanation = writingItem.explanation;
    question.hints = writingItem.hints;
    question.audioPrompt = writingItem.evaluationCriteria;
    question.moduleType = writingItem.moduleType;
    question.moduleLabel = writingItem.moduleLabel;
    question.competency = writingItem.competency;
  }

  return question;
};

const buildListeningItem = ({ level, context, competency, index, module }) => {
  const reference = `LC-${level.id}-${String(index).padStart(4, '0')}`;
  const passageText = buildListeningPassage({ level, context, competency, index });
  const actionMatch = passageText.match(
    /We need to (.*?) at minute|next step is to (.*?) (?:before|after|by|once|when)|suggested we (.*?), but|stronger choice is to (.*?), because|choice is to (.*?), because|By proposing to (.*?) (?:before|after|by|once|when)|recommendation to (.*?) (?:before|after|by|once|when)/,
  );
  const detailMatch = passageText.match(
    /important detail is the ([^.]+)|mention the ([^.]+)|checking the ([^.]+)|compared the .+? with the ([^.]+)|around ([^.]+?) suggests|using the ([^,]+),/,
  );
  const action = (actionMatch?.slice(1).find(Boolean) || 'take the recommended next step').trim();
  const detail = (detailMatch?.slice(1).find(Boolean) || 'a specific detail from the clip').trim();
  const cause = level.order >= 5 ? 'the speaker is signaling caution indirectly' : 'the speakers need a clearer next step';

  const questionByCompetency = {
    'main idea': {
      stem: `Listening ${level.id}.${index} (${module.label}): What is the main idea of clip ${reference}?`,
      correctAnswer: `The speakers are discussing ${context} and agreeing on a careful next step: ${action}.`,
      distractors: [
        `The speakers are introducing an unrelated travel plan.`,
        `The speakers decide to ignore the ${context} issue completely.`,
        `The speakers only list names and do not discuss a decision.`,
      ],
      explanation: `The clip centers on ${context} and points toward the action '${action}'.`,
    },
    'detail recognition': {
      stem: `Listening ${level.id}.${index} (${module.label}): Which detail should the listener remember from clip ${reference}?`,
      correctAnswer: `The clip includes ${detail} as an important detail in the ${context} discussion.`,
      distractors: [
        `The clip says the meeting was cancelled for a holiday.`,
        `The clip says the password was lost before the call.`,
        `The clip says the topic changed to restaurant booking.`,
      ],
      explanation: `The correct option stays inside the ${context} clip and identifies a concrete detail.`,
    },
    'speaker intent': {
      stem: `Listening ${level.id}.${index} (${module.label}): What is the speaker trying to do?`,
      correctAnswer: `The speaker is trying to guide the listener toward ${action} because ${cause}.`,
      distractors: [
        `The speaker is trying to end the conversation without a next step.`,
        `The speaker is trying to criticize the listener personally.`,
        `The speaker is trying to replace the topic with a private story.`,
      ],
      explanation: `The speaker's intent is practical: move the ${context} situation toward a useful next step.`,
    },
    inference: {
      stem: `Listening ${level.id}.${index} (${module.label}): What can you infer from the speakers' tone?`,
      correctAnswer: `They support progress on ${context}, but they want the decision handled carefully.`,
      distractors: [
        `They are certain that no action is needed.`,
        `They are angry and refuse to cooperate.`,
        `They think ${context} is unrelated to the discussion.`,
      ],
      explanation: `The indirect clues show cautious agreement rather than rejection or certainty.`,
    },
    sequence: {
      stem: `Listening ${level.id}.${index} (${module.label}): What should happen next?`,
      correctAnswer: `The next step is to ${action} after considering the ${context} details.`,
      distractors: [
        `The next step is to delete the notes and stop the work.`,
        `The next step is to switch to a different topic immediately.`,
        `The next step is to ignore the people involved.`,
      ],
      explanation: `The clip moves from the situation to the recommended action.`,
    },
  };

  return {
    passageText,
    ...questionByCompetency[competency],
  };
};

const buildSpeakingItem = ({ level, context, competency, index, module }) => {
  const roles = ['classmate', 'teammate', 'mentor', 'client', 'interviewer', 'project lead', 'teacher', 'community organizer'];
  const goals = [
    'explain your preference',
    'describe a recent experience',
    'ask for clarification',
    'respond to a concern',
    'summarize your recommendation',
    'compare two options',
    'give constructive feedback',
    'handle a follow-up question',
  ];
  const constraints = [
    'use one clear reason',
    'include a concrete example',
    'keep the tone polite',
    'organize the answer into two points',
    'acknowledge the other person first',
    'finish with a practical next step',
    'avoid repeating the same phrase',
    'speak naturally for about forty seconds',
  ];
  const pick = (items, multiplier, offset = 0) =>
    items[((level.order * QUESTIONS_PER_SKILL_LEVEL + index) * multiplier + offset) % items.length];
  const role = pick(roles, 5, index);
  const goal = pick(goals, 7, level.order);
  const constraint = pick(constraints, 11, index);
  const reference = `SC-${level.id}-${String(index).padStart(4, '0')}`;

  const promptByLevel = {
    A1: `Your ${role} asks about ${context}. Give a short answer with simple sentences.`,
    A2: `Your ${role} asks you to talk about ${context}. Answer with a reason and one familiar detail.`,
    B1: `Your ${role} wants your opinion about ${context}. Give a connected answer with a reason and an example.`,
    B2: `Your ${role} asks you to discuss ${context}. Compare options, explain a tradeoff, and end with a recommendation.`,
    C1: `Your ${role} raises a nuanced concern about ${context}. Respond diplomatically, synthesize the concern, and propose a clear next step.`,
    C2: `Your ${role} challenges an assumption about ${context}. Give a precise, fluent response that balances evidence, nuance, and practical judgment.`,
  };

  const focusByCompetency = {
    'response structure': `start with a direct answer, develop ${goal}, and finish with a clear closing idea`,
    clarity: `make the main point easy to follow while discussing ${context}`,
    'fluency strategy': `connect ideas smoothly and recover naturally if you pause`,
    'pronunciation focus': `speak at a steady pace with clear word endings and sentence stress`,
    'follow-up handling': `acknowledge the question, answer it directly, and add one useful detail`,
  };

  return {
    stem: `Speaking ${level.id}.${index} (${module.label}): ${promptByLevel[level.id]}`,
    passageText: `${reference}. Module: ${module.label}. Task focus: ${goal}. Constraint: ${constraint}.`,
    correctAnswer: `A strong response should ${focusByCompetency[competency]}, and it should ${constraint}.`,
    distractors: [
      `A weak response changes the topic away from ${context} and gives no relevant reason.`,
      `A weak response lists memorized phrases without answering the ${role}'s question.`,
      `A weak response is too vague to show ${competency} in this situation.`,
    ],
    explanation: `This speaking task evaluates ${competency}: the response must address ${context}, meet the constraint, and sound natural for ${level.id}.`,
    hints: [`Talk to the ${role}.`, `Goal: ${goal}.`, `Constraint: ${constraint}.`],
  };
};

const buildWritingCorrectionItem = ({ level, context, competency, index, module }) => {
  const pick = (items, multiplier, offset = 0) =>
    items[((level.order * QUESTIONS_PER_SKILL_LEVEL + index) * multiplier + offset) % items.length];
  const actors = ['candidate', 'manager', 'student', 'analyst', 'team lead', 'customer', 'trainer', 'engineer'];
  const subjects = ['project update', 'meeting note', 'client email', 'support reply', 'application form', 'training message'];
  const actor = pick(actors, 5, level.order);
  const subject = pick(subjects, 7, index);
  const section = [
    { id: 'sentence-correction', label: 'Sentence Correction' },
    { id: 'error-detection', label: 'Error Detection' },
    { id: 'fill-in-the-blanks', label: 'Fill in the Blanks' },
    { id: 'correct-sentence', label: 'Choose the Correct Sentence' },
    { id: 'vocabulary', label: 'Vocabulary' },
    { id: 'sentence-completion', label: 'Sentence Completion' },
  ][(index - 1) % 6];
  const word = pick([
    { term: 'accurate', synonym: 'correct', antonym: 'incorrect', wrong: ['late', 'brief', 'ordinary'] },
    { term: 'expand', synonym: 'increase', antonym: 'reduce', wrong: ['protect', 'borrow', 'repeat'] },
    { term: 'brief', synonym: 'short', antonym: 'lengthy', wrong: ['polite', 'modern', 'private'] },
    { term: 'reliable', synonym: 'dependable', antonym: 'unreliable', wrong: ['colourful', 'distant', 'temporary'] },
    { term: 'complex', synonym: 'complicated', antonym: 'simple', wrong: ['silent', 'early', 'friendly'] },
    { term: 'formal', synonym: 'official', antonym: 'casual', wrong: ['popular', 'empty', 'local'] },
  ], 19, index);
  const connector = pick(['because', 'although', 'therefore', 'however', 'unless', 'while'], 23, level.order);

  const blueprints = {
    'sentence-correction': {
      focus: 'subject-verb agreement',
      stem: 'Choose the best corrected version of the sentence.',
      passageText: `Original sentence:\nThe ${actor} have reviewed the ${subject}.`,
      correctAnswer: `The ${actor} has reviewed the ${subject}.`,
      distractors: [
        `The ${actor} having reviewed the ${subject}.`,
        `The ${actor} have review the ${subject}.`,
        `The ${actor} has reviewing the ${subject}.`,
      ],
      explanation: 'The singular subject takes "has", and the verb form should be "reviewed".',
    },
    'error-detection': {
      focus: 'error detection',
      stem: 'Which part of the sentence contains the error?',
      passageText: `Sentence:\nThe ${actor} discussed the ${subject} and send the final note yesterday.`,
      correctAnswer: 'send the final note',
      distractors: [`The ${actor}`, `discussed the ${subject}`, 'yesterday'],
      explanation: 'The sentence uses past time, so "send" should be "sent".',
    },
    'fill-in-the-blanks': {
      focus: 'connector usage',
      stem: `Choose the best word to complete the sentence: The ${subject} was delayed, ____ the team informed the client immediately.`,
      passageText: `Context: ${context}`,
      correctAnswer: 'so',
      distractors: ['but', 'unless', 'although'],
      explanation: '"So" shows the result of the delay: the team informed the client.',
    },
    'correct-sentence': {
      focus: 'complete sentence structure',
      stem: 'Choose the grammatically correct sentence.',
      passageText: `Topic: ${context}`,
      correctAnswer: `The ${actor} explained the ${subject} clearly before the meeting started.`,
      distractors: [
        `The ${actor} explain the ${subject} clearly before the meeting started.`,
        `The ${actor} explained the ${subject} clearly before the meeting start.`,
        `The ${actor} explaining the ${subject} clearly before the meeting started.`,
      ],
      explanation: 'The correct option has a complete subject, verb, object, and consistent past tense.',
    },
    vocabulary: {
      focus: index % 2 === 0 ? 'antonym' : 'synonym',
      stem: `${index % 2 === 0 ? 'Choose the closest antonym' : 'Choose the closest synonym'} of "${word.term}".`,
      passageText: `Vocabulary in context: The ${subject} must be ${word.term} for the client review.`,
      correctAnswer: index % 2 === 0 ? word.antonym : word.synonym,
      distractors: word.wrong,
      explanation: `${index % 2 === 0 ? word.antonym : word.synonym} is the best ${index % 2 === 0 ? 'opposite' : 'match'} for "${word.term}" in this context.`,
    },
    'sentence-completion': {
      focus: 'sentence completion',
      stem: `Complete the sentence: ${connector.charAt(0).toUpperCase() + connector.slice(1)} the ${subject} needed revisions,`,
      passageText: `Context: ${context}`,
      correctAnswer: `the ${actor} scheduled a follow-up review.`,
      distractors: [
        `because the ${actor} schedule a follow-up review.`,
        `the ${actor} schedule follow-up reviewed.`,
        `so the ${actor} scheduling a follow-up review.`,
      ],
      explanation: 'The clause must finish as a complete, grammatical main clause.',
    },
  };

  const item = blueprints[section.id];

  return {
    moduleType: section.id,
    moduleLabel: section.label,
    competency: item.focus,
    stem: `${section.label}: ${item.stem}`,
    passageText: item.passageText,
    correctAnswer: item.correctAnswer,
    distractors: item.distractors,
    explanation: item.explanation,
    hints: [
      `Module: ${module.label}`,
      `Focus: ${item.focus}`,
      `Level: ${level.id}`,
      `Context: ${context}`,
      `Competency: ${competency}`,
    ],
    evaluationCriteria: `${section.label}: ${item.focus}`,
  };
};

const buildWritingItem = ({ level, context, competency, index, module }) => {
  const pick = (items, multiplier, offset = 0) =>
    items[((level.order * QUESTIONS_PER_SKILL_LEVEL + index) * multiplier + offset) % items.length];

  return buildWritingCorrectionItem({ level, context, competency, index, module });

  // Real writing prompts by level and module type
  const promptsByModule = {
    'sentence-control': {
      A1: [
        `Write 2–3 sentences to your teacher explaining why you were absent from class.`,
        `Write a short message to a friend asking them to meet you at the library.`,
        `Write 2–3 sentences about your favourite food and why you like it.`,
        `Write a note to your neighbour asking them to keep noise down in the evening.`,
        `Write 2 sentences introducing yourself to a new classmate.`,
      ],
      A2: [
        `Write a short email to your manager explaining that you will be late to work today and why.`,
        `Write a note to a friend describing a place you visited recently.`,
        `Write 3–4 sentences recommending a local restaurant to a colleague.`,
        `Write a brief message to a shop asking about the opening hours.`,
        `Write a short email cancelling an appointment and suggesting a new time.`,
      ],
      B1: [
        `Write an email to your team lead updating them on the progress of your current project.`,
        `Write a message to a customer explaining a delay in their order and what you will do about it.`,
        `Write a paragraph describing a problem in your community and one solution you would suggest.`,
        `Write an email to a colleague giving feedback on a report they shared with you.`,
        `Write a short message to a landlord asking for a repair to be made in your flat.`,
      ],
      B2: [
        `Write a professional email to a client proposing a change to the project timeline, including your reasons and a clear action point.`,
        `Write a paragraph arguing for or against remote work, using at least two specific reasons and one example.`,
        `Write an internal memo to your team explaining a new policy and what action is expected from them.`,
        `Write a covering letter paragraph for a job you are applying for, highlighting your most relevant experience.`,
        `Write an email to a senior manager summarising the outcome of a meeting and the decisions made.`,
      ],
      C1: [
        `Write a diplomatic email to a stakeholder who disagrees with a decision your team has made, acknowledging their concern and explaining your reasoning.`,
        `Write a formal complaint letter to a service provider, detailing the issue, its impact, and the resolution you expect.`,
        `Write a persuasive paragraph advocating for increased investment in a specific area of your organisation.`,
        `Write a briefing note summarising a complex issue for a senior leader who has no prior knowledge of it.`,
        `Write an apology email to a client for a serious error, taking accountability and offering a concrete remedy.`,
      ],
      C2: [
        `Write a nuanced executive summary of a controversial proposal, balancing its benefits and risks without overstating either.`,
        `Write a carefully worded email declining a request while preserving the professional relationship.`,
        `Write a policy commentary paragraph that critiques an existing approach and proposes a more effective alternative, using precise language.`,
        `Write a persuasive essay opening paragraph on the ethical implications of AI in the workplace.`,
        `Write a diplomatic response to a public criticism of your organisation, using measured and authoritative language.`,
      ],
    },
    'paragraph-building': {
      A1: [
        `Write a short paragraph about your daily routine. Include at least three activities.`,
        `Describe your family in a paragraph. Mention at least two family members.`,
        `Write a paragraph about your classroom. What do you see and do there?`,
        `Write a paragraph about your favourite season and why you like it.`,
        `Describe your home in a short paragraph.`,
      ],
      A2: [
        `Write a paragraph about a recent trip or outing you took. What did you do and how did you feel?`,
        `Describe a typical Saturday for you in a paragraph.`,
        `Write a paragraph about a problem at your workplace or school and how you dealt with it.`,
        `Write a paragraph about a skill you are learning and why you chose it.`,
        `Describe someone you admire in a paragraph. What do they do and why do you admire them?`,
      ],
      B1: [
        `Write a paragraph recommending a book or film to a friend. Include a brief summary and explain what makes it worth reading or watching.`,
        `Write a paragraph explaining the advantages and disadvantages of studying online versus in a classroom.`,
        `Write a paragraph describing a challenge you faced at work or school and what you learned from it.`,
        `Write a paragraph giving advice to someone who is starting a new job.`,
        `Write a paragraph about a change you would make to your city or neighbourhood and the reason for it.`,
      ],
      B2: [
        `Write a well-structured paragraph discussing the impact of social media on young people's mental health, including evidence and a balanced conclusion.`,
        `Write a paragraph evaluating two different approaches to project management, noting the tradeoffs.`,
        `Write a paragraph arguing that continuous professional development should be mandatory in all industries.`,
        `Write a paragraph analysing why some companies struggle with remote team communication and what can be done about it.`,
        `Write a paragraph summarising the key findings of a fictional quarterly report, drawing a clear conclusion.`,
      ],
      C1: [
        `Write a cohesive paragraph synthesising three perspectives on the role of government in regulating technology companies.`,
        `Write a paragraph that builds a nuanced argument for why cultural context matters in international business communication.`,
        `Write a paragraph evaluating the long-term risks of a rapid organisational restructuring, using hedged but precise language.`,
        `Write a paragraph distinguishing between two commonly confused policy approaches, with a clear recommendation.`,
        `Write a paragraph integrating statistical evidence, expert opinion, and a real-world example to support a position on urban housing policy.`,
      ],
      C2: [
        `Write a paragraph that constructs a sophisticated critique of a widely accepted management theory, anticipating counterarguments.`,
        `Write a paragraph that navigates the tension between innovation and ethical responsibility in product development.`,
        `Write a paragraph in the style of a policy brief that identifies a systemic failure and proposes a structurally sound remedy.`,
        `Write a paragraph that examines the rhetorical strategies used in a political speech and evaluates their effectiveness.`,
        `Write a paragraph arguing that expertise alone is insufficient for leadership, using concrete examples and precise reasoning.`,
      ],
    },
    cohesion: {
      A1: [
        `Write 3 sentences about your morning using the words 'first', 'then', and 'after'.`,
        `Describe going to the market. Use 'and', 'but', and 'so' to connect your ideas.`,
        `Write a short story about a lost cat. Connect your sentences using linking words.`,
        `Write about your weekend plans using 'first', 'next', and 'finally'.`,
        `Write 3 connected sentences about what you eat for breakfast.`,
      ],
      A2: [
        `Write a short email using 'because', 'however', and 'therefore' to explain a problem and suggest a solution.`,
        `Write a paragraph about your study routine. Use at least three different linking words or phrases.`,
        `Write a message describing two options for a team outing. Connect your ideas clearly using contrast and addition words.`,
        `Write a short paragraph comparing two smartphones. Use 'on the other hand', 'both', and 'in contrast'.`,
        `Write an email updating your teacher about a project. Use connectors to show sequence and reason.`,
      ],
      B1: [
        `Write a paragraph about the pros and cons of living in a big city. Use cohesive devices to link ideas within and between sentences.`,
        `Write a short report on a survey about study habits. Use reference words (it, this, these) and connectors to avoid repetition.`,
        `Write a paragraph describing a process, such as how to prepare for a job interview. Use sequence markers clearly.`,
        `Write a paragraph comparing two career paths. Make sure each idea connects logically to the next.`,
        `Write a recommendation paragraph about a product or service. Use cause-and-effect language throughout.`,
      ],
      B2: [
        `Write a well-linked paragraph explaining why employee engagement affects company performance. Use a variety of cohesive devices.`,
        `Write a paragraph that moves from a general claim to specific evidence to a conclusion, using clear logical connectors.`,
        `Write a response to a colleague's proposal, agreeing with some points and disagreeing with others. Use contrast and concession language precisely.`,
        `Write a paragraph discussing the causes and effects of urban traffic congestion. Ensure ideas flow naturally.`,
        `Write a paragraph in which you rebut a counterargument and reinforce your own position using cohesive language.`,
      ],
      C1: [
        `Write a paragraph that uses complex reference chains, substitution, and ellipsis to discuss the challenges of scaling a startup.`,
        `Write a paragraph in which you transition smoothly between historical context, current evidence, and future projection on a topic of your choice.`,
        `Write a paragraph synthesising two opposing viewpoints using sophisticated discourse markers.`,
        `Write a paragraph that develops a single central idea through multiple interconnected sentences, avoiding repetition using reference words.`,
        `Write a policy paragraph that guides the reader through a problem-cause-solution structure using varied and precise cohesive devices.`,
      ],
      C2: [
        `Write a paragraph that demonstrates mastery of cohesion by interweaving evidence, interpretation, and implication without losing thread.`,
        `Write a paragraph in which the connective logic is implied rather than explicit, yet the argument remains crystal clear.`,
        `Write a paragraph that shifts between registers while maintaining textual coherence throughout.`,
        `Write a paragraph that uses anaphora, ellipsis, and lexical chains to build a persuasive argument.`,
        `Write a paragraph exploring a paradox, using cohesion to guide the reader from the apparent contradiction to a resolution.`,
      ],
    },
    'tone-and-register': {
      A1: [
        `Write a polite message to your teacher asking for help with homework.`,
        `Write a friendly text message to a classmate asking to borrow a book.`,
        `Write a short note to your parent explaining what you did at school today.`,
        `Write a polite request to a shopkeeper asking for the price of an item.`,
        `Write a kind message to a friend who is feeling sad.`,
      ],
      A2: [
        `Write a formal email to a hotel asking about room availability for next weekend.`,
        `Write a friendly but polite reply to a colleague who sent you the wrong file.`,
        `Write a formal complaint to a restaurant about poor service.`,
        `Write an informal message to a friend explaining why you cannot attend their party.`,
        `Write a semi-formal email to your landlord reporting a broken appliance.`,
      ],
      B1: [
        `Write a professional email to a new client introducing yourself and your company's services.`,
        `Write a formal letter of thanks to an organisation that sponsored your event.`,
        `Write an internal message to your team asking them to complete a survey. Keep the tone encouraging but professional.`,
        `Write a polite but firm email to a supplier who has missed a delivery deadline.`,
        `Write a semi-formal message to a community group inviting them to a local event.`,
      ],
      B2: [
        `Write a diplomatically worded email to a senior manager raising a concern about a recent decision without sounding confrontational.`,
        `Write a formal report conclusion that remains objective while clearly recommending a course of action.`,
        `Write a networking email to someone you admire professionally, requesting a short informational call.`,
        `Write a message to a client who is frustrated with a delay, balancing empathy with professionalism.`,
        `Write a formal response to a job offer, expressing enthusiasm while negotiating the salary.`,
      ],
      C1: [
        `Write a carefully calibrated email to a board member challenging a strategic assumption without undermining their authority.`,
        `Write a press statement responding to a public controversy about your organisation, using measured and authoritative language.`,
        `Write a formal academic paragraph in which you critique a published study without appearing dismissive or biased.`,
        `Write a diplomatically phrased performance review for an employee who has both strong points and significant areas for improvement.`,
        `Write a nuanced email to an international partner navigating a cultural misunderstanding without causing offence.`,
      ],
      C2: [
        `Write a communiqué to shareholders that conveys confidence in a difficult quarter without misrepresenting the data.`,
        `Write a paragraph for a think-tank publication that critiques government policy in a rigorous but non-partisan tone.`,
        `Write a response to a hostile online review of your organisation, de-escalating tension while protecting your reputation.`,
        `Write a speech opening for a conference on artificial intelligence that is authoritative, inclusive, and intellectually engaging.`,
        `Write a strategic memo that subtly shifts organisational culture without triggering resistance, using careful register and framing.`,
      ],
    },
    'argument-development': {
      A1: [
        `Do you prefer studying alone or with friends? Write 2–3 sentences giving your opinion and one reason.`,
        `Is it better to live in a city or in the countryside? Write a short opinion with one reason.`,
        `Should students wear school uniforms? Write your opinion in 2–3 sentences.`,
        `Do you think it is important to learn English? Write 2 sentences explaining why or why not.`,
        `Is sport important for children? Write your view in 2–3 sentences.`,
      ],
      A2: [
        `Write a short paragraph arguing whether people should work fewer hours per week. Give at least one reason and one example.`,
        `Do you think social media is more harmful or beneficial for teenagers? Write a paragraph with your view and two supporting points.`,
        `Write a short paragraph arguing that public transport should be free in cities. Include a reason and a possible objection.`,
        `Should all schools teach cooking as a subject? Write a paragraph with your argument and one counter-point.`,
        `Write a paragraph arguing that reading is better than watching television. Use at least two reasons.`,
      ],
      B1: [
        `Write a structured argument paragraph for or against making voting compulsory. Include a claim, two reasons, and a concession.`,
        `Write a paragraph arguing that companies should offer flexible working hours. Use a claim, supporting evidence, and a counter-argument.`,
        `Write a paragraph arguing whether gap years are beneficial for young people. Include a claim, reasons, and a brief rebuttal.`,
        `Write a well-argued paragraph about whether technology is making people less sociable.`,
        `Write a paragraph arguing that universities should focus more on practical skills than academic theory.`,
      ],
      B2: [
        `Write a structured argumentative paragraph on whether artificial intelligence will create more jobs than it destroys. Include a clear thesis, evidence, a counter-argument, and a rebuttal.`,
        `Write a persuasive paragraph arguing that all businesses have an ethical responsibility to reduce their carbon footprint.`,
        `Write an argument paragraph about whether governments should regulate social media platforms. Address complexity and avoid oversimplification.`,
        `Write a paragraph arguing for a controversial position in education policy, anticipating the strongest objection and rebutting it.`,
        `Write a paragraph arguing that economic growth and environmental sustainability are compatible goals, using precise evidence.`,
      ],
      C1: [
        `Write an argument paragraph that builds a sophisticated case for redefining productivity in the modern workplace, engaging with counterarguments in depth.`,
        `Write a nuanced paragraph arguing that free speech and social responsibility are not inherently in conflict, using examples from different contexts.`,
        `Write an argument paragraph evaluating the claim that meritocracy is a myth in most modern societies.`,
        `Write a persuasive paragraph arguing that the education system must fundamentally change to address the challenges of automation.`,
        `Write an argument paragraph on whether international institutions like the UN are still relevant, synthesising multiple perspectives.`,
      ],
      C2: [
        `Write a paragraph that constructs a philosophically rigorous argument for why truth in public discourse is more important than comfort.`,
        `Write a sophisticated argumentative paragraph on whether capitalism is structurally incompatible with long-term environmental sustainability.`,
        `Write an argument paragraph that challenges a widely accepted narrative about globalisation, using evidence and nuanced reasoning.`,
        `Write a paragraph that builds an argument about the limits of data-driven decision-making in complex human systems.`,
        `Write an argument paragraph exploring whether technological neutrality is possible, engaging with the strongest objections.`,
      ],
    },
  };

  const moduleId = module.id;
  const promptPool = promptsByModule[moduleId]?.[level.id] || promptsByModule['sentence-control'][level.id];
  const promptText = promptPool[index % promptPool.length];

  const criteriaByLevel = {
    A1: 'grammar accuracy, basic vocabulary, and clear meaning',
    A2: 'correct grammar, appropriate vocabulary, and a clear message with a reason',
    B1: 'well-organised paragraphs, connectors, appropriate tone, and a supported opinion',
    B2: 'coherent structure, precise vocabulary, balanced argument, and professional register',
    C1: 'sophisticated cohesion, nuanced argument, precise register, and critical thinking',
    C2: 'near-native fluency, rhetorical effectiveness, lexical precision, and subtle reasoning',
  };

  const minWordsByLevel = { A1: 20, A2: 40, B1: 80, B2: 120, C1: 160, C2: 200 };

  return {
    stem: promptText,
    passageText: `Module: ${module.label} | Level: ${level.id} | Competency: ${competency}\n\nYour response will be evaluated for: ${criteriaByLevel[level.id]}.\n\nWrite at least ${minWordsByLevel[level.id]} words.`,
    correctAnswer: `A strong response addresses the prompt directly, is organised clearly, uses appropriate vocabulary and grammar for ${level.id}, and meets the word count.`,
    distractors: [],
    explanation: `This writing task evaluates ${competency} at ${level.id}. Focus on: ${criteriaByLevel[level.id]}.`,
    hints: [
      `Module: ${module.label}`,
      `Target: ${criteriaByLevel[level.id]}`,
      `Min words: ${minWordsByLevel[level.id]}`,
    ],
    minWords: minWordsByLevel[level.id],
    evaluationCriteria: criteriaByLevel[level.id],
  };
};

const buildListeningPassage = ({ level, context, competency, index }) => {
  const speakers = [
    ['Maya', 'Ravi'],
    ['Elena', 'Jon'],
    ['Priya', 'Sam'],
    ['Noah', 'Leah'],
    ['Iris', 'Omar'],
    ['Nina', 'Chen'],
    ['Asha', 'Mateo'],
    ['Grace', 'Dev'],
    ['Lina', 'Theo'],
    ['Sara', 'Ken'],
    ['Anika', 'Leo'],
    ['Fatima', 'Evan'],
    ['Mei', 'Carlos'],
    ['Hannah', 'Bilal'],
    ['Tara', 'Luis'],
    ['Sofia', 'Arun'],
    ['Mina', 'Oscar'],
    ['Julia', 'Nikhil'],
    ['Zara', 'Miles'],
    ['Ivy', 'Kiran'],
  ];
  const settings = [
    'morning stand-up',
    'client call',
    'training room',
    'planning meeting',
    'voice note',
    'campus desk',
    'support counter',
    'team chat summary',
    'manager update',
    'review session',
    'budget huddle',
    'lab debrief',
    'handover call',
    'design critique',
    'onboarding desk',
    'community forum',
    'vendor check-in',
    'strategy roundtable',
    'quality review',
    'weekly retrospective',
  ];
  const artifacts = [
    'slide deck',
    'booking form',
    'feedback sheet',
    'prototype note',
    'delivery tracker',
    'research memo',
    'support ticket',
    'training checklist',
    'budget table',
    'timeline board',
    'risk log',
    'survey chart',
    'lesson plan',
    'invoice draft',
    'test report',
    'policy brief',
    'agenda page',
    'customer profile',
    'release note',
    'meeting transcript',
  ];
  const outcomes = [
    'send a short summary',
    'move the meeting by one day',
    'ask for two examples',
    'check the numbers again',
    'invite one more person',
    'write the decision in the shared document',
    'test the idea with a small group',
    'wait until the missing report arrives',
    'prepare a clearer explanation',
    'confirm the deadline before lunch',
    'separate urgent tasks from optional tasks',
    'record the decision with one open question',
    'compare the draft with last month\'s version',
    'ask the quietest participant for input',
    'turn the complaint into a checklist item',
    'mark the assumption before sharing the plan',
    'split the work into two shorter reviews',
    'replace the vague target with a measured target',
    'send the revised file to the pilot group',
    'pause the launch until the owner replies',
  ];
  const concerns = [
    'the message may be misunderstood',
    'the team has not seen the latest details',
    'the first option saves time but adds risk',
    'two people are using different definitions',
    'the audience needs a simpler explanation',
    'the schedule is tight but still possible',
    'the decision sounds final before everyone agrees',
    'the data supports progress but not certainty',
    'the tone needs to stay polite and firm',
    'the next step depends on one missing answer',
    'the speaker accepts the goal but doubts the timeline',
    'the evidence is useful but gathered from a narrow group',
    'the update sounds complete although one section is missing',
    'the request is simple but the approval path is unclear',
    'the cost looks small now but could grow after launch',
    'the listener agrees with the principle, not the method',
    'the examples are persuasive but not fully comparable',
    'the wording protects trust while delaying commitment',
    'the team needs agreement before the data can guide action',
    'the preferred option solves speed but weakens accountability',
  ];
  const details = [
    'blue folder',
    'north entrance',
    'third checklist item',
    'Tuesday slot',
    'green label',
    'room 204',
    'quarterly target',
    'second prototype',
    'ten-minute review',
    'shared dashboard',
    'pilot cohort',
    'late invoice',
    'backup supplier',
    'student survey',
    'call transcript',
    'security note',
    'city branch',
    'manager comment',
    'training sample',
    'draft appendix',
  ];
  const measures = [
    'three examples',
    'four missing names',
    'six customer replies',
    'eight minutes of delay',
    'two revised slides',
    'nine survey answers',
    'five checklist points',
    'seven test cases',
    'one unresolved comment',
    'twelve sign-ups',
    'fifteen budget lines',
    'eleven interview notes',
    'two approval steps',
    'six risk markers',
    'four comparison groups',
    'ten practice attempts',
    'three rejected drafts',
    'eight follow-up calls',
    'five support cases',
    'one final exception',
  ];
  const tones = [
    'careful',
    'encouraging',
    'skeptical',
    'practical',
    'diplomatic',
    'urgent',
    'reflective',
    'firm',
    'curious',
    'reassuring',
  ];
  const timeMarkers = [
    'before the first break',
    'after the noon update',
    'by the end of the call',
    'once the file is reopened',
    'before Friday morning',
    'after the second reminder',
    'when the pilot group replies',
    'before the dashboard refresh',
    'after the room changes',
    'once the manager signs off',
  ];

  const clipNumber = (level.order - 1) * QUESTIONS_PER_SKILL_LEVEL + index;
  const reference = `LC-${level.id}-${String(index).padStart(4, '0')}`;
  const pick = (items, multiplier, offset = 0) => items[(clipNumber * multiplier + level.order + offset) % items.length];
  const [speakerOne, speakerTwo] = pick(speakers, 7);
  const setting = pick(settings, 11, index);
  const artifact = pick(artifacts, 13, index * 2);
  const outcome = pick(outcomes, 17, level.order * 3);
  const concern = pick(concerns, 19, index * 5);
  const detail = pick(details, 23, level.order + index);
  const measure = pick(measures, 29, index * 3);
  const tone = pick(tones, 31, level.order);
  const timeMarker = pick(timeMarkers, 37, index);
  const minute = 5 + ((clipNumber * 7) % 50);

  if (level.id === 'A1') {
    return `${speakerOne}: Hello ${speakerTwo}. This is ${reference}, a ${context} message at the ${setting}. Please listen carefully. I have the ${artifact}. First, the important detail is the ${detail}. Second, the note says ${measure}, so we cannot finish too quickly. ${speakerTwo}: Thanks. Do we need to call anyone? ${speakerOne}: Not now. We need to ${outcome} at minute ${minute}. Please write it in your notes. ${speakerTwo}: Okay. I will remember the ${detail} and the time.`;
  }

  if (level.id === 'A2') {
    return `${speakerOne}: Hi ${speakerTwo}, ${reference} is about ${context} during the ${setting}. The ${artifact} shows ${measure}, but ${concern}. I checked the first page this morning, and it still has the same problem. ${speakerTwo}: Should we wait for a new message, or should we act now? ${speakerOne}: We should act now. The next step is to ${outcome} ${timeMarker}. ${speakerTwo}: Okay, I will make a note. ${speakerOne}: Correct, and please mention the ${detail}, because that is the easiest detail for listeners to miss.`;
  }

  if (level.id === 'B1') {
    return `${speakerOne}: In ${reference}, the ${setting} focused on ${context}. At the start, everyone thought the situation was simple, but the ${artifact} listed ${measure}, and the main issue was that ${concern}. ${speakerTwo}: I noticed that too. If we move too fast, people may understand the plan differently. I suggested we ${outcome}, but only after checking the ${detail}. ${speakerOne}: That is why the final plan sounds ${tone}, not rushed. The speakers agree with the goal, yet they also want one more check before the decision is shared.`;
  }

  if (level.id === 'B2') {
    return `${speakerOne}: During ${reference}, a ${setting} about ${context}, the team compared the ${artifact} with the ${detail}. The first option addressed ${measure} quickly, which made it attractive at first. However, the group also saw that ${concern}. ${speakerTwo}: That means the quick answer may solve the visible problem while creating a quieter risk later. ${speakerOne}: Exactly. The stronger choice is to ${outcome}, because it keeps momentum while protecting quality. ${speakerTwo}: So the key is not speed alone. It is the ${tone} tradeoff between acting now and preserving trust in the process.`;
  }

  if (level.id === 'C1') {
    return `${speakerOne}: In ${reference}, a ${setting} about ${context}, the speakers weigh the ${artifact} against the ${detail} without stating every concern directly. ${speakerTwo}: The surface agreement is positive, yet the hesitation around ${measure} suggests that ${concern}. Nobody rejects the proposal, but nobody treats it as settled either. ${speakerOne}: That is why the wording matters. By proposing to ${outcome} ${timeMarker}, the speaker encourages alignment while leaving room for revision. ${speakerTwo}: The ${tone} register is the key clue for ${competency}: progress is welcomed, but only if the unresolved detail is handled with care.`;
  }

  return `${speakerOne}: ${reference} frames ${context} in a ${setting} as a question of judgment rather than preference, using the ${artifact}, ${detail}, and ${measure} as evidence. ${speakerTwo}: Notice the calibrated language: support is offered, but the speaker quietly signals that ${concern}. The disagreement is not dramatic; it is carried through qualifications, timing, and the order in which evidence is mentioned. ${speakerOne}: The recommendation to ${outcome} ${timeMarker} works as a ${tone} compromise, preserving authority while inviting scrutiny. ${speakerTwo}: This clip tests ${competency}, especially whether the listener can hear the difference between agreement, caution, and final approval.`;
};

const main = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fluentai';
  await mongoose.connect(uri);
  const questions = mongoose.connection.collection('questions');
  await questions.createIndex({ seedKey: 1 }, { unique: true, sparse: true });

  const bulkOps = [];
  const totals = {
    requested: 0,
    inserted: 0,
    updated: 0,
  };

  const flushBulkOps = async () => {
    if (!bulkOps.length) return;
    const result = await questions.bulkWrite(bulkOps.splice(0), { ordered: false });
    totals.inserted += result.upsertedCount || 0;
    totals.updated += result.modifiedCount || 0;
  };

  for (const skill of skills) {
    for (const level of levels) {
      for (let index = 1; index <= QUESTIONS_PER_SKILL_LEVEL; index += 1) {
        const question = buildQuestion(skill, level, index);
        totals.requested += 1;
        bulkOps.push({
          updateOne: {
            filter: { seedKey: question.seedKey },
            update: {
              $set: question,
              $setOnInsert: { createdAt: new Date() },
            },
            upsert: true,
          },
        });

        if (bulkOps.length >= 500) {
          await flushBulkOps();
        }
      }
    }
  }

  await flushBulkOps();
  const summary = await questions
    .aggregate([
      { $match: { seedKey: /^journey:/, status: 'Active' } },
      { $group: { _id: { skill: '$skill', level: '$level' }, count: { $sum: 1 } } },
      { $sort: { '_id.skill': 1, '_id.level': 1 } },
    ])
    .toArray();

  console.log(`Seeded practice journey questions: ${totals.requested}`);
  console.log(`Inserted: ${totals.inserted}, updated: ${totals.updated}`);
  for (const row of summary) {
    console.log(`${row._id.skill} ${row._id.level}: ${row.count}`);
  }

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
