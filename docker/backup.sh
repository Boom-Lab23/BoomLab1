#!/bin/bash
# Backup automatico BoomLab Platform
# Corre via cron todas as noites as 03:00
#
# Instalacao no VPS:
#   crontab -e
#   0 3 * * * POSTGRES_USER=boomlab POSTGRES_DB=boomlab /opt/boomlab/docker/backup.sh >> /var/log/boomlab-backup.log 2>&1
#
# Diferencas para versao anterior:
# - Usa docker exec directo (nao depende de docker-compose.yml que pode nao existir)
# - Container name correcto: boomlab-db
# - Volume correcto: boomlab_boomlab_uploads (Docker Compose prefixa com project_name)
# - Sanity check: falha se dump for vazio (previne "backup fantasma" de 20 bytes)
set -euo pipefail

BACKUP_DIR="/opt/boomlab/backups"
DATE=$(date +%Y-%m-%d_%H-%M)
KEEP_DAYS=30

mkdir -p "$BACKUP_DIR"

echo "[backup] Inicio: $DATE"

# --- Dump da BD ---
# Usa docker exec directo no container (nao depende do compose file)
if docker exec boomlab-db pg_dump -U "${POSTGRES_USER:-boomlab}" "${POSTGRES_DB:-boomlab}" | gzip > "$BACKUP_DIR/db_${DATE}.sql.gz"; then
  SIZE_DB=$(du -h "$BACKUP_DIR/db_${DATE}.sql.gz" | cut -f1)
  LINES_DB=$(zcat "$BACKUP_DIR/db_${DATE}.sql.gz" | wc -l)
  echo "[backup] DB OK - $SIZE_DB, $LINES_DB linhas"
  # Sanity check - backup minimo 50 linhas (schema base sozinho tem ~200+ linhas)
  if [ "$LINES_DB" -lt 50 ]; then
    echo "[backup] WARNING - dump DB parece vazio! ($LINES_DB linhas)"
  fi
else
  echo "[backup] ERRO: pg_dump falhou"
  exit 1
fi

# --- Snapshot dos uploads (volume correcto: boomlab_boomlab_uploads) ---
if docker run --rm \
  -v boomlab_boomlab_uploads:/source:ro \
  -v "$BACKUP_DIR:/backup" \
  alpine:latest \
  tar -czf "/backup/uploads_${DATE}.tar.gz" -C /source . 2>/dev/null; then
  SIZE_UP=$(du -h "$BACKUP_DIR/uploads_${DATE}.tar.gz" | cut -f1)
  echo "[backup] Uploads OK - $SIZE_UP"
else
  echo "[backup] Uploads: nenhum ficheiro ou volume vazio"
fi

# --- Rotacao (manter ultimos $KEEP_DAYS dias) ---
find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +$KEEP_DAYS -delete
find "$BACKUP_DIR" -name "uploads_*.tar.gz" -mtime +$KEEP_DAYS -delete

echo "[backup] Completo: $DATE"
