import { Router } from 'express';
import multer from 'multer';
import {
  answerSchema,
  completeInterview,
  createInterview,
  createInterviewSchema,
  getInterview,
  getInterviewState,
  getUserInterviews,
  interviewParamsSchema,
  logViolation,
  logViolationSchema,
  personaPreviewSchema,
  personaVoicePreview,
  speakSchema,
  startInterview,
  startInterviewSchema,
  submitAnswer,
  synthesizeQuestion,
  transcribeRecording,
  uploadRecording,
} from '../controllers/interview.controller';
import { Interview } from '../models/Interview';
import { Report } from '../models/Report';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

const router = Router();

router.use(authenticate);
router.post('/persona-preview', validate(personaPreviewSchema), personaVoicePreview);
router.post('/', validate(createInterviewSchema), createInterview);
router.get('/user-interviews', getUserInterviews);
router.post('/start', validate(startInterviewSchema), startInterview);
router.post('/answer', validate(answerSchema), submitAnswer);
router.post('/complete', completeInterview);
router.get('/:id', validate(interviewParamsSchema), getInterview);
router.post('/:id/start', startInterview);
router.post('/:id/answer', validate(answerSchema), submitAnswer);
router.post('/:id/complete', completeInterview);
router.get('/:id/state', validate(interviewParamsSchema), getInterviewState);
router.post('/:id/speak', validate(speakSchema), synthesizeQuestion);
router.post('/:id/transcribe', validate(interviewParamsSchema), upload.single('audio'), transcribeRecording);
router.post('/:id/recording', validate(interviewParamsSchema), upload.single('recording'), uploadRecording);
router.patch('/:id/violation', validate(logViolationSchema), logViolation);
router.get('/:id/report', asyncHandler(async (req, res) => {
  const interview = await Interview.findOne({ _id: req.params.id, userId: req.userId })
    .populate('userId', 'name email');
  if (!interview) throw new AppError('Not found', 404, 'NOT_FOUND');
  const report = await Report.findOne({ interviewId: interview._id });
  res.json({ interview, report });
}));

export default router;
