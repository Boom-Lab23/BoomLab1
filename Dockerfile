# Multi-stage Dockerfile for BoomLab Platform (Next.js 15 + Prisma)
# Produz imagem final ~120MB optimizada para produção.

# ============================================================
# Stage 1: deps — instala dependências uma só vez
# ============================================================
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --ignore-scripts

# ============================================================
# Stage 2: builder — gera Prisma client + build Next.js standalone
# ============================================================
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma client generation (precisa do schema)
RUN npx prisma generate

# Next.js build
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ============================================================
# Stage 3: runner — imagem final mínima
# ============================================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Utilizador non-root para segurança
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copia build Next.js standalone + assets públicos + .next/static
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma runtime: copia schema e client gerado (necessários em runtime)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

USER nextjs
EXPOSE 3000

# Entrypoint corre migrations Prisma antes de iniciar
COPY --chown=nextjs:nodejs docker/entrypoint.sh /entrypoint.sh
CMD ["/bin/sh", "/entrypoint.sh"]
