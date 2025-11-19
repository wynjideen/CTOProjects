import type { Router } from 'express';

export function setupProgressTrackingRoutes(router: Router): void {
  // GET /api/v1/progress/:userId
  router.get('/:userId', (req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Get user progress endpoint not yet implemented',
      },
    });
  });

  // GET /api/v1/progress/:userId/courses/:courseId
  router.get('/:userId/courses/:courseId', (req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Get course progress endpoint not yet implemented',
      },
    });
  });

  // POST /api/v1/progress/:userId/courses/:courseId/checkpoint
  router.post('/:userId/courses/:courseId/checkpoint', (req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Record checkpoint endpoint not yet implemented',
      },
    });
  });
}
