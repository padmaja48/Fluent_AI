const Question = require('../models/Question');

const getQuestions = async (req, res) => {
  try {
    const { skill, level, type } = req.query;
    const filter = {};
    
    if (skill) filter.skill = skill;
    if (level) filter.level = level;
    if (type) filter.type = type;
    filter.status = 'Active';

    const questions = await Question.find(filter).limit(10);
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    res.json(question);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createQuestion = async (req, res) => {
  try {
    const question = new Question(req.body);
    await question.save();
    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateQuestion = async (req, res) => {
  try {
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(question);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteQuestion = async (req, res) => {
  try {
    await Question.findByIdAndDelete(req.params.id);
    res.json({ message: 'Question deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
};
