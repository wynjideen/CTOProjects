# Backend Development Guide

This document summarizes the conventions established for the CTOProjects backend service. Use it as a quick reference when implementing new routes, wiring external systems, or extending the Prisma data layer.

## Architecture Summary

```
┌────────────────────────────────────────────────────────────────────┐
│                            Express App                             │
├────────────────────────────────────────────────────────────────────┤
│  Global Middleware                                                 │
│  • JSON/body parsing                                               │
│  • Pino request logging with correlation IDs                       │
│  • Error handling + structured responses                           │
├────────────────────────────────────────────────────────────────────┤
│  Domain Routers (src/modules)                                      │
│  • file-ingestion                                                  │
│  • content-processing                                              │
│  • learning-orchestration                                          │
│  • progress-tracking                                               │
│  • jobs                                                            │
├────────────────────────────────────────────────────────────────────┤
│  Shared Libraries                                                  │
│  • Config loader (Zod)                                             │
│  • Error helpers (AppError, ValidationError, etc.)                 │
│  • Logger factory / request ID helpers                             │
└────────────────────────────────────────────────────────────────────┘
```

## Coding Standards

- **TypeScript Strict Mode**: enabled via `tsconfig.json`. Always type route handlers and helper utilities.
- **Imports**: prefer ES module syntax (`import ... from`). Keep relative paths short by colocating helpers.
- **Async Handlers**: wrap new async route handlers with `createAsyncHandler` to surface errors to the middleware chain.
- **Error Responses**: throw `AppError` (or subclasses) so clients receive consistent `{ error: { code, message } }` payloads.
- **Logging**: use the injected Pino logger retrieved from `createLogger`. Avoid `console.log` outside of bootstrap code.

## Adding Routes

1. Create a router file in `src/modules/<domain>/routes.ts` (follow existing examples).
2. Export a `setupXRoutes(router: Router)` function.
3. Mount the router inside `src/app.ts` under `/api/v1`.
4. Document request/response contracts in `docs/backend/api-spec.md`.

## Configuration

- Environment variables are validated at startup via `configSchema`. Add new keys there before using them.
- Provide sane defaults when possible (`z.string().default(...)`).
- Keep `.env.example` up to date whenever new configuration is introduced.

## Database + Prisma

- Schema source of truth: `prisma/schema.prisma` (mirrors `docs/database/schema.md`).
- To add changes:
  1. Update the Prisma schema.
  2. Run `npm run prisma:migrate dev -- --name <change>`.
  3. Commit the generated SQL under `prisma/migrations/`.
- Seed data lives in `prisma/seed.ts` and should remain idempotent.
- Use `DIRECT_DATABASE_URL` for any administrative commands that bypass PgBouncer.

## Testing & Tooling

- `npm run test` executes Vitest; colocate tests next to the code they cover (e.g., `*.test.ts`).
- `npm run lint` enforces ESLint rules (see `.eslintrc.json`).
- `npm run format` runs Prettier on the entire project.
- CI should execute `lint`, `type-check`, `test`, and `prisma:migrate deploy` (or equivalent).

## Deployment Notes

- Enable graceful shutdown by keeping the listeners in `src/index.ts` intact (SIGTERM/SIGINT handlers already included).
- Always run database migrations before scaling up the API.
- Structured logs from Pino include request IDs, making it easy to correlate traces in centralized logging systems.

## Next Steps

- Flesh out each domain router with real business logic once downstream services are ready.
- Introduce authentication middleware when the identity provider integration is finalized.
- Expand the test suite with supertest-powered integration tests (placeholder planned in `src/index.test.ts`).

For questions, reach out in `#backend-platform` or reference `docs/backend/api-spec.md` for the broader product context.
