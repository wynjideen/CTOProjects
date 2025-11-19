import pino from 'pino';
import pinoHttp from 'pino-http';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response, NextFunction } from 'express';
import type { Config } from '../config/schema';

export function createLogger(config: Config): pino.Logger {
  return pino({
    level: config.logLevel,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: config.nodeEnv !== 'production',
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  });
}

export function createHttpLogger(
  logger: pino.Logger
): (req: Request, res: Response, next: NextFunction) => void {
  return pinoHttp(
    {
      logger,
      customLogLevel: (req: Request, res: Response) => {
        if (res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      genReqId: () => uuidv4(),
    }
  );
}

export function getRequestId(req: Request): string {
  return (req.id as string) || uuidv4();
}
