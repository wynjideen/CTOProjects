import { ForbiddenError, UnauthorizedError } from './errors';

export enum Role {
  LEARNER = 'learner',
  ADMIN = 'admin',
}

export interface Permission {
  id: string;
  role: Role;
  description: string;
  resource: string;
  action: string;
}

export const PERMISSIONS: Record<string, Permission> = {
  // Learner permissions
  'learner:read': {
    id: 'learner:read',
    role: Role.LEARNER,
    description: 'View own profile and course data',
    resource: 'learner',
    action: 'read',
  },
  'learner:write': {
    id: 'learner:write',
    role: Role.LEARNER,
    description: 'Update own profile, submit assignments',
    resource: 'learner',
    action: 'write',
  },
  'course:view': {
    id: 'course:view',
    role: Role.LEARNER,
    description: 'View enrolled courses',
    resource: 'course',
    action: 'view',
  },
  'course:submit': {
    id: 'course:submit',
    role: Role.LEARNER,
    description: 'Submit assignments and projects',
    resource: 'course',
    action: 'submit',
  },
  'progress:view': {
    id: 'progress:view',
    role: Role.LEARNER,
    description: 'View own learning progress',
    resource: 'progress',
    action: 'view',
  },
  'profile:edit': {
    id: 'profile:edit',
    role: Role.LEARNER,
    description: 'Edit own profile information',
    resource: 'profile',
    action: 'edit',
  },

  // Admin permissions
  'users:create': {
    id: 'users:create',
    role: Role.ADMIN,
    description: 'Create new user accounts',
    resource: 'users',
    action: 'create',
  },
  'users:read': {
    id: 'users:read',
    role: Role.ADMIN,
    description: 'View user profiles and accounts',
    resource: 'users',
    action: 'read',
  },
  'users:write': {
    id: 'users:write',
    role: Role.ADMIN,
    description: 'Modify user information',
    resource: 'users',
    action: 'write',
  },
  'users:delete': {
    id: 'users:delete',
    role: Role.ADMIN,
    description: 'Delete user accounts (soft delete)',
    resource: 'users',
    action: 'delete',
  },
  'users:reset-password': {
    id: 'users:reset-password',
    role: Role.ADMIN,
    description: 'Reset user passwords',
    resource: 'users',
    action: 'reset-password',
  },
  'courses:manage': {
    id: 'courses:manage',
    role: Role.ADMIN,
    description: 'Create, edit, delete courses',
    resource: 'courses',
    action: 'manage',
  },
  'roles:manage': {
    id: 'roles:manage',
    role: Role.ADMIN,
    description: 'Assign and revoke roles',
    resource: 'roles',
    action: 'manage',
  },
  'mfa:reset': {
    id: 'mfa:reset',
    role: Role.ADMIN,
    description: 'Reset user MFA settings',
    resource: 'mfa',
    action: 'reset',
  },
  'audit:read': {
    id: 'audit:read',
    role: Role.ADMIN,
    description: 'View audit logs',
    resource: 'audit',
    action: 'read',
  },
  'system:config': {
    id: 'system:config',
    role: Role.ADMIN,
    description: 'Modify system settings',
    resource: 'system',
    action: 'config',
  },
};

export function getRolePermissions(role: Role): string[] {
  return Object.values(PERMISSIONS)
    .filter((p) => p.role === role)
    .map((p) => p.id);
}

export function getDefaultPermissionsForRole(role: Role): string[] {
  return getRolePermissions(role);
}

export function hasPermission(
  userPermissions: string[],
  requiredPermission: string
): boolean {
  return userPermissions.includes(requiredPermission);
}

export function hasRole(userRoles: string[], requiredRole: Role): boolean {
  return userRoles.includes(requiredRole);
}

export function hasAnyRole(userRoles: string[], requiredRoles: Role[]): boolean {
  return requiredRoles.some((role) => userRoles.includes(role));
}

export function hasAllRoles(userRoles: string[], requiredRoles: Role[]): boolean {
  return requiredRoles.every((role) => userRoles.includes(role));
}

export function hasAnyPermission(
  userPermissions: string[],
  requiredPermissions: string[]
): boolean {
  return requiredPermissions.some((perm) =>
    userPermissions.includes(perm)
  );
}

export function hasAllPermissions(
  userPermissions: string[],
  requiredPermissions: string[]
): boolean {
  return requiredPermissions.every((perm) =>
    userPermissions.includes(perm)
  );
}

export interface AuthContext {
  userId: string;
  email?: string;
  roles: string[];
  permissions?: string[];
  organizationId?: string;
  sessionId?: string;
}

export function requireRole(context: AuthContext, role: Role): void {
  if (!hasRole(context.roles, role)) {
    throw new ForbiddenError(
      `This action requires the ${role} role. Your roles: ${context.roles.join(', ')}`
    );
  }
}

export function requireAnyRole(
  context: AuthContext,
  roles: Role[]
): void {
  if (!hasAnyRole(context.roles, roles)) {
    throw new ForbiddenError(
      `This action requires one of the following roles: ${roles.join(', ')}. Your roles: ${context.roles.join(', ')}`
    );
  }
}

export function requireAllRoles(
  context: AuthContext,
  roles: Role[]
): void {
  if (!hasAllRoles(context.roles, roles)) {
    throw new ForbiddenError(
      `This action requires all of the following roles: ${roles.join(', ')}. Your roles: ${context.roles.join(', ')}`
    );
  }
}

export function requirePermission(
  context: AuthContext,
  permission: string
): void {
  if (!context.permissions || !hasPermission(context.permissions, permission)) {
    throw new ForbiddenError(
      `This action requires the ${permission} permission.`
    );
  }
}

export function requireAnyPermission(
  context: AuthContext,
  permissions: string[]
): void {
  if (
    !context.permissions ||
    !hasAnyPermission(context.permissions, permissions)
  ) {
    throw new ForbiddenError(
      `This action requires one of the following permissions: ${permissions.join(', ')}.`
    );
  }
}

export function requireAllPermissions(
  context: AuthContext,
  permissions: string[]
): void {
  if (
    !context.permissions ||
    !hasAllPermissions(context.permissions, permissions)
  ) {
    throw new ForbiddenError(
      `This action requires all of the following permissions: ${permissions.join(', ')}.`
    );
  }
}

export function checkOrganizationIsolation(
  context: AuthContext,
  resourceOrgId: string
): void {
  if (!context.organizationId) {
    throw new UnauthorizedError('Organization context required');
  }

  if (context.organizationId !== resourceOrgId) {
    throw new ForbiddenError(
      'You do not have access to resources in this organization'
    );
  }
}
