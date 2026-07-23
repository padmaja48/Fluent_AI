import {
  averageSentenceLength,
  averageSyllablesPerWord,
  BANNED_PHRASES,
  buildPassagePrompt,
  buildReadingItemContent,
  clearReadingPassagePoolCache,
  clearRecentPassages,
  containsBannedPhrase,
  containsMetaCommentary,
  getWordCountRangeForTier,
  hasDuplicateSentenceBlock,
  mapCefrToDifficultyTier,
  META_BANNED_PHRASES,
  normalizeOpening,
  READING_GENRES,
  selectContentBrief,
  setReadingPassagePoolForTests,
  type GeneratedPassagePayload,
} from '../services/readingPassageGenerator.service';

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

const makePassage = (
  tier: GeneratedPassagePayload['difficultyTier'],
  cefr: string,
  index: number,
  topic: string,
  genre: GeneratedPassagePayload['genre'],
  body: string,
): GeneratedPassagePayload => ({
  title: `${genre} on ${topic}`,
  passageText: body,
  genre,
  topicDomain: topic,
  structuralStyle: 'third-person',
  difficultyTier: tier,
  vocabularyTerm: 'initiative',
  vocabularyMeaning: 'a new plan or action to achieve something',
  inferenceAnchor: 'The closing lines imply a cautious conclusion.',
  mainIdea: `The text discusses ${topic} from a ${genre} perspective.`,
  keyDetail: `A concrete detail about ${topic} appears in paragraph two.`,
});

const TEST_POOL: GeneratedPassagePayload[] = [
  makePassage(
    'Beginner',
    'A2',
    1,
    'sports',
    'news-report',
    'Local coaches opened a new indoor court after months of fundraising. Parents donated equipment, and teenagers volunteered to repaint the walls. Attendance at youth practices rose within weeks, though officials warned that maintenance costs would require another budget review in spring.',
  ),
  makePassage(
    'Beginner',
    'A1',
    2,
    'health',
    'expository',
    'Clinic staff noticed that morning appointments were often missed when reminder calls went out too late. They shifted calls to the previous evening and added a short text message. Missed visits dropped, and nurses had more time to prepare rooms before patients arrived.',
  ),
  makePassage(
    'Beginner',
    'A2',
    3,
    'culture',
    'narrative',
    'When the community library reopened, Elena expected a quiet reopening day. Instead, musicians performed in the courtyard while volunteers catalogued donated books. She left with a novel she had not seen since childhood and a flyer for a storytelling workshop next month.',
  ),
  makePassage(
    'Beginner',
    'A1',
    4,
    'technology',
    'expository',
    'A small shop replaced paper receipts with digital codes sent by email. Some regular customers complained at first because they preferred printed records. After staff showed how to search old purchases online, most shoppers accepted the change.',
  ),
  makePassage(
    'Intermediate',
    'B1',
    1,
    'environment',
    'argumentative',
    'City planners proposed widening a riverside path to accommodate cyclists and pedestrians separately. Supporters argued that the split would reduce accidents, while shop owners feared construction would disrupt deliveries for months. The council approved a phased design that keeps one lane open throughout the work.',
  ),
  makePassage(
    'Intermediate',
    'B2',
    2,
    'workplace',
    'business-case',
    'A regional logistics firm tested a four-day schedule after employee surveys showed burnout during peak season. Productivity held steady in the pilot team, but customer support queues lengthened on Fridays. Management now assigns rotating coverage rather than closing the desk entirely.',
  ),
  makePassage(
    'Intermediate',
    'B1',
    3,
    'psychology',
    'scientific',
    'Researchers asked participants to recall a stressful commute and then solve simple puzzles. Those who wrote a brief note about what they could control finished faster than those who relived the event without structuring their thoughts. The authors caution that the sample was limited to university staff.',
  ),
  makePassage(
    'Intermediate',
    'B2',
    4,
    'history',
    'historical',
    'Letters from 1893 describe merchants rerouting shipments after a bridge collapse upstream. Official reports blamed weather, yet correspondence shows traders had warned officials about timber decay for years. Historians use the case to show how informal networks sometimes moved goods before state repairs began.',
  ),
  makePassage(
    'Advanced',
    'C1',
    1,
    'economics',
    'argumentative',
    'Analysts debating inflation forecasts rarely disagree about current prices; they disagree about which constraints will bind first. One camp emphasizes wage contracts locked in last year, while another points to shipping rates that have normalized faster than retail shelves reflect. Policymakers, meanwhile, must decide whether to tighten credit before employment softens.',
  ),
  makePassage(
    'Advanced',
    'C2',
    2,
    'science',
    'scientific',
    'Microbiologists comparing soil samples from alpine meadows found bacterial communities that persisted despite temperature swings exceeding twenty degrees within a day. DNA sequencing suggested horizontal gene transfer among strains isolated on different slopes, implying migration via meltwater channels rather than wind alone. The team stopped short of claiming universal applicability because their plots covered only one watershed.',
  ),
  makePassage(
    'Advanced',
    'C1',
    3,
    'current affairs',
    'news-report',
    'Parliament heard testimony on digital identity systems from civil servants, privacy advocates, and banking representatives. Officials highlighted fraud reduction, whereas advocates warned about function creep if health records link automatically. A final vote was deferred after members requested independent audits of pilot databases.',
  ),
  makePassage(
    'Advanced',
    'C2',
    4,
    'arts',
    'biographical',
    'Before her retrospective opened, sculptor Amira Khan insisted that curators include failed maquettes alongside finished bronzes. She argued that discarded forms reveal how material resistance shaped her later work more honestly than polished artist statements do. Critics divided over whether the unfinished pieces clarified or distracted from her mature style.',
  ),
];

