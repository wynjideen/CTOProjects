import pino from 'pino';
import pinoHttp from 'pino-http';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response, NextFunction } from 'express';
import type { Config } from '../config/schema';

export function createLogger(config: Config): pino.Logger {
  return pino({
    level: config.logLevel,
    transport:
      config.nodeEnv === 'production'
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname'
            }
          }
  });
}

export function createHttpLogger(logger: pino.Logger) {
  return pinoHttp({
    logger,
    customLogLevel: (_req: Request, res: Response, error?: Error) => {
      if (error || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    genReqId: () => uuidv4()
  });
}

export function getRequestId(req: Request): string {
  return (req as Request & { id?: string }).id ?? uuidv4();
}
