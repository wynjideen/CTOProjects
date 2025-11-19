# CTOProjects

This repository houses the core documentation and implementation assets for the CTOProjects learning platform. Documentation lives under `docs/` and the executable backend data layer is bootstrapped inside `backend/`.

## Backend Data Layer

The `backend/` directory contains a standalone Node.js project that manages the PostgreSQL schema with Prisma. Follow `backend/README.md` for:

- Environment variable requirements (`DATABASE_URL`, `DIRECT_DATABASE_URL`, `SHADOW_DATABASE_URL`)
- Local Postgres bootstrap instructions (Docker Compose + manual `psql` commands)
- Prisma workflows (`npm run prisma:migrate dev`, `npm run db:seed`, etc.)

## Documentation

All architectural references remain under `docs/` (architecture, database, security, monitoring, frontend, etc.) and continue to drive the database models implemented in the backend package.