describe('readingPassageGenerator.service', () => {
  beforeEach(() => {
    clearRecentPassages();
    clearReadingPassagePoolCache();
    setReadingPassagePoolForTests(TEST_POOL);
  });

  it('maps CEFR levels to real difficulty tiers with distinct word ranges', () => {
    expect(mapCefrToDifficultyTier('A1')).toBe('Beginner');
    expect(mapCefrToDifficultyTier('B2')).toBe('Intermediate');
    expect(mapCefrToDifficultyTier('C2')).toBe('Advanced');

    const beginner = getWordCountRangeForTier('Beginner');
    const advanced = getWordCountRangeForTier('Advanced');
    expect(beginner[1]).toBeLessThan(advanced[0]);
  });

  it('buildPassagePrompt forbids meta-commentary in generated content', () => {
    const brief = selectContentBrief({ cefrLevel: 'B1', context: 'team updates', seed: 42 });
    const { systemPrompt, userPrompt } = buildPassagePrompt(brief);

    expect(systemPrompt).toMatch(/never meta-commentary/i);
    expect(userPrompt).toMatch(/Do NOT mention "the passage"/i);
    META_BANNED_PHRASES.forEach((phrase) => {
      expect(BANNED_PHRASES.join(' ').toLowerCase()).toContain(phrase.toLowerCase());
    });
  });

  it('pool-backed passages avoid banned and meta-commentary phrases', () => {
    for (let index = 1; index <= 12; index += 1) {
      const item = buildReadingItemContent({
        level: { id: index % 2 === 0 ? 'B2' : 'C1', order: 3 },
        context: `topic-${index}`,
        competency: 'skim reading',
        index,
      });

      expect(containsBannedPhrase(item.passageText)).toBe(false);
      expect(containsMetaCommentary(item.passageText)).toBe(false);
      META_BANNED_PHRASES.forEach((phrase) => {
        expect(item.passageText.toLowerCase()).not.toContain(phrase.toLowerCase());
      });
    }
  });

  it('pool-backed passages do not repeat sentence blocks within the same passage', () => {
    for (const entry of TEST_POOL) {
      expect(hasDuplicateSentenceBlock(entry.passageText)).toBe(false);
    }

    for (let index = 1; index <= 12; index += 1) {
      const item = buildReadingItemContent({
        level: { id: 'B1', order: 3 },
        context: 'customer support',
        competency: 'specific detail',
        index,
      });
      expect(hasDuplicateSentenceBlock(item.passageText)).toBe(false);
    }
  });

  it('pool-backed passages use varied openings across a batch', () => {
    const openings = new Set<string>();
    for (let index = 1; index <= 12; index += 1) {
      const item = buildReadingItemContent({
        level: { id: index % 3 === 0 ? 'A2' : index % 3 === 1 ? 'B1' : 'C2', order: 2 },
        context: `context-${index}`,
        competency: 'skim reading',
        index,
      });
      openings.add(normalizeOpening(item.passageText.split('\n')[0] ?? item.passageText));
    }
    expect(openings.size).toBeGreaterThanOrEqual(8);
  });

  it('shows a complexity gradient between Beginner and Advanced pool tiers', () => {
    const beginnerSamples = TEST_POOL.filter((entry) => entry.difficultyTier === 'Beginner');
    const advancedSamples = TEST_POOL.filter((entry) => entry.difficultyTier === 'Advanced');

    const avgBeginnerWords =
      beginnerSamples.reduce((sum, item) => sum + countWords(item.passageText), 0) / beginnerSamples.length;
    const avgAdvancedWords =
      advancedSamples.reduce((sum, item) => sum + countWords(item.passageText), 0) / advancedSamples.length;

    const avgBeginnerSyllables =
      beginnerSamples.reduce((sum, item) => sum + averageSyllablesPerWord(item.passageText), 0) /
      beginnerSamples.length;
    const avgAdvancedSyllables =
      advancedSamples.reduce((sum, item) => sum + averageSyllablesPerWord(item.passageText), 0) /
      advancedSamples.length;

    expect(avgAdvancedWords).toBeGreaterThan(avgBeginnerWords);
    expect(avgAdvancedSyllables).toBeGreaterThanOrEqual(avgBeginnerSyllables);
    expect(averageSentenceLength(advancedSamples[0].passageText)).toBeGreaterThanOrEqual(
      averageSentenceLength(beginnerSamples[0].passageText),
    );
  });

  it('includes narrative, expository, and argumentative genres in the test pool', () => {
    const genres = new Set(TEST_POOL.map((entry) => entry.genre));
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
