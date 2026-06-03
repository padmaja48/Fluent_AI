import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

export const connectDatabase = async () => {
  await mongoose.connect(env.MONGODB_URI);
  logger.info('MongoDB connected');
};

export const disconnectDatabase = async () => {
  await mongoose.disconnect();
};
