import { Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { Question } from '../models/Question';
import { Session } from '../models/Session';
import { User } from '../models/User';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { evaluateAnswer, transcribeAudio, transcribeAudioWithSarvam } from '../services/ai.service';
import { mixedTestReportEmail, queueEmail } from '../services/email.service';
import {
  getImageDescriptionItem,
  getImageDescriptionItems,
  ImageDescriptionLevel,
  publicImageDescriptionItem,
} from '../data/imageDescriptionCatalog';

const createSchema = z.object({
  body: z.object({
    skill: z.enum(['Listening', 'Speaking', 'Reading', 'Writing']),
    level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
    setNumber: z.coerce.number().int().min(1).max(100).optional(),
    moduleOrder: z.coerce.number().int().min(1).max(5).optional(),
    moduleSetNumber: z.coerce.number().int().min(1).max(20).optional(),
  }),
});

const mixedTestCreateSchema = z.object({
  body: z.object({
    level: z.enum(['Beginner', 'Intermediate', 'Advanced']),
    testNumber: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

const idSchema = z.object({ params: z.object({ id: z.string().min(1) }) });

const answerSchema = z.object({
  body: z.object({
    sessionId: z.string(),
    questionId: z.string().optional(),
    answer: z.string(),
    isCorrect: z.boolean().optional(),
    score: z.coerce.number().min(0).max(100).optional(),
  }),
});

const submitSchema = z.object({
  body: z.object({
    sessionId: z.string(),
    duration: z.coerce.number().optional(),
    skillBreakdown: z
      .object({
        detail: z.number().optional(),
        inference: z.number().optional(),
        vocabulary: z.number().optional(),
        gist: z.number().optional(),
      })
      .optional(),
  }),
});

const imageDescriptionCatalogSchema = z.object({
  query: z.object({
    level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).default('A1'),
  }),
});

const router = Router();
const SKILLS = ['Listening', 'Speaking', 'Reading', 'Writing'] as const;
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
const SET_SIZE = 10;
const TEST_SECTION_STRUCTURE = [
  { id: 'sentence-correction', skill: 'Writing', label: 'Sentence Correction', order: 1, minQuestions: 3, maxQuestions: 3, questionCount: 3 },
  { id: 'error-detection', skill: 'Writing', label: 'Error Detection', order: 2, minQuestions: 3, maxQuestions: 3, questionCount: 3 },
  { id: 'fill-in-the-blanks', skill: 'Writing', label: 'Fill in the Blanks', order: 3, minQuestions: 3, maxQuestions: 3, questionCount: 3 },
  { id: 'correct-sentence', skill: 'Writing', label: 'Choose the Correct Sentence', order: 4, minQuestions: 3, maxQuestions: 3, questionCount: 3 },
  { id: 'vocabulary', skill: 'Writing', label: 'Vocabulary', order: 5, minQuestions: 3, maxQuestions: 3, questionCount: 3 },
  { id: 'sentence-completion', skill: 'Writing', label: 'Sentence Completion', order: 6, minQuestions: 3, maxQuestions: 3, questionCount: 3 },
  { id: 'reading-comprehension', skill: 'Reading', label: 'Reading Comprehension', order: 7, minQuestions: 3, maxQuestions: 3, questionCount: 3 },
] as const;
const TEST_SECTION_IDS = TEST_SECTION_STRUCTURE.map((section) => section.id);
const MIXED_TEST_SIZE = TEST_SECTION_STRUCTURE.reduce((sum, section) => sum + section.questionCount, 0);
const MIXED_TEST_MIN_QUESTIONS = TEST_SECTION_STRUCTURE.reduce((sum, section) => sum + section.minQuestions, 0);
const MIXED_TEST_MAX_QUESTIONS = TEST_SECTION_STRUCTURE.reduce((sum, section) => sum + section.maxQuestions, 0);
const MIXED_TESTS_PER_LEVEL = 100;
const QUESTIONS_PER_SKILL_LEVEL = 1000;
const TOTAL_SETS_PER_SKILL_LEVEL = QUESTIONS_PER_SKILL_LEVEL / SET_SIZE;
const MODULES_PER_SKILL_LEVEL = 5;
const TOTAL_SETS_PER_MODULE = TOTAL_SETS_PER_SKILL_LEVEL / MODULES_PER_SKILL_LEVEL;
const MODULE_CATALOG = {
  Listening: [
    { id: 'gist-and-purpose', label: 'Gist & Purpose' },
    { id: 'details-and-numbers', label: 'Details & Numbers' },
    { id: 'speaker-intent', label: 'Speaker Intent' },
    { id: 'inference-and-tone', label: 'Inference & Tone' },
    { id: 'sequence-and-action', label: 'Sequence & Action' },
  ],
  Speaking: [
    { id: 'short-response', label: 'Short Response' },
    { id: 'personal-story', label: 'Personal Story' },
    { id: 'role-play', label: 'Role Play' },
    { id: 'discussion', label: 'Discussion' },
    { id: 'follow-up-defense', label: 'Follow-up Defense' },
  ],
  Reading: [
    { id: 'main-idea', label: 'Main Idea' },
    { id: 'detail-search', label: 'Detail Search' },
    { id: 'vocabulary', label: 'Vocabulary' },
    { id: 'purpose-and-tone', label: 'Purpose & Tone' },
    { id: 'logic-and-inference', label: 'Logic & Inference' },
  ],
  Writing: [
    { id: 'sentence-control', label: 'Sentence Control' },
    { id: 'paragraph-building', label: 'Paragraph Building' },
    { id: 'cohesion', label: 'Cohesion' },
    { id: 'tone-and-register', label: 'Tone & Register' },
    { id: 'argument-development', label: 'Argument Development' },
  ],
} as const;
const TEST_LEVELS = [
  {
    id: 'Beginner',
    label: 'Beginner',
    sourceLevels: ['A1', 'A2'],
    description: 'Basic grammar, simple vocabulary, sentence correction, and short reading comprehension.',
  },
  {
    id: 'Intermediate',
    label: 'Intermediate',
    sourceLevels: ['B1', 'B2'],
    description: 'Workplace grammar, vocabulary in context, sentence completion, and connected reading questions.',
  },
  {
    id: 'Advanced',
    label: 'Advanced',
    sourceLevels: ['C1', 'C2'],
    description: 'Nuanced grammar control, precise vocabulary, complex sentence choice, and advanced reading inference.',
  },
] as const;
type TestLevelId = (typeof TEST_LEVELS)[number]['id'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.use(authenticate);

const getMixedTestCompletedCounts = async (userId: string) => {
  const rows = await Session.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        skill: 'Mixed',
        moduleType: 'mixed-test',
        status: 'Completed',
      },
    },
    {
      $group: {
        _id: '$level',
        completedTests: { $sum: 1 },
        averageScore: { $avg: '$averageScore' },
        lastTestAt: { $max: '$updatedAt' },
        completedTestNumbers: { $addToSet: '$setNumber' },
      },
    },
  ]);

  return new Map(rows.map((row) => [row._id as string, row]));
};

const getMixedTestSessionsByLevel = async (userId: string) => {
  const rows = await Session.find({
    userId,
    skill: 'Mixed',
    moduleType: 'mixed-test',
    setNumber: { $gte: 1, $lte: MIXED_TESTS_PER_LEVEL },
  })
    .select('level setNumber status averageScore updatedAt')
    .lean();

  const lookup = new Map<string, Map<number, { sessionId: string; status: string; averageScore: number; updatedAt?: Date }>>();
  for (const row of rows) {
    if (!row.level || typeof row.setNumber !== 'number') continue;
    const levelMap = lookup.get(row.level) ?? new Map<number, { sessionId: string; status: string; averageScore: number; updatedAt?: Date }>();
    levelMap.set(row.setNumber, {
      sessionId: String(row._id),
      status: row.status,
      averageScore: row.averageScore ?? 0,
      updatedAt: (row as { updatedAt?: Date }).updatedAt,
    });
    lookup.set(row.level, levelMap);
  }

  return lookup;
};

const buildMixedTestBreakdown = async (sessionId: string) => {
  const populated = await Session.findById(sessionId).populate('questions.questionId');
  if (!populated) return [];

  return TEST_SECTION_STRUCTURE.map((section) => {
    const sectionQuestions = populated.questions.filter((item) => {
      const question = item.questionId as unknown as { moduleType?: string };
      return question?.moduleType === section.id;
    });
    const scored = sectionQuestions.filter((item) => typeof item.score === 'number');
    const skipped = scored.filter((item) => !item.userAnswer);
    const answered = scored.filter((item) => item.userAnswer);
    const correct = answered.filter((item) => item.isCorrect);
    const totalScore = scored.reduce((sum, item) => sum + (item.score ?? 0), 0);

    return {
      skill: section.label,
      total: sectionQuestions.length,
      answered: answered.length,
      correct: correct.length,
      wrong: answered.length - correct.length,
      skipped: skipped.length,
      averageScore: sectionQuestions.length ? totalScore / sectionQuestions.length : 0,
    };
  });
};

const queueMixedTestReport = async (sessionId: string, userId: string) => {
  const [session, user] = await Promise.all([
    Session.findById(sessionId),
    User.findById(userId).select('name email'),
  ]);
  if (!session || !user?.email || session.reportEmailedAt) return;

  const breakdown = session.testBreakdown?.length ? session.testBreakdown : await buildMixedTestBreakdown(sessionId);
  const answered = session.questions.filter((question) => typeof question.score === 'number' && question.userAnswer).length;
  const email = mixedTestReportEmail({
    name: user.name || 'Learner',
    level: session.level,
    testLabel: session.testLabel || `${session.level} Mixed Test`,
    averageScore: session.averageScore,
    answered,
    totalQuestions: session.setSize || session.questions.length,
    breakdown,
  });

  await queueEmail({
    to: user.email,
    subject: email.subject,
    html: email.html,
  });
  session.reportEmailedAt = new Date();
  await session.save();
};

router.get(
  '/tests/journey',
  asyncHandler(async (req, res) => {
    const userId = req.userId as string;
    const [completedCounts, testSessionsByLevel, questionCounts] = await Promise.all([
      getMixedTestCompletedCounts(userId),
      getMixedTestSessionsByLevel(userId),
      Question.aggregate([
        { $match: { status: 'Active', moduleType: { $in: TEST_SECTION_IDS } } },
        { $group: { _id: { level: '$level', moduleType: '$moduleType' }, total: { $sum: 1 } } },
      ]),
    ]);

    const countLookup = new Map(questionCounts.map((row) => [`${row._id.level}:${row._id.moduleType}`, row.total as number]));
    const levels = TEST_LEVELS.map((levelMeta, idx) => {
      const completed = completedCounts.get(levelMeta.id);
      const previousLevelsComplete = TEST_LEVELS.slice(0, idx).every(
        (previousLevel) => (completedCounts.get(previousLevel.id)?.completedTests ?? 0) > 0,
      );
      const sectionAvailability = Object.fromEntries(
        TEST_SECTION_STRUCTURE.map((section) => [
          section.id,
          levelMeta.sourceLevels.reduce((sum, sourceLevel) => sum + (countLookup.get(`${sourceLevel}:${section.id}`) ?? 0), 0),
        ]),
      );
      const maxUniqueTests = Math.min(
        ...TEST_SECTION_STRUCTURE.map((section) => Math.floor((sectionAvailability[section.id] ?? 0) / section.questionCount)),
      );
      const levelSessions = testSessionsByLevel.get(levelMeta.id) ?? new Map();
      const tests = Array.from({ length: MIXED_TESTS_PER_LEVEL }, (_, testIdx) => {
        const testNumber = testIdx + 1;
        const session = levelSessions.get(testNumber);
        const previousTest = testNumber === 1 ? null : levelSessions.get(testNumber - 1);
        const unlocked = previousLevelsComplete && (testNumber === 1 || previousTest?.status === 'Completed' || Boolean(session));

        return {
          testNumber,
          questionCount: MIXED_TEST_SIZE,
          minQuestions: MIXED_TEST_SIZE,
          maxQuestions: MIXED_TEST_SIZE,
          questionRange: {
            min: (testNumber - 1) * MIXED_TEST_SIZE + 1,
            max: testNumber * MIXED_TEST_SIZE,
          },
          sessionId: session?.sessionId ?? null,
          status: session?.status ?? 'Locked',
          averageScore: session?.averageScore ?? 0,
          updatedAt: session?.updatedAt ?? null,
          locked: !unlocked || testNumber > maxUniqueTests,
        };
      });
      const nextTestNumber = tests.find((test) => !test.locked && test.status !== 'Completed')?.testNumber ?? MIXED_TESTS_PER_LEVEL;

      return {
        ...levelMeta,
        order: idx + 1,
        locked: !previousLevelsComplete,
        completedTests: completed?.completedTests ?? 0,
        averageScore: completed?.averageScore ?? 0,
        lastTestAt: completed?.lastTestAt ?? null,
        questionCount: MIXED_TEST_SIZE,
        minQuestions: MIXED_TEST_MIN_QUESTIONS,
        maxQuestions: MIXED_TEST_MAX_QUESTIONS,
        totalTests: MIXED_TESTS_PER_LEVEL,
        nextTestNumber,
        maxUniqueTests,
        sectionAvailability,
        tests,
      };
    });

    const activeLevel = levels.find((level) => !level.locked && level.completedTests === 0) ?? levels.find((level) => !level.locked) ?? levels[0];

    res.json({
      skills: ['Grammar', 'Vocabulary', 'Reading'],
      questionCount: MIXED_TEST_SIZE,
      minQuestions: MIXED_TEST_MIN_QUESTIONS,
      maxQuestions: MIXED_TEST_MAX_QUESTIONS,
      testStructure: TEST_SECTION_STRUCTURE,
      testsPerLevel: MIXED_TESTS_PER_LEVEL,
      levels,
      activeLevel: activeLevel.id,
    });
  }),
);

router.post(
  '/tests',
  validate(mixedTestCreateSchema),
  asyncHandler(async (req, res) => {
    const userId = req.userId as string;
    const level = req.body.level as TestLevelId;
    const testNumber = (req.body.testNumber as number | undefined) ?? 1;
    const levelIndex = TEST_LEVELS.findIndex((item) => item.id === level);
    const levelMeta = TEST_LEVELS[levelIndex];
    if (!levelMeta) {
      throw new AppError('Invalid test level', 400, 'TEST_LEVEL_INVALID');
    }
    const completedCounts = await getMixedTestCompletedCounts(userId);
    const previousLevelsComplete = TEST_LEVELS.slice(0, levelIndex).every(
      (previousLevel) => (completedCounts.get(previousLevel.id)?.completedTests ?? 0) > 0,
    );

    if (!previousLevelsComplete) {
      throw new AppError('Complete the earlier level test before starting this one', 403, 'TEST_LEVEL_LOCKED');
    }

    const existingSession = await Session.findOne({
      userId,
      skill: 'Mixed',
      level,
      moduleType: 'mixed-test',
      setNumber: testNumber,
    }).populate('questions.questionId');

    if (existingSession?.status === 'Completed') {
      throw new AppError('This test is already completed. Choose the next unlocked test.', 409, 'TEST_ALREADY_COMPLETED');
    }

    if (existingSession) {
      const existingQuestions = existingSession.questions
        .map((item) => item.questionId)
        .filter(Boolean);
      res.status(200).json({ session: existingSession, questions: existingQuestions });
      return;
    }

    const previousTestComplete =
      testNumber === 1 ||
      Boolean(
        await Session.exists({
          userId,
          skill: 'Mixed',
          level,
          moduleType: 'mixed-test',
          setNumber: testNumber - 1,
          status: 'Completed',
        }),
      );
    if (!previousTestComplete) {
      throw new AppError('Complete the previous test before starting this one', 403, 'TEST_LOCKED');
    }

    const startOrder = (testNumber - 1) * MIXED_TEST_SIZE + 1;
    const endOrder = testNumber * MIXED_TEST_SIZE;
    const sectionGroups = await Promise.all(
      TEST_SECTION_STRUCTURE.map(async (section) => {
        const questions = await Question.find({
          skill: section.skill,
          level: { $in: levelMeta.sourceLevels },
          status: 'Active',
          moduleType: section.id,
        })
          .sort({ levelOrder: 1, journeyOrder: 1, createdAt: 1 })
          .skip((testNumber - 1) * section.questionCount)
          .limit(section.questionCount);

        return { section, questions };
      }),
    );

    const shortage = sectionGroups.find((group) => group.questions.length < group.section.questionCount);
    if (shortage) {
      throw new AppError(
        `Not enough seeded ${shortage.section.label} questions are available for ${level} Test ${testNumber}. Run the practice seed script before starting this test.`,
        409,
        'FRESH_TEST_POOL_EMPTY',
      );
    }

    const questions = sectionGroups.flatMap((group) => group.questions);

    const session = await Session.create({
      userId,
      skill: 'Mixed',
      level,
      testLabel: `${levelMeta.label} English Readiness Test ${testNumber}`,
      testSequence: testNumber,
      moduleType: 'mixed-test',
      moduleLabel: 'Grammar + Vocabulary + Reading',
      setNumber: testNumber,
      setSize: MIXED_TEST_SIZE,
      startOrder,
      endOrder,
      questions: questions.map((question) => ({ questionId: question._id })),
    });

    res.status(201).json({ session, questions });
  }),
);

router.post(
  '/',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const requestedSkill = req.body.skill as (typeof SKILLS)[number];
    const modules = MODULE_CATALOG[requestedSkill];
    const completedSessions = await Session.find({
      userId: req.userId,
      skill: requestedSkill,
      level: req.body.level,
      status: 'Completed',
      setNumber: { $gte: 1, $lte: TOTAL_SETS_PER_SKILL_LEVEL },
    })
      .select('moduleOrder moduleSetNumber setNumber')
      .lean();

    const completedByModule = new Map<number, Set<number>>();
    for (const completed of completedSessions) {
      const completedGlobalSet = completed.setNumber;
      const completedModuleOrder =
        completed.moduleOrder ?? (completedGlobalSet ? Math.ceil(completedGlobalSet / TOTAL_SETS_PER_MODULE) : undefined);
      const completedModuleSetNumber =
        completed.moduleSetNumber ??
        (completedGlobalSet ? ((completedGlobalSet - 1) % TOTAL_SETS_PER_MODULE) + 1 : undefined);
      if (!completedModuleOrder || !completedModuleSetNumber) continue;
      const sets = completedByModule.get(completedModuleOrder) ?? new Set<number>();
      sets.add(completedModuleSetNumber);
      completedByModule.set(completedModuleOrder, sets);
    }

    const nextUnlockedModule =
      Array.from({ length: MODULES_PER_SKILL_LEVEL }, (_, idx) => idx + 1).find(
        (moduleOrder) => (completedByModule.get(moduleOrder)?.size ?? 0) < TOTAL_SETS_PER_MODULE,
      ) ?? MODULES_PER_SKILL_LEVEL;
    const moduleOrder = req.body.moduleOrder ?? (req.body.setNumber ? Math.ceil(req.body.setNumber / TOTAL_SETS_PER_MODULE) : nextUnlockedModule);
    const moduleCompletedSets = completedByModule.get(moduleOrder) ?? new Set<number>();
    const nextModuleSetNumber =
      Array.from({ length: TOTAL_SETS_PER_MODULE }, (_, idx) => idx + 1).find(
        (moduleSetNumber) => !moduleCompletedSets.has(moduleSetNumber),
      ) ?? TOTAL_SETS_PER_MODULE;
    const moduleSetNumber =
      req.body.moduleSetNumber ?? (req.body.setNumber ? ((req.body.setNumber - 1) % TOTAL_SETS_PER_MODULE) + 1 : nextModuleSetNumber);

    const priorModulesComplete = Array.from({ length: Math.max(moduleOrder - 1, 0) }, (_, idx) => idx + 1).every(
      (priorModuleOrder) => (completedByModule.get(priorModuleOrder)?.size ?? 0) >= TOTAL_SETS_PER_MODULE,
    );
    if (!priorModulesComplete) {
      throw new AppError('Complete earlier modules before starting this module', 403, 'MODULE_LOCKED');
    }

    const setNumber = (moduleOrder - 1) * TOTAL_SETS_PER_MODULE + moduleSetNumber;
    const startOrder = (setNumber - 1) * SET_SIZE + 1;
    const endOrder = setNumber * SET_SIZE;
    const module = modules[moduleOrder - 1];

    const questions = await Question.find({
      skill: requestedSkill,
      level: req.body.level,
      status: 'Active',
      moduleOrder,
      journeyOrder: { $gte: startOrder, $lte: endOrder },
    })
      .sort({ journeyOrder: 1, createdAt: 1 })
      .limit(SET_SIZE);

    if (questions.length === 0) {
      throw new AppError('No questions found for this set', 404, 'QUESTION_SET_EMPTY');
    }

    const session = await Session.create({
      userId: req.userId,
      skill: requestedSkill,
      level: req.body.level,
      moduleType: module.id,
      moduleLabel: module.label,
      moduleOrder,
      moduleSetNumber,
      setNumber,
      setSize: SET_SIZE,
      startOrder,
      endOrder,
      questions: questions.map((question) => ({ questionId: question._id })),
    });
    res.status(201).json({ session, questions });
  }),
);

