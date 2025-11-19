import jwt, { JwtPayload } from 'jsonwebtoken';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import pino from 'pino';
import { getConfig } from '../config/loader';
import { UnauthorizedError } from './errors';

export interface DecodedToken extends JwtPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  picture?: string;
  role?: string;
  org_id?: string;
  permissions?: string[];
  scope?: string;
  aud?: string;
  iss?: string;
  client_id?: string;
}

class OIDCManager {
  private logger: pino.Logger;
  private remoteJWKSet?: ReturnType<typeof createRemoteJWKSet>;

  constructor(logger: pino.Logger) {
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    const config = getConfig();

    if (config.oidcProvider && config.oidcJwksUri) {
      try {
        this.remoteJWKSet = createRemoteJWKSet(new URL(config.oidcJwksUri));
        this.logger.info(
          { provider: config.oidcProvider, jwksUri: config.oidcJwksUri },
          'OIDC JWKS initialized'
        );
      } catch (error) {
        this.logger.error(
          { error, provider: config.oidcProvider },
          'Failed to initialize OIDC JWKS'
        );
        throw error;
      }
    }
  }

  async verifyToken(token: string): Promise<DecodedToken> {
    const config = getConfig();

    // If OIDC is configured, verify with remote JWKS
    if (this.remoteJWKSet && config.oidcJwksUri && config.oidcAudience) {
      try {
        const verified = await jwtVerify(token, this.remoteJWKSet, {
          audience: config.oidcAudience,
        });
        return verified.payload as DecodedToken;
      } catch (error) {
        this.logger.warn({ error }, 'Failed to verify token with OIDC JWKS');
        throw new UnauthorizedError('Invalid or expired token');
      }
    }

    // Fallback to local JWT verification using jwtSecret
    try {
      const decoded = jwt.verify(token, config.jwtSecret, {
        algorithms: ['HS256', 'RS256'],
      }) as DecodedToken;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid token');
      }
      throw new UnauthorizedError('Token verification failed');
    }
  }

  async decodeToken(token: string): Promise<DecodedToken | null> {
    try {
      const decoded = jwt.decode(token) as DecodedToken | null;
      return decoded;
    } catch {
      return null;
    }
  }

  isTokenExpired(token: DecodedToken): boolean {
    if (!token.exp) return false;
    return Date.now() >= token.exp * 1000;
  }

  getTokenExpiresIn(token: DecodedToken): number {
    if (!token.exp) return 0;
    return Math.floor((token.exp * 1000 - Date.now()) / 1000);
  }

  extractBearerToken(authHeader?: string): string | null {
    if (!authHeader) return null;
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return null;
    }
    return parts[1];
  }
}

let oidcManager: OIDCManager | null = null;

export function getOIDCManager(logger?: pino.Logger): OIDCManager {
  if (!oidcManager) {
    if (!logger) {
      throw new Error('Logger required to initialize OIDC manager');
    }
    oidcManager = new OIDCManager(logger);
  }
  return oidcManager;
}

export async function initializeOIDC(logger: pino.Logger): Promise<void> {
  const manager = getOIDCManager(logger);
  await manager.initialize();
}
