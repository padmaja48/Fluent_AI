const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  stem: {
    type: String,
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
  type: {
    type: String,
    enum: ['MCQ', 'T/F/NG', 'Task 1', 'Task 2', 'Prompt', 'Essay'],
    required: true,
  },
  options: [{
    text: String,
    isCorrect: Boolean,
  }],
  correctAnswer: String,
  explanation: String,
  journeyOrder: {
    type: Number,
    index: true,
  },
  levelOrder: {
    type: Number,
    index: true,
  },
  skillOrder: {
    type: Number,
    index: true,
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
  moduleQuestionOrder: {
    type: Number,
    index: true,
  },
  topic: String,
  competency: String,
  audioUrl: String,
  audioPrompt: String,
  imageUrl: String,
  passageText: String,
  hints: [String],
  status: {
    type: String,
    enum: ['Draft', 'Active', 'Archived'],
    default: 'Active',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Question', questionSchema);
