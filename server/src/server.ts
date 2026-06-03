import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { closeRedis } from './config/redis';
import { env } from './config/env';
import { startEmailWorker } from './services/email.service';
import { startReminderWorker } from './services/reminder.service';
import { logger } from './utils/logger';

const bootstrap = async () => {
  await connectDatabase();

  const app = createApp();
  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`Server running on http://0.0.0.0:${env.PORT}`);
  });

  const workers = env.NODE_ENV === 'test' ? [] : [startEmailWorker(), startReminderWorker()];

  const shutdown = async () => {
    logger.info('Shutting down server');
    server.close();
    await Promise.all(workers.map((worker) => worker.close()));
    await closeRedis();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

bootstrap().catch((error) => {
  logger.error({ error: error.message, stack: error.stack }, 'Server failed to start');
  process.exit(1);
});
