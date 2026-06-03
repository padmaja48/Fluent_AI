const express = require('express');
const {
  getQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} = require('../controllers/questionController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', getQuestions);
router.get('/:id', authMiddleware, getQuestion);
router.post('/', authMiddleware, createQuestion);
router.put('/:id', authMiddleware, updateQuestion);
router.delete('/:id', authMiddleware, deleteQuestion);

module.exports = router;
