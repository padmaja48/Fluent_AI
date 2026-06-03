import { z } from 'zod';
import { Report } from '../models/Report';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';

export const reportParamsSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const listReports = asyncHandler(async (req, res) => {
  const reports = await Report.find({ userId: req.userId }).sort({ createdAt: -1 });
  res.json(reports);
});

export const getReport = asyncHandler(async (req, res) => {
  const report = await Report.findOne({ _id: req.params.id, userId: req.userId });
  if (!report) {
    throw new AppError('Report not found', 404, 'REPORT_NOT_FOUND');
  }

  res.json(report);
});
