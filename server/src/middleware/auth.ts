import jwt, { JwtPayload } from 'jsonwebtoken';
import { RequestHandler } from 'express';
import { env } from '../config/env';
import { getRedis } from '../config/redis';
import { AppError } from '../utils/AppError';
import { UserRole } from '../models/User';

export const authenticate: RequestHandler = async (req, _res, next) => {
  const headerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined;
  const token = headerToken ?? req.cookies?.accessToken;

  if (!token) {
    return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;

    if (!decoded.sub || !decoded.jti) {
      throw new AppError('Invalid access token', 401, 'INVALID_TOKEN');
    }

    const session = await getRedis().hgetall(`session:${decoded.jti}`);
    if (!session.userId) {
      throw new AppError('Session expired', 401, 'SESSION_EXPIRED');
    }

    req.userId = decoded.sub;
    req.sessionId = decoded.jti;
    req.userRole = decoded.role as UserRole;
    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError('Invalid token', 401, 'INVALID_TOKEN'));
  }
};

export const authorize =
  (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return next(new AppError('Forbidden', 403, 'FORBIDDEN'));
    }

    next();
  };
