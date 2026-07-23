import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { ReadingPassagePool } from '../src/models/ReadingPassagePool';
import {
  batchGenerateReadingPassagePool,
  DEFAULT_POOL_SIZE_PER_TIER,
  getPoolSizeFromEnv,
} from '../src/services/readingPassageGenerator.service';

dotenv.config();

const main = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fluentai';
  const targetSize = getPoolSizeFromEnv();

  await mongoose.connect(uri);
  console.log(`Generating reading passage pool: ${targetSize} passages per difficulty tier (${targetSize * 3} total LLM calls).`);
  console.log(`Default full pool size is ${DEFAULT_POOL_SIZE_PER_TIER}; override with READING_POOL_SIZE.`);

  const summary = await batchGenerateReadingPassagePool({
    targetSizePerTier: targetSize,
    onProgress: ({ tier, completed, target, poolKey }) => {
      console.log(`[${tier}] ${completed}/${target} saved (${poolKey})`);
    },
  });

  const counts = await ReadingPassagePool.aggregate([
    { $group: { _id: '$difficultyTier', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  console.log('\nPool generation complete.');
  console.log(`Generated: ${summary.generated}, skipped invalid: ${summary.skipped}, failed: ${summary.failed}`);
  for (const row of counts) {
    console.log(`${row._id}: ${row.count}`);
  }

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error('Reading passage pool seed failed:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
