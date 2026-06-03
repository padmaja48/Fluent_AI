import { Router } from 'express';
import {
  cancelSchedule,
  createSchedule,
  createScheduleSchema,
  listSchedules,
  reschedule,
  scheduleParamsSchema,
  updateScheduleSchema,
} from '../controllers/schedule.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authenticate);
router.post('/', validate(createScheduleSchema), createSchedule);
router.get('/', listSchedules);
router.put('/:id', validate(updateScheduleSchema), reschedule);
router.delete('/:id', validate(scheduleParamsSchema), cancelSchedule);

export default router;
