# Backend Project Structure

## Overview

The CTOProjects backend is a Node.js/Express service built with TypeScript, implementing a modular microservices-ready architecture. This document describes the project organization and development patterns.

## Repository Structure

```
/backend                          # Backend service package
├── src/
│   ├── config/                   # Configuration management
│   │   ├── schema.ts            # Zod schema for environment validation
│   │   └── loader.ts            # Configuration loader (singleton)
│   ├── lib/                      # Shared utilities and libraries
│   │   ├── logger.ts            # Pino structured logging
│   │   └── errors.ts            # Custom error types and utilities
│   ├── middleware/               # Express middleware
│   │   └── errorHandler.ts      # Global error handling and async wrapper
│   ├── routes/                   # Core routes (health, docs, etc.)
│   │   └── health.ts            # /health and /ready endpoints
│   ├── modules/                  # Feature modules (service domains)
│   │   ├── file-ingestion/
│   │   │   └── routes.ts        # File upload and management endpoints
│   │   ├── content-processing/
│   │   │   └── routes.ts        # Content parsing endpoints
│   │   ├── learning-orchestration/
│   │   │   └── routes.ts        # Learning path endpoints
│   │   ├── progress-tracking/
│   │   │   └── routes.ts        # Progress tracking endpoints
│   │   └── jobs/
│   │       └── routes.ts        # Job management endpoints
│   ├── app.ts                    # Express application factory
│   └── index.ts                  # Entry point and server startup
├── dist/                         # Compiled JavaScript output (gitignored)
├── node_modules/                # Dependencies (gitignored)
├── .env                         # Local environment variables (gitignored)
├── .env.example                 # Example environment template
├── .eslintrc.json               # ESLint configuration
├── .prettierrc.json             # Prettier code formatting
├── .gitignore                   # Git ignore rules
├── tsconfig.json                # TypeScript configuration
├── vitest.config.ts             # Vitest test configuration
├── package.json                 # Dependencies and scripts
├── DEVELOPMENT.md               # Development guide
└── README.md                    # Quick start guide (in repo root)
```

## Module Architecture

### Service Domains

Each service domain corresponds to a module with its own routing namespace:

#### 1. File Ingestion (`/api/v1/files`)
**Responsibility:** Handle file uploads, validation, and storage.

**Routes:**
- `POST /upload` - Upload a single file
- `POST /batch-upload` - Upload multiple files
- `GET /:fileId` - Get file metadata
- `DELETE /:fileId` - Delete a file

**Future expansion:**
- Controllers for business logic
- Service layer for file operations
- Database models for file persistence

#### 2. Content Processing (`/api/v1/content`)
**Responsibility:** Parse, chunk, and enrich file content.

**Routes:**
- `GET /:fileId` - Get processed content structure
- `POST /:fileId/chunks/:chunkId/embed` - Generate embeddings
- `GET /:fileId/chunks/:chunkId` - Get single chunk
- `POST /search` - Vector similarity search

**Future expansion:**
- Content parsing service
- Embedding generation service
- Vector database integration

#### 3. Learning Orchestration (`/api/v1/learning-paths`)
**Responsibility:** Create and manage learning paths with AI-driven adaptation.

**Routes:**
- `POST /` - Create learning path
- `GET /:pathId` - Get learning path
- `POST /:pathId/lessons` - Generate lessons
- `POST /:lessonId/complete` - Mark lesson as complete

**Future expansion:**
- AI planning service
- Adaptive algorithm service
- Assessment integration

#### 4. Progress Tracking (`/api/v1/progress`)
**Responsibility:** Monitor user progress and collect learning metrics.

**Routes:**
- `GET /:userId` - Get user progress
- `GET /:userId/courses/:courseId` - Get course progress
- `POST /:userId/courses/:courseId/checkpoint` - Record checkpoint

**Future expansion:**
- Analytics service
- Metrics aggregation
- Progress calculations

#### 5. Job Scheduler (`/api/v1/jobs`)
**Responsibility:** Manage asynchronous job processing and tracking.

**Routes:**
- `GET /:jobId` - Get job status
- `POST /:jobId/cancel` - Cancel job
- `GET /` - List jobs

