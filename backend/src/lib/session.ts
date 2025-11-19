import type { RedisClientType } from 'redis';
import { createClient } from 'redis';
import pino from 'pino';
import { v4 as uuid } from 'uuid';
import { getConfig } from '../config/loader';

export interface SessionData {
  userId: string;
  email?: string;
  roles: string[];
  permissions?: string[];
  organizationId?: string;
  mfaEnabled?: boolean;
  mfaVerified?: boolean;
  createdAt: number;
  lastActivity: number;
  expiresAt: number;
  absoluteExpiresAt: number;
  ipAddress?: string;
  userAgent?: string;
}

class SessionManager {
  private logger: pino.Logger;
  private redisClient: RedisClientType | null = null;
  private sessionPrefix = 'session:';
  private sessionTtl: number;
  private absoluteSessionTtl: number;

  constructor(logger: pino.Logger) {
    this.logger = logger;
    const config = getConfig();
    this.sessionTtl = config.sessionTimeoutMinutes * 60;
    this.absoluteSessionTtl = config.sessionAbsoluteTimeoutHours * 3600;
  }

  async connect(): Promise<void> {
    const config = getConfig();
    try {
      this.redisClient = createClient({
        url: config.redisUrl,
      });
      this.redisClient.on('error', (err: Error) =>
        this.logger.error({ error: err }, 'Redis connection error')
      );
      await this.redisClient.connect();
      this.logger.info('Redis session store connected');
    } catch (error) {
      this.logger.error({ error }, 'Failed to connect to Redis');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.disconnect();
      this.logger.info('Redis session store disconnected');
    }
  }

  private ensureConnected(): void {
    if (!this.redisClient) {
      throw new Error('Redis client not connected');
    }
  }

  async createSession(sessionData: Omit<SessionData, 'createdAt' | 'lastActivity' | 'expiresAt' | 'absoluteExpiresAt'>): Promise<string> {
    this.ensureConnected();

    const sessionId = uuid();
    const now = Date.now();

    const session: SessionData = {
      ...sessionData,
      createdAt: now,
      lastActivity: now,
      expiresAt: now + this.sessionTtl * 1000,
      absoluteExpiresAt: now + this.absoluteSessionTtl * 1000,
    };

    const sessionKey = `${this.sessionPrefix}${sessionId}`;
    await this.redisClient!.setEx(
      sessionKey,
      this.sessionTtl,
      JSON.stringify(session)
    );

    this.logger.debug(
      { sessionId, userId: sessionData.userId },
      'Session created'
    );

    return sessionId;
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    this.ensureConnected();

    const sessionKey = `${this.sessionPrefix}${sessionId}`;
    const data = await this.redisClient!.get(sessionKey);

    if (!data) {
      return null;
    }

    try {
      const session: SessionData = JSON.parse(data);
      const now = Date.now();

      // Check if session is expired (absolute timeout)
      if (session.absoluteExpiresAt <= now) {
        await this.redisClient!.del(sessionKey);
        this.logger.debug({ sessionId }, 'Session expired (absolute timeout)');
        return null;
      }

      // Check idle timeout
      if (session.expiresAt <= now) {
        await this.redisClient!.del(sessionKey);
        this.logger.debug({ sessionId }, 'Session expired (idle timeout)');
        return null;
      }

      return session;
    } catch (error) {
      this.logger.error({ error, sessionId }, 'Failed to parse session data');
      return null;
    }
  }

  async updateSessionActivity(sessionId: string): Promise<SessionData | null> {
    this.ensureConnected();

    const sessionKey = `${this.sessionPrefix}${sessionId}`;
    const data = await this.redisClient!.get(sessionKey);

    if (!data) {
      return null;
    }

    try {
      const session: SessionData = JSON.parse(data);
      const now = Date.now();

      // Check absolute timeout first
      if (session.absoluteExpiresAt <= now) {
        await this.redisClient!.del(sessionKey);
        return null;
      }

      // Update last activity and sliding window expiration
      session.lastActivity = now;
      session.expiresAt = now + this.sessionTtl * 1000;

      await this.redisClient!.setEx(
        sessionKey,
        this.sessionTtl,
        JSON.stringify(session)
      );

      return session;
    } catch (error) {
      this.logger.error(
        { error, sessionId },
        'Failed to update session activity'
      );
      return null;
    }
  }

  async updateSessionRoles(sessionId: string, roles: string[], permissions?: string[]): Promise<SessionData | null> {
    this.ensureConnected();

    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    session.roles = roles;
    if (permissions) {
      session.permissions = permissions;
    }

    const sessionKey = `${this.sessionPrefix}${sessionId}`;
    const ttl = Math.floor((session.expiresAt - Date.now()) / 1000);

    if (ttl > 0) {
      await this.redisClient!.setEx(
        sessionKey,
        ttl,
        JSON.stringify(session)
      );
    }

    return session;
  }

  async destroySession(sessionId: string): Promise<void> {
    this.ensureConnected();

    const sessionKey = `${this.sessionPrefix}${sessionId}`;
    await this.redisClient!.del(sessionKey);

    this.logger.debug({ sessionId }, 'Session destroyed');
  }

  async invalidateUserSessions(userId: string): Promise<void> {
    this.ensureConnected();

    const pattern = `${this.sessionPrefix}*`;
    const keys = await this.redisClient!.keys(pattern);

    for (const key of keys) {
      const data = await this.redisClient!.get(key);
      if (data) {
        try {
          const session: SessionData = JSON.parse(data);
          if (session.userId === userId) {
            await this.redisClient!.del(key);
          }
        } catch (error) {
          this.logger.error(
            { error, key },
            'Failed to parse session for invalidation'
          );
        }
      }
    }

    this.logger.info({ userId }, 'All user sessions invalidated');
  }

  getIdleTimeoutMs(): number {
    return this.sessionTtl * 1000;
  }

  getAbsoluteTimeoutMs(): number {
    return this.absoluteSessionTtl * 1000;
  }

  getTimeToIdleWarning(session: SessionData): number {
    const warningThresholdMs = 5 * 60 * 1000; // 5 minutes before idle timeout
    const now = Date.now();
    const timeUntilExpiry = session.expiresAt - now;
    return Math.max(0, timeUntilExpiry - warningThresholdMs);
  }

  isNearIdleTimeout(session: SessionData): boolean {
    const warningThresholdMs = 5 * 60 * 1000;
    const now = Date.now();
    const timeUntilExpiry = session.expiresAt - now;
    return timeUntilExpiry <= warningThresholdMs && timeUntilExpiry > 0;
  }
}

let sessionManager: SessionManager | null = null;

export function getSessionManager(logger?: pino.Logger): SessionManager {
  if (!sessionManager) {
    if (!logger) {
      throw new Error('Logger required to initialize session manager');
    }
    sessionManager = new SessionManager(logger);
  }
  return sessionManager;
}

export async function initializeSessionManager(
  logger: pino.Logger
): Promise<SessionManager> {
  const manager = getSessionManager(logger);
  await manager.connect();
  return manager;
}
