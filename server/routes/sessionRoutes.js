const express = require('express');
const {
  createSession,
  getSession,
  getUserSessions,
  submitAnswer,
  submitSession,
} = require('../controllers/sessionController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authMiddleware, createSession);
router.get('/user-sessions', authMiddleware, getUserSessions);
router.get('/:id', authMiddleware, getSession);
router.post('/answer', authMiddleware, submitAnswer);
router.post('/submit', authMiddleware, submitSession);

module.exports = router;
