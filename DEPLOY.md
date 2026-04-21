# Deploy — BoomLab Platform em VPS Hostinger

Guia completo para migrar de Vercel/Neon para um **Hostinger VPS self-hosted** com Docker.

---

## 📋 Pré-requisitos

- **VPS Hostinger KVM 2** (2 vCPU, 8GB RAM, 100GB SSD) — ~8€/mês
  - SO: **Ubuntu 22.04 LTS**
  - SSH key configurada na compra
- Domínio **`servico.boomlab.agency`** (já tens)
- Acesso ao repo GitHub `Boom-Lab23/BoomLab1`
- API keys já existentes (Anthropic, Fireflies, Gmail, Google OAuth, AssemblyAI)

---

## 🚀 Passo-a-passo

### 1. Apontar DNS para o VPS

No teu provedor DNS (Cloudflare/Namecheap/onde registaste o domínio):

```
Tipo   Nome      Valor
A      servico   <IP-DO-VPS>   (o IP que o Hostinger te dá)
```

Aguardar ~1h para propagação. Verifica com:
```bash
dig +short servico.boomlab.agency
```

---

### 2. Ligar ao VPS e instalar dependências

```bash
ssh root@<IP-DO-VPS>

# Update do sistema
apt update && apt upgrade -y

# Firewall básico
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Docker + Docker Compose
curl -fsSL https://get.docker.com | sh
systemctl enable docker
docker --version
docker compose version

# Utilitários úteis
apt install -y git curl htop ncdu fail2ban
systemctl enable fail2ban
```

---

### 3. Clonar o repo e preparar env

```bash
mkdir -p /opt/boomlab
cd /opt/boomlab
git clone https://github.com/Boom-Lab23/BoomLab1.git .

# Copiar template e editar
cp .env.production.example .env.production
nano .env.production
```

**Valores a gerar/rever no `.env.production`:**

- `POSTGRES_PASSWORD` — gera uma forte:
  ```bash
  openssl rand -base64 32
  ```
- `NEXTAUTH_SECRET` — gera:
  ```bash
  openssl rand -base64 32
  ```
- Os restantes (Google, Fireflies, Anthropic, Gmail) — **copiar do `.env.local` atual da Vercel**
- `ASSEMBLYAI_API_KEY` — quando tiveres a key

---

### 4. Subir os containers

```bash
cd /opt/boomlab
docker compose up -d --build
```

O build demora ~5 minutos na primeira vez (instala Node, Postgres, Caddy, faz build do Next).

**Verificar que subiu:**
```bash
docker compose ps          # todos devem estar "running"
docker compose logs -f app # logs do Next.js
```

