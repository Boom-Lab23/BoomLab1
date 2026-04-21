#!/bin/sh
set -e

echo "[boomlab] A aplicar migrations Prisma..."
# Usa directamente o binario node_modules/prisma/build/index.js em vez de npx
# (npx tenta reinstalar, o que falha numa imagem minima sem npm config dir)
if [ -f "./node_modules/prisma/build/index.js" ]; then
  node ./node_modules/prisma/build/index.js db push --accept-data-loss --skip-generate || {
    echo "[boomlab] AVISO: prisma db push falhou. A continuar mesmo assim."
  }
else
  echo "[boomlab] AVISO: prisma CLI nao encontrado em node_modules/prisma. Skipping migrations."
fi

echo "[boomlab] A iniciar servidor Next.js na porta ${PORT}..."
exec node server.js
