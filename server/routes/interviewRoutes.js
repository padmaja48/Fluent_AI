const express = require('express');
const {
  createInterview,
  startInterview,
  submitAnswer,
  completeInterview,
  getUserInterviews,
} = require('../controllers/interviewController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authMiddleware, createInterview);
router.get('/user-interviews', authMiddleware, getUserInterviews);
router.post('/start', authMiddleware, startInterview);
router.post('/answer', authMiddleware, submitAnswer);
router.post('/complete', authMiddleware, completeInterview);

module.exports = router;