**Future expansion:**
- Job queue implementation (SQS/Bull)
- Worker process integration
- Job retry logic

## Shared Libraries

### Configuration (`src/config/`)

**Purpose:** Centralized environment variable management with validation.

**Key files:**
- `schema.ts` - Zod schema defining all configuration options
- `loader.ts` - Singleton loader that validates config at startup

**Usage:**
```typescript
import { getConfig } from './config/loader';
const config = getConfig();
```

**Benefits:**
- Fail fast with clear error messages
- Single source of truth for required settings
- Type-safe configuration throughout the app
- Automatic validation before server starts

### Logging (`src/lib/logger.ts`)

**Purpose:** Structured, high-performance logging with request correlation.

**Features:**
- Pino for performance and structure
- Request IDs for tracing
- Configurable log levels
- Pretty printing in development, JSON in production
- Automatic HTTP request/response logging

**Usage:**
```typescript
import pino from 'pino';
import { createLogger } from './lib/logger';

const logger = createLogger(config);
logger.info('Message');
```

### Error Handling (`src/lib/errors.ts`)

**Purpose:** Consistent error handling across all endpoints.

**Error types:**
- `AppError` - Base class for application errors
- `ValidationError` - Input validation failures
- `NotFoundError` - Resource not found
- `UnauthorizedError` - Authentication failures
- `ForbiddenError` - Authorization failures
- `ConflictError` - Resource conflicts
- `InternalServerError` - Unexpected errors

**Usage:**
```typescript
import { ValidationError, NotFoundError } from './lib/errors';

throw new ValidationError('Email is required', { field: 'email' });
throw new NotFoundError('User', userId);
```

## Middleware Stack

### Global Middleware Order

1. **Express parsers**
   - `express.json()` - Parse JSON bodies
   - `express.urlencoded()` - Parse URL-encoded bodies

2. **Request logging** (`pino-http`)
   - Logs all HTTP requests with correlation IDs
   - Automatic request/response timing

3. **Route handlers**
   - API v1 routes
   - Health check routes
   - OpenAPI documentation

4. **404 handler**
   - Catches unmatched routes
   - Returns consistent error response

5. **Error handler**
   - Catches all errors from routes and middleware
   - Formats error responses
   - Logs errors appropriately

### Creating Async Handlers

All async route handlers should use the `createAsyncHandler` wrapper:

```typescript
import { createAsyncHandler } from './middleware/errorHandler';

router.post('/endpoint', createAsyncHandler(async (req, res) => {
  // Your async code
  // Errors are automatically caught
  throw new ValidationError('Invalid input');
}));
```

## API Response Contracts

### Success Response

```json
{
  "data": {
    "id": "uuid",
    "status": "success"
  }
}
```

