# Authentication & Authorization Model

## Table of Contents

1. [Overview](#overview)
2. [Identity Provider Architecture](#identity-provider-architecture)
3. [Authentication Flows](#authentication-flows)
4. [Token Lifecycle & Management](#token-lifecycle--management)
5. [Session Management](#session-management)
6. [Multi-Factor Authentication (MFA)](#multi-factor-authentication-mfa)
7. [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
8. [Data Access Constraints](#data-access-constraints)
9. [Onboarding & User Provisioning](#onboarding--user-provisioning)
10. [Passwordless Authentication](#passwordless-authentication)
11. [Compliance & Security](#compliance--security)
12. [Secrets Management](#secrets-management)

---

## Overview

This document defines the end-to-end identity and access management strategy for CTOProjects. The authentication and authorization model is built on industry-standard protocols (OAuth 2.0 and OpenID Connect) through a third-party identity provider, enabling secure, scalable, and compliant user management.

### Key Principles

- **Centralized Identity Management**: Single source of truth for user identity and authentication
- **Zero Trust Architecture**: Every request is authenticated and authorized
- **Principle of Least Privilege**: Users have minimal permissions required for their role
- **Compliance-First**: Support for FERPA, GDPR, and other regulatory requirements
- **Developer-Friendly**: Clear, consistent APIs and SDKs for frontend and backend teams

---

## Identity Provider Architecture

### Supported Providers

The system supports two primary identity providers:

#### 1. Auth0
- **Use Case**: General-purpose applications with flexible customization needs
- **Advantages**: Extensive customization, rich identity provider ecosystem, strong rules engine
- **Configuration**: Tenant-based approach with custom domain
- **Compliance**: Native GDPR, SOC 2, and HIPAA support

#### 2. Amazon Cognito
- **Use Case**: AWS-native deployments with simplified administration
- **Advantages**: Integrated with AWS ecosystem, cost-effective at scale, simplified IAM integration
- **Configuration**: User pool per environment with app clients
- **Compliance**: HIPAA-eligible, SOC 2 Type II compliant

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        User                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        v                             v
   ┌────────────┐            ┌──────────────┐
   │  Frontend  │            │  Mobile App  │
   │   (React)  │            │  (Native)    │
   └──────┬─────┘            └──────┬───────┘
          │                         │
          └──────────────┬──────────┘
                         │
                    ┌────v────────┐
                    │ Auth Gateway │
                    │ (Redirects)  │
                    └────┬────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
          v                             v
    ┌──────────────┐          ┌──────────────┐
    │   Auth0      │          │   Cognito    │
    │   Tenant     │          │  User Pool   │
    └──────┬───────┘          └──────┬───────┘
           │                         │
           └──────────────┬──────────┘
                          │
                   ┌──────v───────┐
                   │ Auth Tokens  │
                   │ (JWT)        │
                   └──────┬───────┘
                          │
                   ┌──────v────────────┐
                   │  Backend APIs     │
                   │  (Token Validation)
                   └───────────────────┘
```

---

## Authentication Flows

### 1. Authorization Code Flow with PKCE (Recommended)

**Use Case**: Web and mobile applications

**Flow Sequence**:

```
1. User clicks "Login" in frontend
2. Frontend generates:
   - code_challenge (SHA256(code_verifier))
   - state (random nonce)
3. Frontend redirects to:
   https://idp.example.com/authorize?
     response_type=code&
     client_id=YOUR_CLIENT_ID&
     redirect_uri=https://app.example.com/callback&
     scope=openid%20profile%20email&
     code_challenge=XXXXX&
     code_challenge_method=S256&
     state=YYYYY
4. User authenticates (credentials, SSO, MFA)
5. IDP redirects to:
   https://app.example.com/callback?code=AUTH_CODE&state=YYYYY
6. Frontend validates state parameter
7. Frontend exchanges code for tokens:
   POST /oauth/token
   {
     "grant_type": "authorization_code",
     "code": "AUTH_CODE",
     "client_id": "YOUR_CLIENT_ID",
     "code_verifier": "original_code_verifier",
     "redirect_uri": "https://app.example.com/callback"
   }
8. IDP returns:
   {
     "access_token": "JWT_ACCESS_TOKEN",
     "id_token": "JWT_ID_TOKEN",
     "refresh_token": "REFRESH_TOKEN",
     "expires_in": 3600,
     "token_type": "Bearer"
   }
```

**Security Considerations**:
- PKCE prevents authorization code interception attacks
- State parameter prevents CSRF attacks
- Tokens are never exposed to the browser address bar
- Refresh tokens are stored securely (HttpOnly cookies or secure storage)

### 2. Implicit Flow (Legacy - Discouraged)

**Status**: Deprecated for new implementations

**Reason**: Exposes tokens directly in URL fragment; vulnerable to XSS attacks

### 3. Client Credentials Flow

**Use Case**: Service-to-service authentication

**Flow Sequence**:

```
1. Backend service authenticates with:
   POST /oauth/token
   {
     "grant_type": "client_credentials",
     "client_id": "SERVICE_CLIENT_ID",
     "client_secret": "SERVICE_CLIENT_SECRET",
     "scope": "api:admin"
   }
2. IDP returns access token
3. Service uses token for API calls
   Authorization: Bearer ACCESS_TOKEN
```

**Use Cases**:
- Background jobs and scheduled tasks
- Service-to-service communication
- Admin operations
- Data synchronization

### 4. Device Authorization Flow

**Use Case**: Devices without traditional web browsers

**Flow Sequence**:

```
1. Device requests device code:
   POST /oauth/device
   {
     "client_id": "DEVICE_CLIENT_ID"
   }
2. IDP returns:
   {
     "device_code": "DEVICE_CODE",
     "user_code": "USER_CODE",
     "verification_uri": "https://idp.example.com/device",
     "expires_in": 1800,
     "interval": 5
   }
3. Device displays user code and verification URI
4. User visits verification_uri and enters user_code
5. User authenticates and approves
6. Device polls for token completion (every 'interval' seconds)
   POST /oauth/token
   {
     "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
     "device_code": "DEVICE_CODE",
     "client_id": "DEVICE_CLIENT_ID"
   }
7. After approval, token is returned
```

---

## Token Lifecycle & Management

### JWT Token Structure

All tokens are JSON Web Tokens (JWT) with three parts: header.payload.signature

**Access Token Payload Example**:

```json
{
  "iss": "https://idp.example.com/",
  "sub": "user123",
  "aud": "api:backend",
  "exp": 1234567890,
  "iat": 1234564290,
  "auth_time": 1234560000,
  "client_id": "frontend_app",
  "scope": "openid profile email api:read api:write",
  "permissions": ["learner:read", "learner:write"],
  "role": "learner",
  "org_id": "org123"
}
```

**ID Token Payload Example**:

```json
{
  "iss": "https://idp.example.com/",
  "sub": "user123",
  "aud": "frontend_app",
  "exp": 1234567890,
  "iat": 1234564290,
  "auth_time": 1234560000,
  "nonce": "nonce_value",
  "email": "user@example.com",
  "email_verified": true,
  "given_name": "John",
  "family_name": "Doe",
  "picture": "https://example.com/avatar.jpg",
  "role": "learner",
  "org_id": "org123"
}
```

### Token Expiration Times

| Token Type       | Expiration | Purpose                          | Refresh Policy              |
|------------------|------------|----------------------------------|-----------------------------|
| Access Token     | 1 hour     | API requests, resource access    | Can be refreshed             |
| ID Token         | 1 hour     | Authentication proof, user info  | Refresh with access token   |
| Refresh Token    | 30 days    | Obtaining new access tokens      | Can be revoked, rotation rec. |
| Session Cookie   | 24 hours   | Web session persistence          | Sliding window expiration    |

### Token Refresh Flow

**When Access Token Expires**:

```
1. Frontend/Backend detects 401 response or token expiration
2. Request new tokens using refresh token:
   POST /oauth/token
   {
     "grant_type": "refresh_token",
     "refresh_token": "REFRESH_TOKEN",
     "client_id": "YOUR_CLIENT_ID"
   }
3. IDP validates refresh token and returns new tokens
4. Application updates local token storage
5. Retry original request with new access token
```

### Token Validation

**Backend API Token Validation Checklist**:

```
1. Verify JWT signature with IDP's public key
2. Check token expiration (exp claim)
3. Verify audience (aud claim) matches service
4. Verify issuer (iss claim) matches IDP domain
5. Extract and validate user permissions from token
6. Check for token revocation in distributed cache
7. Validate scope for requested resource
```

### Token Revocation

**Types of Token Revocation**:

1. **Manual Logout**: User explicitly logs out
   ```
   POST /oauth/revoke
   {
     "token": "REFRESH_TOKEN",
     "token_type_hint": "refresh_token"
   }
   ```

2. **Password Change**: All existing tokens invalidated
3. **Security Incident**: Immediate revocation of all user tokens
4. **Admin Action**: Revoke specific user sessions

---

## Session Management

### Web Application Sessions

**Session Architecture**:

```
Frontend                           Backend
─────────────────────────────────────────
User Login
│
├─ Authorization Code Flow
│  └─ Receive Tokens (JWT)
│
├─ Store Access Token
│  ├─ In-Memory Cache (SPA)
│  └─ IndexedDB (for page refresh)
│
├─ Store Refresh Token
│  └─ HttpOnly Secure Cookie (XSS protection)
│
└─ Session Created
   └─ Include Session ID in Cookie
      (Separate from refresh token)
```

### Session Persistence

**SPA (Single Page Application)**:

```javascript
// After successful authentication
sessionStorage.set('access_token', accessToken);    // Short-lived
localStorage.set('user_profile', userProfile);      // Basic info
// Refresh token in HttpOnly cookie (set by server)
```

**Server-Side Session**:

```
Session ID → Redis/Cache
├─ user_id
├─ role
├─ permissions
├─ organization_id
├─ created_at
├─ last_activity
└─ expiration_time
```

### Session Timeout & Sliding Window

- **Idle Timeout**: 30 minutes of inactivity
- **Absolute Timeout**: 24 hours maximum session duration
- **Sliding Window**: Each activity extends session by 30 minutes
- **Inactivity Warning**: Show warning at 25 minutes, option to extend

### Session Invalidation Events

Sessions are immediately invalidated when:
- User logs out
- User password is changed
- User role is changed
- Security policy violation detected
- Admin revokes session
- Device is marked as compromised

---

## Multi-Factor Authentication (MFA)

### Supported MFA Methods

#### 1. Time-Based One-Time Password (TOTP)
- **Implementation**: Google Authenticator, Authy, Microsoft Authenticator
- **Backend**: HMAC-SHA1 based (RFC 6238)
- **Recovery Codes**: 10 backup codes generated on setup
- **Re-enrollment**: Can re-authenticate with recovery code

#### 2. Email OTP
- **Delivery**: 6-digit code sent to registered email
- **Validity**: 10 minutes
- **Rate Limiting**: Maximum 3 attempts, then 30-minute lockout
- **Use Case**: Primary method for passwordless

#### 3. SMS OTP
- **Delivery**: 6-digit code via SMS
- **Validity**: 10 minutes
- **Cost**: Higher cost, use cautiously
- **Use Case**: Backup method, high-security scenarios

#### 4. Push Notifications
- **Mechanism**: Push to registered device with approval prompt
- **User Experience**: One-tap approval
- **Devices**: Mobile devices with app installed
- **Fallback**: If device is unavailable, use backup codes

#### 5. Biometric Authentication
- **Face Recognition**: Face ID (iOS)
- **Fingerprint**: Touch ID (iOS), fingerprint (Android)
- **Platform**: Device-native, not supported universally

### MFA Enrollment Flow

```
User Dashboard → Security Settings → Enable MFA
│
├─ Select Method (TOTP/Email/SMS/Push)
│
├─ Setup Phase:
│  ├─ Display setup instructions
│  ├─ Generate QR code (for TOTP)
│  ├─ Display recovery codes (important!)
│  └─ User scans/verifies setup
│
├─ Verification Phase:
│  ├─ User enters verification code
│  ├─ Backend validates code
│  └─ Record MFA as enabled
│
└─ Complete: Send confirmation email
```

### MFA During Authentication

```
1. User provides email/username
2. Backend verifies credentials
3. If MFA enabled:
   ├─ Send MFA challenge
   ├─ Display MFA options
   └─ Wait for MFA response
4. User completes MFA challenge
5. If successful:
   └─ Issue authentication tokens
6. If failed (3 attempts):
   └─ Lock account for 30 minutes
```

### MFA Recovery

**Recovery Codes**:
- 10 one-time use codes generated on MFA enrollment
- Stored securely hashed on backend
- Each code can only be used once
- User prompted to generate new codes after use

**Account Recovery**:
- Requires email verification if all MFA methods unavailable
- Admin can reset MFA after identity verification
- User must re-enroll after MFA reset

---

## Role-Based Access Control (RBAC)

### Role Definitions

#### 1. Learner Role

**Permissions**:
- `learner:read` - View own profile and course data
- `learner:write` - Update own profile, submit assignments
- `course:view` - View enrolled courses
- `course:submit` - Submit assignments and projects
- `progress:view` - View own learning progress
- `profile:edit` - Edit own profile information

**Data Access**:
- Own user profile
- Own course enrollments
- Own submissions and grades
- Public course content

**Restrictions**:
- Cannot view other learner data
- Cannot modify course content
- Cannot create or manage users
- Cannot access admin dashboards

#### 2. Admin Role

**Permissions**:
- `admin:*` - All administrative permissions
- `users:create` - Create new user accounts
- `users:read` - View user profiles and accounts
- `users:write` - Modify user information
- `users:delete` - Delete user accounts (soft delete)
- `users:reset-password` - Reset user passwords
- `courses:manage` - Create, edit, delete courses
- `roles:manage` - Assign and revoke roles
- `mfa:reset` - Reset user MFA settings
- `audit:read` - View audit logs
- `system:config` - Modify system settings

**Data Access**:
- All user data (with audit logging)
- All course and content data
- All submission data
- System configuration

**Audit Trail**:
- All actions logged with timestamp, user, and details
- Cannot be modified or deleted

### RBAC Data Model

```json
{
  "user": {
    "id": "user123",
    "email": "user@example.com",
    "roles": ["learner"],
    "organization_id": "org123"
  },
  "role_assignment": {
    "user_id": "user123",
    "role": "learner",
    "assigned_at": "2024-01-01T00:00:00Z",
    "assigned_by": "admin_user",
    "scope": "org123"
  },
  "permissions": [
    {
      "id": "learner:read",
      "role": "learner",
      "description": "Read own learner data",
      "resource": "learner",
      "action": "read"
    }
  ]
}
```

### Role Assignment

**By Admin**:
```
PATCH /api/users/{userId}/roles
{
  "roles": ["learner", "admin"],
  "reason": "Promoted to admin"
}
```

**Audit Log Entry**:
```json
{
  "event_type": "role_assignment",
  "user_id": "user123",
  "admin_id": "admin456",
  "old_roles": ["learner"],
  "new_roles": ["learner", "admin"],
  "reason": "Promoted to admin",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Checking Permissions

**In Backend Code**:

```
1. Extract user from token context
2. Load user roles from token or cache
3. Check required permission in token claim
4. If permission not in token:
   a. Load from database (if cache stale)
   b. Re-validate against resource
5. Return 403 Forbidden if permission denied
```

**In Frontend Code**:

```
1. Extract permissions from ID token
2. Check permission before rendering UI element
3. Use for feature flags and UI visibility
4. Never rely solely on frontend checks
5. Always validate on backend before action
```

---

## Data Access Constraints

### Principle of Least Privilege

Every user is granted the minimum permissions necessary for their role.

### Organization-Level Isolation

```
Organization A          Organization B
├─ Learner A1          ├─ Learner B1
├─ Learner A2          ├─ Learner B2
├─ Courses A1-A5       └─ Courses B1-B3
└─ Admin A1            └─ Admin B1

Constraint: Learner A1 cannot access Organization B data
```

### Resource-Level Access Control

**Example: Course Viewing**

```
GET /api/courses/course123
├─ If public course:
│  └─ All authenticated users can view
│
├─ If org-restricted course:
│  └─ Only users in organization can view
│
├─ If private course:
│  └─ Only enrolled users can view
│
└─ If admin course:
   └─ Only admins can view
```

**Example: User Profile Viewing**

```
GET /api/users/{userId}/profile
├─ If requesting own profile:
│  └─ Allow (user:read:self)
│
├─ If requesting other learner:
│  └─ Allow if:
│     ├─ Requester is admin
│     ├─ OR in same learning group
│     └─ OR permission:user:read granted
│
└─ Else:
   └─ Return 403 Forbidden
```

### Audit Logging for Data Access

All access to sensitive data is logged:

```json
{
  "event_type": "data_access",
  "user_id": "user123",
  "resource_type": "user_profile",
  "resource_id": "user456",
  "action": "read",
  "result": "success",
  "timestamp": "2024-01-15T10:30:00Z",
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0..."
}
```

### Encryption at Rest

- All personally identifiable information (PII) encrypted at rest
- Keys managed by external key management service (KMS)
- Encryption key rotation every 90 days
- Learner can request data deletion (right to be forgotten)

---

## Onboarding & User Provisioning

### New User Registration

#### Step 1: Registration Form

```
POST /api/auth/register
{
  "email": "newuser@example.com",
  "given_name": "John",
  "family_name": "Doe",
  "organization_id": "org123"
}
```

#### Step 2: Email Verification

```
1. Registration email sent with verification link
2. Link includes token valid for 24 hours
3. User clicks link or enters code
4. Email verified, user account activated
5. User can now set password or use passwordless
```

#### Step 3: Profile Completion

```
1. User directed to profile setup
2. Optional fields:
   - Phone number
   - Profile picture
   - Bio/Description
   - Preferences
3. Can be skipped, completed later
```

#### Step 4: First MFA Setup (Optional)

```
If organization policy requires:
1. Prompt MFA setup
2. Allow skip with warning
3. Can be enforced at next login
```

### User Provisioning via SAML/SCIM

**Enterprise SSO Flows**:

#### SAML 2.0 Integration
```
Enterprise System → Auth Provider → CTOProjects
├─ SAML IdP metadata shared
├─ Assertion endpoints configured
├─ Automatic user creation on first login
└─ Attributes mapped (email, name, groups)
```

#### SCIM 2.0 API (System for Cross-domain Identity Management)
```
POST /scim/v2/Users
{
  "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
  "userName": "john.doe@example.com",
  "name": {
    "givenName": "John",
    "familyName": "Doe"
  },
  "emails": [{"value": "john.doe@example.com"}],
  "groups": ["learners", "course_cohort_1"]
}
```

**Advantages**:
- Automatic user sync from enterprise directory
- Automated role/group assignment
- Removes manual provisioning overhead
- Deprovisioning when user leaves organization

### Bulk User Import

**CSV Import Format**:

```csv
email,given_name,family_name,role,organization_id
john@example.com,John,Doe,learner,org123
jane@example.com,Jane,Smith,admin,org123
```

**API Endpoint**:

```
POST /api/admin/users/bulk-import
Content-Type: multipart/form-data
File: users.csv

Response:
{
  "total": 2,
  "successful": 2,
  "failed": 0,
  "errors": []
}
```

---

## Passwordless Authentication

### Email Link Authentication

**Flow**:

```
1. User enters email on login page
2. Backend sends magic link:
   https://app.example.com/auth/magic-link?token=XXXXX
3. Link valid for 15 minutes
4. User clicks link, automatically logged in
5. Token used once and expires
```

**Backend Implementation**:

```json
{
  "POST": "/api/auth/passwordless/email",
  "body": {
    "email": "user@example.com"
  },
  "response": {
    "success": true,
    "message": "Check your email for login link"
  }
}
```

### Email OTP (One-Time Password)

**Flow**:

```
1. User enters email
2. 6-digit code sent to email (valid 10 minutes)
3. User enters code in app
4. Backend validates and issues tokens
5. Code automatically invalidated after use
```

**API**:

```
POST /api/auth/passwordless/otp/send
{
  "email": "user@example.com"
}

POST /api/auth/passwordless/otp/verify
{
  "email": "user@example.com",
  "code": "123456"
}
```

### Phone Number Authentication

**For Mobile Devices**:

```
1. User enters phone number
2. SMS OTP sent (6-digit, 10 minutes)
3. User enters in app
4. Tokens issued on verification
5. Can be configured as secondary auth
```

### Social Login

**Supported Providers**:

- Google OAuth 2.0
- Microsoft Azure AD
- GitHub OAuth
- Apple Sign In (for iOS)
- LinkedIn (for enterprise)

**Benefits**:
- Reduced password fatigue
- Existing account credentials
- User attributes pre-populated
- No password to forget/reset

**Flow**:

```
1. User clicks "Sign in with Google"
2. Redirected to Google OAuth consent
3. User authorizes scope
4. Redirected back with auth code
5. Backend exchanges for tokens
6. User created/updated in system
7. Session established
```

---

## Compliance & Security

### FERPA Compliance (Family Educational Rights and Privacy Act)

**Requirements**:

1. **User Consent**: 
   - Explicit consent required for data sharing
   - Consent records maintained with timestamps
   - Easy withdrawal of consent

2. **Data Access Logging**:
   - All access to student records logged
   - Logs immutable and retained for 3 years
   - Reports available to audit teams

3. **Data Retention**:
   - Student records retained per institutional policy
   - Deletion capabilities for terminated students
   - Archival of records at end of program

4. **Third-Party Access**:
   - Agreements with all data processors
   - Data use limitations documented
   - Regular audits of third parties

### GDPR Compliance (General Data Protection Regulation)

**Core Principles**:

1. **Lawful Basis**:
   - Explicit consent required for data processing
   - Service contract covers necessary processing
   - Legitimate interest documented

2. **Data Subject Rights**:

   ```
   • Right of Access:
     GET /api/users/{userId}/data-export
     → Full user data in machine-readable format
   
   • Right to Rectification:
     PATCH /api/users/{userId}/profile
     → Update incorrect information
   
   • Right to be Forgotten:
     DELETE /api/users/{userId}
     → Data deletion (with exceptions for legal holds)
   
   • Right to Data Portability:
     GET /api/users/{userId}/data-export?format=json
     → Export in common format
   
   • Right to Restrict Processing:
     PUT /api/users/{userId}/privacy-preferences
     {
       "restrict_processing": true
     }
     → Restrict use of data
   ```

3. **Data Protection Impact Assessment (DPIA)**:
   - Completed for any high-risk processing
   - Regular review and updates
   - Documented and available for inspection

4. **Data Breach Notification**:
   - Notification within 72 hours to authorities
   - User notification via email
   - Documentation of breach and response

5. **Data Processing Agreement (DPA)**:
   - Signed with all processors (vendors)
   - Defines scope, duration, nature of processing
   - Standard clauses for international transfers

### SOC 2 Type II Compliance

**Security Controls**:

1. **Access Controls**:
   - MFA enforcement for all users
   - Regular access reviews
   - Principle of least privilege

2. **Change Management**:
   - All code changes reviewed and tested
   - Deployment audit trail
   - Rollback procedures

3. **Network Security**:
   - All communication over TLS 1.2+
   - IP whitelisting for admin access
   - DDoS protection

4. **Monitoring**:
   - Real-time security monitoring
   - Incident response procedures
   - Regular security audits (quarterly)

### HIPAA Compliance (if handling health information)

**Requirements**:

1. **Business Associate Agreements (BAAs)**:
   - Signed with all vendors
   - Defines handling of PHI (Protected Health Information)

2. **Access Controls**:
   - Unique user IDs for all PHI access
   - Emergency access procedures
   - Termination procedures (immediate access removal)

3. **Audit Controls**:
   - Comprehensive audit logging
   - Review and analysis procedures
   - Reports available for audits

4. **Encryption**:
   - Encryption in transit (TLS)
   - Encryption at rest (AES-256)
   - Secure key management

---

## Secrets Management

### Secret Types and Storage

#### 1. API Keys & Client Secrets

**Storage Locations**:

```
Development:
└─ .env file (local, never committed)

Staging/Production:
└─ Secrets Manager (AWS Secrets Manager / Azure Key Vault)
   ├─ Encrypted at rest
   ├─ Access logged
   ├─ Automatic rotation
   └─ Version history
```

#### 2. OAuth/OIDC Configuration

**Client ID**: Can be public (embedded in apps)

**Client Secret**: Must be protected
```
Storage:
├─ Backend only (server-side)
├─ Never exposed to frontend
├─ In secure vaults
└─ Rotated on schedule
```

**Example - Backend Service**:

```
Environment Variable (Production):
OAUTH_CLIENT_ID=your_client_id
OAUTH_CLIENT_SECRET=<from_secrets_manager>

Code:
const clientSecret = await secretsManager.getSecret('OAUTH_CLIENT_SECRET');
```

#### 3. JWT Signing Keys

**Private Key**: For signing tokens (IDP only)
- Stored in HSM (Hardware Security Module)
- Never exposed to applications
- Auto-rotation supported

**Public Key**: For token verification (apps)
- Can be public (distributed freely)
- Usually fetched from JWKS endpoint
- Cached locally with TTL

```
GET /.well-known/jwks.json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "kid": "key_id",
      "n": "modulus",
      "e": "exponent"
    }
  ]
}
```

#### 4. Encryption Keys

**Master Key**: Protects all data encryption keys
- Managed by KMS
- Never stored in code
- Rotated quarterly

**Data Encryption Keys (DEKs)**: Encrypt actual data
- Derived from master key
- Specific to data type
- Rotated with data re-encryption

### Secret Rotation Schedule

| Secret Type          | Rotation Frequency | Procedure                      |
|----------------------|--------------------|--------------------------------|
| OAuth Client Secret  | 90 days            | Issue new, test, update apps   |
| API Keys             | 90 days            | Dual-key approach              |
| JWT Signing Keys     | Annually           | HSM rotation                   |
| Encryption Keys      | Annually           | Data re-encryption required    |
| DB Passwords         | 180 days           | Coordinated rollout            |

### Rotation Procedures

**Dual Key Approach** (for seamless rotation):

```
1. Generate new secret
2. Deploy both old and new secrets
3. All new operations use new secret
4. Old operations still accept old secret
5. Monitor usage of old secret
6. After grace period, deactivate old
7. Full migration of old secret

Timeline:
Day 1: Issue new secret, deploy dual-key system
Day 30: Deprecate old secret, monitor migration
Day 90: Deactivate old secret completely
```

### Access Control for Secrets

**Who Can Access**:

- **Local Development**: Developers (limited secrets)
- **CI/CD Pipeline**: Service accounts (scoped secrets)
- **Production**: Production service account only
- **Admin Access**: Audit trail required

**Audit Trail**:

```json
{
  "event_type": "secret_access",
  "secret_name": "OAUTH_CLIENT_SECRET",
  "accessed_by": "ci-cd-service",
  "timestamp": "2024-01-15T10:30:00Z",
  "action": "read",
  "ip_address": "10.0.0.1",
  "user_agent": "AWS SDK v3"
}
```

### Emergency Access

**Break Glass Procedure**:

```
For emergency access to secrets when normal channels unavailable:

1. Incident commander initiates break glass request
2. Requires approval from 2 senior engineers
3. Access granted for maximum 1 hour
4. All access logged with detailed audit
5. Incident report filed
6. Post-incident review conducted
```

---

## Implementation Guidelines for Backend Teams

### Token Validation Middleware

```
1. Extract Bearer token from Authorization header
2. Verify JWT signature using IDP public key
3. Check token expiration
4. Verify audience and issuer
5. Extract user ID and permissions
6. Check token revocation list (cache)
7. Attach user context to request
8. Return 401 if any check fails
```

### Permission Checking

```
Before processing request:
1. Determine required permission(s)
2. Check permission in token claims
3. If permission not in token, load from DB
4. Validate permission is active
5. Return 403 if permission missing
6. Log access for audit trail
```

### Error Handling

```
401 Unauthorized:
- Missing token
- Invalid signature
- Expired token
- Revoked token

403 Forbidden:
- Insufficient permissions
- Resource access denied
- Role requirements not met

Response:
{
  "error": "Forbidden",
  "code": "PERMISSION_DENIED",
  "message": "User lacks required permission: admin:write"
}
```

---

## Implementation Guidelines for Frontend Teams

### Token Storage Strategy

**Access Token**:
```
Browser Memory (SPA):
- Short-lived (1 hour)
- Lost on page refresh
- Protected from XSS leaks
- Automatic refresh before expiry
```

**Refresh Token**:
```
HttpOnly Secure Cookie:
- Server-set flag prevents JS access
- Protected from XSS
- Sent automatically with requests
- Cannot be accessed by malicious scripts
```

### Automatic Token Refresh

```
1. Track token expiration time
2. Before expiry (refresh at T-5min):
   - Request new access token
   - Backend validates refresh token
   - Issue new access token
3. If refresh fails:
   - Clear stored tokens
   - Redirect to login
4. Continue request with new token
```

### Logout Implementation

```
1. Call logout endpoint:
   POST /api/auth/logout
   {
     "refresh_token": "REFRESH_TOKEN"
   }
2. Backend invalidates tokens
3. Clear all local storage:
   - Memory cache
   - LocalStorage
   - SessionStorage
4. Clear HttpOnly cookies (automatic)
5. Redirect to login page
```

### Session Timeout UI

```
At 5 minutes before timeout:
- Show warning modal
- "Session expiring in 5 minutes"
- Options:
  • Extend Session (POST to extend endpoint)
  • Logout Now (redirect to login)
4. If no response after 5 minutes:
   - Auto-logout
   - Clear tokens
   - Redirect to login
```

---

## Security Best Practices

### For All Teams

1. **Never Log Tokens**: Tokens should never appear in logs
2. **HTTPS Only**: All authentication over secure TLS 1.2+
3. **CORS Configuration**: Whitelist only trusted origins
4. **Rate Limiting**: Limit login attempts and token requests
5. **Error Messages**: Don't reveal whether email exists (avoid user enumeration)
6. **Input Validation**: Validate all authentication inputs
7. **Secure Headers**: Implement security headers (HSTS, X-Frame-Options, etc.)

### For Developers

1. **Secret Rotation**: Implement detection of rotated secrets
2. **Token Claims Validation**: Always validate token claims
3. **Permission Caching**: Cache permissions with TTL, not indefinitely
4. **Audit Logging**: Log all auth-related actions
5. **Testing**: Include auth tests in your test suite
6. **Documentation**: Document API authentication requirements

### Code Examples

**Example: Express.js Middleware**

```javascript
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }
  
  try {
    // Verify signature
    const decoded = jwt.verify(token, getPublicKey(), {
      algorithms: ['RS256'],
      issuer: IDP_ISSUER,
      audience: 'api:backend'
    });
    
    // Check revocation
    const revoked = await revocationCache.isRevoked(token);
    if (revoked) {
      return res.status(401).json({ error: 'Token revoked' });
    }
    
    req.user = decoded;
    req.permissions = decoded.permissions;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

**Example: React Hook**

```javascript
const useAuth = () => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    const refreshToken = async () => {
      try {
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include' // Include cookies
        });
        const data = await response.json();
        setToken(data.access_token);
        setUser(jwtDecode(data.id_token));
      } catch (err) {
        setToken(null);
        setUser(null);
      }
    };
    
    refreshToken();
    const interval = setInterval(refreshToken, 55 * 60 * 1000); // Refresh every 55 min
    
    return () => clearInterval(interval);
  }, []);
  
  return { token, user };
};
```

---

## Troubleshooting Common Issues

### Token Validation Failures

**Issue**: "Invalid token signature"
- Verify IDP domain matches in token
- Check if public key has been rotated
- Ensure algorithm is supported (RS256)

**Issue**: "Token expired"
- Check system clock synchronization
- Token exp claim in past
- Implement refresh token flow

### Login Failures

**Issue**: "CORS errors during login redirect"
- Verify redirect_uri is whitelisted in IDP
- Check CORS headers from IDP endpoint
- Ensure frontend domain is allowed

**Issue**: "User not created after SSO login"
- Verify SAML/OIDC claim mapping
- Check if email is in token
- Verify user auto-provisioning enabled

### Session/Token Issues

**Issue**: "Session expires too quickly"
- Check token expiration time (exp claim)
- Verify refresh token mechanism working
- Check if refresh tokens are valid

**Issue**: "User permissions not updating"
- Verify token refresh happening
- Check cache TTL for permissions
- Ensure permission changes propagate

---

## Revision History

| Version | Date       | Changes                                          | Author |
|---------|------------|--------------------------------------------------|--------|
| 1.0     | 2024-01-15 | Initial document: auth flows, tokens, RBAC, SAML/SCIM, compliance | Security Team |

---

## References & Resources

### Standards & Specifications
- [OAuth 2.0 Authorization Framework](https://tools.ietf.org/html/rfc6749)
- [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html)
- [JWT (JSON Web Tokens)](https://tools.ietf.org/html/rfc7519)
- [TOTP (RFC 6238)](https://tools.ietf.org/html/rfc6238)

### Provider Documentation
- [Auth0 Documentation](https://auth0.com/docs)
- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)

### Compliance
- [FERPA - Student Privacy Rights](https://www2.ed.gov/policy/gen/guid/fpco/ferpa/)
- [GDPR Regulation](https://gdpr-info.eu/)
- [SOC 2 Trust Service Criteria](https://www.aicpa.org/soc2)

### Security Resources
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

---

## Document Governance

**Last Updated**: January 15, 2024
**Next Review**: July 15, 2024 (6 months)
**Owner**: Security Team
**Contact**: security@example.com

For questions or updates regarding this document, please contact the Security Team.
