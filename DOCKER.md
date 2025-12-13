# Docker + Neon (Local dev + Production)

This repo supports two database modes:
- Development: Neon Local proxy container (creates an ephemeral branch per environment start)
- Production: Connect directly to Neon Cloud via `DATABASE_URL` (no Neon Local container)

## Files added
- `Dockerfile` (multi-stage: `dev`, `prod`, `migrate`)
- `docker-compose.dev.yml` (app + Neon Local)
- `docker-compose.prod.yml` (app only, plus optional `migrate` profile)
- `.env.development` / `.env.production` (templates; keep secrets out of git)

## Environment variables
The app reads the database connection from:
- `DATABASE_URL` (preferred)
- `DB_URI` (legacy fallback)

### Development (Neon Local)
In `.env.development`:
- `DATABASE_URL=postgres://neon:npg@neon-local:5432/dbname?sslmode=require`
- `NEON_LOCAL=true`
- `NEON_LOCAL_HOST=neon-local`

Neon Local container needs:
- `NEON_API_KEY`
- `NEON_PROJECT_ID`
- `PARENT_BRANCH_ID` (to auto-create ephemeral branches on start/stop)

### Production (Neon Cloud)
In `.env.production`:
- `DATABASE_URL=postgres://...neon.tech/...?...`

No `NEON_LOCAL*` variables are required.

## Local development: start app + Neon Local
1) Fill in `.env.development` (at least `ARCJET_KEY`, `NEON_API_KEY`, `NEON_PROJECT_ID`, `PARENT_BRANCH_ID`).
2) Start:

```bash
docker compose -f docker-compose.dev.yml up --build
```

3) API is available at:
- `http://localhost:3000/health`
- `http://localhost:3000/api/v1/auth/sign-up`

Stop (ephemeral branch is deleted by default when Neon Local stops):

```bash
docker compose -f docker-compose.dev.yml down
```

## Production: run against Neon Cloud
1) Fill in `.env.production` with your real Neon Cloud `DATABASE_URL` (and other secrets like `JWT_SECRET`, `ARCJET_KEY`).
2) Start:

```bash
docker compose -f docker-compose.prod.yml up --build
```

### Apply migrations in production (optional)
This repo includes a `migrate` service target that has `drizzle-kit` available.

```bash
docker compose -f docker-compose.prod.yml --profile migrate run --rm migrate
```

## How the DB switching works
- Dev: `DATABASE_URL` points to `neon-local` (service name inside compose), and `NEON_LOCAL=true` makes the Neon serverless driver talk to the Neon Local proxy (`http://neon-local:5432/sql`).
- Prod: `DATABASE_URL` points directly to your Neon Cloud endpoint; `NEON_LOCAL` is unset/false so the driver uses its normal behavior.
