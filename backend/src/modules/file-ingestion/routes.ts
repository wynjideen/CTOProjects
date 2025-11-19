import type { Router } from 'express';

export function setupFileIngestionRoutes(router: Router): void {
  router.post('/upload', (_req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'File upload endpoint not yet implemented'
      }
    });
  });

  router.get('/:fileId', (_req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Get file endpoint not yet implemented'
      }
    });
  });

  router.delete('/:fileId', (_req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Delete file endpoint not yet implemented'
      }
    });
  });

  router.post('/batch-upload', (_req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Batch upload endpoint not yet implemented'
      }
    });
  });
}
