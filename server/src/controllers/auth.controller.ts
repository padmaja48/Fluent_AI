import { OAuth2Client } from 'google-auth-library';
import { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { getRedis } from '../config/redis';
import { IUser, User } from '../models/User';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { createOtp } from '../utils/crypto';
import { createSessionTokens, revokeSession, rotateRefreshToken } from '../services/token.service';
import { passwordResetEmail, queueEmail, verificationEmail } from '../services/email.service';
import { durationToSeconds } from '../utils/duration';

const googleClient = env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_CALLBACK_URL)
  : null;

const getPublicAppUrl = (req: Request) => {
  if (env.CLIENT_URL && !env.CLIENT_URL.includes('localhost')) {
    return env.CLIENT_URL;
  }

  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || req.get('host');
  if (host) {
    return `${forwardedProto || req.protocol}://${host}`;
  }

  return env.CLIENT_URL;
};

const getGoogleCallbackUrl = (req: Request) =>
  new URL('/api/auth/google/callback', getPublicAppUrl(req)).toString();

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email().toLowerCase(),
    password: z.string().min(8),
    level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().min(3).max(254).toLowerCase(),
    password: z.string().min(1),
  }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    email: z.string().email().toLowerCase(),
    otp: z.string().length(6),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email().toLowerCase(),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email().toLowerCase(),
    otp: z.string().length(6),
    password: z.string().min(8),
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(),
  }),
});

export const googleSchema = z.object({
  body: z.object({
    credential: z.string().min(10),
  }),
});

const serializeUser = (user: IUser) => ({
  id: user._id,
  name: user.name,
  username: user.username,
  email: user.email,
  level: user.level,
  role: user.role,
  isEmailVerified: user.isEmailVerified,
  totalSessions: user.totalSessions,
  averageScore: user.averageScore,
  streak: user.streak,
  authProvider: user.authProvider,
  phone: user.phone,
  institution: user.institution,
  preferredLanguage: user.preferredLanguage,
  skills: user.skills,
  profileImageUrl: user.profileImageUrl,
});

const issueOtp = async (type: 'verify' | 'reset', email: string) => {
  const otp = createOtp();
  await getRedis().set(`otp:${type}:${email}`, otp, 'EX', 10 * 60);
  return otp;
};

const refreshCookieMaxAge = durationToSeconds(env.JWT_REFRESH_EXPIRES_IN, 7 * 24 * 60 * 60) * 1000;

const setRefreshCookie = (res: Response, refreshToken: string) => {
  res.cookie(env.REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    signed: true,
    maxAge: refreshCookieMaxAge,
    path: '/',
  });
};

const clearRefreshCookie = (res: Response) => {
  res.clearCookie(env.REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    signed: true,
    path: '/',
  });
};

const readRefreshToken = (req: { body?: { refreshToken?: string }; signedCookies?: Record<string, string>; cookies?: Record<string, string> }) =>
  req.body?.refreshToken ?? req.signedCookies?.[env.REFRESH_COOKIE_NAME] ?? req.cookies?.[env.REFRESH_COOKIE_NAME];

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, level } = req.body;
  const existing = await User.findOne({ email });

  if (existing) {
    throw new AppError('User already exists', 409, 'USER_EXISTS');
  }

  const user = await User.create({ name, email, password, level });
  const otp = await issueOtp('verify', email);
  await queueEmail({ to: email, ...verificationEmail(name, otp) });

  const tokens = await createSessionTokens(user, {
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });
  setRefreshCookie(res, tokens.refreshToken);

  res.status(201).json({
    message: 'User registered successfully. Verification code sent.',
    ...tokens,
    token: tokens.accessToken,
    user: serializeUser(user),
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const identifier = email.trim().toLowerCase();
  const user = await User.findOne(
    identifier.includes('@') ? { email: identifier } : { username: identifier },
  ).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  user.authMetadata.lastLoginAt = new Date();
  user.authMetadata.failedLoginAttempts = 0;
  await user.save();

  const tokens = await createSessionTokens(user, {
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });
  setRefreshCookie(res, tokens.refreshToken);

  res.json({
    message: 'Login successful',
    ...tokens,
    token: tokens.accessToken,
    user: serializeUser(user),
  });
});

