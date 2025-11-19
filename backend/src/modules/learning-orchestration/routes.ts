import type { Router } from 'express';

export function setupLearningOrchestrationRoutes(router: Router): void {
  // POST /api/v1/learning-paths
  router.post('/', (req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Create learning path endpoint not yet implemented',
      },
    });
  });

  // GET /api/v1/learning-paths/:pathId
  router.get('/:pathId', (req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Get learning path endpoint not yet implemented',
      },
    });
  });

  // POST /api/v1/learning-paths/:pathId/lessons
  router.post('/:pathId/lessons', (req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Generate lessons endpoint not yet implemented',
      },
    });
  });

  // POST /api/v1/lessons/:lessonId/complete
  router.post('/:lessonId/complete', (req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Complete lesson endpoint not yet implemented',
      },
    });
  });
}