Caddy trata sozinho do SSL (Let's Encrypt) — só requer que o DNS já aponte para o VPS.

---

### 5. Migrar dados da Neon (Postgres cloud) para o Postgres local

**No teu computador local** (com acesso às duas DBs):

```bash
# 1. Dump da Neon
pg_dump "postgresql://neondb_owner:npg_Ra4zLSedMXj1@ep-lively-surf-ab6bcw7c.eu-west-2.aws.neon.tech/neondb?sslmode=require" \
  --no-owner --no-acl --data-only \
  > neon-dump.sql

# 2. Enviar para o VPS
scp neon-dump.sql root@<IP-VPS>:/opt/boomlab/
```

**No VPS:**
```bash
cd /opt/boomlab

# 3. Aplicar schema primeiro (Prisma db push - já foi feito no entrypoint)
#    Se precisar forçar: docker compose exec app npx prisma db push

# 4. Restaurar dados
docker compose exec -T db psql -U boomlab -d boomlab < neon-dump.sql
```

Testar login em `https://servico.boomlab.agency` com conta existente.

---

### 6. Configurar backup automático

```bash
# Tornar o script executável
chmod +x /opt/boomlab/docker/backup.sh

# Adicionar ao cron (todas as noites às 03:00)
(crontab -l 2>/dev/null; echo "0 3 * * * cd /opt/boomlab && ./docker/backup.sh >> /var/log/boomlab-backup.log 2>&1") | crontab -

# Verificar
crontab -l
```

**Backups off-site (opcional mas recomendado):**

Edita `docker/backup.sh` e descomenta uma das opções:
- **rclone** (Google Drive / Dropbox / OneDrive / S3 / Backblaze B2)
- **aws cli** (Amazon S3)

Instalar rclone:
```bash
apt install rclone
rclone config   # segue o wizard para o teu cloud provider
```

---

### 7. Atualizar Google OAuth (adicionar novo Redirect URI)

Na [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. Abrir o OAuth 2.0 Client ID da BoomLab Platform
2. Em **Authorized redirect URIs**, confirmar que já tens:
   - `https://servico.boomlab.agency/api/auth/callback/google`
3. Em **Authorized JavaScript origins**:
   - `https://servico.boomlab.agency`

---

### 8. Atualizar webhook Fireflies

Na [dashboard Fireflies](https://app.fireflies.ai/integrations):

- Webhook URL: `https://servico.boomlab.agency/api/webhooks/fireflies`
- (mesmo URL de antes, continua a apontar para o mesmo domínio)

---

### 9. Teste final

- [ ] `https://servico.boomlab.agency` abre (cadeado verde)
- [ ] Login com credenciais existentes funciona
- [ ] Workspace mostra clientes
- [ ] Mensagens carregam
- [ ] Upload de ficheiros em mensagens funciona
- [ ] PWA: no Chrome aparece botão "Instalar" ou no URL bar
- [ ] Instalar PWA no desktop — testar abrir
- [ ] Backup dry-run: `./docker/backup.sh`

---

## 🔄 Updates futuros (deploy de novas versões)

Sempre que fizer push para `main`:

```bash
ssh root@<IP-VPS>
cd /opt/boomlab
git pull
docker compose up -d --build
docker compose logs -f app   # verificar que arrancou sem erros
```

Tempo total de update: ~3 minutos.

---

## 🔧 Comandos úteis

```bash
# Ver logs
docker compose logs -f app          # app Next.js
docker compose logs -f db           # postgres
docker compose logs -f caddy        # proxy

# Restart sem rebuild
docker compose restart app

# Ver uso de recursos
docker stats

# Entrar no container app
docker compose exec app sh

# Consola Postgres
docker compose exec db psql -U boomlab -d boomlab

# Backup manual
./docker/backup.sh

# Restaurar backup
gunzip -c backups/db_2026-04-21_03-00.sql.gz | \
  docker compose exec -T db psql -U boomlab -d boomlab
```

---

## 🆘 Troubleshooting

### Caddy não consegue emitir SSL
- Verifica que o DNS já propagou: `dig +short servico.boomlab.agency`
- Verifica portas 80 e 443 abertas no firewall: `ufw status`
- Logs: `docker compose logs caddy`

### App não arranca
- Ver logs: `docker compose logs -f app`
- Normalmente é env var em falta
- Testar db: `docker compose exec db psql -U boomlab -d boomlab -c "\l"`

### "Too many open files" ou lentidão
- Aumentar limits no host: `/etc/security/limits.conf`
- Considerar upgrade para KVM 4

### PWA não aparece botão "Instalar"
- Manifest servido com content-type certo: `curl https://servico.boomlab.agency/manifest.webmanifest`
- Ícones acessíveis: `curl https://servico.boomlab.agency/icons/icon-192.png`
- Service Worker registado: DevTools > Application > Service Workers

---

## 📊 Monitorização (opcional)

### Uptime Robot (grátis)
1. Criar conta em uptimerobot.com
2. Adicionar monitor HTTP(S): `https://servico.boomlab.agency`
3. Alertas por email/SMS se cair

### Logs centralizados (avançado)
- Grafana + Loki via Docker (adicionar ao `docker-compose.yml`)

---

## 💰 Custo total recorrente

| Item | Mensal |
|---|---|
| Hostinger VPS KVM 2 | ~8€ |
| Anthropic Claude API | ~10-30€ (variável) |
| AssemblyAI | pay-per-use (~0.37$/h de áudio) |
| Gmail / Google (já têm) | 0€ |
| Fireflies (já têm) | — |
| **Total infra extra** | **~8-15€/mês** |

Comparar com Vercel Pro (20€) + Neon Pro (19€) = 39€/mês → **poupa-se ~75%**.

---

## 🔗 Referências

- [Hostinger VPS docs](https://support.hostinger.com/en/collections/1655134-vps)
- [Caddy docs](https://caddyserver.com/docs/)
- [Next.js standalone output](https://nextjs.org/docs/app/api-reference/next-config-js/output)
- [Prisma Docker best practices](https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-to-docker-containers)
