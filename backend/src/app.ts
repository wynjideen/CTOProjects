import express, { type Express } from 'express';
import type pino from 'pino';
import { createHttpLogger } from './lib/logger';
import { createErrorHandler } from './middleware/errorHandler';
import { setupHealthRoutes } from './routes/health';
import { setupFileIngestionRoutes } from './modules/file-ingestion/routes';
import { setupContentProcessingRoutes } from './modules/content-processing/routes';
import { setupLearningOrchestrationRoutes } from './modules/learning-orchestration/routes';
import { setupProgressTrackingRoutes } from './modules/progress-tracking/routes';
import { setupJobRoutes } from './modules/jobs/routes';

export function createApp(logger: pino.Logger): Express {
  const app = express();

  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(createHttpLogger(logger));

  setupHealthRoutes(app);

  const apiRouter = express.Router();

  const filesRouter = express.Router();
  setupFileIngestionRoutes(filesRouter);
  apiRouter.use('/files', filesRouter);

  const contentRouter = express.Router();
  setupContentProcessingRoutes(contentRouter);
  apiRouter.use('/content', contentRouter);

  const learningRouter = express.Router();
  setupLearningOrchestrationRoutes(learningRouter);
  apiRouter.use('/learning-paths', learningRouter);

  const progressRouter = express.Router();
  setupProgressTrackingRoutes(progressRouter);
  apiRouter.use('/progress', progressRouter);

  const jobsRouter = express.Router();
  setupJobRoutes(jobsRouter);
  apiRouter.use('/jobs', jobsRouter);

  app.use('/api/v1', apiRouter);

  app.get('/api/docs', (_req, res) => {
    res.json({
      openapi: '3.0.0',
      info: {
        title: 'CTOProjects Backend API',
        version: '1.0.0',
        description: 'Adaptive learning platform API spec is documented in docs/backend/api-spec.md'
      },
      servers: [{ url: '/api/v1', description: 'Primary REST API' }]
    });
  });

  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found'
      }
    });
  });

  app.use(createErrorHandler(logger));

  return app;
}