### Error Response

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "requestId": "correlation-id",
    "details": {
      "field": "additional context"
    }
  }
}
```

## Configuration

### Environment Variables

All configuration comes from environment variables loaded via `.env`:

**Core:**
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production/test)
- `LOG_LEVEL` - Pino log level (trace/debug/info/warn/error/fatal)

**Database:**
- `DATABASE_URL` - PostgreSQL connection string (required)

**Cache:**
- `REDIS_URL` - Redis connection URL (required)

**Storage:**
- `S3_BUCKET` - AWS S3 bucket name (required)
- `S3_REGION` - AWS S3 region (required)
- `S3_ACCESS_KEY_ID` - AWS access key (required)
- `S3_SECRET_ACCESS_KEY` - AWS secret key (required)

**Authentication:**
- `JWT_SECRET` - JWT signing secret, minimum 32 characters (required)
- `JWT_EXPIRES_IN` - JWT token expiration (default: 24h)

**LLM:**
- `LLM_PROVIDER` - AI provider (openai/anthropic/azure)
- `LLM_API_KEY` - API key for LLM provider (required)
- `LLM_MODEL` - Model name (default: gpt-4)

**Optional:**
- `OAUTH_PROVIDER_URL` - OAuth provider endpoint
- `SQS_QUEUE_URL` - AWS SQS queue URL
- `ENABLE_OTEL` - Enable OpenTelemetry (false/true)
- `ENABLE_DETAILED_LOGGING` - Enable verbose logging

### Validation

Configuration is validated at startup using Zod. Invalid or missing required variables cause immediate failure with helpful error messages.

## Development Workflow

### Adding a New Endpoint

1. **Identify the module** - Which service domain does it belong to?
2. **Create the handler** - Add to the module's routes file
3. **Use async wrapper** - Wrap handler with `createAsyncHandler`
4. **Handle errors** - Use custom error types
5. **Add tests** - Create `.test.ts` or `.spec.ts` file
6. **Lint and test** - `npm run lint && npm test`

### Adding Configuration

1. **Update schema** - Add to `src/config/schema.ts`
2. **Update loader** - Add to `src/config/loader.ts`
3. **Update example** - Add to `.env.example`
4. **Use in code** - `getConfig().yourVariable`

### Adding a Shared Library

1. **Create in `src/lib/`** - New file for utilities
2. **Export functions** - Clear, well-typed exports
3. **Add tests** - Co-located `.test.ts` file
4. **Document usage** - In code comments or this guide

## TypeScript Conventions

- **Strict mode:** All `tsconfig.json` strict options enabled
- **No implicit any:** Always type function parameters and returns
- **Explicit returns:** Functions must have return type annotations
- **Module resolution:** Node (CommonJS)
- **Target:** ES2020

## Build and Deployment

### Development Build

```bash
npm run dev
```

Starts with hot reloading via `tsx watch`.

### Production Build

```bash
npm run build
npm start
```

Compiles TypeScript to `dist/` directory and runs the compiled JavaScript.

### Docker

The backend can be containerized:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
EXPOSE 3000
CMD ["npm", "start"]
```

## Monitoring and Observability

### Health Checks

- `GET /health` - Basic health status
- `GET /ready` - Readiness probe with dependency checks

### Logging

- Structured JSON logs in production
- Pretty-printed logs in development
- Request correlation IDs for tracing
- Log levels configurable per environment

### Future Enhancements

- OpenTelemetry instrumentation (metrics, traces)
- Application performance monitoring (APM)
- Error tracking and reporting
- Custom business metrics

## Testing Strategy

### Unit Tests

- Test individual functions and services
- Vitest for fast, isolated testing
- Mocking external dependencies

### Integration Tests

- Test module interactions
- Test middleware behavior
- Test error handling

### E2E Tests

- Test complete request/response flows
- Test across all modules
- Test with real services in staging

### Running Tests

```bash
npm test              # Run once
npm run test:watch   # Watch mode
npm run test:coverage # With coverage
```

## Performance Considerations

### Logging Performance

Pino is optimized for performance:
- Asynchronous logging doesn't block requests
- Child loggers for context without cloning
- Log sampling capabilities for high-volume scenarios

### Error Handling

- Consistent error handling prevents cascading failures
- Proper HTTP status codes guide client handling
- Request IDs enable distributed tracing

### Configuration

- Single loading at startup, not per-request
- Validation happens once, errors caught early

## Security Considerations

### Environment Variables

- Sensitive values (API keys, secrets) via env vars
- Never commit `.env` file
- Use `.env.example` as template

### Error Messages

- Generic messages in production
- Detailed errors in development
- No sensitive data in error responses

### Request Validation

- Zod schemas for input validation
- Consistent validation error formatting
- Type-safe request handling

## Future Architecture Evolution

### Phase 1: Current (Monolith)
Single service with modular routing for different domains.

### Phase 2: Planned
- Separate microservices per domain
- Service-to-service communication (gRPC/REST)
- Shared data layer (separate service)
- API Gateway for routing

### Phase 3: Future
- Event-driven architecture
- Message queues (SQS/RabbitMQ)
- CQRS for complex queries
- Eventual consistency patterns

## References

- [Backend API Specification](./api-spec.md) - Detailed endpoint documentation
- [System Architecture](../architecture/system-architecture.md) - System design
- [Development Guide](../../backend/DEVELOPMENT.md) - Development patterns
