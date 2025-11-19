import type { Router } from 'express';

export function setupJobRoutes(router: Router): void {
  router.get('/:jobId', (_req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Get job status endpoint not yet implemented'
      }
    });
  });

  router.post('/:jobId/cancel', (_req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Cancel job endpoint not yet implemented'
      }
    });
  });

  router.get('/', (_req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'List jobs endpoint not yet implemented'
      }
    });
  });
}
