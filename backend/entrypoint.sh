#!/bin/sh
set -e

echo "=== Checking environment ==="
echo "DATABASE_URL is set: $([ -n "$DATABASE_URL" ] && echo 'YES' || echo 'NO')"
echo "NODE_ENV: $NODE_ENV"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set!"
  echo "Please configure DATABASE_URL as an environment variable."
  exit 1
fi

echo "=== Running Prisma migrations ==="
npx prisma migrate deploy

echo "=== Starting server ==="
exec node dist/main.js
