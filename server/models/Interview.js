const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  resumeUrl: String,
  resumeText: String,
  roleLevel: {
    type: String,
    enum: ['Fresher', 'Mid', 'Senior', 'Lead'],
    required: true,
  },
  roleDomain: {
    type: String,
    enum: ['Backend Engineering', 'Frontend Engineering', 'Fullstack', 'DevOps', 'Data Science', 'Product Management'],
    required: true,
  },
  interviewStyle: {
    type: String,
    enum: ['Technical deep-dive', 'Mixed', 'HR / Behavioural', 'Case Study'],
    default: 'Mixed',
  },
  duration: {
    type: Number,
    enum: [15, 30, 45],
    default: 30,
  },
  questions: [{
    question: String,
    userAnswer: String,
    feedback: String,
    score: Number,
  }],
  totalScore: Number,
  feedbackSummary: {
    strengths: [String],
    improvements: [String],
    overallFeedback: String,
  },
  status: {
    type: String,
    enum: ['Setup', 'In Progress', 'Completed', 'Pending Review'],
    default: 'Setup',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Interview', interviewSchema);