router.get(
  '/journey',
  asyncHandler(async (req, res) => {
    const [questionCounts, completedSessions] = await Promise.all([
      Question.aggregate([
        { $match: { status: 'Active', seedKey: /^journey:/ } },
        {
          $group: {
            _id: { skill: '$skill', level: '$level', moduleOrder: '$moduleOrder', moduleType: '$moduleType', moduleLabel: '$moduleLabel' },
            totalQuestions: { $sum: 1 },
          },
        },
      ]),
      Session.find({
        userId: req.userId,
        status: 'Completed',
        setNumber: { $gte: 1, $lte: TOTAL_SETS_PER_SKILL_LEVEL },
      })
        .select('skill level setNumber moduleOrder moduleSetNumber moduleType moduleLabel averageScore updatedAt')
        .sort({ updatedAt: -1 })
        .lean(),
    ]);

    const countLookup = new Map(
      questionCounts.map((row) => [`${row._id.skill}:${row._id.level}:${row._id.moduleOrder}`, row.totalQuestions as number]),
    );
    const completedLookup = new Map<string, Array<{ setNumber: number; averageScore: number; completedAt?: Date }>>();

    for (const session of completedSessions) {
      if (typeof session.setNumber !== 'number') continue;
      const moduleOrder = session.moduleOrder ?? Math.ceil(session.setNumber / TOTAL_SETS_PER_MODULE);
      const moduleSetNumber = session.moduleSetNumber ?? ((session.setNumber - 1) % TOTAL_SETS_PER_MODULE) + 1;
      const key = `${session.skill}:${session.level}:${moduleOrder}`;
      const existing = completedLookup.get(key) ?? [];
      if (!existing.some((item) => item.setNumber === moduleSetNumber)) {
        existing.push({
          setNumber: moduleSetNumber,
          averageScore: session.averageScore ?? 0,
          completedAt: (session as { updatedAt?: Date }).updatedAt,
        });
      }
      completedLookup.set(key, existing);
    }

    const progress = Object.fromEntries(
      SKILLS.map((skill) => [
        skill,
        Object.fromEntries(
          LEVELS.map((level) => {
            let completedCount = 0;
            let unlockedModuleOrder = MODULES_PER_SKILL_LEVEL;
            const modules = MODULE_CATALOG[skill].map((module, idx) => {
              const moduleOrder = idx + 1;
              const totalQuestions = countLookup.get(`${skill}:${level}:${moduleOrder}`) ?? 0;
              const totalSets = Math.ceil(totalQuestions / SET_SIZE);
              const completedSets = (completedLookup.get(`${skill}:${level}:${moduleOrder}`) ?? []).sort(
                (a, b) => a.setNumber - b.setNumber,
              );
              const previousModulesComplete = MODULE_CATALOG[skill]
                .slice(0, idx)
                .every((_, priorIdx) => (completedLookup.get(`${skill}:${level}:${priorIdx + 1}`)?.length ?? 0) >= TOTAL_SETS_PER_MODULE);
              if (previousModulesComplete && completedSets.length < totalSets) {
                unlockedModuleOrder = Math.min(unlockedModuleOrder, moduleOrder);
              }
              completedCount += completedSets.length;

              return {
                ...module,
                moduleOrder,
                totalQuestions,
                totalSets,
                setSize: SET_SIZE,
                completedSets,
                completedCount: completedSets.length,
                nextSetNumber:
                  Array.from({ length: totalSets || TOTAL_SETS_PER_MODULE }, (_, setIdx) => setIdx + 1).find(
                    (setNumber) => !completedSets.some((completedSet) => completedSet.setNumber === setNumber),
                  ) ?? totalSets,
                locked: !previousModulesComplete,
              };
            });
            const activeModule = modules.find((module) => !module.locked && module.completedCount < module.totalSets) ?? modules[modules.length - 1];
            const totalQuestions = modules.reduce((sum, module) => sum + module.totalQuestions, 0);
            const totalSets = modules.reduce((sum, module) => sum + module.totalSets, 0);

            return [
              level,
              {
                totalQuestions,
                totalSets,
                setSize: SET_SIZE,
                completedSets: modules.flatMap((module) =>
                  module.completedSets.map((completedSet) => ({
                    ...completedSet,
                    globalSetNumber: (module.moduleOrder - 1) * TOTAL_SETS_PER_MODULE + completedSet.setNumber,
                    moduleOrder: module.moduleOrder,
                  })),
                ),
                completedCount,
                nextSetNumber: (activeModule.moduleOrder - 1) * TOTAL_SETS_PER_MODULE + activeModule.nextSetNumber,
                nextModuleOrder: activeModule.moduleOrder,
                nextModuleSetNumber: activeModule.nextSetNumber,
                modules,
              },
            ];
          }),
        ),
      ]),
    );

    res.json({
      skills: SKILLS,
      levels: LEVELS,
      setSize: SET_SIZE,
      questionsPerSkillLevel: QUESTIONS_PER_SKILL_LEVEL,
      totalSetsPerSkillLevel: TOTAL_SETS_PER_SKILL_LEVEL,
      totalModulesPerSkillLevel: MODULES_PER_SKILL_LEVEL,
      totalSetsPerModule: TOTAL_SETS_PER_MODULE,
      moduleCatalog: MODULE_CATALOG,
      progress,
    });
  }),
);

