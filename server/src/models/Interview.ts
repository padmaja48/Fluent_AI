import mongoose, { Document, Model, Schema } from 'mongoose';

export type InterviewStatus = 'Setup' | 'In Progress' | 'Completed' | 'Pending Review' | 'Cancelled';

export interface IInterviewQuestion {
  question: string;
  expectedSignals?: string[];
  userAnswer?: string;
  transcriptUrl?: string;
  feedback?: string;
  score?: number;
  questionType?: 'behavioural' | 'technical' | 'situational';
  resumeReference?: string;
}

export interface IInterviewViolation {
  type: string;
  timestamp: Date;
  description: string;
}

export interface IInterview extends Document {
  userId: mongoose.Types.ObjectId;
  resumeId?: mongoose.Types.ObjectId;
  resumeUrl?: string;
  resumeText?: string;
  roleLevel: 'Fresher' | 'Mid' | 'Senior' | 'Lead';
  roleDomain: string;
  interviewStyle: string;
  duration: number;
  questions: IInterviewQuestion[];
  currentQuestionIndex: number;
  recordingUrl?: string;
  reportUrl?: string;
  totalScore?: number;
  scores: {
    communication?: number;
    technical?: number;
    behavioral?: number;
  };
  feedbackSummary: {
    strengths: string[];
    improvements: string[];
    overallFeedback?: string;
  };
  status: InterviewStatus;
  startedAt?: Date;
  completedAt?: Date;
  personaId?: 'us-american' | 'us-indian' | 'us-australian' | 'ru-russian';
  interviewType?: 'Behavioural' | 'Technical' | 'Mixed';
  complexity?: 'Beginner' | 'Intermediate' | 'Advanced';
  targetCompany?: string;
  violations: IInterviewViolation[];
  resumeSkills: string[];
  resumeExperienceLevel?: string;
  resumeSuggestedQuestions: string[];
  resumeSummary?: string;
}

const interviewQuestionSchema = new Schema<IInterviewQuestion>(
  {
    question: { type: String, required: true },
    expectedSignals: [String],
    userAnswer: String,
    transcriptUrl: String,
    feedback: String,
    score: Number,
    questionType: { type: String, enum: ['behavioural', 'technical', 'situational'] },
    resumeReference: String,
  },
  { _id: false },
);

const interviewSchema = new Schema<IInterview>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resumeId: { type: Schema.Types.ObjectId, ref: 'Resume' },
    resumeUrl: String,
    resumeText: String,
    roleLevel: { type: String, enum: ['Fresher', 'Mid', 'Senior', 'Lead'], required: true },
    roleDomain: { type: String, required: true },
    interviewStyle: { type: String, default: 'Mixed' },
    duration: { type: Number, enum: [15, 30, 45, 60], default: 30 },
    questions: [interviewQuestionSchema],
    currentQuestionIndex: { type: Number, default: 0 },
    recordingUrl: String,
    reportUrl: String,
    totalScore: Number,
    scores: {
      communication: Number,
      technical: Number,
      behavioral: Number,
    },
    feedbackSummary: {
      strengths: { type: [String], default: [] },
      improvements: { type: [String], default: [] },
      overallFeedback: String,
    },
    status: {
      type: String,
      enum: ['Setup', 'In Progress', 'Completed', 'Pending Review', 'Cancelled'],
      default: 'Setup',
      index: true,
    },
    startedAt: Date,
    completedAt: Date,
    personaId: { type: String, enum: ['us-american', 'us-indian', 'us-australian', 'ru-russian'] },
    interviewType: { type: String, enum: ['Behavioural', 'Technical', 'Mixed'], default: 'Mixed' },
    complexity: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], default: 'Intermediate' },
    targetCompany: { type: String, trim: true, lowercase: true },
    violations: [
      {
        type: { type: String },
        timestamp: { type: Date, default: Date.now },
        description: String,
      },
    ],
    resumeSkills: { type: [String], default: [] },
    resumeExperienceLevel: String,
    resumeSuggestedQuestions: { type: [String], default: [] },
    resumeSummary: String,
  },
  { timestamps: true },
);

export const Interview =
  (mongoose.models.Interview as Model<IInterview> | undefined) ??
  mongoose.model<IInterview>('Interview', interviewSchema);
