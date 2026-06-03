import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ITestSection {
  skill: 'Listening' | 'Speaking' | 'Reading' | 'Writing';
  questionIds: mongoose.Types.ObjectId[];
  timeLimit?: number;
}

export interface ITest extends Document {
  title: string;
  description?: string;
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  durationMinutes: number;
  sections: ITestSection[];
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
}

const testSectionSchema = new Schema<ITestSection>(
  {
    skill: { type: String, enum: ['Listening', 'Speaking', 'Reading', 'Writing'], required: true },
    questionIds: [{ type: Schema.Types.ObjectId, ref: 'Question' }],
    timeLimit: Number,
  },
  { _id: false },
);

const testSchema = new Schema<ITest>(
  {
    title: { type: String, required: true },
    description: String,
    level: { type: String, enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], required: true, index: true },
    durationMinutes: { type: Number, default: 60 },
    sections: [testSectionSchema],
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const Test =
  (mongoose.models.Test as Model<ITest> | undefined) ??
  mongoose.model<ITest>('Test', testSchema);
