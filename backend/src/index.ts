import { createServer } from 'http';
import { createApp } from './app';
import { createLogger } from './lib/logger';
import { getConfig } from './config/loader';

async function bootstrap() {
  const config = getConfig();
  const logger = createLogger(config);
  const app = createApp(logger);
  const server = createServer(app);

  server.listen(config.port, () => {
    logger.info({ port: config.port, env: config.nodeEnv }, 'Server listening');
  });

  const shutdown = (signal: NodeJS.Signals) => {
    logger.info({ signal }, 'Received shutdown signal');

    server.close((err) => {
      if (err) {
        logger.error({ err }, 'Error during graceful shutdown');
        process.exit(1);
      }

      logger.info('HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
    process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    logger.error({ error }, 'Uncaught exception');
    process.exit(1);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
