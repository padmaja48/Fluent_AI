const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Question = require('./models/Question');

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fluentai', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Question.deleteMany({});

    // Create sample users
    const users = await User.insertMany([
      {
        name: 'Arjun Kumar',
        email: 'arjun@example.com',
        password: 'password123',
        level: 'B2',
        totalSessions: 84,
        averageScore: 7.2,
        streak: 12,
        skills: { listening: 8, speaking: 6, reading: 8, writing: 6 },
        role: 'student',
      },
      {
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'admin123',
        level: 'C2',
        role: 'admin',
      },
    ]);

    console.log(`✓ Created ${users.length} users`);

    // Create sample questions
    const questions = await Question.insertMany([
      {
        stem: 'Listen to the business podcast. What is the primary concern about remote work?',
        skill: 'Listening',
        level: 'B2',
        type: 'MCQ',
        options: [
          { text: 'Reduced spontaneous communication', isCorrect: false },
          { text: 'Loss of shared physical workspace culture', isCorrect: true },
          { text: 'Difficulty monitoring productivity', isCorrect: false },
          { text: 'Time zone differences', isCorrect: false },
        ],
        correctAnswer: 'Loss of shared physical workspace culture',
        explanation: 'The speaker emphasizes cultural and ritualistic aspects of office presence.',
        status: 'Active',
      },
      {
        stem: 'Read the passage about climate change. Is the statement "Tipping points are reversible" True or False?',
        skill: 'Reading',
        level: 'C1',
        type: 'T/F/NG',
        options: [
          { text: 'True', isCorrect: false },
          { text: 'False', isCorrect: true },
          { text: 'Not Given', isCorrect: false },
        ],
        correctAnswer: 'False',
        explanation: 'The passage explains that some tipping points are irreversible.',
        status: 'Active',
      },
      {
        stem: 'Describe the bar chart showing quarterly sales trends.',
        skill: 'Writing',
        level: 'B2',
        type: 'Task 1',
        correctAnswer: 'Student should describe trends, compare quarters, and identify key figures.',
        explanation: 'Task 1 answers need clear structure: overview, key features, and comparisons.',
        status: 'Active',
      },
      {
        stem: 'Tell me about handling a critical production issue.',
        skill: 'Speaking',
        level: 'Mid',
        type: 'Prompt',
        correctAnswer: 'Student should provide clear context, problem-solving steps, and outcome.',
        explanation: 'Good speaking answers include storytelling structure and technical clarity.',
        status: 'Active',
      },
    ]);

    console.log(`✓ Created ${questions.length} questions`);

    console.log('✓ Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error seeding database:', error.message);
    process.exit(1);
  }
};

seedDatabase();