export const googleLogin = asyncHandler(async (req, res) => {
  if (!googleClient || !env.GOOGLE_CLIENT_ID) {
    throw new AppError('Google OAuth is not configured', 503, 'GOOGLE_NOT_CONFIGURED');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: req.body.credential,
    audience: env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();

  if (!payload?.email) {
    throw new AppError('Google account email is required', 400, 'GOOGLE_EMAIL_REQUIRED');
  }

  const user = await User.findOneAndUpdate(
    { email: payload.email.toLowerCase() },
    {
      $setOnInsert: {
        name: payload.name ?? payload.email.split('@')[0],
        email: payload.email.toLowerCase(),
        authProvider: 'google',
        googleId: payload.sub,
      },
      $set: {
        isEmailVerified: payload.email_verified ?? true,
        profileImageUrl: payload.picture,
        'authMetadata.lastLoginAt': new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const tokens = await createSessionTokens(user, {
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });
  setRefreshCookie(res, tokens.refreshToken);

  res.json({
    message: 'Google login successful',
    ...tokens,
    token: tokens.accessToken,
    user: serializeUser(user),
  });
});

export const googleRedirect = asyncHandler(async (req, res) => {
  if (!googleClient || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new AppError('Google OAuth is not configured', 503, 'GOOGLE_NOT_CONFIGURED');
  }

  const url = googleClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    prompt: 'consent',
    redirect_uri: getGoogleCallbackUrl(req),
  });

  res.redirect(url);
});

export const googleCallback = asyncHandler(async (req, res) => {
  if (!googleClient || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new AppError('Google OAuth is not configured', 503, 'GOOGLE_NOT_CONFIGURED');
  }

  const code = typeof req.query.code === 'string' ? req.query.code : undefined;
  if (!code) {
    throw new AppError('Google OAuth code is required', 400, 'GOOGLE_CODE_REQUIRED');
  }

  const { tokens: googleTokens } = await googleClient.getToken({
    code,
    redirect_uri: getGoogleCallbackUrl(req),
  });
  if (!googleTokens.id_token) {
    throw new AppError('Google ID token was not returned', 400, 'GOOGLE_ID_TOKEN_REQUIRED');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: googleTokens.id_token,
    audience: env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();

  if (!payload?.email) {
    throw new AppError('Google account email is required', 400, 'GOOGLE_EMAIL_REQUIRED');
  }

  const user = await User.findOneAndUpdate(
    { email: payload.email.toLowerCase() },
    {
      $setOnInsert: {
        name: payload.name ?? payload.email.split('@')[0],
        email: payload.email.toLowerCase(),
        authProvider: 'google',
        googleId: payload.sub,
      },
      $set: {
        isEmailVerified: payload.email_verified ?? true,
        profileImageUrl: payload.picture,
        'authMetadata.lastLoginAt': new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const appTokens = await createSessionTokens(user, {
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });
  setRefreshCookie(res, appTokens.refreshToken);

  const callbackUrl = new URL('/auth/callback', getPublicAppUrl(req));
  callbackUrl.searchParams.set('accessToken', appTokens.accessToken);
  callbackUrl.searchParams.set('sessionId', appTokens.sessionId);
  res.redirect(callbackUrl.toString());
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const cachedOtp = await getRedis().get(`otp:verify:${email}`);

  if (cachedOtp !== otp) {
    throw new AppError('Invalid or expired verification code', 400, 'INVALID_OTP');
  }

  const user = await User.findOneAndUpdate({ email }, { isEmailVerified: true }, { new: true });
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  await getRedis().del(`otp:verify:${email}`);
  res.json({ message: 'Email verified', user: serializeUser(user) });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });

  if (user) {
    const otp = await issueOtp('reset', user.email);
    await queueEmail({ to: user.email, ...passwordResetEmail(user.name, otp) });
  }

  res.json({ message: 'If the account exists, a reset code was sent.' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, password } = req.body;
  const cachedOtp = await getRedis().get(`otp:reset:${email}`);

  if (cachedOtp !== otp) {
    throw new AppError('Invalid or expired reset code', 400, 'INVALID_OTP');
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  user.password = password;
  await user.save();
  await getRedis().del(`otp:reset:${email}`);
  res.json({ message: 'Password reset successful' });
});

export const refresh = asyncHandler(async (req, res) => {
  const refreshToken = readRefreshToken(req);
  if (!refreshToken) {
    throw new AppError('Refresh token required', 400, 'REFRESH_REQUIRED');
  }

  const tokens = await rotateRefreshToken(refreshToken, {
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });
  setRefreshCookie(res, tokens.refreshToken);

  res.json({
    message: 'Token refreshed',
    ...tokens,
    token: tokens.accessToken,
  });
});

export const logout = asyncHandler(async (req, res) => {
  if (req.sessionId) {
    await revokeSession(req.sessionId, readRefreshToken(req));
  }

  clearRefreshCookie(res);
  res.json({ message: 'Logged out' });
});

export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  res.json(serializeUser(user));
});
