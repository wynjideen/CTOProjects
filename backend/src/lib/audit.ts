import pino from 'pino';

export enum AuditEventType {
  LOGIN = 'login',
  LOGOUT = 'logout',
  ROLE_ASSIGNMENT = 'role_assignment',
  ROLE_REVOCATION = 'role_revocation',
  PASSWORD_CHANGE = 'password_change',
  MFA_ENABLED = 'mfa_enabled',
  MFA_DISABLED = 'mfa_disabled',
  SESSION_CREATED = 'session_created',
  SESSION_DESTROYED = 'session_destroyed',
  TOKEN_VERIFIED = 'token_verified',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  FORBIDDEN_ACCESS = 'forbidden_access',
  DATA_ACCESS = 'data_access',
  RESOURCE_CREATED = 'resource_created',
  RESOURCE_UPDATED = 'resource_updated',
  RESOURCE_DELETED = 'resource_deleted',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
}

export interface AuditLogEntry {
  id?: string;
  eventType: AuditEventType;
  userId: string;
  adminId?: string;
  userEmail?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  details?: Record<string, unknown>;
  result: 'success' | 'failure';
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  organizationId?: string;
  timestamp: number;
  reason?: string;
}

class AuditLogger {
  private logger: pino.Logger;

  constructor(logger: pino.Logger) {
    this.logger = logger;
  }

  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    const auditEntry: AuditLogEntry = {
      ...entry,
      timestamp: Date.now(),
    };

    this.logger.info(
      {
        eventType: auditEntry.eventType,
        userId: auditEntry.userId,
        resourceType: auditEntry.resourceType,
        result: auditEntry.result,
      },
      `Audit: ${auditEntry.eventType} - ${auditEntry.action}`
    );

    // TODO: In production, this would persist to database
    // For now, we're logging to stdout for audit trail
  }

  async logLogin(userId: string, email?: string, ipAddress?: string, userAgent?: string, organizationId?: string): Promise<void> {
    await this.log({
      eventType: AuditEventType.LOGIN,
      userId,
      userEmail: email,
      action: 'User logged in',
      result: 'success',
      ipAddress,
      userAgent,
      organizationId,
    });
  }

  async logLogout(userId: string, sessionId?: string, organizationId?: string): Promise<void> {
    await this.log({
      eventType: AuditEventType.LOGOUT,
      userId,
      action: 'User logged out',
      result: 'success',
      details: { sessionId },
      organizationId,
    });
  }

  async logRoleAssignment(
    userId: string,
    adminId: string,
    oldRoles: string[],
    newRoles: string[],
    reason?: string,
    organizationId?: string
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.ROLE_ASSIGNMENT,
      userId,
      adminId,
      action: 'Role assigned',
      result: 'success',
      oldValues: { roles: oldRoles },
      newValues: { roles: newRoles },
      reason,
      organizationId,
    });
  }

  async logUnauthorizedAccess(
    userId: string,
    resourceType: string,
    resourceId: string,
    ipAddress?: string,
    userAgent?: string,
    organizationId?: string
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.UNAUTHORIZED_ACCESS,
      userId,
      action: 'Unauthorized access attempt',
      result: 'failure',
      resourceType,
      resourceId,
      ipAddress,
      userAgent,
      organizationId,
    });
  }

  async logForbiddenAccess(
    userId: string,
    resourceType: string,
    resourceId: string,
    requiredPermission?: string,
    ipAddress?: string,
    userAgent?: string,
    organizationId?: string
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.FORBIDDEN_ACCESS,
      userId,
      action: 'Forbidden access attempt',
      result: 'failure',
      resourceType,
      resourceId,
      details: { requiredPermission },
      ipAddress,
      userAgent,
      organizationId,
    });
  }

  async logDataAccess(
    userId: string,
    resourceType: string,
    resourceId: string,
    action: string,
    organizationId?: string
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.DATA_ACCESS,
      userId,
      action,
      resourceType,
      resourceId,
      result: 'success',
      organizationId,
    });
  }

  async logResourceCreated(
    userId: string,
    resourceType: string,
    resourceId: string,
    details?: Record<string, unknown>,
    organizationId?: string
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.RESOURCE_CREATED,
      userId,
      action: `${resourceType} created`,
      resourceType,
      resourceId,
      result: 'success',
      details,
      organizationId,
    });
  }

  async logResourceUpdated(
    userId: string,
    resourceType: string,
    resourceId: string,
    oldValues?: Record<string, unknown>,
    newValues?: Record<string, unknown>,
    organizationId?: string
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.RESOURCE_UPDATED,
      userId,
      action: `${resourceType} updated`,
      resourceType,
      resourceId,
      result: 'success',
      oldValues,
      newValues,
      organizationId,
    });
  }

  async logResourceDeleted(
    userId: string,
    resourceType: string,
    resourceId: string,
    reason?: string,
    organizationId?: string
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.RESOURCE_DELETED,
      userId,
      action: `${resourceType} deleted`,
      resourceType,
      resourceId,
      result: 'success',
      reason,
      organizationId,
    });
  }

  async logSuspiciousActivity(
    userId: string,
    activity: string,
    details?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
    organizationId?: string
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
      userId,
      action: activity,
      result: 'failure',
      details,
      ipAddress,
      userAgent,
      organizationId,
    });
  }
}

let auditLogger: AuditLogger | null = null;

export function getAuditLogger(logger?: pino.Logger): AuditLogger {
  if (!auditLogger) {
    if (!logger) {
      throw new Error('Logger required to initialize audit logger');
    }
    auditLogger = new AuditLogger(logger);
  }
  return auditLogger;
}
