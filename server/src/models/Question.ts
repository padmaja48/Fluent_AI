import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IQuestion extends Document {
  stem: string;
  skill: 'Listening' | 'Speaking' | 'Reading' | 'Writing';
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  type: 'MCQ' | 'T-F-NG' | 'Task' | 'Essay';
  options: Array<{ text: string; isCorrect: boolean }>;
  correctAnswer?: string;
  explanation?: string;
  audioUrl?: string;
  audioPrompt?: string;
  passageText?: string;
  imageUrl?: string;
  hints?: string[];
  journeyOrder?: number;
  levelOrder?: number;
  skillOrder?: number;
  moduleType?: string;
  moduleLabel?: string;
  moduleOrder?: number;
  moduleQuestionOrder?: number;
  topic?: string;
  competency?: string;
  status: 'Draft' | 'Active' | 'Archived';
}

const questionSchema = new Schema<IQuestion>(
  {
    stem: { type: String, required: true },
    skill: { type: String, enum: ['Listening', 'Speaking', 'Reading', 'Writing'], required: true, index: true },
    level: { type: String, enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], required: true, index: true },
    type: { type: String, enum: ['MCQ', 'T-F-NG', 'Task', 'Essay'], required: true },
    options: [
      {
        text: String,
        isCorrect: Boolean,
      },
    ],
    correctAnswer: String,
    explanation: String,
    audioUrl: String,
    audioPrompt: String,
    passageText: String,
    imageUrl: String,
    hints: [String],
    journeyOrder: { type: Number, index: true },
    levelOrder: { type: Number, index: true },
    skillOrder: { type: Number, index: true },
    moduleType: { type: String, index: true },
    moduleLabel: String,
    moduleOrder: { type: Number, index: true },
    moduleQuestionOrder: { type: Number, index: true },
    topic: String,
    competency: String,
    status: { type: String, enum: ['Draft', 'Active', 'Archived'], default: 'Active', index: true },
  },
  { timestamps: true },
);

// Compound index to support fast sorted queries without memory limit errors
questionSchema.index({ skill: 1, level: 1, createdAt: -1 });
questionSchema.index({ createdAt: -1 });

export const Question =
  (mongoose.models.Question as Model<IQuestion> | undefined) ??
  mongoose.model<IQuestion>('Question', questionSchema);
