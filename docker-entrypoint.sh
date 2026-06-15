#!/bin/sh
set -e

echo "→ Applying database migrations…"
npx prisma migrate deploy

if [ "$SEED_ON_START" = "true" ]; then
  echo "→ Seeding database…"
  npx prisma db seed || echo "⚠ seed failed or already applied, continuing"
fi

echo "→ Starting app…"
exec "$@"
