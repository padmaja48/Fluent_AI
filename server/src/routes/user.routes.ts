import { Router } from 'express';
import { z } from 'zod';
import { getAllUsers, getUserAnalytics, getUserDashboard, updateProfile, updateProfileSchema } from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';

const idSchema = z.object({ params: z.object({ id: z.string().min(1) }) });

const router = Router();

router.use(authenticate);
router.get('/dashboard', getUserDashboard);
router.put('/profile', validate(updateProfileSchema), updateProfile);
router.get('/all', authorize('admin'), getAllUsers);
router.get('/:id/analytics', authorize('admin'), validate(idSchema), getUserAnalytics);

export default router;
