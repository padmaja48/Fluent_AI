export type ListeningCompetency =
  | 'main idea'
  | 'detail recognition'
  | 'speaker intent'
  | 'inference'
  | 'sequence';

export type ListeningFact = {
  id: string;
  label: string;
  value: string;
};

export type ListeningClip = {
  reference: string;
  passageText: string;
  facts: ListeningFact[];
};

export type ListeningItemOutput = {
  passageText: string;
  stem: string;
  correctAnswer: string;
  distractors: string[];
  explanation: string;
};

export const GENERIC_LISTENING_DISTRACTORS = [
  'unrelated travel plan',
  'ignore the',
  'issue completely',
  'without a next step',
  'criticize the listener personally',
  'private story',
  'no action is needed',
  'refuse to cooperate',
  'unrelated to the discussion',
  'delete the notes',
  'switch to a different topic immediately',
  'ignore the people involved',
  'meeting was cancelled for a holiday',
  'password was lost',
  'restaurant booking',
];

const countWords = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

const hashSeed = (...parts: Array<string | number>): number => {
  const raw = parts.join(':');
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const pick = <T,>(items: T[], seed: number, salt = 0): T => items[(seed + salt) % items.length];

const scriptOverlapScore = (option: string, script: string): number => {
  const optionWords = new Set(option.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  const scriptWords: string[] = script.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  if (!optionWords.size || !scriptWords.length) return 0;
  let overlap = 0;
  for (const word of optionWords) {
    if (scriptWords.includes(word)) overlap += 1;
  }
  return overlap / optionWords.size;
};

export const balanceListeningOptions = (
  correctAnswer: string,
  distractors: string[],
): { correctAnswer: string; distractors: string[] } => {
  const target =
    distractors.reduce((sum, option) => sum + countWords(option), 0) / Math.max(distractors.length, 1);
  const trimToWords = (text: string, words: number) => text.trim().split(/\s+/).slice(0, words).join(' ');

  let balancedCorrect = correctAnswer.trim();
  if (countWords(balancedCorrect) > target * 1.25) {
    balancedCorrect = trimToWords(balancedCorrect, Math.max(6, Math.round(target)));
  }

  const balancedDistractors = distractors.map((option) => {
    const words = countWords(option);
    if (words >= target * 0.75 && words <= target * 1.25) return option.trim();
    if (words < target * 0.75) {
      return trimToWords(`${option.trim()} during the ${target >= 8 ? 'same exchange' : 'clip'}.`, Math.max(6, Math.round(target)));
    }
    return trimToWords(option, Math.max(6, Math.round(target)));
  });

  const avgDistractor =
    balancedDistractors.reduce((sum, option) => sum + countWords(option), 0) /
    Math.max(balancedDistractors.length, 1);
  if (countWords(balancedCorrect) > avgDistractor * 1.3) {
    balancedCorrect = trimToWords(balancedCorrect, Math.max(6, Math.round(avgDistractor)));
  }

  return { correctAnswer: balancedCorrect, distractors: balancedDistractors };
};

export const validateListeningQuestion = (
  clip: ListeningClip,
  question: Pick<ListeningItemOutput, 'correctAnswer' | 'distractors'>,
): string[] => {
  const issues: string[] = [];
  const script = clip.passageText.toLowerCase();
  const allOptions = [question.correctAnswer, ...question.distractors];

  if (question.distractors.length !== 3) issues.push('expected three distractors');

  for (const option of allOptions) {
    const normalized = option.toLowerCase();
    if (GENERIC_LISTENING_DISTRACTORS.some((phrase) => normalized.includes(phrase))) {
      issues.push('generic distractor');
    }
    if (scriptOverlapScore(option, clip.passageText) < 0.2) {
      issues.push('option not grounded in audio');
    }
  }

  const avgDistractor =
    question.distractors.reduce((sum, option) => sum + countWords(option), 0) /
    Math.max(question.distractors.length, 1);
  if (countWords(question.correctAnswer) > avgDistractor * 1.3) {
    issues.push('correct answer too long');
  }

  const unique = new Set(allOptions.map((option) => option.trim().toLowerCase()));
  if (unique.size !== allOptions.length) issues.push('duplicate options');

  return issues;
};

const buildClipFacts = (input: {
  level: { id: string; order: number };
  context: string;
  index: number;
}): ListeningClip => {
  const seed = hashSeed(input.level.id, input.context, input.index);
  const clipNumber = (input.level.order - 1) * 1000 + input.index;
  const reference = `LC-${input.level.id}-${String(input.index).padStart(4, '0')}`;

  const speakers = [
    ['Maya', 'Ravi'],
    ['Elena', 'Jon'],
    ['Priya', 'Sam'],
    ['Noah', 'Leah'],
    ['Iris', 'Omar'],
  ];
  const settings = [
    'morning stand-up',
    'client call',
    'planning meeting',
    'training room',
    'support counter',
    'vendor check-in',
    'strategy roundtable',
    'quality review',
  ];
  const artifacts = ['slide deck', 'delivery tracker', 'feedback sheet', 'risk log', 'research memo', 'support ticket'];
  const details = ['room 204', 'north entrance', 'blue folder', 'Tuesday slot', 'shared dashboard', 'pilot cohort'];
  const secondaryDetails = ['green label', 'backup supplier', 'call transcript', 'security note', 'draft appendix'];
  const measures = ['six customer replies', 'three examples', 'nine survey answers', 'five checklist points', 'two approval steps'];
  const concerns = [
    'the team has not seen the latest details',
    'the first option saves time but adds risk',
    'the schedule is tight but still possible',
    'the data supports progress but not certainty',
  ];
  const actions = [
    'send the revised file to the pilot group',
    'confirm the deadline before lunch',
    'wait until the missing report arrives',
    'record the decision with one open question',
    'compare the draft with last month\'s version',
  ];
  const timeMarkers = ['before Friday morning', 'after the second reminder', 'by the end of the call', 'once the file is reopened'];
  const tones = ['careful', 'diplomatic', 'practical', 'reassuring', 'firm'];

  const [speakerOne, speakerTwo] = pick(speakers, seed, 1);
  const setting = pick(settings, seed, 3);
  const artifact = pick(artifacts, seed, 5);
  const primaryDetail = pick(details, seed, 7);
  const secondaryDetail = pick(secondaryDetails, seed, 9);
  const measure = pick(measures, seed, 11);
  const concern = pick(concerns, seed, 13);
  const plannedAction = pick(actions, seed, 15);
  const timeMarker = pick(timeMarkers, seed, 17);
  const tone = pick(tones, seed, 19);
  const minute = 5 + ((clipNumber * 7) % 50);
  const wrongDay = pick(['Tuesday', 'Thursday', 'Monday'], seed, 21);
  const correctDay = pick(['Wednesday', 'Friday', 'Saturday'], seed, 23);

  const facts: ListeningFact[] = [
    { id: 'context', label: 'topic', value: input.context },
    { id: 'setting', label: 'setting', value: setting },
    { id: 'artifact', label: 'artifact', value: artifact },
    { id: 'primaryDetail', label: 'primary detail', value: primaryDetail },
    { id: 'secondaryDetail', label: 'secondary detail', value: secondaryDetail },
    { id: 'measure', label: 'measure', value: measure },
    { id: 'concern', label: 'concern', value: concern },
    { id: 'plannedAction', label: 'planned action', value: plannedAction },
    { id: 'timeMarker', label: 'time marker', value: timeMarker },
    { id: 'tone', label: 'tone', value: tone },
    { id: 'minute', label: 'minute marker', value: String(minute) },
    { id: 'wrongDay', label: 'initial day', value: wrongDay },
    { id: 'correctDay', label: 'corrected day', value: correctDay },
  ];

  let passageText = '';

  if (input.level.id === 'A1' || input.level.id === 'A2') {
    passageText = `${speakerOne}: Hi ${speakerTwo}, this is ${reference} about ${input.context} during the ${setting}. I checked the ${artifact} this morning. The ${primaryDetail} matters, and the note lists ${measure}. ${speakerTwo}: Should we act today? ${speakerOne}: Not yet. We said ${wrongDay} first, but I meant ${correctDay} after finance checks the ${secondaryDetail}. ${speakerTwo}: So we ${plannedAction} at minute ${minute}, not before. ${speakerOne}: Right, and mention the ${primaryDetail} when you write the summary.`;
  } else if (input.level.id === 'B1' || input.level.id === 'B2') {
    passageText = `${speakerOne}: In ${reference}, the ${setting} on ${input.context} started simply, but the ${artifact} showed ${measure}. ${speakerTwo}: I flagged the ${secondaryDetail} because ${concern}. ${speakerOne}: I initially said we would move on ${wrongDay}, actually ${correctDay} once the ${primaryDetail} is confirmed. ${speakerTwo}: Then we should ${plannedAction} ${timeMarker}. ${speakerOne}: Yes, keep the update ${tone}; the ${artifact} makes the gap look smaller than it is. ${speakerTwo}: Listeners often miss that the ${secondaryDetail} still blocks approval.`;
  } else {
    passageText = `${speakerOne}: ${reference} covers ${input.context} in a ${setting}. The ${artifact}, ${primaryDetail}, and ${measure} frame the discussion, though ${concern}. ${speakerTwo}: You said ${wrongDay}, then corrected it to ${correctDay}; that change affects whether we ${plannedAction} ${timeMarker}. ${speakerOne}: Exactly. The ${tone} wording keeps alignment open while the ${secondaryDetail} remains unresolved. ${speakerTwo}: So the clip turns on timing and evidence, not on rejecting the goal outright. ${speakerOne}: Final note: record minute ${minute} and the ${primaryDetail} in the shared log.`;
  }

  return { reference, passageText, facts };
};

const factValue = (facts: ListeningFact[], id: string): string =>
  facts.find((fact) => fact.id === id)?.value ?? '';

export type ListeningQuestionDraft = {
  stem: string;
  correctAnswer: string;
  distractors: string[];
  explanation: string;
};

const buildQuestionForCompetency = (
  competency: ListeningCompetency,
  clip: ListeningClip,
  moduleLabel: string,
  levelId: string,
  index: number,
): ListeningItemOutput => {
  const { reference, facts, passageText } = clip;
  const context = factValue(facts, 'context');
  const primaryDetail = factValue(facts, 'primaryDetail');
  const secondaryDetail = factValue(facts, 'secondaryDetail');
  const measure = factValue(facts, 'measure');
  const concern = factValue(facts, 'concern');
  const plannedAction = factValue(facts, 'plannedAction');
  const timeMarker = factValue(facts, 'timeMarker');
  const tone = factValue(facts, 'tone');
  const wrongDay = factValue(facts, 'wrongDay');
  const correctDay = factValue(facts, 'correctDay');
  const minute = factValue(facts, 'minute');
  const artifact = factValue(facts, 'artifact');
  const setting = factValue(facts, 'setting');

  const byCompetency: Record<ListeningCompetency, ListeningQuestionDraft> = {
    'main idea': {
      stem: `Listening ${levelId}.${index} (${moduleLabel}): What is the main idea of clip ${reference}?`,
      correctAnswer: `The speakers discuss ${context} and plan to ${plannedAction} after confirming the ${primaryDetail}.`,
      distractors: [
        `The speakers will ${plannedAction} on ${wrongDay} before the ${primaryDetail} is checked.`,
        `The speakers treat the ${measure} as proof that the ${secondaryDetail} no longer matters.`,
        `The speakers treat the ${artifact} as the full ${setting} update without other details.`,
      ],
      explanation: `The clip centers on ${context}, a correction about timing, and a careful next step.`,
    },
    'detail recognition': {
      stem: `Listening ${levelId}.${index} (${moduleLabel}): Which detail is explicitly mentioned in clip ${reference}?`,
      correctAnswer: `The clip mentions the ${primaryDetail} as a detail listeners should note.`,
      distractors: [
        `The clip states the team will ${plannedAction} on ${wrongDay} without any change.`,
        `The clip says the ${secondaryDetail} was removed from the ${artifact}.`,
        `The clip reports the ${measure} was never discussed in the ${setting}.`,
      ],
      explanation: `The ${primaryDetail} appears directly, while the other options misstate spoken details.`,
    },
    'speaker intent': {
      stem: `Listening ${levelId}.${index} (${moduleLabel}): What is the speaker trying to do?`,
      correctAnswer: `The speaker guides the team to ${plannedAction} once the ${primaryDetail} is confirmed.`,
      distractors: [
        `The speaker asks the team to accept the ${measure} without reviewing the ${secondaryDetail}.`,
        `The speaker tries to cancel the ${context} plan because of the ${wrongDay} note.`,
        `The speaker wants to postpone all action until minute ${minute} passes with no update.`,
      ],
      explanation: `Speaker intent is practical: secure confirmation, then move to ${plannedAction}.`,
    },
    inference: {
      stem: `Listening ${levelId}.${index} (${moduleLabel}): What can you infer from the speakers' tone?`,
      correctAnswer: `They support progress on ${context}, but want a ${tone} decision after the ${correctDay} correction.`,
      distractors: [
        `They reject the ${plannedAction} because the ${artifact} already settled the issue.`,
        `They are certain the ${secondaryDetail} will not affect the ${measure}.`,
        `They treat the ${wrongDay} mention as the final schedule with no revision.`,
      ],
      explanation: `Tone and the day correction imply cautious agreement, not certainty or refusal.`,
    },
    sequence: {
      stem: `Listening ${levelId}.${index} (${moduleLabel}): What should happen next?`,
      correctAnswer: `The next step is to ${plannedAction} ${timeMarker} after the ${primaryDetail} is confirmed.`,
      distractors: [
        `The next step is to ${plannedAction} immediately on ${wrongDay} before checking the ${secondaryDetail}.`,
        `The next step is to archive the ${artifact} and stop tracking minute ${minute}.`,
        `The next step is to finalize the ${measure} even though ${concern}.`,
      ],
      explanation: `The sequence moves from correction and verification to the stated action.`,
    },
  };

  const question = byCompetency[competency];
  const balanced = balanceListeningOptions(question.correctAnswer, question.distractors);
  return {
    passageText,
    stem: question.stem,
    correctAnswer: balanced.correctAnswer,
    distractors: balanced.distractors,
    explanation: question.explanation,
  };
};

export const buildListeningItemContent = (input: {
  level: { id: string; order?: number };
  context: string;
  competency: ListeningCompetency;
  index: number;
  module: { label: string };
}): ListeningItemOutput => {
  const level = { id: input.level.id, order: input.level.order ?? 1 };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const clip = buildClipFacts({
      level,
      context: input.context,
      index: input.index + attempt * 17,
    });
    const question = buildQuestionForCompetency(
      input.competency,
      clip,
      input.module.label,
      level.id,
      input.index,
    );
    const issues = validateListeningQuestion(clip, question);
    if (!issues.length) {
      return question;
    }
  }

  const clip = buildClipFacts({ level, context: input.context, index: input.index });
  return buildQuestionForCompetency(input.competency, clip, input.module.label, level.id, input.index);
};

export const longestOptionIndex = (options: string[]): number => {
  let maxIndex = 0;
  let maxWords = 0;
  options.forEach((option, index) => {
    const words = countWords(option);
    if (words > maxWords) {
      maxWords = words;
      maxIndex = index;
    }
  });
  return maxIndex;
};
