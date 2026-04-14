"use client";

import { useState } from "react";
import {
  Settings, Key, Users, Plug, FileCode, CheckCircle2, XCircle,
  ExternalLink, Copy, Eye, EyeOff,
} from "lucide-react";
import Link from "next/link";

type Integration = {
  name: string;
  description: string;
  envKey: string;
  configured: boolean;
  docsUrl: string;
};

const integrations: Integration[] = [
  {
    name: "Fireflies.ai",
    description: "Transcricao e resumos automaticos de reunioes",
    envKey: "FIREFLIES_API_KEY",
    configured: !!process.env.NEXT_PUBLIC_FIREFLIES_CONFIGURED,
    docsUrl: "https://app.fireflies.ai/integrations",
  },
  {
    name: "Claude API (Anthropic)",
    description: "Analise IA de reunioes e chamadas",
    envKey: "ANTHROPIC_API_KEY",
    configured: !!process.env.NEXT_PUBLIC_ANTHROPIC_CONFIGURED,
    docsUrl: "https://console.anthropic.com",
  },
  {
    name: "Google OAuth",
    description: "Login, Google Calendar e Google Docs",
    envKey: "GOOGLE_CLIENT_ID",
    configured: !!process.env.NEXT_PUBLIC_GOOGLE_CONFIGURED,
    docsUrl: "https://console.cloud.google.com/apis/credentials",
  },
  {
    name: "Cloudflare R2",
    description: "Storage para gravacoes de chamadas e reunioes",
    envKey: "R2_ACCESS_KEY_ID",
    configured: false,
    docsUrl: "https://dash.cloudflare.com",
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuracoes</h1>
        <p className="text-muted-foreground">Gerir integracoes, equipa e scripts IA</p>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/settings/scripts" className="rounded-xl border bg-card p-5 transition-colors hover:bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2.5">
              <FileCode className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="font-semibold">Scripts IA</p>
              <p className="text-sm text-muted-foreground">Gerir scripts de avaliacao</p>
            </div>
          </div>
        </Link>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2.5">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold">Equipa</p>
              <p className="text-sm text-muted-foreground">Gerir membros e permissoes</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2.5">
              <Key className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-semibold">API & Webhooks</p>
              <p className="text-sm text-muted-foreground">Endpoints e chaves</p>
            </div>
          </div>
        </div>
      </div>

      {/* Integrations */}
      <div className="rounded-xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-semibold">Integracoes</h2>
          <p className="text-sm text-muted-foreground">
            Configura as API keys no ficheiro .env.local do projeto
          </p>
        </div>
        <div className="divide-y">
          {integrations.map((integration) => (
            <div key={integration.name} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-full p-1 ${integration.configured ? "text-green-600" : "text-gray-400"}`}>
                  {integration.configured ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <XCircle className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="font-medium">{integration.name}</p>
                  <p className="text-sm text-muted-foreground">{integration.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <code className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {integration.envKey}
                </code>
                <a
                  href={integration.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Webhook URLs */}
      <div className="rounded-xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-semibold">Webhooks</h2>
          <p className="text-sm text-muted-foreground">URLs para configurar nos servicos externos</p>
        </div>
        <div className="divide-y">
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">Fireflies Webhook</p>
              <p className="text-xs text-muted-foreground">Configura no Fireflies para receber transcricoes automaticamente</p>
            </div>
            <div className="flex items-center gap-2">
              <code className="rounded bg-gray-100 px-2 py-1 text-xs">/api/webhooks/fireflies</code>
              <button
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/fireflies`)}
                className="rounded-lg border p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Copiar URL"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">Google Drive Webhook</p>
              <p className="text-xs text-muted-foreground">Para sincronizacao automatica de Google Docs</p>
            </div>
            <div className="flex items-center gap-2">
              <code className="rounded bg-gray-100 px-2 py-1 text-xs">/api/webhooks/google-drive</code>
              <button
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/google-drive`)}
                className="rounded-lg border p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Copiar URL"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Setup Guide */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
        <h3 className="font-semibold text-blue-800">Guia de Configuracao</h3>
        <ol className="mt-2 space-y-1.5 text-sm text-blue-700 list-decimal list-inside">
          <li>Cria uma base de dados PostgreSQL no <strong>Neon</strong> (neon.tech) e adiciona o DATABASE_URL</li>
          <li>Corre <code className="rounded bg-blue-100 px-1">npx prisma db push</code> para criar as tabelas</li>
          <li>Configura o <strong>Google OAuth</strong> em console.cloud.google.com (Client ID + Secret)</li>
          <li>Adiciona a <strong>Fireflies API Key</strong> de app.fireflies.ai/integrations</li>
          <li>Adiciona a <strong>Claude API Key</strong> de console.anthropic.com</li>
          <li>Configura o webhook do Fireflies para apontar para o teu dominio</li>
          <li>Faz deploy na <strong>Vercel</strong> e esta pronto</li>
        </ol>
      </div>
    </div>
  );
}