router.get(
  '/user-sessions',
  asyncHandler(async (req, res) => {
    const sessions = await Session.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(sessions);
  }),
);

router.get(
  '/in-progress',
  asyncHandler(async (req, res) => {
    const sessions = await Session.find({
      userId: req.userId,
      status: 'In Progress',
      skill: { $ne: 'Mixed' },
    })
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean();

    const populated = await Promise.all(
      sessions.map(async (s) => {
        const questionIds = s.questions.map((q: any) => q.questionId);
        const questionDocs = await Question.find({ _id: { $in: questionIds } })
          .select('_id stem type options correctAnswer passageText audioPrompt moduleLabel explanation orderInSet')
          .lean();
        const qMap = new Map(questionDocs.map((q: any) => [String(q._id), q]));
        const mergedQuestions = questionDocs;
        const answeredCount = s.questions.filter((q: any) => q.userAnswer).length;
        return { session: s, questions: mergedQuestions, answeredCount };
      }),
    );

    res.json(populated);
  }),
);

router.get(
  '/speaking/image-description/images',
  validate(imageDescriptionCatalogSchema),
  asyncHandler(async (req, res) => {
    const level = req.query.level as ImageDescriptionLevel;
    res.json({
      level,
      prepSeconds: 30,
      speakingSeconds: 60,
      images: getImageDescriptionItems(level).map(publicImageDescriptionItem),
    });
  }),
);

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

