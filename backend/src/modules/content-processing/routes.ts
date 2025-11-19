import type { Router } from 'express';

export function setupContentProcessingRoutes(router: Router): void {
  router.get('/:fileId', (_req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Get processed content endpoint not yet implemented'
      }
    });
  });

  router.post('/:fileId/chunks/:chunkId/embed', (_req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Embed chunk endpoint not yet implemented'
      }
    });
  });

  router.get('/:fileId/chunks/:chunkId', (_req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Get chunk endpoint not yet implemented'
      }
    });
  });

  router.post('/search', (_req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Content search endpoint not yet implemented'
      }
    });
  });
}
