const Interview = require('../models/Interview');
const User = require('../models/User');

const createInterview = async (req, res) => {
  try {
    const { roleLevel, roleDomain, interviewStyle, duration, resumeText } = req.body;
    
    const interview = new Interview({
      userId: req.userId,
      roleLevel,
      roleDomain,
      interviewStyle,
      duration,
      resumeText,
      status: 'Setup',
    });
    
    await interview.save();
    res.status(201).json(interview);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const startInterview = async (req, res) => {
  try {
    const { interviewId } = req.body;
    
    const interview = await Interview.findById(interviewId);
    interview.status = 'In Progress';
    await interview.save();
    
    res.json(interview);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const submitAnswer = async (req, res) => {
  try {
    const { interviewId, question, answer } = req.body;
    
    const interview = await Interview.findById(interviewId);
    interview.questions.push({
      question,
      userAnswer: answer,
    });
    
    await interview.save();
    res.json(interview);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const completeInterview = async (req, res) => {
  try {
    const { interviewId, feedback, totalScore } = req.body;
    
    const interview = await Interview.findById(interviewId);
    interview.status = 'Pending Review';
    interview.totalScore = totalScore;
    interview.feedbackSummary = feedback;
    
    await interview.save();
    res.json(interview);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getUserInterviews = async (req, res) => {
  try {
    const interviews = await Interview.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(interviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createInterview,
  startInterview,
  submitAnswer,
  completeInterview,
  getUserInterviews,
};
