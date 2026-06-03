import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { Test } from '../models/Test';
import { Question } from '../models/Question';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';

const idSchema = z.object({ params: z.object({ id: z.string().min(1) }) });

const testSchema = z.object({
  body: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
    durationMinutes: z.number().min(5).max(180).default(60),
    sections: z.array(
      z.object({
        skill: z.enum(['Listening', 'Speaking', 'Reading', 'Writing']),
        questionIds: z.array(z.string()),
        timeLimit: z.number().optional(),
      }),
    ).default([]),
    isActive: z.boolean().default(true),
  }),
});

const router = Router();

// List — admin sees all, students see active only
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const query: Record<string, unknown> = req.userRole === 'admin' ? {} : { isActive: true };
    if (req.query.level) query.level = req.query.level;
    const tests = await Test.find(query).sort({ createdAt: -1 });
    res.json(tests);
  }),
);

// Get single test
router.get(
  '/:id',
  authenticate,
  validate(idSchema),
  asyncHandler(async (req, res) => {
    const test = await Test.findById(req.params.id);
    if (!test) throw new AppError('Test not found', 404, 'TEST_NOT_FOUND');
    res.json(test);
  }),
);

// Get populated questions for a test
router.get(
  '/:id/questions',
  authenticate,
  validate(idSchema),
  asyncHandler(async (req, res) => {
    const test = await Test.findById(req.params.id);
    if (!test) throw new AppError('Test not found', 404, 'TEST_NOT_FOUND');

    const sections = await Promise.all(
      test.sections.map(async (section) => {
        const questions = await Question.find({ _id: { $in: section.questionIds } });
        return { skill: section.skill, timeLimit: section.timeLimit, questions };
      }),
    );
    res.json({ test, sections });
  }),
);

// Create — admin only
router.post(
  '/',
  authenticate,
  authorize('admin'),
  validate(testSchema),
  asyncHandler(async (req, res) => {
    const test = await Test.create({ ...req.body, createdBy: req.userId });
    res.status(201).json(test);
  }),
);

// Update — admin only
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  validate(idSchema.merge(testSchema.partial())),
  asyncHandler(async (req, res) => {
    const test = await Test.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!test) throw new AppError('Test not found', 404, 'TEST_NOT_FOUND');
    res.json(test);
  }),
);

// Delete — admin only
router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  validate(idSchema),
  asyncHandler(async (req, res) => {
    await Test.findByIdAndDelete(req.params.id);
    res.status(204).send();
  }),
);

export default router;
