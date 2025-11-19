import express, { Express } from 'express';
import pino from 'pino';
import { createHttpLogger } from './lib/logger';
import { createErrorHandler } from './middleware/errorHandler';
import { setupHealthRoutes } from './routes/health';
import { setupAuthRoutes } from './modules/auth/routes';
import { setupFileIngestionRoutes } from './modules/file-ingestion/routes';
import { setupContentProcessingRoutes } from './modules/content-processing/routes';
import { setupLearningOrchestrationRoutes } from './modules/learning-orchestration/routes';
import { setupProgressTrackingRoutes } from './modules/progress-tracking/routes';
import { setupJobRoutes } from './modules/jobs/routes';

export function createApp(logger: pino.Logger): Express {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(createHttpLogger(logger));

  // Health check routes
  setupHealthRoutes(app);

  // API v1 routes
  const apiV1Router = express.Router();

  // Auth Module (no auth required for token endpoints)
  const authRouter = express.Router();
  setupAuthRoutes(authRouter, logger);
  apiV1Router.use('/auth', authRouter);

  // File Ingestion Module
  const filesRouter = express.Router();
  setupFileIngestionRoutes(filesRouter);
  apiV1Router.use('/files', filesRouter);

  // Content Processing Module
  const contentRouter = express.Router();
  setupContentProcessingRoutes(contentRouter);
  apiV1Router.use('/content', contentRouter);

  // Learning Orchestration Module
  const learningRouter = express.Router();
  setupLearningOrchestrationRoutes(learningRouter);
  apiV1Router.use('/learning-paths', learningRouter);

  // Progress Tracking Module
  const progressRouter = express.Router();
  setupProgressTrackingRoutes(progressRouter);
  apiV1Router.use('/progress', progressRouter);

  // Jobs Module
  const jobsRouter = express.Router();
  setupJobRoutes(jobsRouter);
  apiV1Router.use('/jobs', jobsRouter);

  // Mount API v1 routes
  app.use('/api/v1', apiV1Router);

  // OpenAPI stub
  app.get('/api/docs', (_req, res) => {
    res.json({
      openapi: '3.0.0',
      info: {
        title: 'CTOProjects Backend API',
        version: '1.0.0',
        description:
          'Adaptive Learning Platform API - See docs/backend/api-spec.md for full specification',
      },
      servers: [
        {
          url: '/api/v1',
          description: 'API v1',
        },
      ],
      paths: {
        '/files/upload': {
          post: {
            summary: 'Upload a single file',
            tags: ['File Ingestion'],
            description: 'See docs/backend/api-spec.md for full specification',
          },
        },
        '/content/search': {
          post: {
            summary: 'Search content by vector similarity',
            tags: ['Content Processing'],
            description: 'See docs/backend/api-spec.md for full specification',
          },
        },
        '/learning-paths': {
          post: {
            summary: 'Create a learning path',
            tags: ['Learning Orchestration'],
            description: 'See docs/backend/api-spec.md for full specification',
          },
        },
        '/progress/{userId}': {
          get: {
            summary: 'Get user progress',
            tags: ['Progress Tracking'],
            description: 'See docs/backend/api-spec.md for full specification',
          },
        },
        '/jobs/{jobId}': {
          get: {
            summary: 'Get job status',
            tags: ['Job Scheduler'],
            description: 'See docs/backend/api-spec.md for full specification',
          },
        },
      },
    });
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    });
  });

  // Error handling middleware
  app.use(createErrorHandler(logger));

  return app;
}
