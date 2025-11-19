# CTOProjects

An adaptive learning management platform with AI-powered file processing, intelligent content analysis, and personalized learning path orchestration.

## Project Structure

This monorepo contains multiple service packages:

- **`/backend`** - Node.js/Express + TypeScript API service
- **`/docs`** - Comprehensive system documentation
  - `architecture/` - System design and infrastructure
  - `backend/` - API specification and backend architecture
  - `database/` - Data models and schemas
  - `frontend/` - Frontend specifications
  - `security/` - Authentication and security models
  - `llm/` - LLM orchestration and integration
  - `monitoring/` - Monitoring and observability setup

## Backend Setup

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 13+ (for database)
- Redis 6+ (for job queues and caching)
- AWS credentials (for S3 and SQS)

### Installation

```bash
cd backend
npm install
```

### Environment Configuration

Copy `.env.example` to `.env` and configure the required environment variables:

```bash
cp .env.example .env
```

**Required environment variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection URL
- `JWT_SECRET` - JWT signing secret (minimum 32 characters)
- `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` - AWS S3 configuration
- `LLM_API_KEY` - API key for configured LLM provider

See `.env.example` for all available configuration options.

### Development

Start the development server with hot reloading:

```bash
npm run dev
```

The server will be available at `http://localhost:3000`.

**Health check endpoints:**
- `GET /health` - Basic health status
- `GET /ready` - Readiness probe (checks all dependencies)

### Scripts

- `npm run dev` - Start development server with hot reloading (tsx watch)
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run production build
- `npm run lint` - Run ESLint (with --fix flag to auto-fix)
- `npm run format` - Format code with Prettier
- `npm run type-check` - Run TypeScript type checking
- `npm test` - Run tests with Vitest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report

### Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── schema.ts        # Configuration schema (Zod)
│   │   └── loader.ts        # Configuration loader with validation
│   ├── lib/
│   │   ├── logger.ts        # Structured logging (Pino)
│   │   └── errors.ts        # Error types and utilities
│   ├── middleware/
│   │   └── errorHandler.ts  # Global error handling middleware
│   ├── routes/
│   │   └── health.ts        # Health and readiness endpoints
│   ├── modules/
│   │   ├── file-ingestion/
│   │   │   └── routes.ts    # File upload and management
│   │   ├── content-processing/
│   │   │   └── routes.ts    # Content parsing and chunking
│   │   ├── learning-orchestration/
│   │   │   └── routes.ts    # Learning path management
│   │   ├── progress-tracking/
│   │   │   └── routes.ts    # User progress tracking
│   │   └── jobs/
│   │       └── routes.ts    # Async job management
│   ├── app.ts               # Express app setup
│   └── index.ts             # Entry point and server startup
├── .env.example             # Example environment variables
├── .eslintrc.json           # ESLint configuration
├── .prettierrc.json         # Prettier configuration
├── tsconfig.json            # TypeScript configuration
├── vitest.config.ts         # Vitest configuration
└── package.json             # Dependencies and scripts
```

### API Overview

The backend implements a modular architecture with the following service domains:

#### 1. File Ingestion Service
- File upload and validation
- Streaming support for large files
- Metadata extraction

**Base path:** `/api/v1/files`

#### 2. Content Processing Service
- Content parsing and chunking
- Metadata enrichment
- Vector embeddings

**Base path:** `/api/v1/content`

#### 3. Learning Orchestration Service
- Learning path creation and management
- Adaptive lesson planning
- Assessment integration

**Base path:** `/api/v1/learning-paths`

#### 4. Progress Tracking Service
- User progress monitoring
- Metrics and analytics
- Checkpoint recording

**Base path:** `/api/v1/progress`

#### 5. Job Scheduler Service
- Async job management
- Job status tracking
- Retry and error handling

**Base path:** `/api/v1/jobs`

### Configuration and Logging

#### Centralized Configuration
The backend uses a centralized configuration system with Zod schema validation:
- Environment variables are loaded via `dotenv`
- All configuration is validated at startup
- Missing or invalid configuration causes immediate failure with helpful error messages
- See `src/config/` for implementation

#### Structured Logging
The backend uses Pino for structured, high-performance logging:
- Request correlation IDs are automatically generated and tracked
- Log levels are configurable via `LOG_LEVEL` environment variable
- Pretty printing in development, JSON format in production
- HTTP request/response logging with request correlation
- See `src/lib/logger.ts` for implementation

### Error Handling

The backend implements a consistent error handling strategy:
- Global error handler middleware for all exceptions
- Custom error types for different scenarios (AppError, ValidationError, NotFoundError, etc.)
- Validation errors include detailed field-level information (via Zod)
- All errors include request IDs for tracing
- Error responses follow the contract specified in `docs/backend/api-spec.md`

See `src/lib/errors.ts` and `src/middleware/errorHandler.ts` for implementation.

### API Documentation

Full API documentation is available in `docs/backend/api-spec.md`. A basic OpenAPI stub is available at:

```
GET /api/docs
```

### Testing

Run tests with:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Generate coverage report:

```bash
npm run test:coverage
```

The test setup includes:
- **Vitest** for fast unit and integration testing
- **ESLint** for code quality
- **TypeScript** for type safety

## Documentation

- **[System Architecture](docs/architecture/system-architecture.md)** - High-level system design and technology stack
- **[Backend API Specification](docs/backend/api-spec.md)** - Detailed API endpoints and contracts
- **[Security & Authentication](docs/security/auth.md)** - Authentication and authorization model
- **[Database Schema](docs/database/schema.md)** - Data models and relationships

## Development Workflow

1. **Create a feature branch** from `main`
2. **Implement changes** following the existing code style
3. **Run tests** to ensure quality: `npm test`
4. **Run linting** to check code style: `npm run lint`
5. **Type check** TypeScript: `npm run type-check`
6. **Create a pull request** with clear description
7. **Address review feedback** before merging

## Contributing

Please ensure:
- Code follows the existing style (ESLint/Prettier)
- All tests pass (`npm test`)
- Type checking passes (`npm run type-check`)
- Linting passes (`npm run lint`)
- New features include tests
- Documentation is updated

## License

MIT
