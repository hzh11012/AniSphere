#!/bin/sh
set -e

echo "[entrypoint] Running database migrations..."
node node_modules/drizzle-kit/bin.cjs migrate

echo "[entrypoint] Starting Qnya..."
exec supervisord -c /etc/supervisord.conf
