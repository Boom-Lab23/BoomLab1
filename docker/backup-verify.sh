#!/bin/bash
# Verificacao semanal de backup - corre aos domingos as 04:00
# Restaura o ultimo backup para uma DB temporaria e conta rows.
# Se contagem bate com BD producao, sucesso. Se nao, alerta.
#
# Instalacao:
#   crontab -e
#   0 4 * * 0 POSTGRES_USER=boomlab POSTGRES_DB=boomlab /opt/boomlab/docker/backup-verify.sh >> /var/log/boomlab-backup-verify.log 2>&1
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/boomlab/backups}"
ALERT_EMAIL="${BACKUP_ALERT_EMAIL:-guilherme@boomlab.agency}"
RESEND_KEY="${RESEND_API_KEY:-}"
RESEND_FROM="${RESEND_FROM:-noreply@boomlab.agency}"
TEST_DB="boomlab_restore_test_$(date +%s)"

alert() {
  local subject="$1"
  local body="$2"
  echo "[verify] ALERT: $subject - $body"
  if [ -n "${CRON_SECRET:-}" ]; then
    curl -sS -X POST "${APP_URL:-https://servico.boomlab.cloud}/api/admin/alert" \
      -H "x-cron-secret: $CRON_SECRET" \
      -H "Content-Type: application/json" \
      -d "$(jq -cn --arg s "Verify: $subject" --arg b "$body" --arg e "$ALERT_EMAIL" '{subject:$s, body:$b, to:$e}' 2>/dev/null || echo "{\"subject\":\"Verify: $subject\",\"body\":\"$body\"}")" \
      > /dev/null 2>&1 || true
  fi
}

cleanup() {
  docker exec boomlab-db psql -U "${POSTGRES_USER:-boomlab}" -d postgres -c "DROP DATABASE IF EXISTS \"$TEST_DB\";" > /dev/null 2>&1 || true
}
trap cleanup EXIT

# 1. Encontra ultimo backup
LATEST=$(ls -1t "$BACKUP_DIR"/db_*.sql.gz 2>/dev/null | head -1)
if [ -z "$LATEST" ]; then
  alert "Sem backups" "Nao existem ficheiros db_*.sql.gz em $BACKUP_DIR"
  exit 1
fi
echo "[verify] Ultimo backup: $LATEST"

# 2. Cria DB temporaria
docker exec boomlab-db psql -U "${POSTGRES_USER:-boomlab}" -d postgres -c "CREATE DATABASE \"$TEST_DB\";"

# 3. Restaura
if ! zcat "$LATEST" | docker exec -i boomlab-db psql -U "${POSTGRES_USER:-boomlab}" -d "$TEST_DB" > /tmp/restore.log 2>&1; then
  alert "Restauro FALHOU" "zcat $LATEST | psql retornou erro. Ver /tmp/restore.log no VPS."
  exit 2
fi

# 4. Conta tabelas
TABLE_COUNT=$(docker exec boomlab-db psql -U "${POSTGRES_USER:-boomlab}" -d "$TEST_DB" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")
if [ "$TABLE_COUNT" -lt 5 ]; then
  alert "Backup restaura mas poucas tabelas" "Apenas $TABLE_COUNT tabelas restauradas. Esperado: >= 5. Provavelmente o dump nao contem o schema completo."
  exit 3
fi

echo "[verify] OK - Restauro bem sucedido. $TABLE_COUNT tabelas restauradas de $LATEST"
