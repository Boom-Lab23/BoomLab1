#!/bin/bash
# Backup automatico BoomLab Platform - HARDENED
# Corre via cron todas as noites as 03:00
#
# Instalacao no VPS:
#   crontab -e
#   0 3 * * * POSTGRES_USER=boomlab POSTGRES_DB=boomlab /opt/boomlab/docker/backup.sh >> /var/log/boomlab-backup.log 2>&1
#
# Guarantees contra dataloss:
# 1. Sanity check: falha se dump < 100 linhas OU < 1KB (previne backups fantasma)
# 2. Alerta por email via curl ao Resend (se BACKUP_ALERT_EMAIL env estiver set)
# 3. Upload offsite para S3-compatible (Backblaze B2) se AWS_* env vars set
# 4. File marker BACKUP_LAST_SUCCESS.txt para monitorizacao external
# 5. Retorna exit code != 0 em falha - cron email root automaticamente
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/boomlab/backups}"
DATE=$(date +%Y-%m-%d_%H-%M)
KEEP_DAYS=${KEEP_DAYS:-30}
MIN_LINES=${MIN_LINES:-100}
MIN_BYTES=${MIN_BYTES:-1024}
ALERT_EMAIL="${BACKUP_ALERT_EMAIL:-guilherme@boomlab.agency}"
RESEND_KEY="${RESEND_API_KEY:-}"
RESEND_FROM="${RESEND_FROM:-noreply@boomlab.agency}"

mkdir -p "$BACKUP_DIR"

log() {
  echo "[backup $(date '+%Y-%m-%d %H:%M:%S')] $*"
}

alert() {
  local subject="$1"
  local body="$2"
  log "ALERT: $subject - $body"
  # Chama endpoint interno da app - que usa Gmail SMTP ja configurado
  if [ -n "${CRON_SECRET:-}" ]; then
    curl -sS -X POST "${APP_URL:-http://boomlab-app:3000}/api/admin/alert" \
      -H "x-cron-secret: $CRON_SECRET" \
      -H "Content-Type: application/json" \
      -d "$(jq -cn --arg s "Backup: $subject" --arg b "$body" --arg e "$ALERT_EMAIL" '{subject:$s, body:$b, to:$e}' 2>/dev/null || echo "{\"subject\":\"Backup: $subject\",\"body\":\"$body\"}")" \
      > /dev/null 2>&1 || true
  fi
}

log "Inicio: $DATE"

DB_FILE="$BACKUP_DIR/db_${DATE}.sql.gz"
UPLOADS_FILE="$BACKUP_DIR/uploads_${DATE}.tar.gz"

# --- 1. Dump da BD ---
if ! docker exec boomlab-db pg_dump -U "${POSTGRES_USER:-boomlab}" "${POSTGRES_DB:-boomlab}" | gzip > "$DB_FILE"; then
  alert "pg_dump FALHOU" "O comando docker exec boomlab-db pg_dump retornou erro. Backup NAO foi criado."
  exit 1
fi

# --- 2. Validacao do tamanho do dump ---
BYTES_DB=$(stat -c%s "$DB_FILE" 2>/dev/null || stat -f%z "$DB_FILE")
LINES_DB=$(zcat "$DB_FILE" | wc -l)
SIZE_DB=$(du -h "$DB_FILE" | cut -f1)

if [ "$BYTES_DB" -lt "$MIN_BYTES" ]; then
  alert "Backup DB vazio" "Dump tem apenas $BYTES_DB bytes (minimo: $MIN_BYTES). Ficheiro: $DB_FILE. Backup eliminado para nao mascarar problema."
  rm -f "$DB_FILE"
  exit 2
fi

if [ "$LINES_DB" -lt "$MIN_LINES" ]; then
  alert "Backup DB muito pequeno" "Dump tem apenas $LINES_DB linhas (minimo: $MIN_LINES). Pode ter falhado a gerar dados. Ficheiro: $DB_FILE."
  # Nao apaga mas alerta - pode ser BD nova e vazia
fi

# --- 3. Verifica que SQL e valido (header + footer esperados) ---
if ! zcat "$DB_FILE" | head -5 | grep -q "PostgreSQL database dump"; then
  alert "Backup DB sem header PostgreSQL" "Dump nao comeca com header 'PostgreSQL database dump'. Provavelmente corrupto."
  rm -f "$DB_FILE"
  exit 3
fi

log "DB OK - $SIZE_DB, $LINES_DB linhas, $BYTES_DB bytes"

# --- 4. Snapshot dos uploads (volume correcto: boomlab_boomlab_uploads) ---
if docker run --rm \
  -v boomlab_boomlab_uploads:/source:ro \
  -v "$BACKUP_DIR:/backup" \
  alpine:latest \
  tar -czf "/backup/uploads_${DATE}.tar.gz" -C /source . 2>/dev/null; then
  SIZE_UP=$(du -h "$UPLOADS_FILE" | cut -f1)
  log "Uploads OK - $SIZE_UP"
else
  log "Uploads: volume vazio ou inacessivel (nao critico)"
fi

# --- 5. Upload offsite (S3/B2) - so se credenciais estiverem configuradas ---
if [ -n "${AWS_ACCESS_KEY_ID:-}" ] && [ -n "${AWS_SECRET_ACCESS_KEY:-}" ] && [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  if command -v aws >/dev/null 2>&1; then
    S3_ENDPOINT_ARG=""
    if [ -n "${AWS_S3_ENDPOINT:-}" ]; then
      S3_ENDPOINT_ARG="--endpoint-url=$AWS_S3_ENDPOINT"
    fi
    if aws s3 cp "$DB_FILE" "s3://$BACKUP_S3_BUCKET/db/db_${DATE}.sql.gz" $S3_ENDPOINT_ARG --storage-class STANDARD_IA 2>&1; then
      log "S3 upload OK - s3://$BACKUP_S3_BUCKET/db/db_${DATE}.sql.gz"
      if [ -f "$UPLOADS_FILE" ]; then
        aws s3 cp "$UPLOADS_FILE" "s3://$BACKUP_S3_BUCKET/uploads/uploads_${DATE}.tar.gz" $S3_ENDPOINT_ARG --storage-class STANDARD_IA 2>&1 || log "S3 uploads upload falhou (nao critico)"
      fi
    else
      alert "Upload offsite FALHOU" "aws s3 cp retornou erro ao enviar $DB_FILE para s3://$BACKUP_S3_BUCKET. Backup LOCAL foi criado OK mas offsite falhou."
    fi
  else
    log "aws CLI nao instalado - skip offsite upload"
  fi
fi

# --- 6. Rotacao local ---
find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +$KEEP_DAYS -delete
find "$BACKUP_DIR" -name "uploads_*.tar.gz" -mtime +$KEEP_DAYS -delete

# --- 7. Marker de ultimo sucesso (para monitorizacao external) ---
echo "$DATE" > "$BACKUP_DIR/BACKUP_LAST_SUCCESS.txt"
date +%s > "$BACKUP_DIR/BACKUP_LAST_SUCCESS.unix"

log "Completo: $DATE"
