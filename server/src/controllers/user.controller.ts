import { z } from 'zod';
import mongoose from 'mongoose';
import { Interview } from '../models/Interview';
import { Report } from '../models/Report';
import { Resume } from '../models/Resume';
import { Schedule } from '../models/Schedule';
import { Session } from '../models/Session';
import { User } from '../models/User';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
  }),
});

export const getUserDashboard = asyncHandler(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.userId);
  const [user, interviews, reports, resumes, schedules, recentSessions, sessionSummary, skillSummary] = await Promise.all([
    User.findById(req.userId).select('-password'),
    Interview.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(5),
    Report.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(5),
    Resume.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(3),
    Schedule.find({ userId: req.userId, status: { $in: ['Scheduled', 'Rescheduled'] } })
      .sort({ scheduledFor: 1 })
      .limit(5),
    Session.find({ userId: req.userId, status: 'Completed' }).sort({ updatedAt: -1 }).limit(8).lean(),
    Session.aggregate([
      { $match: { userId, status: 'Completed' } },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          averageScore: { $avg: '$averageScore' },
          totalQuestions: { $sum: { $size: '$questions' } },
          totalDurationSeconds: { $sum: { $ifNull: ['$durationSeconds', 0] } },
          lastPracticedAt: { $max: '$updatedAt' },
        },
      },
    ]),
    Session.aggregate([
      { $match: { userId, status: 'Completed' } },
      {
        $group: {
          _id: '$skill',
          sessions: { $sum: 1 },
          averageScore: { $avg: '$averageScore' },
          completedSets: { $sum: 1 },
          questions: { $sum: { $size: '$questions' } },
          lastSessionAt: { $max: '$updatedAt' },
        },
      },
    ]),
  ]);

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  const summary = sessionSummary[0] ?? {
    totalSessions: 0,
    averageScore: 0,
    totalQuestions: 0,
    totalDurationSeconds: 0,
    lastPracticedAt: null,
  };
  const practiceDates = recentSessions
    .map((session) => new Date((session as { updatedAt?: Date }).updatedAt ?? new Date()).toISOString().slice(0, 10))
    .filter((date, idx, arr) => arr.indexOf(date) === idx);
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const day = cursor.toISOString().slice(0, 10);
    if (!practiceDates.includes(day)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const skillStats = Object.fromEntries(
    ['Listening', 'Speaking', 'Reading', 'Writing'].map((skill) => {
      const row = skillSummary.find((item) => item._id === skill);
      const latest = recentSessions.find((session) => session.skill === skill);
      return [
        skill,
        {
          sessions: row?.sessions ?? 0,
          completedSets: row?.completedSets ?? 0,
          questions: row?.questions ?? 0,
          averageScore: row?.averageScore ?? 0,
          currentLevel: latest?.level ?? user.level,
          moduleLabel: latest?.moduleLabel ?? 'Not started',
          moduleSetNumber: latest?.moduleSetNumber ?? 0,
          lastSessionAt: row?.lastSessionAt ?? null,
        },
      ];
    }),
  );

  const practiceActivity = recentSessions.map((session) => ({
    _id: session._id,
    type: 'practice',
    title: `${session.skill} ${session.level}`,
    subtitle: `${session.moduleLabel ?? 'Practice'} · Set ${session.moduleSetNumber ?? session.setNumber ?? 1} · ${session.questions?.length || 0} questions`,
    score: session.averageScore ?? 0,
    createdAt: (session as { updatedAt?: Date }).updatedAt,
    skill: session.skill,
    level: session.level,
  }));
  const interviewActivity = interviews.map((interview) => ({
    _id: interview._id,
    type: 'interview',
    title: interview.get('roleDomain') ? `${interview.get('roleDomain')} interview` : 'AI interview',
    subtitle: interview.get('status') ?? 'Interview',
    score: Object.values((interview.get('scores') ?? {}) as Record<string, number>).filter(Boolean)[0] ?? 0,
    createdAt: interview.get('updatedAt') ?? interview.get('createdAt'),
  }));
  const reportActivity = reports.map((report) => ({
    _id: report._id,
    type: 'report',
    title: report.get('title') ?? 'Performance report',
    subtitle: 'Report generated',
    score: report.get('overallScore') ?? 0,
    createdAt: report.get('updatedAt') ?? report.get('createdAt'),
  }));

  res.json({
    user,
    totals: {
      practiceSessions: summary.totalSessions,
      practiceQuestions: summary.totalQuestions,
      totalDurationSeconds: summary.totalDurationSeconds,
      interviews: await Interview.countDocuments({ userId: req.userId }),
      reports: await Report.countDocuments({ userId: req.userId }),
      resumes: await Resume.countDocuments({ userId: req.userId }),
    },
    practice: {
      totalSessions: summary.totalSessions,
      averageScore: summary.averageScore ?? 0,
      totalQuestions: summary.totalQuestions,
      totalDurationSeconds: summary.totalDurationSeconds,
      lastPracticedAt: summary.lastPracticedAt,
      streak,
      skillStats,
    },
    totalSessions: summary.totalSessions,
    averageScore: summary.averageScore ?? 0,
    recentActivity: [...practiceActivity, ...interviewActivity, ...reportActivity]
      .sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)))
      .slice(0, 10),
    interviews,
    reports,
    resumes,
    schedules,
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.userId, req.body, { new: true }).select('-password');
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  res.json(user);
});

export const getAllUsers = asyncHandler(async (_req, res) => {
  const users = await User.find().select('-password').sort({ createdAt: -1 });
  res.json(users);
});

export const getUserAnalytics = asyncHandler(async (req, res) => {
  const targetUserId = new mongoose.Types.ObjectId(req.params.id as string);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [user, skillTrend, recentSessions, interviewHistory] = await Promise.all([
    User.findById(targetUserId).select('-password'),
    Session.aggregate([
      { $match: { userId: targetUserId, status: 'Completed', updatedAt: { $gte: thirtyDaysAgo } } },
      { $sort: { updatedAt: 1 } },
      {
        $group: {
          _id: '$skill',
          scores: { $push: '$averageScore' },
          sessions: { $sum: 1 },
          avgScore: { $avg: '$averageScore' },
        },
      },
    ]),
    Session.find({ userId: targetUserId, status: 'Completed' })
      .sort({ updatedAt: -1 })
      .limit(30)
      .lean(),
    Interview.find({ userId: targetUserId }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);

  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

  res.json({ user, skillTrend, recentSessions, interviewHistory });
});