const normalizeWord = (word: string) => word.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim();

const keywordMatchesFor = (transcript: string, keywords: string[]) => {
  const normalizedTranscript = ` ${normalizeWord(transcript).replace(/\s+/g, ' ')} `;
  return keywords.filter((keyword) => {
    const normalizedKeyword = normalizeWord(keyword);
    if (!normalizedKeyword) return false;
    return normalizedTranscript.includes(` ${normalizedKeyword} `);
  });
};

const wordTargetForLevel = (level: ImageDescriptionLevel) => {
  if (level === 'A1') return 35;
  if (level === 'A2') return 50;
  return 80;
};

router.post(
  '/speaking/image-description/check',
  upload.single('audio'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError('Audio file is required', 400, 'AUDIO_REQUIRED');
    }

    const level = String(req.body.level || 'A1') as ImageDescriptionLevel;
    if (!LEVELS.includes(level)) {
      throw new AppError('Valid CEFR level is required', 400, 'LEVEL_REQUIRED');
    }

    const imageId = String(req.body.imageId || '');
    const item = getImageDescriptionItem(imageId, level);
    if (!item) {
      throw new AppError('Image description task not found', 404, 'IMAGE_TASK_NOT_FOUND');
    }

    const durationSeconds = Math.max(1, Number(req.body.durationSeconds || 60));
    const transcription = await transcribeAudioWithSarvam(req.file);
    const transcript = transcription.text || '';
    const wordCount = countWords(transcript);
    const fluencyWpm = Math.round((wordCount / durationSeconds) * 60);
    const matchedKeywords = keywordMatchesFor(transcript, item.keywords);
    const missingSuggestions = item.suggestions.filter(
      (suggestion) => !keywordMatchesFor(transcript, [suggestion]).length,
    );
    const vocabularySuggestions = Array.from(new Set([...missingSuggestions, ...item.suggestions])).slice(0, 3);
    const targetWordCount = wordTargetForLevel(level);
    const keywordScore = Math.round((matchedKeywords.length / Math.max(1, item.keywords.length)) * 100);
    const wordScore = Math.min(100, Math.round((wordCount / targetWordCount) * 100));
    const fluencyScore = Math.min(100, Math.round((fluencyWpm / 100) * 100));

    res.json({
      imageId: item.id,
      level,
      transcript,
      transcriptionModel: transcription.model,
      wordCount,
      targetWordCount,
      fluencyWpm,
      fluencyScore,
      matchedKeywords,
      keywordScore,
      vocabularySuggestions,
      feedback: [
        wordCount >= targetWordCount
          ? `Good length: you reached the ${targetWordCount}-word target.`
          : `Try to add more detail. Target at least ${targetWordCount} words for this level.`,
        matchedKeywords.length >= 4
          ? 'You used several image-related words.'
          : 'Use more concrete nouns, actions, and location words from the image.',
        fluencyWpm >= 80
          ? 'Your speaking pace is fluent.'
          : 'Try speaking in fuller connected sentences.',
      ],
      scores: {
        wordScore,
        keywordScore,
        fluencyScore,
        overall: Math.round(wordScore * 0.35 + keywordScore * 0.35 + fluencyScore * 0.3),
      },
    });
  }),
);

