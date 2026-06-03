import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ISession extends Document {
  userId: mongoose.Types.ObjectId;
  skill: 'Listening' | 'Speaking' | 'Reading' | 'Writing' | 'Mixed';
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  testLabel?: string;
  testSequence?: number;
  moduleType?: string;
  moduleLabel?: string;
  moduleOrder?: number;
  moduleSetNumber?: number;
  setNumber?: number;
  setSize?: number;
  startOrder?: number;
  endOrder?: number;
  questions: Array<{
    questionId?: mongoose.Types.ObjectId;
    userAnswer?: string;
    isCorrect?: boolean;
    score?: number;
  }>;
  totalScore: number;
  averageScore: number;
  durationSeconds?: number;
  skillBreakdown?: {
    detail?: number;
    inference?: number;
    vocabulary?: number;
    gist?: number;
  };
  testBreakdown?: Array<{
    skill: string;
    answered: number;
    correct: number;
    averageScore: number;
  }>;
  reportEmailedAt?: Date;
  status: 'In Progress' | 'Completed' | 'Submitted';
}

const sessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    skill: { type: String, enum: ['Listening', 'Speaking', 'Reading', 'Writing', 'Mixed'], required: true },
    level: { type: String, enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], required: true },
    testLabel: String,
    testSequence: { type: Number, index: true },
    moduleType: { type: String, index: true },
    moduleLabel: String,
    moduleOrder: { type: Number, index: true },
    moduleSetNumber: { type: Number, index: true },
    setNumber: { type: Number, index: true },
    setSize: { type: Number, default: 10 },
    startOrder: { type: Number, index: true },
    endOrder: { type: Number, index: true },
    questions: [
      {
        questionId: { type: Schema.Types.ObjectId, ref: 'Question' },
        userAnswer: String,
        isCorrect: Boolean,
        score: Number,
      },
    ],
    totalScore: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    durationSeconds: Number,
    skillBreakdown: {
      detail: Number,
      inference: Number,
      vocabulary: Number,
      gist: Number,
    },
    testBreakdown: [
      {
        skill: String,
        answered: Number,
        correct: Number,
        averageScore: Number,
      },
    ],
    reportEmailedAt: Date,
    status: { type: String, enum: ['In Progress', 'Completed', 'Submitted'], default: 'In Progress' },
  },
  { timestamps: true },
);

export const Session =
  (mongoose.models.Session as Model<ISession> | undefined) ??
  mongoose.model<ISession>('Session', sessionSchema);
