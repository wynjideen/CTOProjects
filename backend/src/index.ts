import { createApp } from './app';
import { createLogger } from './lib/logger';
import { getConfig } from './config/loader';

async function main(): Promise<void> {
  const config = getConfig();
  const logger = createLogger(config);

  logger.info(`Starting server in ${config.nodeEnv} mode`);

  const app = createApp(logger);

  const server = app.listen(config.port, () => {
    logger.info(`Server listening on port ${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`Log level: ${config.logLevel}`);
  });

  const gracefulShutdown = (): void => {
    logger.info('Received shutdown signal, closing gracefully...');

    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  process.on('uncaughtException', (error) => {
    logger.error(error, 'Uncaught exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error(reason, 'Unhandled rejection');
    process.exit(1);
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
