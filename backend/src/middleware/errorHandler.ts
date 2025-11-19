import type { NextFunction, Request, Response } from 'express';
import type { Logger } from 'pino';
import { AppError, ErrorResponse } from '../lib/errors';
import { getRequestId } from '../lib/logger';

export function createErrorHandler(logger: Logger) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (err: Error | AppError, req: Request, res: Response, _next: NextFunction): void => {
    const requestId = getRequestId(req);

    if (err instanceof AppError) {
      const payload: ErrorResponse = {
        error: {
          code: err.code,
          message: err.message,
          requestId,
          ...(err.details && { details: err.details })
        }
      };

      logger.warn(
        {
          requestId,
          path: req.path,
          method: req.method,
          statusCode: err.statusCode,
          code: err.code
        },
        'Handled application error'
      );

      res.status(err.statusCode).json(payload);
      return;
    }

    logger.error(
      {
        requestId,
        path: req.path,
        method: req.method,
        stack: err.stack
      },
      err.message
    );

    const payload: ErrorResponse = {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        requestId
      }
    };

    res.status(500).json(payload);
  };
}

export function createAsyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}
