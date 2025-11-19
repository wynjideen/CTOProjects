import type { Express } from 'express';

export function setupHealthRoutes(app: Express): void {
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/ready', (req, res) => {
    // In production, this would check database and Redis connectivity
    res.status(200).json({
      status: 'ready',
      checks: {
        api: 'ok',
      },
      timestamp: new Date().toISOString(),
    });
  });
}
