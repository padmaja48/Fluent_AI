const { chromium } = require('playwright-core');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: 'server/.env' });

const baseUrl = process.env.UI_URL || 'http://localhost:5174';
const chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';

const results = [];
const failures = [];
const consoleErrors = [];
const failedRequests = [];
const errorResponses = [];

const record = (name, status, detail = '') => {
  results.push({ name, status, detail });
  const marker = status === 'PASS' ? '✓' : status === 'WARN' ? '!' : '✗';
  console.log(`${marker} ${name}${detail ? ` — ${detail}` : ''}`);
};

const seedQuestion = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/eduai');
  await mongoose.connection.collection('questions').updateOne(
    { stem: 'E2E smoke question: What is the main benefit of structured interview practice?' },
    {
      $setOnInsert: {
        stem: 'E2E smoke question: What is the main benefit of structured interview practice?',
        skill: 'Listening',
        level: 'B2',
        type: 'MCQ',
        options: [
          { text: 'It creates repeatable feedback loops', isCorrect: true },
          { text: 'It removes the need to prepare', isCorrect: false },
          { text: 'It guarantees every job offer', isCorrect: false },
        ],
        correctAnswer: 'It creates repeatable feedback loops',
        explanation: 'Structured practice helps candidates improve through consistent feedback.',
        status: 'Active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
};

const cleanupUser = async (email) => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/eduai');
  }

  const users = mongoose.connection.collection('users');
  const user = await users.findOne({ email });
  if (!user) return;

  await Promise.all([
    mongoose.connection.collection('authsessions').deleteMany({ userId: user._id }),
    mongoose.connection.collection('sessions').deleteMany({ userId: user._id }),
    mongoose.connection.collection('interviews').deleteMany({ userId: user._id }),
    mongoose.connection.collection('reports').deleteMany({ userId: user._id }),
    mongoose.connection.collection('resumes').deleteMany({ userId: user._id }),
    mongoose.connection.collection('schedules').deleteMany({ userId: user._id }),
    users.deleteOne({ _id: user._id }),
  ]);
};

const expectText = async (page, text, name, timeout = 8000) => {
  try {
    await page.getByText(text, { exact: false }).first().waitFor({ timeout });
    record(name, 'PASS');
  } catch (error) {
    record(name, 'FAIL', `Missing text: ${text}`);
    failures.push({ name, error: error.message });
  }
};

(async () => {
  await seedQuestion();

  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      errorResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('dialog', async (dialog) => {
    record(`Dialog: ${dialog.message()}`, 'PASS');
    await dialog.accept();
  });

  const email = `ui-smoke-${Date.now()}@example.com`;
  const password = 'Password123!';

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await expectText(page, 'Welcome back to EduAI', 'Login screen renders');

  await page.getByRole('button', { name: 'Sign up' }).click();
  await expectText(page, 'Start learning English', 'Register screen renders');
  await page.locator('input[type="text"]').fill('UI Smoke Tester');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('select').selectOption('B2');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expectText(page, 'Dashboard', 'Registration logs in and reaches app shell', 15000);

  await expectText(page, 'Good evening, UI Smoke Tester', 'Dashboard loads user greeting');
  await expectText(page, 'Recent activity', 'Dashboard recent activity section renders');

  await page.getByRole('button', { name: /Practice/ }).click();
  await expectText(page, 'Practice Hub', 'Practice screen renders');
  await page.locator('.practice-config select').nth(0).selectOption('Listening');
  await page.locator('.practice-config select').nth(1).selectOption('B2');
  await page.getByRole('button', { name: 'Start Practice' }).click();
  await page.waitForTimeout(2500);
  const practiceLoading = await page.getByText('Loading questions...', { exact: false }).count();
  const practiceQuestion = await page.getByText('Practice - Listening', { exact: false }).count();
  if (practiceQuestion > 0 && practiceLoading === 0) {
    record('Practice start click opens a question', 'PASS');
    const firstOption = page.locator('.option-btn').first();
    if (await firstOption.count()) {
      await firstOption.click();
      await page.getByRole('button', { name: 'Submit Answer' }).click();
      record('Practice answer submit click works', 'PASS');
    } else {
      record('Practice answer submit click skipped', 'WARN', 'No option button was rendered');
    }
  } else {
    const emptyMessage = await page.getByText('No active Listening questions', { exact: false }).count();
    record(
      'Practice start click opens a question',
      emptyMessage ? 'WARN' : 'FAIL',
      emptyMessage
        ? 'Empty question bank message rendered'
        : 'No question or empty-state message rendered',
    );
    if (!emptyMessage) {
      failures.push({ name: 'Practice start click opens a question', error: 'No question or empty state' });
    }
  }

  await page.getByRole('button', { name: /Interview/ }).click();
  await expectText(page, 'AI Mock Interview', 'Interview setup screen renders');
  await page.locator('select[name="roleDomain"]').selectOption('Backend Engineering');
  await page.locator('select[name="roleLevel"]').selectOption('Mid');
  await page.locator('select[name="interviewStyle"]').selectOption('Mixed');
  await page.locator('select[name="duration"]').selectOption('30');
  await page.getByRole('button', { name: 'Start Interview' }).click();
  await expectText(page, 'Interview in Progress', 'Interview start click creates interview', 15000);
  await page.locator('.mic-btn').click();
  await expectText(page, 'Recording...', 'Interview mic toggle click works');
  await page.getByRole('button', { name: 'Submit Answer' }).click();
  await page.waitForTimeout(1500);
  record('Interview answer submit click executed', 'PASS');

  await page.getByRole('button', { name: /Results/ }).click();
  await expectText(page, 'Session Results', 'Results screen renders');

  await page.getByRole('button', { name: /Admin/ }).click();
  await expectText(page, 'Access Denied. Admin only.', 'Admin non-admin guard renders');

  await page.locator('.logout-btn').click();
  await expectText(page, 'Welcome back to EduAI', 'Logout returns to login');

  if (consoleErrors.length) {
    record('Browser console errors', 'WARN', `${consoleErrors.length} error(s) captured`);
    consoleErrors.forEach((item) => console.log(`  console: ${item}`));
  } else {
    record('Browser console errors', 'PASS', 'None captured');
  }

  if (failedRequests.length) {
    record('Failed browser requests', 'WARN', `${failedRequests.length} failed request(s) captured`);
    failedRequests.forEach((item) => console.log(`  request: ${item}`));
  } else {
    record('Failed browser requests', 'PASS', 'None captured');
  }

  if (errorResponses.length) {
    record('HTTP error responses', 'WARN', `${errorResponses.length} response(s) >= 400`);
    errorResponses.forEach((item) => console.log(`  response: ${item}`));
  } else {
    record('HTTP error responses', 'PASS', 'None captured');
  }

  await browser.close();
  await cleanupUser(email);
  await mongoose.disconnect();

  if (failures.length) {
    process.exitCode = 1;
  }
})();
