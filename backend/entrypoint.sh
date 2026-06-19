#!/bin/sh

echo "=== Checking environment ==="
echo "DATABASE_URL is set: $([ -n "$DATABASE_URL" ] && echo 'YES' || echo 'NO')"
echo "NODE_ENV: $NODE_ENV"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set!"
  exit 1
fi

echo "=== Running Prisma migrations ==="
npx prisma migrate deploy || echo "WARNING: Migration failed, trying db push..."
npx prisma db push --skip-generate || echo "WARNING: db push also failed"

echo "=== Starting server on port ${BACKEND_PORT:-3001} ==="
exec node dist/main.js
