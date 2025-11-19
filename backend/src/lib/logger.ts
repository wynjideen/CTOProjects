import pino from 'pino';
import pinoHttp from 'pino-http';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response, NextFunction } from 'express';
import type { Config } from '../config/schema';

let defaultLogger: pino.Logger;

export function createLogger(config: Config): pino.Logger {
  const logger = pino({
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
  
  // Store as default logger for use without request context
  defaultLogger = logger;
  return logger;
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

export function getRequestId(req?: Request): pino.Logger {
  if (req) {
    return (req as any).logger || defaultLogger || pino();
  }
  // Return default logger when no request context
  return defaultLogger || pino();
}

// Export a default logger instance for services that don't have request context
export function getDefaultLogger(): pino.Logger {
  return defaultLogger || pino();
}
