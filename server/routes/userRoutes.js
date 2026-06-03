const express = require('express');
const { getUserDashboard, updateProfile, getAllUsers } = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/dashboard', authMiddleware, getUserDashboard);
router.put('/profile', authMiddleware, updateProfile);
router.get('/all', authMiddleware, getAllUsers);

module.exports = router;
