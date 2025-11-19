# Backend Service & Data Layer

This package contains the Node.js backend bootstrap for CTOProjects. It exposes a typed Express server for rapid feature work and a Prisma-based data layer that mirrors the schema defined in `docs/database/schema.md`.

## Stack Overview

- **Language:** TypeScript (strict mode) compiled to CommonJS
- **HTTP:** Express with structured logging via Pino + request correlation IDs
- **Config:** Centralized Zod schema with environment validation on boot
- **Error Handling:** Typed `AppError` hierarchy with consistent JSON responses
- **Testing:** Vitest with coverage hooks ready
- **ORM:** Prisma Client targeting PostgreSQL with migrations + seed data

## Getting Started

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

The development server runs with `tsx` in watch mode. Health endpoints are available at `GET /health` and `GET /ready`.

## Environment Variables

Refer to `.env.example` for a full list. Critical values:

| Variable | Description |
| --- | --- |
| `PORT` | HTTP port for the Express server (default 3000). |
| `DATABASE_URL` | Primary Prisma/PostgreSQL connection string (PgBouncer safe). |
| `DIRECT_DATABASE_URL` | Direct connection for migrations and Prisma Studio. |
| `SHADOW_DATABASE_URL` | Shadow database used by Prisma migrate/tests. |
| `JWT_SECRET` | 32+ character signing key for auth tokens. |

## NPM Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Express server with hot reload. |
| `npm run build` | Type-check and emit JavaScript to `dist/`. |
| `npm run start` | Run the compiled server. |
| `npm run lint` | ESLint across the TypeScript source. |
| `npm run format` | Prettier for the entire repo. |
| `npm run test` | Execute Vitest in CI mode. |
| `npm run prisma:generate` | Generate Prisma Client types. |
| `npm run prisma:migrate dev` | Apply new migrations locally. |
| `npm run prisma:migrate:deploy` | Apply migrations in CI/prod. |
| `npm run db:seed` | Seed baseline data (admin + learner demo flows). |

## Database & Prisma Workflow

1. Start Postgres (see `docker-compose.yml` for a local container) or point `DATABASE_URL` at an existing instance.
2. Create the shadow database once: `createdb ctoprojects_shadow` (or via `docker compose exec postgres psql -U postgres -c "CREATE DATABASE ctoprojects_shadow;"`).
3. Run `npm run prisma:migrate dev` to apply the schema. The generated SQL aligns with the ERD in `docs/database/schema.md` (users, study_materials, content_chunks, generated_assets, learning_sessions, interactions, user_feedback, progress_metrics, audit_logs plus enum + indexes).
4. Generate the Prisma Client (`npm run prisma:generate`) and import it where needed.
5. Seed base data with `npm run db:seed`. The script is idempotent and provisions:
   - Admin + learner demo accounts
   - Sample study material, chunk, and generated asset
   - A learning session, interaction, feedback, progress metric, and audit log entry

## Development Workflow

- `src/app.ts` wires up core middleware, module routers, and OpenAPI stubs.
- `src/modules/*` directories host per-domain routers (file ingestion, content processing, orchestration, progress tracking, jobs). The handlers currently return `501` responses as scaffolding for future features.
- Add new dependencies via `npm install <pkg>` and update TypeScript types accordingly.
- Keep `tsconfig.json`, `.eslintrc.json`, and `.prettierrc.json` in sync with team standards.

## Troubleshooting

- **Config validation failures**: check the console output; Zod lists the missing/invalid environment variables.
- **Prisma complaining about PgBouncer**: ensure `DIRECT_DATABASE_URL` points to the raw Postgres service and that migration commands use it automatically.
- **Seed script foreign key errors**: confirm `npm run prisma:migrate dev` succeeded and you are targeting the correct database.

For deeper architectural guidance (module responsibilities, async workflows, logging strategy) see `DEVELOPMENT.md`.
