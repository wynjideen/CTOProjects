import type { Express } from 'express';

export function setupHealthRoutes(app: Express): void {
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/ready', (_req, res) => {
    res.json({ status: 'ready' });
  });
}
