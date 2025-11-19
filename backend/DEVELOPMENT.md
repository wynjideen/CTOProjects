# Backend Development Guide

## Overview

This document provides comprehensive guidance for developing the CTOProjects backend service.

## Project Structure

```
backend/
├── src/
│   ├── config/              # Configuration management
│   │   ├── schema.ts        # Zod schema for environment variables
│   │   └── loader.ts        # Configuration loader with validation
│   ├── lib/                 # Shared libraries
│   │   ├── logger.ts        # Pino logging setup
│   │   └── errors.ts        # Custom error classes
│   ├── middleware/          # Express middleware
│   │   └── errorHandler.ts  # Global error handling
│   ├── routes/              # Top-level routes
│   │   └── health.ts        # Health/readiness endpoints
│   ├── modules/             # Feature modules (one per service domain)
│   │   ├── file-ingestion/
│   │   │   └── routes.ts
│   │   ├── content-processing/
│   │   │   └── routes.ts
│   │   ├── learning-orchestration/
│   │   │   └── routes.ts
│   │   ├── progress-tracking/
│   │   │   └── routes.ts
│   │   └── jobs/
│   │       └── routes.ts
│   ├── app.ts               # Express app factory
│   └── index.ts             # Entry point
├── .env.example             # Example environment file
├── .eslintrc.json           # ESLint rules
├── .prettierrc.json         # Code formatting
├── tsconfig.json            # TypeScript config
├── vitest.config.ts         # Test config
└── package.json
```

## Adding New Endpoints

### Step 1: Create a route handler in the appropriate module

For example, to add a new endpoint to file-ingestion:

```typescript
// src/modules/file-ingestion/routes.ts
import type { Router } from 'express';
import { createAsyncHandler } from '../../middleware/errorHandler';
import { AppError } from '../../lib/errors';

export function setupFileIngestionRoutes(router: Router): void {
  router.post('/upload', createAsyncHandler(async (req, res) => {
    // Handler implementation
    if (!req.body.filename) {
      throw new AppError('INVALID_REQUEST', 400, 'filename is required');
    }
    res.status(202).json({ jobId: 'uuid', status: 'processing' });
  }));
}
```

### Step 2: Handler patterns

Use the `createAsyncHandler` wrapper for async handlers to ensure errors are caught:

```typescript
import { createAsyncHandler } from '../../middleware/errorHandler';

router.post('/some-endpoint', createAsyncHandler(async (req, res) => {
  // Your async code here
  // Errors are automatically caught and passed to error handler
}));
```

### Step 3: Error handling

Use custom error types for consistent error responses:

```typescript
import { 
  AppError, 
  ValidationError, 
  NotFoundError 
} from '../../lib/errors';

// Validation error
throw new ValidationError('Field is required', { field: 'email' });

// Not found
throw new NotFoundError('User', userId);

// Custom app error
throw new AppError('CUSTOM_CODE', 400, 'Custom message', { details: 'here' });
```

## Configuration

### Adding a new environment variable

1. **Update the schema** in `src/config/schema.ts`:

```typescript
export const configSchema = z.object({
  // ... existing
  myNewVariable: z.string().min(1),
});
```

2. **Update the loader** in `src/config/loader.ts`:

```typescript
export function loadConfig(): Config {
  const parsed = configSchema.safeParse({
    // ... existing
    myNewVariable: process.env.MY_NEW_VARIABLE,
  });
  // ...
}
```

3. **Update `.env.example`**:

```bash
MY_NEW_VARIABLE=value
```

4. **Use it in your code**:

```typescript
import { getConfig } from './config/loader';

const config = getConfig();
console.log(config.myNewVariable);
```

## Logging

### Request correlation IDs

Request IDs are automatically generated and available in all requests:

```typescript
import { getRequestId } from '../../lib/logger';

const requestId = getRequestId(req);
logger.info({ requestId }, 'Processing request');
```

### Log levels

Control verbosity via `LOG_LEVEL` environment variable:

```typescript
logger.trace('Very detailed');
logger.debug('Debug info');
logger.info('Information');
logger.warn('Warning');
logger.error('Error');
logger.fatal('Fatal error');
```

### In production

Set `NODE_ENV=production` for JSON log output suitable for log aggregation systems.

## Testing

### Unit tests

Create a `.test.ts` or `.spec.ts` file next to your code:

```typescript
import { describe, it, expect } from 'vitest';

describe('MyModule', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

### Running tests

```bash
npm test                 # Run once
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage
```

## Code Quality

### Type checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint            # Check and fix issues
npm run format          # Format with Prettier
```

## Development Server

### Start development server

```bash
npm run dev
```

The server will:
- Start on port 3000 (or `PORT` env var)
- Hot reload on file changes
- Show structured logs in the console

### Health checks

- `GET /health` - Basic health status
- `GET /ready` - Readiness probe

### API documentation stub

- `GET /api/docs` - Basic OpenAPI spec stub

## Building for production

```bash
npm run build           # Compile to dist/
npm start              # Run production build
```

## Environment-specific behavior

### Development (`NODE_ENV=development`)

- Pretty-printed logs
- Detailed error messages
- Full stack traces

### Production (`NODE_ENV=production`)

- JSON-formatted logs
- Generic error messages (no internals leaked)
- Minimal stack traces

## Performance considerations

### Structured logging

Pino provides high-performance logging without slowing down the application.

### Async handlers

Always use `createAsyncHandler` wrapper for async route handlers to ensure proper error handling.

### Configuration validation

Configuration is validated once at startup, not on every request.

## Common patterns

### Validating request input

```typescript
import { z } from 'zod';
import { handleZodError } from '../../lib/errors';

const requestSchema = z.object({
  filename: z.string().min(1),
  size: z.number().positive(),
});

const parsed = requestSchema.safeParse(req.body);
if (!parsed.success) {
  throw handleZodError(parsed.error);
}
```

### Async middleware

```typescript
import { createAsyncHandler } from '../../middleware/errorHandler';

app.use(createAsyncHandler(async (req, res, next) => {
  // Async setup
  next();
}));
```

## Troubleshooting

### Configuration errors at startup

Check the console output for which environment variables are missing:

```
Configuration validation failed:
  DATABASE_URL: Invalid DATABASE_URL
  JWT_SECRET: String must contain at least 32 character(s)
```

### Port already in use

Either:
- Change `PORT` environment variable
- Kill the process using port 3000: `lsof -ti:3000 | xargs kill -9`

### Module not found errors

Ensure:
- TypeScript configuration includes the correct `rootDir` and `outDir`
- Module paths are correct
- All dependencies are installed: `npm install`

### Tests not running

Check that `vitest` is installed and configuration is correct in `vitest.config.ts`.

## Best practices

1. **Always use async handlers** with `createAsyncHandler` wrapper
2. **Validate input** with Zod schemas
3. **Use custom error types** for consistent error handling
4. **Include request IDs** in logs for tracing
5. **Document complex logic** with clear comments
6. **Add tests** for new features
7. **Type everything** - avoid `any` unless necessary
8. **Keep modules focused** - one responsibility per module
9. **Use meaningful variable names** - clarity over brevity
10. **Log at appropriate levels** - don't spam with debug logs in production

## Future improvements

- Database migrations and ORM setup (Prisma)
- Authentication middleware (JWT validation)
- Rate limiting middleware
- Request validation middleware
- Database connection pooling
- Redis client setup
- S3 client setup
- Message queue setup (SQS)
- OpenTelemetry instrumentation
- API documentation (OpenAPI/Swagger)
- Integration tests
