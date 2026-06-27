const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  level: {
    type: String,
    enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    default: 'B1',
  },
  totalSessions: {
    type: Number,
    default: 0,
  },
  averageScore: {
    type: Number,
    default: 0,
  },
  streak: {
    type: Number,
    default: 0,
  },
  skills: {
    listening: { type: Number, default: 0 },
    speaking: { type: Number, default: 0 },
    reading: { type: Number, default: 0 },
    writing: { type: Number, default: 0 },
  },
  role: {
    type: String,
    enum: ['student', 'admin'],
    default: 'student',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);
