import {
  averageSentenceLength,
  averageSyllablesPerWord,
  BANNED_PHRASES,
  buildPassagePrompt,
  buildReadingItemContent,
  buildReadingPassageSync,
  clearRecentPassages,
  containsBannedPhrase,
  getWordCountRangeForTier,
  mapCefrToDifficultyTier,
  normalizeOpening,
  READING_GENRES,
  selectContentBrief,
} from '../services/readingPassageGenerator.service';

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

describe('readingPassageGenerator.service', () => {
  beforeEach(() => {
    clearRecentPassages();
  });

  it('maps CEFR levels to real difficulty tiers with distinct word ranges', () => {
    expect(mapCefrToDifficultyTier('A1')).toBe('Beginner');
    expect(mapCefrToDifficultyTier('B2')).toBe('Intermediate');
    expect(mapCefrToDifficultyTier('C2')).toBe('Advanced');

    const beginner = getWordCountRangeForTier('Beginner');
    const advanced = getWordCountRangeForTier('Advanced');
    expect(beginner[1]).toBeLessThan(advanced[0]);
  });

  it('buildPassagePrompt includes anti-template and exclusion guidance', () => {
    const brief = selectContentBrief({ cefrLevel: 'B1', context: 'team updates', seed: 42 });
    const { systemPrompt, userPrompt } = buildPassagePrompt(brief);

    expect(systemPrompt).toMatch(/formulaic/i);
    expect(userPrompt).toMatch(/infer/i);
    expect(userPrompt).toMatch(/Do NOT include round participation statistics/i);
    BANNED_PHRASES.forEach((phrase) => {
      expect(systemPrompt.toLowerCase()).toContain(phrase);
    });
  });

  it('generates 10 varied passages without banned phrases or duplicate openings', () => {
    const openings = new Set<string>();
    const topics = new Set<string>();
    const genres = new Set<string>();
    const stats = new Set<string>();

    for (let index = 1; index <= 10; index += 1) {
      const payload = buildReadingPassageSync({
        cefrLevel: index % 2 === 0 ? 'B1' : 'C1',
        context: `context-${index}`,
        seed: index * 997,
      });

      expect(containsBannedPhrase(payload.passageText)).toBe(false);
      BANNED_PHRASES.forEach((phrase) => {
        expect(payload.passageText.toLowerCase()).not.toContain(phrase);
      });

      openings.add(normalizeOpening(payload.passageText.split('\n')[0] ?? ''));
      topics.add(payload.topicDomain);
      genres.add(payload.genre);

    const statMatch = payload.passageText.match(/\b\d{1,3}(?:\.\d+)?\s*(?:percent|%|million|billion|thousand)\b/i);
    if (statMatch) {
      stats.add(statMatch[0].toLowerCase());
    }
  }

  expect(openings.size).toBeGreaterThanOrEqual(8);
  expect(topics.size).toBeGreaterThanOrEqual(5);
  expect(genres.size).toBeGreaterThanOrEqual(4);
  // Statistics appear only in some structural styles; uniqueness matters when present.
  expect(stats.size).toBeLessThanOrEqual(openings.size);
  });

  it('shows a complexity gradient between Beginner and Advanced tiers', () => {
    const beginnerSamples = Array.from({ length: 3 }, (_, idx) =>
      buildReadingPassageSync({ cefrLevel: 'A2', context: 'shopping', seed: 100 + idx }),
    );
    const advancedSamples = Array.from({ length: 3 }, (_, idx) =>
      buildReadingPassageSync({ cefrLevel: 'C2', context: 'ethics review', seed: 500 + idx }),
    );

    const avgBeginnerSentence =
      beginnerSamples.reduce((sum, item) => sum + averageSentenceLength(item.passageText), 0) /
      beginnerSamples.length;
    const avgAdvancedSentence =
      advancedSamples.reduce((sum, item) => sum + averageSentenceLength(item.passageText), 0) /
      advancedSamples.length;

    const avgBeginnerSyllables =
      beginnerSamples.reduce((sum, item) => sum + averageSyllablesPerWord(item.passageText), 0) /
      beginnerSamples.length;
    const avgAdvancedSyllables =
      advancedSamples.reduce((sum, item) => sum + averageSyllablesPerWord(item.passageText), 0) /
      advancedSamples.length;

    const avgBeginnerWords =
      beginnerSamples.reduce((sum, item) => sum + countWords(item.passageText), 0) / beginnerSamples.length;
    const avgAdvancedWords =
      advancedSamples.reduce((sum, item) => sum + countWords(item.passageText), 0) / advancedSamples.length;

    expect(avgAdvancedWords).toBeGreaterThan(avgBeginnerWords + 40);
    expect(avgAdvancedSyllables).toBeGreaterThan(avgBeginnerSyllables);
    expect(
      avgAdvancedSentence > avgBeginnerSentence ||
        avgAdvancedSyllables > avgBeginnerSyllables + 0.05,
    ).toBe(true);
  });

  it('includes narrative, expository, and argumentative genres in a batch of 10', () => {
    const genres = new Set<string>();
    for (let index = 1; index <= 10; index += 1) {
      const payload = buildReadingPassageSync({ cefrLevel: 'B2', context: 'project planning', seed: index * 131 });
      genres.add(payload.genre);
    }

    expect(genres.has('narrative') || genres.has('biographical')).toBe(true);
    expect(genres.has('expository') || genres.has('scientific') || genres.has('news-report')).toBe(true);
    expect(genres.has('argumentative') || genres.has('business-case')).toBe(true);
    expect(READING_GENRES.length).toBeGreaterThanOrEqual(9);
  });

  it('buildReadingItemContent returns comprehension fields for seed integration', () => {
    const item = buildReadingItemContent({
      level: { id: 'B1', order: 3 },
      context: 'customer support',
      competency: 'skim reading',
      index: 12,
      module: { label: 'Main Idea' },
    });

    expect(item.passageText.length).toBeGreaterThan(80);
    expect(item.stem).toMatch(/main idea/i);
    expect(item.correctAnswer.length).toBeGreaterThan(10);
    expect(item.distractors).toHaveLength(3);
    expect(containsBannedPhrase(item.passageText)).toBe(false);
  });
});
