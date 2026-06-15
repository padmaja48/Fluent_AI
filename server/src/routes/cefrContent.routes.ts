import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { CefrContent } from '../models/CefrContent';
import { asyncHandler } from '../utils/asyncHandler';

const listSchema = z.object({
  query: z.object({
    level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
    skill: z.enum(['L', 'S', 'R', 'W']).optional(),
  }),
});

const router = Router();

router.use(authenticate);

router.get(
  '/',
  validate(listSchema),
  asyncHandler(async (req, res) => {
    const filter: Record<string, string> = {};
    if (req.query.level) filter.level = String(req.query.level);
    if (req.query.skill) filter.skill = String(req.query.skill);

    const content = await CefrContent.find(filter)
      .select('-__v')
      .sort({ level: 1, skill: 1, seedKey: 1 })
      .lean();

    res.json({ content });
  }),
);

export default router;