router.post(
  '/speaking/check',
  upload.single('audio'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError('Audio file is required', 400, 'AUDIO_REQUIRED');
    }

    const question = String(req.body.question || '');
    const expectedAnswer = String(req.body.expectedAnswer || '');
    if (!question) {
      throw new AppError('Question text is required', 400, 'QUESTION_REQUIRED');
    }

    const transcription = await transcribeAudio(req.file);
    const evaluation = await evaluateAnswer(
      `${question}\nExpected answer signal: ${expectedAnswer}`,
      transcription.text,
    );

    res.json({
      transcript: transcription.text,
      transcriptionModel: transcription.model,
      evaluation,
    });
  }),
);

router.post(
  '/writing/check',
  asyncHandler(async (req, res) => {
    const prompt = String(req.body.prompt || '');
    const level = String(req.body.level || 'B1');
    const criteria = String(req.body.criteria || 'grammar, vocabulary, coherence, task achievement');
    const userText = String(req.body.userText || '');

    if (!prompt) throw new AppError('Prompt is required', 400, 'PROMPT_REQUIRED');
    if (!userText || userText.trim().split(/\s+/).length < 3) {
      throw new AppError('Please write at least a few words before submitting.', 400, 'RESPONSE_TOO_SHORT');
    }

    const wordCount = countWords(userText);
    const targetWordsByLevel: Record<string, number> = { A1: 20, A2: 40, B1: 80, B2: 120, C1: 160, C2: 200 };
    const targetWords = targetWordsByLevel[level] ?? 80;
    const sentenceCount = userText.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean).length;
    const hasCapitalStart = /^[A-Z]/.test(userText.trim());
    const hasEndingPunctuation = /[.!?]$/.test(userText.trim());
    const lengthScore = Math.min(100, Math.round((wordCount / targetWords) * 100));
    const mechanicsScore = Math.round(((hasCapitalStart ? 1 : 0) + (hasEndingPunctuation ? 1 : 0) + Math.min(sentenceCount, 3)) / 5 * 100);
    const score = Math.round(lengthScore * 0.45 + mechanicsScore * 0.35 + 20);
    const evaluation = {
      score: Math.min(100, score),
      grammarScore: mechanicsScore,
      vocabularyScore: Math.min(100, Math.round((new Set(userText.toLowerCase().match(/[a-z]+/g) || []).size / Math.max(1, wordCount)) * 120)),
      coherenceScore: sentenceCount > 1 ? Math.min(100, 55 + sentenceCount * 10) : 45,
      taskAchievementScore: lengthScore,
      feedback: 'Your response was checked for basic length, capitalization, punctuation, and sentence structure.',
      strengths: [
        wordCount >= Math.min(targetWords, 40) ? 'The response has enough length for a basic local check.' : 'The response is concise.',
        hasCapitalStart && hasEndingPunctuation ? 'Basic capitalization and punctuation are present.' : 'The response was submitted successfully.',
      ],
      improvements: [
        `Review sentence-correction practice to strengthen grammar accuracy.`,
        wordCount < targetWords ? `Add more detail when a free response is required. Target: ${targetWords} words.` : `Keep sentences clear and connected.`,
      ],
      criteria,
    };
    res.json({ evaluation });
  }),
);

