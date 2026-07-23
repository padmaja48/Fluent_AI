import mongoose, { Document, Model, Schema } from 'mongoose';
import type { DifficultyTier, ReadingGenre, StructuralStyle } from '../services/readingPassageGenerator.service';

export interface IReadingPassagePoolEntry extends Document {
  poolKey: string;
  difficultyTier: DifficultyTier;
  cefrLevel: string;
  title: string;
  passageText: string;
  genre: ReadingGenre;
  topicDomain: string;
  structuralStyle: StructuralStyle;
  vocabularyTerm?: string;
  vocabularyMeaning?: string;
  inferenceAnchor?: string;
  mainIdea?: string;
  keyDetail?: string;
  generatedAt: Date;
}

const readingPassagePoolSchema = new Schema<IReadingPassagePoolEntry>(
  {
    poolKey: { type: String, required: true, unique: true, index: true },
    difficultyTier: { type: String, required: true, index: true },
    cefrLevel: { type: String, required: true },
    title: { type: String, required: true },
    passageText: { type: String, required: true },
    genre: { type: String, required: true },
    topicDomain: { type: String, required: true },
    structuralStyle: { type: String, required: true },
    vocabularyTerm: String,
    vocabularyMeaning: String,
    inferenceAnchor: String,
    mainIdea: String,
    keyDetail: String,
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

readingPassagePoolSchema.index({ difficultyTier: 1, poolKey: 1 });

export const ReadingPassagePool =
  (mongoose.models.ReadingPassagePool as Model<IReadingPassagePoolEntry> | undefined) ??
  mongoose.model<IReadingPassagePoolEntry>('ReadingPassagePool', readingPassagePoolSchema);
