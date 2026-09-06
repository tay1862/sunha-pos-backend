# Sunha POS

Foundation monorepo for an offline-first Android POS aimed at Lao shops and cafés.

## Architecture

```text
apps/pos       Expo Router React Native Android shell (Lao-first)
apps/api       NestJS modular API on Fastify
apps/admin     Next.js + Tailwind internal operations shell
packages/contracts  Zod API contracts with string money/quantity
packages/domain     Deterministic pricing and quantity domain engine
packages/config     Shared TypeScript and Vitest configuration
PostgreSQL          The only local infrastructure dependency
```

Phase 2 now includes production-oriented owner authentication and store setup: Argon2id passwords, short-lived JWT access tokens, rotating 30-day refresh sessions, tenant-scoped store settings, and SecureStore-backed mobile tokens. Catalog, checkout, sync, and hardware integrations remain staged next.

## Prerequisites

- Node.js 20.19 or newer (Node 22 LTS recommended)
- pnpm 11.25
- Docker Desktop for PostgreSQL
- Android Studio/JDK for a local Android build

## Setup

```bash
corepack enable
pnpm install
cp .env.example .env
docker compose up -d
pnpm dev
```

Individual apps:

```bash
pnpm --filter @sunha/api dev
pnpm --filter @sunha/admin dev
pnpm --filter @sunha/pos dev
```

API health check: `curl http://localhost:3001/v1/health`

API database readiness check: `curl http://localhost:3001/v1/health/ready`

Prisma commands:

```bash
pnpm --filter @sunha/api exec prisma validate
pnpm --filter @sunha/api exec prisma generate
pnpm --filter @sunha/api exec prisma migrate dev --name init
pnpm --filter @sunha/api exec prisma migrate dev --name phase2_auth_sessions
```

Phase 2 endpoints are `POST /v1/auth/signup`, `POST /v1/auth/login`, `POST /v1/auth/refresh`, plus authenticated `GET/PATCH /v1/setup/store`. Set a long random `JWT_SECRET` in deployment. Email verification and password reset need an email provider and are intentionally queued for the next infrastructure slice.

The API does not connect to PostgreSQL during boot by default, which keeps local health checks usable before infrastructure is started. Set `DATABASE_CONNECT_ON_BOOT=true` when the deployment should fail fast if the database is unavailable.

For Android, copy `apps/pos/.env.example` to `apps/pos/.env`, start an emulator, then run `pnpm --filter @sunha/pos android`. The emulator uses `10.0.2.2` to reach the host API.

## Quality commands

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Domain money values are integer strings in LAK. Quantities are decimal strings with at most three fractional digits. The domain package uses `BigInt`-based arithmetic and half-up rounding to avoid floating-point drift.
