import { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export const notFoundHandler: RequestHandler = () => {
  throw new AppError('Route not found', 404, 'ROUTE_NOT_FOUND');
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.flatten(),
    });
  }

  if ((error as { code?: number }).code === 11000) {
    return res.status(409).json({
      error: 'Duplicate resource',
      code: 'DUPLICATE_RESOURCE',
    });
  }

  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const code = error instanceof AppError ? error.code : 'INTERNAL_SERVER_ERROR';

  if (statusCode >= 500) {
    logger.error({ error: error.message, stack: error.stack }, 'Request failed');
  }

  res.status(statusCode).json({
    error: error.message || 'Internal server error',
    code,
    ...(env.NODE_ENV !== 'production' && { stack: error.stack }),
  });
};
