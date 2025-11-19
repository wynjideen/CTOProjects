import { describe, it, expect } from 'vitest';
import {
  Role,
  getDefaultPermissionsForRole,
  hasPermission,
  hasRole,
  hasAnyRole,
  hasAllRoles,
  hasAnyPermission,
  hasAllPermissions,
  requireRole,
  requirePermission,
  checkOrganizationIsolation,
  type AuthContext,
} from './rbac';
import { ForbiddenError, UnauthorizedError } from './errors';

describe('RBAC Module', () => {
  describe('getDefaultPermissionsForRole', () => {
    it('should return learner permissions', () => {
      const perms = getDefaultPermissionsForRole(Role.LEARNER);
      expect(perms).toContain('learner:read');
      expect(perms).toContain('learner:write');
      expect(perms).toContain('course:view');
      expect(perms).toContain('progress:view');
    });

    it('should return admin permissions', () => {
      const perms = getDefaultPermissionsForRole(Role.ADMIN);
      expect(perms).toContain('users:create');
      expect(perms).toContain('users:read');
      expect(perms).toContain('roles:manage');
      expect(perms).toContain('audit:read');
    });

    it('should return different permissions for different roles', () => {
      const learnerPerms = getDefaultPermissionsForRole(Role.LEARNER);
      const adminPerms = getDefaultPermissionsForRole(Role.ADMIN);

      expect(learnerPerms).not.toEqual(adminPerms);
      expect(learnerPerms.length).toBeLessThan(adminPerms.length);
    });
  });

  describe('hasPermission', () => {
    it('should return true if user has permission', () => {
      const perms = ['learner:read', 'learner:write'];
      expect(hasPermission(perms, 'learner:read')).toBe(true);
    });

    it('should return false if user lacks permission', () => {
      const perms = ['learner:read'];
      expect(hasPermission(perms, 'users:create')).toBe(false);
    });

    it('should return false for empty permissions array', () => {
      expect(hasPermission([], 'learner:read')).toBe(false);
    });
  });

  describe('hasRole', () => {
    it('should return true if user has role', () => {
      const roles = [Role.LEARNER];
      expect(hasRole(roles, Role.LEARNER)).toBe(true);
    });

    it('should return false if user lacks role', () => {
      const roles = [Role.LEARNER];
      expect(hasRole(roles, Role.ADMIN)).toBe(false);
    });
  });

  describe('hasAnyRole', () => {
    it('should return true if user has any of the required roles', () => {
      const roles = [Role.LEARNER];
      expect(hasAnyRole(roles, [Role.ADMIN, Role.LEARNER])).toBe(true);
    });

    it('should return false if user has none of the required roles', () => {
      const roles = [Role.LEARNER];
      expect(hasAnyRole(roles, [Role.ADMIN])).toBe(false);
    });
  });

  describe('hasAllRoles', () => {
    it('should return true if user has all required roles', () => {
      const roles = [Role.ADMIN, Role.LEARNER];
      expect(hasAllRoles(roles, [Role.ADMIN, Role.LEARNER])).toBe(true);
    });

    it('should return false if user is missing any role', () => {
      const roles = [Role.LEARNER];
      expect(hasAllRoles(roles, [Role.ADMIN, Role.LEARNER])).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if user has any of the permissions', () => {
      const perms = ['learner:read', 'progress:view'];
      expect(
        hasAnyPermission(perms, ['users:create', 'learner:read'])
      ).toBe(true);
    });

    it('should return false if user has none of the permissions', () => {
      const perms = ['learner:read'];
      expect(hasAnyPermission(perms, ['users:create', 'users:write'])).toBe(
        false
      );
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true if user has all permissions', () => {
      const perms = ['learner:read', 'learner:write'];
      expect(
        hasAllPermissions(perms, ['learner:read', 'learner:write'])
      ).toBe(true);
    });

    it('should return false if user is missing any permission', () => {
      const perms = ['learner:read'];
      expect(
        hasAllPermissions(perms, ['learner:read', 'learner:write'])
      ).toBe(false);
    });
  });

  describe('requireRole', () => {
    it('should not throw if user has required role', () => {
      const context: AuthContext = {
        userId: 'user123',
        roles: [Role.ADMIN],
      };

      expect(() => requireRole(context, Role.ADMIN)).not.toThrow();
    });

    it('should throw ForbiddenError if user lacks role', () => {
      const context: AuthContext = {
        userId: 'user123',
        roles: [Role.LEARNER],
      };

      expect(() => requireRole(context, Role.ADMIN)).toThrow(ForbiddenError);
    });
  });

  describe('requirePermission', () => {
    it('should not throw if user has required permission', () => {
      const context: AuthContext = {
        userId: 'user123',
        roles: [Role.LEARNER],
        permissions: ['learner:read'],
      };

      expect(() => requirePermission(context, 'learner:read')).not.toThrow();
    });

    it('should throw ForbiddenError if user lacks permission', () => {
      const context: AuthContext = {
        userId: 'user123',
        roles: [Role.LEARNER],
        permissions: ['learner:read'],
      };

      expect(() => requirePermission(context, 'users:create')).toThrow(
        ForbiddenError
      );
    });

    it('should throw ForbiddenError if permissions is undefined', () => {
      const context: AuthContext = {
        userId: 'user123',
        roles: [Role.LEARNER],
      };

      expect(() => requirePermission(context, 'learner:read')).toThrow(
        ForbiddenError
      );
    });
  });

  describe('checkOrganizationIsolation', () => {
    it('should not throw if user is in same organization', () => {
      const context: AuthContext = {
        userId: 'user123',
        roles: [Role.LEARNER],
        organizationId: 'org123',
      };

      expect(() =>
        checkOrganizationIsolation(context, 'org123')
      ).not.toThrow();
    });

    it('should throw ForbiddenError for different organization', () => {
      const context: AuthContext = {
        userId: 'user123',
        roles: [Role.LEARNER],
        organizationId: 'org123',
      };

      expect(() =>
        checkOrganizationIsolation(context, 'org456')
      ).toThrow(ForbiddenError);
    });

    it('should throw UnauthorizedError if organizationId is missing', () => {
      const context: AuthContext = {
        userId: 'user123',
        roles: [Role.LEARNER],
      };

      expect(() =>
        checkOrganizationIsolation(context, 'org123')
      ).toThrow(UnauthorizedError);
    });
  });
});
