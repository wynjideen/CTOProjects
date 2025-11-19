import type { Router } from 'express';

export function setupFileIngestionRoutes(router: Router): void {
  // POST /api/v1/files/upload
  router.post('/upload', (req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'File upload endpoint not yet implemented',
      },
    });
  });

  // GET /api/v1/files/:fileId
  router.get('/:fileId', (req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Get file endpoint not yet implemented',
      },
    });
  });

  // DELETE /api/v1/files/:fileId
  router.delete('/:fileId', (req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Delete file endpoint not yet implemented',
      },
    });
  });

  // POST /api/v1/files/batch-upload
  router.post('/batch-upload', (req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Batch upload endpoint not yet implemented',
      },
    });
  });
}
