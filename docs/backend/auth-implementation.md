# Authentication & Authorization Implementation Guide

## Overview

This document provides implementation details for the authentication and authorization (auth RBAC) system in the CTOProjects backend. It covers OIDC integration, JWT validation, session management, RBAC enforcement, and audit logging.

## Table of Contents

1. [Configuration](#configuration)
2. [OIDC Integration](#oidc-integration)
3. [JWT Token Validation](#jwt-token-validation)
4. [Session Management](#session-management)
5. [RBAC Implementation](#rbac-implementation)
6. [Middleware](#middleware)
7. [Auth Endpoints](#auth-endpoints)
8. [Audit Logging](#audit-logging)
9. [Usage Examples](#usage-examples)
10. [Troubleshooting](#troubleshooting)

---

## Configuration

### Environment Variables

Configure authentication via the following environment variables in `.env`:

```bash
# OIDC Provider Configuration
OIDC_PROVIDER=auth0                           # 'auth0' or 'cognito'
OIDC_DOMAIN=your-tenant.auth0.com            # IdP domain
OIDC_CLIENT_ID=your-client-id                # Application client ID
OIDC_CLIENT_SECRET=your-client-secret        # Application client secret
OIDC_AUDIENCE=https://api.example.com        # API audience identifier
OIDC_JWKS_URI=https://your-tenant.auth0.com/.well-known/jwks.json

# JWT Configuration (for local development)
JWT_SECRET=your-secret-key-at-least-32-characters-long
JWT_EXPIRES_IN=24h

# Session Configuration
SESSION_TIMEOUT_MINUTES=30                    # Idle timeout
SESSION_ABSOLUTE_TIMEOUT_HOURS=24             # Maximum session duration

# Redis (required for session storage)
REDIS_URL=redis://localhost:6379
```

### Provider-Specific Setup

#### Auth0

1. Create an Auth0 tenant at https://auth0.com/signup
2. Create an API application in Auth0 dashboard
3. Configure JWT audience to match your API identifier
4. Get JWKS URI from: `https://{DOMAIN}/.well-known/jwks.json`

Example:
```bash
OIDC_PROVIDER=auth0
OIDC_DOMAIN=my-app.auth0.com
OIDC_CLIENT_ID=YOUR_CLIENT_ID
OIDC_CLIENT_SECRET=YOUR_CLIENT_SECRET
OIDC_AUDIENCE=https://api.myapp.com
OIDC_JWKS_URI=https://my-app.auth0.com/.well-known/jwks.json
```

#### Amazon Cognito

1. Create a user pool in AWS Cognito console
2. Create an app client in the user pool
3. Configure the app client with your redirect URIs
4. Get JWKS URI from: `https://cognito-idp.{REGION}.amazonaws.com/{USER_POOL_ID}/.well-known/jwks.json`

Example:
```bash
OIDC_PROVIDER=cognito
OIDC_DOMAIN=your-domain.auth.us-east-1.amazoncognito.com
OIDC_CLIENT_ID=YOUR_CLIENT_ID
OIDC_CLIENT_SECRET=YOUR_CLIENT_SECRET
OIDC_AUDIENCE=https://api.myapp.com
OIDC_JWKS_URI=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123/.well-known/jwks.json
```

---

## OIDC Integration

### OIDC Manager

The `OIDCManager` class handles all OIDC operations:

```typescript
import { getOIDCManager, initializeOIDC } from './lib/oidc';

// During server startup
const logger = createLogger(config);
await initializeOIDC(logger);

// Later in your code
const oidcManager = getOIDCManager(logger);

// Verify a token
const decoded = await oidcManager.verifyToken(accessToken);
console.log(decoded.sub); // User ID
console.log(decoded.role); // User role
```

### Token Verification

Tokens are verified against the OIDC provider's JWKS (JSON Web Key Set) if configured, or against the local JWT secret as a fallback:

```typescript
async verifyToken(token: string): Promise<DecodedToken> {
  // If OIDC configured, verify with provider's JWKS
  // Validates: signature, expiration, audience, issuer
  
  // Fallback: verify with local JWT_SECRET
  // Useful for development or service-to-service communication
}
```

### Token Structure

Expected JWT payload:

```json
{
  "sub": "user123",
  "email": "user@example.com",
  "email_verified": true,
  "given_name": "John",
  "family_name": "Doe",
  "role": "learner",
  "org_id": "org123",
  "permissions": ["learner:read", "learner:write"],
  "scope": "openid profile email api:read",
  "aud": "https://api.example.com",
  "iss": "https://idp.example.com/",
  "exp": 1234567890,
  "iat": 1234564290
}
```

---

## JWT Token Validation

### Validation Checklist

When a request comes in, the middleware performs these checks:

1. **Extract Bearer Token**: Parse `Authorization: Bearer {token}` header
2. **Verify Signature**: Validate JWT signature using OIDC provider's public key
3. **Check Expiration**: Ensure `exp` claim is in the future
4. **Verify Audience**: Check `aud` matches configured audience
5. **Verify Issuer**: Check `iss` matches OIDC provider domain
6. **Extract Claims**: Get user ID, roles, permissions, org ID

### Handling Expired Tokens

When tokens expire:

```typescript
// Client detects 401 response
// Client requests new token using refresh token
POST /oauth/token
{
  "grant_type": "refresh_token",
  "refresh_token": "REFRESH_TOKEN",
  "client_id": "YOUR_CLIENT_ID"
}

// Backend returns new access token
// Client retries original request with new token
```

### Certificate Rotation

OIDC providers rotate their signing certificates periodically. The JWKS client automatically:

1. Fetches public keys from JWKS URI
2. Caches keys with appropriate TTL
3. Re-fetches when a key is not found (automatic key rotation)

No manual intervention required.

---

## Session Management

### Session Store

Sessions are stored in Redis with automatic expiration:

```typescript
import { getSessionManager } from './lib/session';

const manager = getSessionManager(logger);

// Create session
const sessionId = await manager.createSession({
  userId: 'user123',
  email: 'user@example.com',
  roles: ['learner'],
  permissions: ['learner:read'],
  organizationId: 'org123',
  ipAddress: req.ip,
  userAgent: req.get('user-agent'),
});

// Retrieve session
const session = await manager.getSession(sessionId);
if (!session) {
  // Session expired or invalid
}

// Update activity (sliding window)
await manager.updateSessionActivity(sessionId);

// Destroy session
await manager.destroySession(sessionId);
```

### Timeout & Sliding Window

- **Idle Timeout**: 30 minutes (configurable via `SESSION_TIMEOUT_MINUTES`)
- **Absolute Timeout**: 24 hours (configurable via `SESSION_ABSOLUTE_TIMEOUT_HOURS`)
- **Sliding Window**: Each activity extends idle timeout by 30 minutes
- **Warning Threshold**: Warning sent when 5 minutes remain until idle timeout

Session data stored in Redis:

```json
{
  "userId": "user123",
  "email": "user@example.com",
  "roles": ["learner"],
  "permissions": ["learner:read"],
  "organizationId": "org123",
  "createdAt": 1705254600000,
  "lastActivity": 1705254900000,
  "expiresAt": 1705256700000,
  "absoluteExpiresAt": 1705341000000,
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

### Session Invalidation Events

Sessions are immediately invalidated when:

1. User logs out
2. User password is changed
3. User role is changed
4. Absolute timeout reached
5. Admin revokes session
6. Security policy violation detected

```typescript
// Invalidate all sessions for a user (e.g., after password change)
await manager.invalidateUserSessions(userId);

// Update user roles in active sessions
const session = await manager.updateSessionRoles(sessionId, newRoles, newPermissions);
```

---

## RBAC Implementation

### Roles

Two built-in roles:

#### Learner
- View own profile and course data
- Submit assignments
- View own progress
- Edit own profile

#### Admin
- Manage users (create, read, update, delete)
- Manage courses and content
- Assign and revoke roles
- View audit logs
- Reset user MFA
- Modify system settings

### Permissions

Permissions are fine-grained and tied to roles:

```typescript
import { PERMISSIONS, Role, getDefaultPermissionsForRole } from './lib/rbac';

// Get all permissions for a role
const learnerPerms = getDefaultPermissionsForRole(Role.LEARNER);
const adminPerms = getDefaultPermissionsForRole(Role.ADMIN);

// Check individual permissions
const hasReadPermission = userPermissions.includes('learner:read');
const hasAdminAccess = userRoles.includes(Role.ADMIN);
```

### Authorization Checks

In route handlers:

```typescript
import { requireRole, requirePermission, checkOrganizationIsolation } from './lib/rbac';

router.get('/admin/dashboard', (req, res) => {
  // Check role
  requireRole(req.authContext, Role.ADMIN);
  
  // Check permission
  requirePermission(req.authContext, 'audit:read');
  
  // Check organization isolation
  checkOrganizationIsolation(req.authContext, resourceOrgId);
  
  res.json({ data: 'admin data' });
});
```

### Permission Helpers

```typescript
// Check single role
hasRole(userRoles, Role.ADMIN);

// Check any of multiple roles
hasAnyRole(userRoles, [Role.ADMIN, Role.LEARNER]);

// Check all roles
hasAllRoles(userRoles, [Role.ADMIN, Role.LEARNER]);

// Check single permission
hasPermission(userPerms, 'users:read');

// Check any of multiple permissions
hasAnyPermission(userPerms, ['users:read', 'users:write']);

// Check all permissions
hasAllPermissions(userPerms, ['users:read', 'users:write']);
```

---

## Middleware

### Auth Middleware

Apply to protected routes:

```typescript
import { createAuthMiddleware, createRoleMiddleware, createPermissionMiddleware } from './middleware/auth';

// JWT token-based authentication
router.get('/protected', createAuthMiddleware(logger), (req, res) => {
  const userId = req.authContext?.userId;
  res.json({ user: userId });
});

// Role-based access control
router.delete('/admin/users/:id', 
  createAuthMiddleware(logger),
  createRoleMiddleware([Role.ADMIN]),
  (req, res) => {
    // Only admins can access
  }
);

// Permission-based access control
router.post('/audit/logs',
  createAuthMiddleware(logger),
  createPermissionMiddleware(['audit:read']),
  (req, res) => {
    // Only users with audit:read permission
  }
);
```

### Auth Context

Once authenticated, `req.authContext` contains:

```typescript
interface AuthContext {
  userId: string;
  email?: string;
  roles: string[];
  permissions?: string[];
  organizationId?: string;
  sessionId?: string;
}
```

---

## Auth Endpoints

### POST /api/v1/auth/token

Exchange OIDC authorization code for tokens.

**Request:**
```json
{
  "code": "AUTH_CODE",
  "redirectUri": "https://app.example.com/callback"
}
```

**Response:**
```json
{
  "access_token": "JWT_ACCESS_TOKEN",
  "id_token": "JWT_ID_TOKEN",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### POST /api/v1/auth/session

Create a session from a valid JWT token.

**Request:**
```
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "sessionId": "uuid",
  "user": {
    "id": "user123",
    "email": "user@example.com",
    "roles": ["learner"],
    "organizationId": "org123"
  }
}
```

### GET /api/v1/auth/me

Get current authenticated user information.

**Request:**
```
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "user": {
    "id": "user123",
    "email": "user@example.com",
    "roles": ["learner"],
    "permissions": ["learner:read"],
    "organizationId": "org123"
  }
}
```

### POST /api/v1/auth/logout

Logout and destroy session.

**Request:**
```
Authorization: Bearer {accessToken}
X-Session-ID: {sessionId}
```

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

### POST /api/v1/auth/token/introspect

Introspect token (check if valid).

**Request:**
```json
{
  "token": "JWT_TOKEN"
}
```

**Response (Active):**
```json
{
  "active": true,
  "sub": "user123",
  "email": "user@example.com",
  "exp": 1234567890,
  "role": "learner",
  "permissions": ["learner:read"]
}
```

**Response (Inactive):**
```json
{
  "active": false,
  "reason": "Token expired"
}
```

### POST /api/v1/auth/refresh-session

Refresh session activity (extend timeout).

**Request:**
```
Authorization: Bearer {accessToken}
X-Session-ID: {sessionId}
```

**Response:**
```json
{
  "sessionId": "uuid",
  "expiresAt": 1705256700000,
  "absoluteExpiresAt": 1705341000000
}
```

### POST /api/v1/auth/webhooks/oidc

Webhook for OIDC provider events.

**Request:**
```json
{
  "event": "user.role.changed",
  "userId": "user123",
  "changes": {
    "oldRoles": ["learner"],
    "newRoles": ["admin"]
  }
}
```

**Supported Events:**
- `user.role.changed` - Invalidates all user sessions
- `user.password.changed` - Invalidates all user sessions

---

## Audit Logging

### Audit Events

The system logs the following events:

```typescript
enum AuditEventType {
  LOGIN = 'login',
  LOGOUT = 'logout',
  ROLE_ASSIGNMENT = 'role_assignment',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  FORBIDDEN_ACCESS = 'forbidden_access',
  DATA_ACCESS = 'data_access',
  RESOURCE_CREATED = 'resource_created',
  RESOURCE_UPDATED = 'resource_updated',
  RESOURCE_DELETED = 'resource_deleted',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
}
```

### Logging Audit Events

```typescript
import { getAuditLogger } from './lib/audit';

const auditLogger = getAuditLogger(logger);

// Log login
await auditLogger.logLogin(
  userId,
  email,
  ipAddress,
  userAgent,
  organizationId
);

// Log role assignment
await auditLogger.logRoleAssignment(
  userId,
  adminId,
  oldRoles,
  newRoles,
  'Promoted to admin',
  organizationId
);

// Log unauthorized access
await auditLogger.logUnauthorizedAccess(
  userId,
  'user_profile',
  'user456',
  ipAddress,
  userAgent,
  organizationId
);

// Log data access
await auditLogger.logDataAccess(
  userId,
  'course',
  'course123',
  'read',
  organizationId
);
```

### Audit Log Entry

```json
{
  "id": "audit_log_id",
  "eventType": "login",
  "userId": "user123",
  "userEmail": "user@example.com",
  "action": "User logged in",
  "resourceType": null,
  "resourceId": null,
  "result": "success",
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "organizationId": "org123",
  "timestamp": 1705254900000
}
```

---

## Usage Examples

### Example 1: Create Protected API Endpoint

```typescript
router.get('/api/v1/learner/dashboard',
  createAuthMiddleware(logger),
  createAsyncAuthHandler(async (req, res) => {
    const userId = req.authContext!.userId;
    
    // User is authenticated, verify they can access their own data
    checkOrganizationIsolation(req.authContext!, req.authContext!.organizationId!);
    
    // Fetch user's dashboard data
    const dashboard = await fetchDashboard(userId);
    
    res.json({ dashboard });
  })
);
```

### Example 2: Admin-Only Endpoint

```typescript
router.post('/api/v1/admin/users',
  createAuthMiddleware(logger),
  createRoleMiddleware([Role.ADMIN]),
  createAsyncAuthHandler(async (req, res) => {
    const adminId = req.authContext!.userId;
    
    // Create new user
    const user = await createUser(req.body);
    
    // Log the action
    await auditLogger.logResourceCreated(
      adminId,
      'user',
      user.id,
      { email: user.email },
      req.authContext!.organizationId
    );
    
    res.status(201).json({ user });
  })
);
```

### Example 3: Permission-Based Access

```typescript
router.get('/api/v1/admin/audit-logs',
  createAuthMiddleware(logger),
  createPermissionMiddleware(['audit:read']),
  createAsyncAuthHandler(async (req, res) => {
    const logs = await fetchAuditLogs(req.authContext!.organizationId);
    res.json({ logs });
  })
);
```

### Example 4: Frontend Token Exchange

```typescript
// Frontend code
async function login(code, redirectUri) {
  // Exchange auth code for access token
  const tokenResponse = await fetch('/api/v1/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri })
  });
  
  const { access_token, id_token } = await tokenResponse.json();
  
  // Create session
  const sessionResponse = await fetch('/api/v1/auth/session', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const { sessionId, user } = await sessionResponse.json();
  
  // Store tokens and session
  sessionStorage.setItem('access_token', access_token);
  localStorage.setItem('id_token', id_token);
  localStorage.setItem('user', JSON.stringify(user));
  
  // Store session ID in secure cookie (set by server)
  // Use session ID for subsequent requests
}
```

---

## Troubleshooting

### Token Verification Fails

**Problem**: "Invalid or expired token"

**Solutions**:
1. Check token expiration: `exp` claim should be in the future
2. Verify audience: `aud` should match `OIDC_AUDIENCE`
3. Verify issuer: `iss` should match OIDC provider domain
4. Check signature: Ensure JWT_SECRET or OIDC_JWKS_URI is correctly configured

### Session Expires Too Quickly

**Problem**: Session timeout after a few minutes

**Solutions**:
1. Check `SESSION_TIMEOUT_MINUTES` - default is 30
2. Ensure Redis is connected and operational
3. Verify session activity is being updated on each request
4. Check Redis memory - may be evicting sessions

### OIDC Connection Fails

**Problem**: "Failed to initialize OIDC JWKS"

**Solutions**:
1. Verify `OIDC_PROVIDER` is set to 'auth0' or 'cognito'
2. Check `OIDC_JWKS_URI` is valid and accessible
3. Verify network connectivity to OIDC provider
4. Check firewall rules allow HTTPS outbound
5. Verify certificate chain (if behind proxy)

### Unauthorized Access on Protected Routes

**Problem**: Getting 401 on protected routes with valid token

**Solutions**:
1. Verify `Authorization` header is present
2. Check header format: `Authorization: Bearer {token}`
3. Verify token is valid (use `/token/introspect`)
4. Check token expiration
5. Verify OIDC configuration if using OIDC provider

### Forbidden Access on Admin Routes

**Problem**: Getting 403 "Forbidden" on admin routes

**Solutions**:
1. Check user role: `GET /me` to see current roles
2. Verify role is in token: should include admin role in `role` claim
3. Check RBAC configuration in auth provider
4. Verify middleware is applied: `createRoleMiddleware([Role.ADMIN])`

### Redis Connection Issues

**Problem**: "Redis client not connected" error

**Solutions**:
1. Verify Redis is running: `redis-cli ping`
2. Check `REDIS_URL` is correct
3. Verify Redis credentials if using password authentication
4. Check firewall rules for Redis port (default 6379)
5. Verify Redis is accessible from application server

---

## Best Practices

1. **Always use HTTPS** in production - tokens expose user information
2. **Store tokens securely**:
   - Access tokens in memory (SPA) or secure cookies
   - Refresh tokens in HttpOnly secure cookies
3. **Implement token rotation** - refresh tokens before expiration
4. **Monitor audit logs** for suspicious activity patterns
5. **Rotate OIDC credentials regularly** - especially client secrets
6. **Use organization isolation** to prevent cross-tenant data leaks
7. **Implement rate limiting** on token endpoints to prevent brute force
8. **Log all authentication events** for compliance and security
9. **Keep JWKS cache reasonable** - don't cache too long (default 1 day)
10. **Test certificate rotation** - ensure smooth transition when keys rotate

