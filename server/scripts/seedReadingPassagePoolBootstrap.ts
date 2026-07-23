import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { BOOTSTRAP_READING_PASSAGES } from '../src/data/readingPassagePool.bootstrap';
import { ReadingPassagePool } from '../src/models/ReadingPassagePool';
import type { DifficultyTier, GeneratedPassagePayload } from '../src/services/readingPassageGenerator.service';
import { clearReadingPassagePoolCache } from '../src/services/readingPassageGenerator.service';

dotenv.config();

const TARGET_PER_TIER = 30;

const CEFR_BY_TIER: Record<DifficultyTier, string[]> = {
  Beginner: ['A1', 'A2'],
  Intermediate: ['B1', 'B2'],
  Advanced: ['C1', 'C2'],
};

const buildTierPool = (tier: DifficultyTier): GeneratedPassagePayload[] => {
  const source = BOOTSTRAP_READING_PASSAGES.filter((entry) => entry.difficultyTier === tier);
  if (!source.length) {
    throw new Error(`No bootstrap passages configured for ${tier}.`);
  }

  const pool: GeneratedPassagePayload[] = [];
  for (let index = 0; index < TARGET_PER_TIER; index += 1) {
    pool.push(source[index % source.length]);
  }
  return pool;
};

const main = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fluentai';
  await mongoose.connect(uri);

  let upserted = 0;
  for (const tier of ['Beginner', 'Intermediate', 'Advanced'] as DifficultyTier[]) {
    const tierPool = buildTierPool(tier);
    for (let index = 0; index < tierPool.length; index += 1) {
      const entry = tierPool[index];
      const poolKey = `${tier}:${String(index + 1).padStart(4, '0')}`;
      const cefrLevel = CEFR_BY_TIER[tier][index % CEFR_BY_TIER[tier].length];

      await ReadingPassagePool.findOneAndUpdate(
        { poolKey },
        {
          poolKey,
          difficultyTier: tier,
          cefrLevel,
          title: entry.title,
          passageText: entry.passageText,
          genre: entry.genre,
          topicDomain: entry.topicDomain,
          structuralStyle: entry.structuralStyle,
          vocabularyTerm: entry.vocabularyTerm,
          vocabularyMeaning: entry.vocabularyMeaning,
          inferenceAnchor: entry.inferenceAnchor,
          mainIdea: entry.mainIdea,
          keyDetail: entry.keyDetail,
          generatedAt: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      upserted += 1;
    }
  }

  clearReadingPassagePoolCache();
  const counts = await ReadingPassagePool.aggregate([
    { $group: { _id: '$difficultyTier', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  console.log(`Bootstrap reading pool upserted: ${upserted}`);
  for (const row of counts) {
    console.log(`${row._id}: ${row.count}`);
  }

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error('Bootstrap reading pool seed failed:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
