import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { apiLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import questionRoutes from './routes/question.routes';
import sessionRoutes from './routes/session.routes';
import interviewRoutes from './routes/interview.routes';
import resumeRoutes from './routes/resume.routes';
import scheduleRoutes from './routes/schedule.routes';
import reportRoutes from './routes/report.routes';
import testRoutes from './routes/test.routes';

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (curl, Postman, server-to-server)
        if (!origin) {
          callback(null, true);
          return;
        }
        // In development, allow any localhost or 127.0.0.1 origin
        if (env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          callback(null, true);
          return;
        }
        if (env.CORS_ORIGINS.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`CORS origin not allowed: ${origin}`));
      },
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(cookieParser(env.COOKIE_SECRET));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  app.use(apiLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'fluentai',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/questions', questionRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/interviews', interviewRoutes);
  app.use('/api/resumes', resumeRoutes);
  app.use('/api/schedules', scheduleRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/tests', testRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/questions', questionRoutes);
  app.use('/api/v1/sessions', sessionRoutes);
  app.use('/api/v1/interviews', interviewRoutes);
  app.use('/api/v1/resumes', resumeRoutes);
  app.use('/api/v1/schedules', scheduleRoutes);
  app.use('/api/v1/reports', reportRoutes);
  app.use('/api/v1/tests', testRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
