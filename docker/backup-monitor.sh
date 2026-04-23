#!/bin/bash
# Monitor de backup BoomLab - corre a cada hora
# Verifica se o ultimo backup foi feito nas ultimas 30h. Se nao, alerta.
#
# Instalacao:
#   crontab -e
#   7 * * * * /opt/boomlab/docker/backup-monitor.sh >> /var/log/boomlab-backup-monitor.log 2>&1
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/boomlab/backups}"
MARKER="$BACKUP_DIR/BACKUP_LAST_SUCCESS.unix"
MAX_AGE_HOURS=${MAX_AGE_HOURS:-30}
ALERT_EMAIL="${BACKUP_ALERT_EMAIL:-guilherme@boomlab.agency}"
RESEND_KEY="${RESEND_API_KEY:-}"
RESEND_FROM="${RESEND_FROM:-noreply@boomlab.agency}"

alert() {
  local subject="$1"
  local body="$2"
  echo "[monitor] ALERT: $subject - $body"
  if [ -n "${CRON_SECRET:-}" ]; then
    curl -sS -X POST "${APP_URL:-https://servico.boomlab.cloud}/api/admin/alert" \
      -H "x-cron-secret: $CRON_SECRET" \
      -H "Content-Type: application/json" \
      -d "$(jq -cn --arg s "Monitor: $subject" --arg b "$body" --arg e "$ALERT_EMAIL" '{subject:$s, body:$b, to:$e}' 2>/dev/null || echo "{\"subject\":\"Monitor: $subject\",\"body\":\"$body\"}")" \
      > /dev/null 2>&1 || true
  fi
}

if [ ! -f "$MARKER" ]; then
  alert "Nenhum backup NUNCA correu" "Nao existe ficheiro $MARKER. O backup nao corre ou falha sempre. Verifica /var/log/boomlab-backup.log."
  exit 1
fi

LAST_UNIX=$(cat "$MARKER")
NOW_UNIX=$(date +%s)
AGE_SECONDS=$((NOW_UNIX - LAST_UNIX))
AGE_HOURS=$((AGE_SECONDS / 3600))
MAX_AGE_SECONDS=$((MAX_AGE_HOURS * 3600))

if [ "$AGE_SECONDS" -gt "$MAX_AGE_SECONDS" ]; then
  LAST_DATE=$(date -d "@$LAST_UNIX" 2>/dev/null || date -r "$LAST_UNIX" 2>/dev/null || echo "$LAST_UNIX")
  alert "Ultimo backup ha $AGE_HOURS horas" "O ultimo backup com sucesso foi $LAST_DATE (ha $AGE_HOURS horas, limite: $MAX_AGE_HOURS). Investigar urgente."
  exit 1
fi

echo "[monitor] OK - ultimo backup ha $AGE_HOURS horas"
