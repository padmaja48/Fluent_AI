const User = require('../models/User');
const Session = require('../models/Session');

const getUserDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    const sessions = await Session.find({ userId: req.userId, status: 'Completed' });
    const recentActivity = sessions.slice(0, 3);
    
    res.json({
      user,
      totalSessions: sessions.length,
      recentActivity,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, level } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      { name, level },
      { new: true }
    ).select('-password');
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getUserDashboard,
  updateProfile,
  getAllUsers,
};
