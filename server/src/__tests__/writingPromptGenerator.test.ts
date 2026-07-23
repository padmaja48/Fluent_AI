import {
  buildWritingPromptItem,
  getMinWordsForLevel,
  getWritingFrameCount,
  normalizeWritingStem,
  type WritingModuleId,
} from '../services/writingPromptGenerator.service';

const MODULES: Array<{ id: WritingModuleId; label: string }> = [
  { id: 'sentence-control', label: 'Sentence Control' },
  { id: 'paragraph-building', label: 'Paragraph Building' },
  { id: 'cohesion', label: 'Cohesion' },
  { id: 'tone-and-register', label: 'Tone & Register' },
  { id: 'argument-development', label: 'Argument Development' },
];

describe('writingPromptGenerator.service', () => {
  it('provides at least 20 distinct prompt frames per writing module', () => {
    for (const module of MODULES) {
      expect(getWritingFrameCount(module.id)).toBeGreaterThanOrEqual(20);
    }
  });

  it('generates varied stems without identical openings across a module batch', () => {
    for (const module of MODULES) {
      const openings = new Set<string>();
      for (let index = 1; index <= 25; index += 1) {
        const item = buildWritingPromptItem({
          level: { id: 'B1', order: 3 },
          context: 'team updates',
          competency: 'sentence control',
          index,
          module,
        });
        openings.add(normalizeWritingStem(item.stem));
        expect(item.moduleType).toBe(module.id);
        expect(item.moduleLabel).toBe(module.label);
        expect(item.distractors).toHaveLength(0);
      }
      expect(openings.size).toBeGreaterThanOrEqual(20);
    }
  });

  it('shows a real word-count gradient across CEFR levels', () => {
    const module = MODULES[0];
    const wordsByLevel = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((levelId) => {
      const item = buildWritingPromptItem({
        level: { id: levelId, order: 1 },
        context: 'daily routine',
        competency: 'sentence control',
        index: 1,
        module,
      });
      return item.minWords;
    });

    expect(wordsByLevel[5]).toBeGreaterThan(wordsByLevel[0]);
    expect(wordsByLevel[3]).toBeGreaterThan(wordsByLevel[1]);
    expect(getMinWordsForLevel('C2')).toBeGreaterThan(getMinWordsForLevel('A1'));
  });

  it('does not leak meta-instruction boilerplate into writing prompts', () => {
    const banned = [
      'reward careful rereading',
      'context clues help infer',
      'the passage mixes concrete examples',
      'readers should notice how details across paragraphs connect',
      'taken together, the passage suggests',
    ];

    for (const module of MODULES) {
      for (let index = 1; index <= 10; index += 1) {
        const item = buildWritingPromptItem({
          level: { id: 'B2', order: 4 },
          context: `topic-${index}`,
          competency: 'cohesion',
          index,
          module,
        });
        const combined = `${item.stem} ${item.passageText}`.toLowerCase();
        banned.forEach((phrase) => {
          expect(combined).not.toContain(phrase);
        });
      }
    }
  });
});
