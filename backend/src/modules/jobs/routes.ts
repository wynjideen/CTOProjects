import type { Router } from 'express';

export function setupJobRoutes(router: Router): void {
  // GET /api/v1/jobs/:jobId
  router.get('/:jobId', (req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Get job status endpoint not yet implemented',
      },
    });
  });

  // POST /api/v1/jobs/:jobId/cancel
  router.post('/:jobId/cancel', (req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Cancel job endpoint not yet implemented',
      },
    });
  });

  // GET /api/v1/jobs
  router.get('/', (req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'List jobs endpoint not yet implemented',
      },
    });
  });
}
