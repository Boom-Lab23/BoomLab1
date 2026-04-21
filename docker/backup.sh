#!/bin/bash
# Backup automatico BoomLab Platform
# Corre via cron todas as noites as 03:00 (configurar com DEPLOY.md)
set -e

BACKUP_DIR="/opt/boomlab/backups"
DATE=$(date +%Y-%m-%d_%H-%M)
KEEP_DAYS=30

mkdir -p "$BACKUP_DIR"

echo "[backup] Inicio: $DATE"

# Dump DB
docker compose -f /opt/boomlab/docker-compose.yml exec -T db \
  pg_dump -U "${POSTGRES_USER:-boomlab}" "${POSTGRES_DB:-boomlab}" \
  | gzip > "$BACKUP_DIR/db_${DATE}.sql.gz"

# Snapshot uploads
docker run --rm \
  -v boomlab_uploads:/source:ro \
  -v "$BACKUP_DIR:/backup" \
  alpine:latest \
  tar -czf "/backup/uploads_${DATE}.tar.gz" -C /source . 2>/dev/null || true

# Rotacao
find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +$KEEP_DAYS -delete
find "$BACKUP_DIR" -name "uploads_*.tar.gz" -mtime +$KEEP_DAYS -delete

SIZE_DB=$(du -h "$BACKUP_DIR/db_${DATE}.sql.gz" 2>/dev/null | cut -f1)
echo "[backup] OK - DB=${SIZE_DB:-N/A}"
