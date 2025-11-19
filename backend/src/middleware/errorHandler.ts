import type { Request, Response, NextFunction } from 'express';
import pino from 'pino';
import { AppError, ErrorResponse } from '../lib/errors';
import { getRequestId } from '../lib/logger';

export function createErrorHandler(logger: pino.Logger) {
  return (
    err: Error | AppError,
    _req: Request,
    res: Response,
    _next: NextFunction
  ): void => {
    const requestId = getRequestId(_req);

    if (err instanceof AppError) {
      const response: ErrorResponse = {
        error: {
          code: err.code,
          message: err.message,
          requestId,
          ...(err.details && { details: err.details }),
        },
      };

      logger.warn(
        {
          error: err.message,
          code: err.code,
          statusCode: err.statusCode,
          requestId,
          url: _req.url,
          method: _req.method,
        },
        'Request error'
      );

      res.status(err.statusCode).json(response);
      return;
    }

    logger.error(
      {
        error: err.message,
        stack: err.stack,
        requestId,
        url: _req.url,
        method: _req.method,
      },
      'Unexpected error'
    );

    const response: ErrorResponse = {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        requestId,
      },
    };

    res.status(500).json(response);
  };
}

export function createAsyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
