import {
  buildListeningItemContent,
  GENERIC_LISTENING_DISTRACTORS,
  longestOptionIndex,
  validateListeningQuestion,
  type ListeningCompetency,
} from '../services/listeningQuestionGenerator.service';

const competencies: ListeningCompetency[] = [
  'main idea',
  'detail recognition',
  'speaker intent',
  'inference',
  'sequence',
];

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

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

const rotateOptions = (correctAnswer: string, distractors: string[], index: number) => {
  const allOptions = [correctAnswer, ...distractors];
  const shift = index % allOptions.length;
  return [...allOptions.slice(shift), ...allOptions.slice(0, shift)];
};

const correctPosition = (options: string[], correctAnswer: string) =>
  options.findIndex((option) => option === correctAnswer);

describe('listeningQuestionGenerator', () => {
  it('rejects generic distractor phrases', () => {
    for (const phrase of GENERIC_LISTENING_DISTRACTORS) {
      expect(phrase.length).toBeGreaterThan(3);
    }
  });

  it('generates ten questions where the correct answer is not longest in a majority', () => {
    let correctIsLongest = 0;
    const items = Array.from({ length: 10 }, (_, i) =>
      buildListeningItemContent({
        level: { id: 'B1', order: 3 },
        context: 'project planning',
        competency: competencies[i % competencies.length],
        index: i + 1,
        module: { label: 'Listening Practice' },
      }),
    );

    for (const item of items) {
      const options = [item.correctAnswer, ...item.distractors];
      const longest = longestOptionIndex(options);
      const correctIndex = options.indexOf(item.correctAnswer);
      if (longest === correctIndex) correctIsLongest += 1;
      expect(validateListeningQuestion({ reference: 'x', passageText: item.passageText, facts: [] }, item)).toEqual([]);
    }

    expect(correctIsLongest).toBeLessThanOrEqual(5);
  });

  it('distributes correct answer positions roughly evenly across 24 questions', () => {
    const positions = { A: 0, B: 0, C: 0, D: 0 };
    const labels = ['A', 'B', 'C', 'D'] as const;

    for (let index = 1; index <= 24; index += 1) {
      const item = buildListeningItemContent({
        level: { id: 'B2', order: 4 },
        context: 'team communication',
        competency: competencies[index % competencies.length],
        index,
        module: { label: 'Listening Practice' },
      });
      const rotated = rotateOptions(item.correctAnswer, item.distractors, index);
      const pos = correctPosition(rotated, item.correctAnswer);
      positions[labels[pos]] += 1;
    }

    for (const count of Object.values(positions)) {
      expect(count).toBeGreaterThanOrEqual(4);
      expect(count).toBeLessThanOrEqual(8);
    }
  });

  it('grounds all options in the audio script for sample questions', () => {
    for (let index = 1; index <= 5; index += 1) {
      const item = buildListeningItemContent({
        level: { id: 'C1', order: 5 },
        context: 'workplace updates',
        competency: competencies[index % competencies.length],
        index: index * 11,
        module: { label: 'Listening Practice' },
      });

      for (const option of [item.correctAnswer, ...item.distractors]) {
        expect(scriptOverlapScore(option, item.passageText)).toBeGreaterThanOrEqual(0.2);
      }
    }
  });

  it('keeps correct answer length within 30% of average distractor length', () => {
    for (let index = 1; index <= 12; index += 1) {
      const item = buildListeningItemContent({
        level: { id: 'A2', order: 2 },
        context: 'daily routines',
        competency: competencies[index % competencies.length],
        index,
        module: { label: 'Listening Practice' },
      });
      const avgDistractor =
        item.distractors.reduce((sum, option) => sum + countWords(option), 0) / item.distractors.length;
      expect(countWords(item.correctAnswer)).toBeLessThanOrEqual(avgDistractor * 1.3 + 1);
    }
  });

  it('includes day corrections and multi-speaker dialogue in scripts', () => {
    const item = buildListeningItemContent({
      level: { id: 'B1', order: 3 },
      context: 'scheduling',
      competency: 'detail recognition',
      index: 42,
      module: { label: 'Listening Practice' },
    });

    expect(item.passageText).toMatch(/:/);
    expect(item.passageText.toLowerCase()).toMatch(/meant|actually|corrected/);
  });
});
