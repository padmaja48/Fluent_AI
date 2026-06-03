const Session = require('../models/Session');
const User = require('../models/User');

const createSession = async (req, res) => {
  try {
    const { skill, level } = req.body;
    
    const session = new Session({
      userId: req.userId,
      skill,
      level,
      status: 'In Progress',
    });
    
    await session.save();
    res.status(201).json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getSession = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id).populate('userId');
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getUserSessions = async (req, res) => {
  try {
    const sessions = await Session.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const submitAnswer = async (req, res) => {
  try {
    const { sessionId, questionId, answer, isCorrect, score } = req.body;
    
    const session = await Session.findById(sessionId);
    session.questions.push({
      questionId,
      userAnswer: answer,
      isCorrect,
      score,
    });
    
    await session.save();
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const submitSession = async (req, res) => {
  try {
    const { sessionId, duration, skillBreakdown } = req.body;
    
    const session = await Session.findById(sessionId);
    session.status = 'Completed';
    session.durationSeconds = duration;
    session.skillBreakdown = skillBreakdown;
    
    // Calculate scores
    const scores = session.questions.map(q => q.score);
    session.totalScore = scores.reduce((a, b) => a + b, 0);
    session.averageScore = scores.length > 0 ? session.totalScore / scores.length : 0;
    
    await session.save();
    
    // Update user stats
    const user = await User.findById(req.userId);
    user.totalSessions += 1;
    const allSessions = await Session.find({ userId: req.userId, status: 'Completed' });
    const allScores = allSessions.flatMap(s => s.questions.map(q => q.score));
    user.averageScore = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
    await user.save();
    
    res.json({ session, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createSession,
  getSession,
  getUserSessions,
  submitAnswer,
  submitSession,
};
