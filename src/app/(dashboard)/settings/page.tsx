"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";
import {
  Settings, Plug, CheckCircle2, XCircle, ExternalLink, Copy,
  Calendar, FileText, Mic, Brain, Users, ChevronRight, User,
} from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const { data: session } = useSession();
  const userName = session?.user?.name ?? "Utilizador";
  const userEmail = session?.user?.email ?? "";
  const googleConnected = (session?.user as Record<string, unknown>)?.googleConnected as boolean | undefined;

  const [copied, setCopied] = useState("");

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  }

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/webhooks/fireflies`
    : "https://servico.boomlab.agency/api/webhooks/fireflies";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuracoes</h1>
        <p className="text-muted-foreground">Integracoes e gestao da plataforma</p>
      </div>

      {/* Quick Nav */}
      <div className="grid gap-3 md:grid-cols-3">
        <Link href="/admin/users" className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50">
          <div className="rounded-lg bg-blue-100 p-2.5"><Users className="h-5 w-5 text-blue-600" /></div>
          <div className="flex-1"><p className="font-semibold">Utilizadores</p><p className="text-xs text-muted-foreground">Criar e gerir contas</p></div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link href="/recordings" className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50">
          <div className="rounded-lg bg-purple-100 p-2.5"><Brain className="h-5 w-5 text-purple-600" /></div>
          <div className="flex-1"><p className="font-semibold">Base de Conhecimento IA</p><p className="text-xs text-muted-foreground">Scripts e documentos</p></div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link href="/settings/scripts" className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50">
          <div className="rounded-lg bg-orange-100 p-2.5"><Mic className="h-5 w-5 text-orange-600" /></div>
          <div className="flex-1"><p className="font-semibold">Scripts de Avaliacao</p><p className="text-xs text-muted-foreground">Criterios para analise</p></div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>

      {/* YOUR Connections (per user) */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b p-4">
          <User className="h-4 w-4 text-[#2D76FC]" />
          <h2 className="font-semibold">As tuas conexoes</h2>
          <span className="ml-auto text-xs text-muted-foreground">{userName} ({userEmail})</span>
        </div>

        {/* Google Calendar + Docs */}
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold">Google (Calendar + Docs)</p>
                <p className="text-sm text-muted-foreground">Sincronizar o teu calendario e documentos</p>
              </div>
            </div>
            {googleConnected ? (
              <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                <CheckCircle2 className="h-3 w-3" /> Conectado
              </span>
            ) : (
              <button
                onClick={() => signIn("google", { callbackUrl: "/settings" })}
                className="rounded-lg bg-[#2D76FC] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#2563EB]"
              >
                Conectar o meu Google
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {googleConnected
              ? "O teu Google esta conectado. O teu calendario e documentos estao sincronizados."
              : "Conecta o teu Google para sincronizar o teu calendario pessoal e ter acesso aos Google Docs. Cada membro da equipa precisa de conectar o seu Google individualmente."
            }
          </p>
        </div>
      </div>

      {/* Global Integrations (admin) */}
      <div className="rounded-xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-semibold">Integracoes Globais</h2>
          <p className="text-xs text-muted-foreground">Configuradas para toda a equipa pelo administrador</p>
        </div>

        {/* Fireflies */}
        <div className="border-b p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                <Mic className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="font-semibold">Fireflies.ai</p>
                <p className="text-sm text-muted-foreground">Transcricao automatica de reunioes</p>
              </div>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
              <CheckCircle2 className="h-3 w-3" /> Conectado
            </span>
          </div>
          <div className="mt-3 rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Webhook URL:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded border bg-background px-2 py-1 text-xs">{webhookUrl}</code>
              <button onClick={() => copyToClipboard(webhookUrl, "fireflies")} className="rounded border px-2 py-1 text-xs hover:bg-muted">
                {copied === "fireflies" ? "Copiado!" : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Claude AI */}
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <Brain className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold">Claude AI (Anthropic)</p>
                <p className="text-sm text-muted-foreground">Analise automatica de reunioes e chamadas</p>
              </div>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
              <CheckCircle2 className="h-3 w-3" /> Conectado
            </span>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
        <h3 className="font-semibold text-blue-800">Como funciona?</h3>
        <ul className="mt-2 space-y-1.5 text-sm text-blue-700">
          <li><strong>Google:</strong> Cada membro conecta o seu Google pessoal para sincronizar calendario e docs.</li>
          <li><strong>Fireflies:</strong> Global - todas as reunioes sao transcritas automaticamente.</li>
          <li><strong>Claude IA:</strong> Global - analisa reunioes e chamadas para toda a equipa.</li>
        </ul>
      </div>
    </div>
  );
}
