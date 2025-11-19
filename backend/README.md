# Backend Data Layer

This package bootstraps the PostgreSQL data model for CTOProjects with Prisma. It mirrors the schema defined in `docs/database/schema.md`, provides repeatable migrations, and ships an idempotent seed script for baseline data used by automated tests and manual QA flows.

## Requirements

- Node.js 18+
- npm 10+
- Docker (optional but recommended for the local Postgres instance)
- PostgreSQL 14+ (the migrations were tested with Postgres 15)

## Environment Variables

Copy the example file and adjust the URLs to match your environment:

```bash
cp .env.example .env
```

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Primary connection string (can point to PgBouncer or another pooled endpoint). Include `pgbouncer=true`, `connection_limit`, and `pool_timeout` flags when routing through PgBouncer. |
| `DIRECT_DATABASE_URL` | Direct connection that bypasses PgBouncer for administrative tasks such as running migrations or Prisma Studio. Point it at the underlying Postgres host. |
| `SHADOW_DATABASE_URL` | Dedicated database/schema used by Prisma Migrate and automated tests. Should live on the same server as the primary database. |

> **Tip:** When PgBouncer runs in transaction mode, keep `DIRECT_DATABASE_URL` pointing to the raw Postgres service so that Prisma can run long‑lived migrations without exhausting pooled connections.

## Local Database (Docker)

A helper Compose file is provided for convenience:

```bash
# start postgres and keep it running
npm install
docker compose up -d postgres

# create the shadow database the first time
docker compose exec postgres psql -U postgres -c "CREATE DATABASE ctoprojects_shadow;"
```

Update your `.env` file so that both `DATABASE_URL` and `DIRECT_DATABASE_URL` match the credentials defined in `docker-compose.yml` (default `postgres/postgres`).

## Common Commands

| Action | Command |
| --- | --- |
| Format schema | `npm run prisma:format` |
| Generate Prisma Client | `npm run prisma:generate` |
| Open Prisma Studio | `npm run prisma:studio` |
| Create / apply dev migrations | `npm run prisma:migrate dev` |
| Apply migrations in CI / prod | `npm run prisma:migrate:deploy` |
| Reset database (drops & reapplies) | `npm run db:reset` |
| Seed baseline data | `npm run db:seed` |

Running `npm run prisma:migrate dev` from the `backend` folder will create the full schema (users, study_materials, content_chunks, generated_assets, learning_sessions, interactions, user_feedback, progress_metrics, audit_logs) exactly as described in the database specification. The command also builds the Prisma Client so TypeScript definitions are ready for consumption.

## Seeding Baseline Data

`npm run db:seed` inserts:

- Default roles via enum backed users (Admin + Learner accounts)
- A demo learner user (`learner@ctoprojects.dev`)
- Sample study material, chunk, generated asset, and learning session
- Reference interaction, user feedback, progress metric, and audit log entries

The script is idempotent; you can run it multiple times without duplicating rows. Use the seeded data to validate API flows, smoke tests, or development demos.

## Manual Postgres Setup (without Docker)

If you prefer a local Postgres installation, create the databases manually and then run the migrations:

```bash
createdb ctoprojects
createdb ctoprojects_shadow
npm run prisma:migrate dev
npm run db:seed
```

## Testing Notes

- Automated tests should point to the same schema and run `npm run prisma:migrate dev` (or `npm run prisma:migrate:deploy`) before executing queries.
- Use the shadow database to keep migration history isolated from the primary pool.
- Prisma Client respects the pooling flags inside `DATABASE_URL`, so the generated client is PgBouncer‑safe by default.

## Troubleshooting

- **`DATABASE_URL` not set**: ensure your `.env` file exists or export the variables in your shell; Prisma’s new config loader does not read `.env` automatically unless the variables are defined.
- **Migrations timing out via PgBouncer**: point `DIRECT_DATABASE_URL` to the raw Postgres host and set `DATABASE_URL` to the pooled endpoint.
- **Seeding errors about foreign keys**: confirm migrations ran successfully and that the seed script is executed against a clean database.
