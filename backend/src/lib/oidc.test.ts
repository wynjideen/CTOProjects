/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { getOIDCManager } from './oidc';
import { UnauthorizedError } from './errors';
import pino from 'pino';

// Mock the config module
vi.mock('../config/loader', () => ({
  getConfig: () => ({
    jwtSecret: 'a'.repeat(32),
  }),
}));

describe('OIDC Manager', () => {
  let logger: pino.Logger;

  beforeEach(() => {
    logger = pino({ level: 'silent' });
    vi.resetModules();
  });

  describe('extractBearerToken', () => {
    it('should extract bearer token from authorization header', () => {
      const manager = getOIDCManager(logger);
      const token = 'test-token-value';
      const header = `Bearer ${token}`;

      const result = manager.extractBearerToken(header);
      expect(result).toBe(token);
    });

    it('should return null for missing header', () => {
      const manager = getOIDCManager(logger);
      const result = manager.extractBearerToken(undefined);
      expect(result).toBeNull();
    });

    it('should return null for invalid format', () => {
      const manager = getOIDCManager(logger);
      const result = manager.extractBearerToken('InvalidHeader');
      expect(result).toBeNull();
    });

    it('should return null for empty header', () => {
      const manager = getOIDCManager(logger);
      const result = manager.extractBearerToken('');
      expect(result).toBeNull();
    });
  });

  describe('decodeToken', () => {
    it('should decode a valid JWT token', async () => {
      const manager = getOIDCManager(logger);
      const payload = {
        sub: 'user123',
        email: 'user@example.com',
        role: 'learner',
        org_id: 'org123',
      };

      const token = jwt.sign(payload, 'test-secret');
      const decoded = await manager.decodeToken(token);

      expect(decoded).toBeDefined();
    });

    it('should return null for invalid token', async () => {
      const manager = getOIDCManager(logger);
      const result = await manager.decodeToken('invalid-token');
      expect(result).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return true for expired token', () => {
      const manager = getOIDCManager(logger);
      const payload = {
        sub: 'user123',
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      };

      const token = jwt.sign(payload, 'test-secret', { noTimestamp: true });
      const decoded = jwt.decode(token) as Record<string, unknown> | null;

      expect(manager.isTokenExpired(decoded as any)).toBe(true);
    });

    it('should return false for valid token', () => {
      const manager = getOIDCManager(logger);
      const payload = {
        sub: 'user123',
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };

      const token = jwt.sign(payload, 'test-secret', { noTimestamp: true });
      const decoded = jwt.decode(token) as Record<string, unknown> | null;

      expect(manager.isTokenExpired(decoded as any)).toBe(false);
    });
  });

  describe('getTokenExpiresIn', () => {
    it('should return time remaining in seconds', () => {
      const manager = getOIDCManager(logger);
      const expiryTime = Math.floor(Date.now() / 1000) + 7200; // 2 hours
      const payload = {
        sub: 'user123',
        exp: expiryTime,
      };

      const token = jwt.sign(payload, 'test-secret', { noTimestamp: true });
      const decoded = jwt.decode(token) as Record<string, unknown> | null;

      const expiresIn = manager.getTokenExpiresIn(decoded as any);
      expect(expiresIn).toBeGreaterThan(7000);
      expect(expiresIn).toBeLessThanOrEqual(7200);
    });

    it('should return 0 for token without exp', () => {
      const manager = getOIDCManager(logger);
      const payload = { sub: 'user123' };

      expect(manager.getTokenExpiresIn(payload)).toBe(0);
    });
  });

  describe('verifyToken with local secret', () => {
    it('should verify valid token with local secret', async () => {
      const manager = getOIDCManager(logger);
      const payload = {
        sub: 'user123',
        email: 'user@example.com',
        role: 'learner',
        org_id: 'org123',
      };

      const token = jwt.sign(payload, 'a'.repeat(32)); // 32 char secret
      const decoded = await manager.verifyToken(token);

      expect(decoded.sub).toBe('user123');
      expect(decoded.email).toBe('user@example.com');
    });

    it('should throw UnauthorizedError for invalid token', async () => {
      const manager = getOIDCManager(logger);

      await expect(manager.verifyToken('invalid-token')).rejects.toThrow(
        UnauthorizedError
      );
    });

    it('should throw UnauthorizedError for expired token', async () => {
      const manager = getOIDCManager(logger);
      const payload = {
        sub: 'user123',
        exp: Math.floor(Date.now() / 1000) - 3600,
      };

      const token = jwt.sign(payload, 'a'.repeat(32), { noTimestamp: true });

      await expect(manager.verifyToken(token)).rejects.toThrow(
        UnauthorizedError
      );
    });
  });
});
