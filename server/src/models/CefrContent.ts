import mongoose, { Document, Model, Schema } from 'mongoose';

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type LsrwSkill = 'L' | 'S' | 'R' | 'W';

export interface ICefrContentQuestion {
  type: 'MCQ' | 'Open' | 'GapFill' | 'TrueFalse';
  prompt: string;
  options?: string[];
  answer: string | boolean;
  explanation?: string;
}

export interface ICefrContent extends Document {
  seedKey: string;
  level: CefrLevel;
  skill: LsrwSkill;
  title: string;
  content: string;
  questions: ICefrContentQuestion[];
  modelAnswer?: string;
  audioUrl?: string;
  audioContentType?: string;
  metadata?: Record<string, unknown>;
}

const cefrContentQuestionSchema = new Schema<ICefrContentQuestion>(
  {
    type: { type: String, enum: ['MCQ', 'Open', 'GapFill', 'TrueFalse'], required: true },
    prompt: { type: String, required: true },
    options: [String],
    answer: { type: Schema.Types.Mixed, required: true },
    explanation: String,
  },
  { _id: false },
);

const cefrContentSchema = new Schema<ICefrContent>(
  {
    seedKey: { type: String, required: true, unique: true, index: true },
    level: { type: String, enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], required: true, index: true },
    skill: { type: String, enum: ['L', 'S', 'R', 'W'], required: true, index: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    questions: [cefrContentQuestionSchema],
    modelAnswer: String,
    audioUrl: String,
    audioContentType: String,
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true },
);

cefrContentSchema.index({ level: 1, skill: 1, title: 1 });

export const CefrContent =
  (mongoose.models.CefrContent as Model<ICefrContent> | undefined) ??
  mongoose.model<ICefrContent>('CefrContent', cefrContentSchema);
