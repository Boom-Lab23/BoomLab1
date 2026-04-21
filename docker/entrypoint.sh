#!/bin/sh
set -e

echo "[boomlab] A aplicar migrations Prisma..."
# Precisa de Prisma CLI - vem no node_modules/prisma
npx --yes prisma db push --accept-data-loss --skip-generate || {
  echo "[boomlab] AVISO: prisma db push falhou. A continuar mesmo assim."
}

echo "[boomlab] A iniciar servidor Next.js na porta ${PORT}..."
exec node server.js
