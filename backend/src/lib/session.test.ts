import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import pino from 'pino';
import { getSessionManager, type SessionData } from './session';

// Mock the config module
vi.mock('../config/loader', () => ({
  getConfig: () => ({
    redisUrl: 'redis://localhost:6379',
    sessionTimeoutMinutes: 30,
    sessionAbsoluteTimeoutHours: 24,
  }),
}));

describe('Session Manager', () => {
  let logger: pino.Logger;

  beforeEach(() => {
    logger = pino({ level: 'silent' });
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Lifecycle', () => {
    it('should create a session with correct data', async () => {
      const manager = getSessionManager(logger);

      // Mock Redis connection
      manager['redisClient'] = {
        setEx: vi.fn().mockResolvedValue('OK'),
        get: vi.fn(),
        del: vi.fn(),
        keys: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        on: vi.fn(),
      } as unknown as Record<string, unknown>;

      const sessionId = await manager.createSession({
        userId: 'user123',
        email: 'user@example.com',
        roles: ['learner'],
        organizationId: 'org123',
      });

      expect(sessionId).toBeDefined();
      expect(manager['redisClient'].setEx).toHaveBeenCalled();
    });

    it('should retrieve session and check timeout', async () => {
      const manager = getSessionManager(logger);
      const now = Date.now();

      const sessionData: SessionData = {
        userId: 'user123',
        email: 'user@example.com',
        roles: ['learner'],
        organizationId: 'org123',
        createdAt: now,
        lastActivity: now,
        expiresAt: now + 30 * 60 * 1000, // 30 minutes from now
        absoluteExpiresAt: now + 24 * 60 * 60 * 1000, // 24 hours from now
      };

      manager['redisClient'] = {
        get: vi.fn().mockResolvedValue(JSON.stringify(sessionData)),
        setEx: vi.fn(),
        del: vi.fn(),
        keys: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        on: vi.fn(),
      } as unknown as Record<string, unknown>;

      const session = await manager.getSession('session123');

      expect(session).not.toBeNull();
      expect(session?.userId).toBe('user123');
      expect(session?.roles).toEqual(['learner']);
    });

    it('should invalidate expired sessions', async () => {
      const manager = getSessionManager(logger);
      const now = Date.now();

      const expiredSession: SessionData = {
        userId: 'user123',
        email: 'user@example.com',
        roles: ['learner'],
        organizationId: 'org123',
        createdAt: now - 2 * 60 * 60 * 1000,
        lastActivity: now - 60 * 60 * 1000,
        expiresAt: now - 10 * 60 * 1000, // Expired 10 minutes ago
        absoluteExpiresAt: now + 24 * 60 * 60 * 1000,
      };

      manager['redisClient'] = {
        get: vi.fn().mockResolvedValue(JSON.stringify(expiredSession)),
        setEx: vi.fn(),
        del: vi.fn(),
        keys: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        on: vi.fn(),
      } as unknown as Record<string, unknown>;

      const session = await manager.getSession('session123');

      expect(session).toBeNull();
      expect(manager['redisClient'].del).toHaveBeenCalledWith('session:session123');
    });
  });

  describe('Session Activity Updates', () => {
    it('should update session activity and extend expiry', async () => {
      const manager = getSessionManager(logger);
      const now = Date.now();

      const sessionData: SessionData = {
        userId: 'user123',
        email: 'user@example.com',
        roles: ['learner'],
        organizationId: 'org123',
        createdAt: now - 10 * 60 * 1000,
        lastActivity: now - 5 * 60 * 1000,
        expiresAt: now + 25 * 60 * 1000,
        absoluteExpiresAt: now + 24 * 60 * 60 * 1000,
      };

      manager['redisClient'] = {
        get: vi.fn().mockResolvedValue(JSON.stringify(sessionData)),
        setEx: vi.fn().mockResolvedValue('OK'),
        del: vi.fn(),
        keys: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        on: vi.fn(),
      } as unknown as Record<string, unknown>;

      const updatedSession = await manager.updateSessionActivity('session123');

      expect(updatedSession).not.toBeNull();
      expect(updatedSession?.lastActivity).toBeGreaterThan(sessionData.lastActivity);
      expect(manager['redisClient'].setEx).toHaveBeenCalled();
    });

    it('should detect session near idle timeout', async () => {
      const manager = getSessionManager(logger);
      const now = Date.now();

      const sessionData: SessionData = {
        userId: 'user123',
        email: 'user@example.com',
        roles: ['learner'],
        organizationId: 'org123',
        createdAt: now,
        lastActivity: now,
        expiresAt: now + 4 * 60 * 1000, // Less than 5 minutes until expiry
        absoluteExpiresAt: now + 24 * 60 * 60 * 1000,
      };

      const isNearTimeout = manager.isNearIdleTimeout(sessionData);
      expect(isNearTimeout).toBe(true);
    });
  });

  describe('Session Invalidation', () => {
    it('should destroy individual session', async () => {
      const manager = getSessionManager(logger);

      manager['redisClient'] = {
        del: vi.fn().mockResolvedValue(1),
        get: vi.fn(),
        setEx: vi.fn(),
        keys: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        on: vi.fn(),
      } as unknown as Record<string, unknown>;

      await manager.destroySession('session123');

      expect(manager['redisClient'].del).toHaveBeenCalledWith(
        'session:session123'
      );
    });

    it('should invalidate all user sessions', async () => {
      const manager = getSessionManager(logger);
      const now = Date.now();

      const session1: SessionData = {
        userId: 'user123',
        roles: ['learner'],
        createdAt: now,
        lastActivity: now,
        expiresAt: now + 30 * 60 * 1000,
        absoluteExpiresAt: now + 24 * 60 * 60 * 1000,
      };

      const session2: SessionData = {
        userId: 'user456',
        roles: ['admin'],
        createdAt: now,
        lastActivity: now,
        expiresAt: now + 30 * 60 * 1000,
        absoluteExpiresAt: now + 24 * 60 * 60 * 1000,
      };

      manager['redisClient'] = {
        keys: vi.fn().mockResolvedValue(['session:sess1', 'session:sess2']),
        get: vi
          .fn()
          .mockResolvedValueOnce(JSON.stringify(session1))
          .mockResolvedValueOnce(JSON.stringify(session2)),
        del: vi.fn().mockResolvedValue(1),
        setEx: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        on: vi.fn(),
      } as unknown as Record<string, unknown>;

      await manager.invalidateUserSessions('user123');

      expect(manager['redisClient'].del).toHaveBeenCalledTimes(1);
    });
  });

  describe('Role Updates', () => {
    it('should update session roles', async () => {
      const manager = getSessionManager(logger);
      const now = Date.now();

      const sessionData: SessionData = {
        userId: 'user123',
        email: 'user@example.com',
        roles: ['learner'],
        organizationId: 'org123',
        createdAt: now,
        lastActivity: now,
        expiresAt: now + 30 * 60 * 1000,
        absoluteExpiresAt: now + 24 * 60 * 60 * 1000,
      };

      manager['redisClient'] = {
        get: vi.fn().mockResolvedValue(JSON.stringify(sessionData)),
        setEx: vi.fn().mockResolvedValue('OK'),
        del: vi.fn(),
        keys: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        on: vi.fn(),
      } as unknown as Record<string, unknown>;

      const updated = await manager.updateSessionRoles(
        'session123',
        ['admin'],
        ['users:read', 'users:write']
      );

      expect(updated?.roles).toEqual(['admin']);
      expect(updated?.permissions).toEqual(['users:read', 'users:write']);
    });
  });

  describe('Session Timeouts', () => {
    it('should return correct idle timeout duration', () => {
      const manager = getSessionManager(logger);
      const timeoutMs = manager.getIdleTimeoutMs();

      expect(timeoutMs).toBe(30 * 60 * 1000);
    });

    it('should return correct absolute timeout duration', () => {
      const manager = getSessionManager(logger);
      const timeoutMs = manager.getAbsoluteTimeoutMs();

      expect(timeoutMs).toBe(24 * 60 * 60 * 1000);
    });

    it('should calculate time to idle warning', () => {
      const manager = getSessionManager(logger);
      const now = Date.now();

      const sessionData: SessionData = {
        userId: 'user123',
        roles: ['learner'],
        createdAt: now,
        lastActivity: now,
        expiresAt: now + 10 * 60 * 1000, // 10 minutes from now
        absoluteExpiresAt: now + 24 * 60 * 60 * 1000,
      };

      const timeToWarning = manager.getTimeToIdleWarning(sessionData);
      expect(timeToWarning).toBeGreaterThan(0);
      expect(timeToWarning).toBeLessThanOrEqual(10 * 60 * 1000);
    });
  });
});