router.get(
  '/:id',
  validate(idSchema),
  asyncHandler(async (req, res) => {
    const session = await Session.findOne({ _id: req.params.id, userId: req.userId }).populate('questions.questionId');
    if (!session) {
      throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
    }
    res.json(session);
  }),
);

router.post(
  '/answer',
  validate(answerSchema),
  asyncHandler(async (req, res) => {
    const session = await Session.findOne({ _id: req.body.sessionId, userId: req.userId });
    if (!session) {
      throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
    }
    const existingQuestion = session.questions.find(
      (question) => req.body.questionId && question.questionId?.toString() === req.body.questionId,
    );
    if (existingQuestion) {
      existingQuestion.userAnswer = req.body.answer;
      existingQuestion.isCorrect = req.body.isCorrect;
      existingQuestion.score = req.body.score ?? 0;
    } else {
      session.questions.push({
        questionId: req.body.questionId,
        userAnswer: req.body.answer,
        isCorrect: req.body.isCorrect,
        score: req.body.score ?? 0,
      });
    }
    await session.save();
    res.json(session);
  }),
);

router.post(
  '/submit',
  validate(submitSchema),
  asyncHandler(async (req, res) => {
    const session = await Session.findOne({ _id: req.body.sessionId, userId: req.userId });
    if (!session) {
      throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
    }
    const expectedCount = session.setSize || session.questions.length;
    const totalScore = session.questions.reduce((sum, question) => sum + (question.score ?? 0), 0);
    session.totalScore = totalScore;
    session.averageScore = expectedCount ? totalScore / expectedCount : 0;
    session.durationSeconds = req.body.duration;
    session.skillBreakdown = req.body.skillBreakdown;
    if (session.skill === 'Mixed' && session.moduleType === 'mixed-test') {
      session.testBreakdown = await buildMixedTestBreakdown(session._id.toString());
    }
    session.status = 'Completed';
    await session.save();

    const userStats = await Session.aggregate([
      { $match: { userId: session.userId, status: 'Completed' } },
      { $group: { _id: null, totalSessions: { $sum: 1 }, averageScore: { $avg: '$averageScore' } } },
    ]);
    await User.findByIdAndUpdate(req.userId, {
      $set: {
        totalSessions: userStats[0]?.totalSessions ?? 0,
        averageScore: userStats[0]?.averageScore ?? 0,
      },
    });

    if (session.skill === 'Mixed' && session.moduleType === 'mixed-test') {
      await queueMixedTestReport(session._id.toString(), req.userId as string);
    }

    res.json(session);
  }),
);

export default router;
