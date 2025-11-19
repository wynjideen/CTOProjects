import type { Router } from 'express';

export function setupProgressTrackingRoutes(router: Router): void {
  router.get('/:userId', (_req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Get user progress endpoint not yet implemented'
      }
    });
  });

  router.get('/:userId/courses/:courseId', (_req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Get course progress endpoint not yet implemented'
      }
    });
  });

  router.post('/:userId/courses/:courseId/checkpoint', (_req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Record checkpoint endpoint not yet implemented'
      }
    });
  });
}
