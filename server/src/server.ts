import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { closeRedis } from './config/redis';
import { env } from './config/env';
import { startEmailWorker } from './services/email.service';
import { startReminderWorker } from './services/reminder.service';
import { logger } from './utils/logger';

const bootstrap = async () => {
  const app = createApp();
  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`Server running on http://0.0.0.0:${env.PORT}`);
  });

  const workers: Array<{ close: () => Promise<unknown> }> = [];
  let dependenciesStarted = false;

  const startDependencies = async () => {
    if (dependenciesStarted) return;

    try {
      await connectDatabase();
      if (env.NODE_ENV !== 'test') {
        workers.push(startEmailWorker(), startReminderWorker());
      }
      dependenciesStarted = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, 'Startup dependency failed; retrying');
      const retry = setTimeout(startDependencies, 10000);
      retry.unref?.();
    }
  };

  void startDependencies();

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
