import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IReport extends Document {
  userId: mongoose.Types.ObjectId;
  interviewId?: mongoose.Types.ObjectId;
  reportUrl?: string;
  communicationScore: number;
  technicalScore: number;
  behavioralScore: number;
  overallScore: number;
  strengths: string[];
  improvements: string[];
  recommendations: string[];
  transcriptSummary?: string;
  questionAnalysis: unknown[];
}

const reportSchema = new Schema<IReport>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    interviewId: { type: Schema.Types.ObjectId, ref: 'Interview', index: true },
    reportUrl: String,
    communicationScore: { type: Number, required: true },
    technicalScore: { type: Number, required: true },
    behavioralScore: { type: Number, required: true },
    overallScore: { type: Number, required: true },
    strengths: { type: [String], default: [] },
    improvements: { type: [String], default: [] },
    recommendations: { type: [String], default: [] },
    transcriptSummary: String,
    questionAnalysis: { type: Schema.Types.Mixed, default: [] },
  },
  { timestamps: true },
);

export const Report =
  (mongoose.models.Report as Model<IReport> | undefined) ??
  mongoose.model<IReport>('Report', reportSchema);
