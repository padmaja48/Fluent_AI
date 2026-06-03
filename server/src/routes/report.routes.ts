import { Router } from 'express';
import { getReport, listReports, reportParamsSchema } from '../controllers/report.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authenticate);
router.get('/', listReports);
router.get('/:id', validate(reportParamsSchema), getReport);

export default router;
