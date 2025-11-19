import { Router, Request, Response } from 'express';
import pino from 'pino';
import { getOIDCManager } from '../../lib/oidc';
import { getSessionManager } from '../../lib/session';
import { getAuditLogger } from '../../lib/audit';
import { getRequestId } from '../../lib/logger';
import {
  createAuthMiddleware,
  createAsyncAuthHandler,
} from '../../middleware/auth';
import { UnauthorizedError } from '../../lib/errors';
import { Role, getDefaultPermissionsForRole } from '../../lib/rbac';

export function setupAuthRoutes(router: Router, logger: pino.Logger): void {
  const oidcManager = getOIDCManager(logger);
  const sessionManager = getSessionManager(logger);
  const auditLogger = getAuditLogger(logger);

  // POST /api/v1/auth/token - Exchange OIDC auth code for tokens
  router.post(
    '/token',
    createAsyncAuthHandler(async (req: Request, res: Response) => {
      const requestId = getRequestId(req);
      const { code, redirectUri } = req.body;

      if (!code || !redirectUri) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: code, redirectUri',
            requestId,
          },
        });
        return;
      }

      try {
        // In a real implementation, this would exchange the code with the OIDC provider
        // For now, we'll just return a mock response
        res.json({
          access_token: 'mock_access_token',
          id_token: 'mock_id_token',
          token_type: 'Bearer',
          expires_in: 3600,
        });
      } catch (error) {
        logger.error({ error, requestId }, 'Token exchange failed');
        res.status(500).json({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Token exchange failed',
            requestId,
          },
        });
      }
    })
  );

  // POST /api/v1/auth/session - Create a session from a valid JWT token
  router.post(
    '/session',
    createAsyncAuthHandler(async (req: Request, res: Response) => {
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

        // Verify token
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

        // Create session
        const roles = decoded.role ? [decoded.role] : [Role.LEARNER];
        const permissions = getDefaultPermissionsForRole(roles[0] as Role);

        const sessionId = await sessionManager.createSession({
          userId: decoded.sub,
          email: decoded.email,
          roles,
          permissions,
          organizationId: decoded.org_id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });

        // Audit log
        await auditLogger.logLogin(
          decoded.sub,
          decoded.email,
          req.ip,
          req.get('user-agent'),
          decoded.org_id
        );

        res.json({
          sessionId,
          user: {
            id: decoded.sub,
            email: decoded.email,
            roles,
            organizationId: decoded.org_id,
          },
        });
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

        logger.error({ error, requestId }, 'Session creation failed');
        res.status(500).json({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Session creation failed',
            requestId,
          },
        });
      }
    })
  );

  // GET /api/v1/auth/me - Get current user info
  router.get(
    '/me',
    createAuthMiddleware(logger),
    createAsyncAuthHandler(async (req: Request, res: Response) => {
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

      res.json({
        user: {
          id: req.authContext.userId,
          email: req.authContext.email,
          roles: req.authContext.roles,
          permissions: req.authContext.permissions,
          organizationId: req.authContext.organizationId,
        },
      });
    })
  );

  // POST /api/v1/auth/logout - Logout and destroy session
  router.post(
    '/logout',
    createAuthMiddleware(logger),
    createAsyncAuthHandler(async (req: Request, res: Response) => {
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

      try {
        const sessionId = req.headers['x-session-id'] as string;
        if (sessionId) {
          await sessionManager.destroySession(sessionId);
        }

        // Audit log
        await auditLogger.logLogout(
          req.authContext.userId,
          sessionId,
          req.authContext.organizationId
        );

        res.json({
          message: 'Logged out successfully',
        });
      } catch (error) {
        logger.error({ error, requestId }, 'Logout failed');
        res.status(500).json({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Logout failed',
            requestId,
          },
        });
      }
    })
  );

  // POST /api/v1/auth/token/introspect - Token introspection
  router.post(
    '/token/introspect',
    createAsyncAuthHandler(async (req: Request, res: Response) => {
      const requestId = getRequestId(req);
      const { token } = req.body;

      if (!token) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required field: token',
            requestId,
          },
        });
        return;
      }

      try {
        const decoded = await oidcManager.verifyToken(token);

        if (oidcManager.isTokenExpired(decoded)) {
          res.json({
            active: false,
            reason: 'Token expired',
          });
          return;
        }

        res.json({
          active: true,
          sub: decoded.sub,
          email: decoded.email,
          exp: decoded.exp,
          iat: decoded.iat,
          aud: decoded.aud,
          iss: decoded.iss,
          scope: decoded.scope,
          role: decoded.role,
          permissions: decoded.permissions,
          org_id: decoded.org_id,
        });
      } catch (error) {
        res.json({
          active: false,
          reason: error instanceof Error ? error.message : 'Invalid token',
        });
      }
    })
  );

  // POST /api/v1/auth/refresh-session - Refresh session activity
  router.post(
    '/refresh-session',
    createAuthMiddleware(logger),
    createAsyncAuthHandler(async (req: Request, res: Response) => {
      const requestId = getRequestId(req);
      const sessionId = req.headers['x-session-id'] as string;

      if (!sessionId || !req.authContext) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            requestId,
          },
        });
        return;
      }

      try {
        const session = await sessionManager.updateSessionActivity(sessionId);

        if (!session) {
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'Session expired',
              requestId,
            },
          });
          return;
        }

        res.json({
          sessionId,
          expiresAt: session.expiresAt,
          absoluteExpiresAt: session.absoluteExpiresAt,
        });
      } catch (error) {
        logger.error({ error, requestId }, 'Session refresh failed');
        res.status(500).json({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Session refresh failed',
            requestId,
          },
        });
      }
    })
  );

  // Webhook for OIDC provider events (e.g., Auth0 rule changes)
  router.post(
    '/webhooks/oidc',
    createAsyncAuthHandler(async (req: Request, res: Response) => {
      const requestId = getRequestId(req);
      const { event, userId, changes } = req.body;

      logger.info(
        { event, userId, changes, requestId },
        'OIDC webhook received'
      );

      switch (event) {
        case 'user.role.changed':
          // Invalidate all user sessions when role changes
          await sessionManager.invalidateUserSessions(userId);
          logger.info(
            { userId, requestId },
            'User sessions invalidated due to role change'
          );
          break;

        case 'user.password.changed':
          // Invalidate all user sessions when password changes
          await sessionManager.invalidateUserSessions(userId);
          logger.info(
            { userId, requestId },
            'User sessions invalidated due to password change'
          );
          break;

        default:
          logger.debug({ event, requestId }, 'Unhandled OIDC event');
      }

      res.json({ received: true });
    })
  );
}
