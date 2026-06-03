import { Router } from 'express';
import multer from 'multer';
import { getResume, getResumeHistory, resumeParamsSchema, uploadResume } from '../controllers/resume.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = Router();

router.use(authenticate);
router.post('/', upload.single('resume'), uploadResume);
router.get('/', getResumeHistory);
router.get('/:id', validate(resumeParamsSchema), getResume);

export default router;
