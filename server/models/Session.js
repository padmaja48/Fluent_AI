const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  skill: {
    type: String,
    enum: ['Listening', 'Speaking', 'Reading', 'Writing'],
    required: true,
  },
  level: {
    type: String,
    enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    required: true,
  },
  moduleType: {
    type: String,
    index: true,
  },
  moduleLabel: String,
  moduleOrder: {
    type: Number,
    index: true,
  },
  moduleSetNumber: {
    type: Number,
    index: true,
  },
  setNumber: {
    type: Number,
    index: true,
  },
  setSize: {
    type: Number,
    default: 10,
  },
  startOrder: {
    type: Number,
    index: true,
  },
  endOrder: {
    type: Number,
    index: true,
  },
  questions: [{
    questionId: mongoose.Schema.Types.ObjectId,
    userAnswer: String,
    isCorrect: Boolean,
    score: Number,
  }],
  totalScore: {
    type: Number,
    default: 0,
  },
  averageScore: {
    type: Number,
    default: 0,
  },
  durationSeconds: Number,
  skillBreakdown: {
    detail: Number,
    inference: Number,
    vocabulary: Number,
    gist: Number,
  },
  status: {
    type: String,
    enum: ['In Progress', 'Completed', 'Submitted'],
    default: 'In Progress',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Session', sessionSchema);
