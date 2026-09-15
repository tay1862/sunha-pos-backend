#!/usr/bin/env bash
set -euo pipefail

echo "Release verification: $(git rev-parse --short HEAD)"
if [[ -z "${DATABASE_URL:-}" || "${SUNHA_AUDIT_DISPOSABLE:-}" != "yes" ]]; then
  echo "Release verification requires DATABASE_URL for a disposable database and SUNHA_AUDIT_DISPOSABLE=yes." >&2
  exit 1
fi
pnpm --filter @sunha/api exec prisma migrate deploy
export RUN_INTEGRATION=true
pnpm exec prettier --check .github/workflows/ci.yml .github/workflows/release-candidate.yml apps/api/package.json
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @sunha/api build
pnpm --filter @sunha/admin build
pnpm --filter @sunha/pos exec expo export --platform android

echo "Release verification passed"
