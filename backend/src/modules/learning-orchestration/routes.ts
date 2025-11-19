import type { Router } from 'express';

export function setupLearningOrchestrationRoutes(router: Router): void {
  router.post('/', (_req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Create learning path endpoint not yet implemented'
      }
    });
  });

  router.get('/:pathId', (_req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Get learning path endpoint not yet implemented'
      }
    });
  });

  router.post('/:pathId/lessons', (_req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Generate lessons endpoint not yet implemented'
      }
    });
  });

  router.post('/:lessonId/complete', (_req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Complete lesson endpoint not yet implemented'
      }
    });
  });
}
