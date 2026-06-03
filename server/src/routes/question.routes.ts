import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { Question } from '../models/Question';
import { uploadBuffer } from '../services/storage.service';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';

const idSchema = z.object({ params: z.object({ id: z.string().min(1) }) });
const questionSchema = z.object({
  body: z.object({
    stem: z.string().min(3),
    skill: z.enum(['Listening', 'Speaking', 'Reading', 'Writing']),
    level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
    type: z.enum(['MCQ', 'T-F-NG', 'Task', 'Essay']),
    options: z.array(z.object({ text: z.string(), isCorrect: z.boolean() })).default([]),
    correctAnswer: z.string().optional(),
    explanation: z.string().optional(),
    status: z.enum(['Draft', 'Active', 'Archived']).default('Active'),
  }),
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { skill, level, status, type, random } = req.query;
    const query: Record<string, unknown> = {};
    if (skill) query.skill = skill;
    if (level) query.level = level;
    if (status) query.status = status;
    if (type) query.type = type;

    if (random === 'true') {
      const sampleSize = Math.min(Number(req.query.limit) || 10, 50);
      const questions = await Question.aggregate([
        { $match: { ...query, status: query.status ?? 'Active' } },
        { $sample: { size: sampleSize } },
      ]);
      res.json(questions);
      return;
    }

    // Pagination support
    const page  = Math.max(1, parseInt(String(req.query.page  || '1')));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'))));
    const skip  = (page - 1) * limit;

    const [questions, total] = await Promise.all([
      Question.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .allowDiskUse(true),
      Question.countDocuments(query),
    ]);

    res.json({ questions, total, page, limit, pages: Math.ceil(total / limit) });
  }),
);

router.get(
  '/:id',
  validate(idSchema),
  asyncHandler(async (req, res) => {
    const question = await Question.findById(req.params.id);
    if (!question) {
      throw new AppError('Question not found', 404, 'QUESTION_NOT_FOUND');
    }
    res.json(question);
  }),
);

router.post(
  '/',
  authenticate,
  authorize('admin'),
  validate(questionSchema),
  asyncHandler(async (req, res) => {
    const question = await Question.create(req.body);
    res.status(201).json(question);
  }),
);

router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  validate(z.object({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      stem: z.string().min(3).optional(),
      skill: z.enum(['Listening', 'Speaking', 'Reading', 'Writing']).optional(),
      level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
      type: z.enum(['MCQ', 'T-F-NG', 'Task', 'Essay']).optional(),
      options: z.array(z.object({ text: z.string(), isCorrect: z.boolean() })).optional(),
      correctAnswer: z.string().optional(),
      explanation: z.string().optional(),
      audioUrl: z.string().optional(),
      audioPrompt: z.string().optional(),
      passageText: z.string().optional(),
      topic: z.string().optional(),
      competency: z.string().optional(),
      journeyOrder: z.number().optional(),
      moduleOrder: z.number().optional(),
      moduleQuestionOrder: z.number().optional(),
      status: z.enum(['Draft', 'Active', 'Archived']).optional(),
    }),
  })),
  asyncHandler(async (req, res) => {
    const question = await Question.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!question) {
      throw new AppError('Question not found', 404, 'QUESTION_NOT_FOUND');
    }
    res.json(question);
  }),
);

router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  validate(idSchema),
  asyncHandler(async (req, res) => {
    await Question.findByIdAndDelete(req.params.id);
    res.status(204).send();
  }),
);

// ── Audio file upload → Cloudinary ────────────────────────────────
router.post(
  '/upload-audio',
  authenticate,
  authorize('admin'),
  upload.single('audio'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError('No audio file provided', 400, 'NO_FILE');
    const stored = await uploadBuffer(req.file, 'recordings');
    res.json({ audioUrl: stored.url });
  }),
);

// ── Bulk JSON insert ──────────────────────────────────────────────
router.post(
  '/bulk',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const rows: unknown[] = Array.isArray(req.body.questions) ? req.body.questions : [];
    if (!rows.length) throw new AppError('No questions provided', 400, 'NO_QUESTIONS');

    const inserted: unknown[] = [];
    const errors: { index: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const q = await Question.create(rows[i]);
        inserted.push(q);
      } catch (err: unknown) {
        errors.push({ index: i, error: err instanceof Error ? err.message : String(err) });
      }
    }

    res.json({ inserted: inserted.length, errors });
  }),
);

export default router;
