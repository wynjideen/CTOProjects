/* eslint-disable @typescript-eslint/no-namespace */
import { Request, Response, NextFunction } from 'express';
import pino from 'pino';
import { getOIDCManager } from '../lib/oidc';
import { getSessionManager } from '../lib/session';
import { UnauthorizedError } from '../lib/errors';
import { type AuthContext, Role } from '../lib/rbac';
import { getRequestId } from '../lib/logger';

// Extend Express Request to include auth context
declare global {
  namespace Express {
    interface Request {
      authContext?: AuthContext;
      sessionId?: string;
      logger?: pino.Logger;
    }
  }
}

export function createAuthMiddleware(logger: pino.Logger) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const requestId = getRequestId(req);
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing authorization header',
          requestId,
        },
      });
      return;
    }

    try {
      const oidcManager = getOIDCManager(logger);
      const token = oidcManager.extractBearerToken(authHeader);

      if (!token) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid authorization header format',
            requestId,
          },
        });
        return;
      }

      // Verify the token
      const decoded = await oidcManager.verifyToken(token);

      if (!decoded.sub) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid token payload',
            requestId,
          },
        });
        return;
      }

      // Extract roles and permissions from token
      const roles = decoded.role ? [decoded.role] : ['learner'];
      const permissions = decoded.permissions || [];

      // Build auth context
      const authContext: AuthContext = {
        userId: decoded.sub,
        email: decoded.email,
        roles,
        permissions,
        organizationId: decoded.org_id,
      };

      req.authContext = authContext;
      req.logger = logger;

      logger.debug(
        { userId: authContext.userId, roles, requestId },
        'Token verified'
      );

      next();
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        res.status(401).json({
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        });
        return;
      }

      logger.error(
        { error, requestId },
        'Authentication middleware error'
      );
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Authentication failed',
          requestId,
        },
      });
    }
  };
}

export function createSessionAuthMiddleware(logger: pino.Logger) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const requestId = getRequestId(req);
    const sessionId = req.cookies?.sessionId || req.headers['x-session-id'];

    if (!sessionId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing session',
          requestId,
        },
      });
      return;
    }

    try {
      const sessionManager = getSessionManager(logger);
      const session = await sessionManager.getSession(sessionId as string);

      if (!session) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired session',
            requestId,
          },
        });
        return;
      }

      // Update activity (sliding window)
      await sessionManager.updateSessionActivity(sessionId as string);

      // Check for idle timeout warning
      if (sessionManager.isNearIdleTimeout(session)) {
        res.set('X-Session-Warning', 'Session expiring soon');
      }

      // Build auth context from session
      const authContext: AuthContext = {
        userId: session.userId,
        email: session.email,
        roles: session.roles,
        permissions: session.permissions,
        organizationId: session.organizationId,
        sessionId: sessionId as string,
      };

      req.authContext = authContext;
      req.sessionId = sessionId as string;
      req.logger = logger;

      logger.debug(
        { userId: authContext.userId, sessionId, requestId },
        'Session validated'
      );

      next();
    } catch (error) {
      logger.error(
        { error, sessionId, requestId },
        'Session authentication error'
      );
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Session validation failed',
          requestId,
        },
      });
    }
  };
}

export function createRoleMiddleware(requiredRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = getRequestId(req);

    if (!req.authContext) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId,
        },
      });
      return;
    }

    const hasRequiredRole = requiredRoles.some((role) =>
      req.authContext!.roles.includes(role)
    );

    if (!hasRequiredRole) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `This action requires one of the following roles: ${requiredRoles.join(', ')}`,
          requestId,
        },
      });
      return;
    }

    next();
  };
}

export function createPermissionMiddleware(requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = getRequestId(req);

    if (!req.authContext) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId,
        },
      });
      return;
    }

    if (!req.authContext.permissions) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have the required permissions',
          requestId,
        },
      });
      return;
    }

    const hasAllPermissions = requiredPermissions.every((perm) =>
      req.authContext!.permissions!.includes(perm)
    );

    if (!hasAllPermissions) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `This action requires all of the following permissions: ${requiredPermissions.join(', ')}`,
          requestId,
        },
      });
      return;
    }

    next();
  };
}

export function createAsyncAuthHandler(
  handler: (
    req: Request,
    res: Response,
    next: NextFunction
  ) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
