"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import {
  Settings, Plug, CheckCircle2, XCircle, ExternalLink, Copy,
  Calendar, FileText, Mic, Brain, Users, ChevronRight,
} from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
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
          <div className="rounded-lg bg-blue-100 p-2.5">
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Utilizadores</p>
            <p className="text-xs text-muted-foreground">Criar e gerir contas</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link href="/recordings" className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50">
          <div className="rounded-lg bg-purple-100 p-2.5">
            <Brain className="h-5 w-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Base de Conhecimento IA</p>
            <p className="text-xs text-muted-foreground">Scripts e documentos de referencia</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link href="/settings/scripts" className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50">
          <div className="rounded-lg bg-orange-100 p-2.5">
            <Mic className="h-5 w-5 text-orange-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Scripts de Avaliacao</p>
            <p className="text-xs text-muted-foreground">Criterios para analise de chamadas</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>

      {/* Integrations - Simplified */}
      <div className="rounded-xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-semibold">Integracoes</h2>
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
            <p className="text-xs font-medium text-muted-foreground mb-1">Webhook URL (copiar e colar no Fireflies):</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded border bg-background px-2 py-1 text-xs">{webhookUrl}</code>
              <button
                onClick={() => copyToClipboard(webhookUrl, "fireflies")}
                className="rounded border px-2 py-1 text-xs hover:bg-muted"
              >
                {copied === "fireflies" ? "Copiado!" : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              No Fireflies, vai a Integrations &gt; Webhooks e cola este URL. Ativa os eventos "Meeting Transcribed" e "Meeting Summarized".
            </p>
          </div>
        </div>

        {/* Claude AI */}
        <div className="border-b p-5">
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
          <p className="mt-2 text-xs text-muted-foreground">
            A IA analisa automaticamente reunioes e chamadas. Alimenta a Base de Conhecimento com os teus documentos para analises mais precisas.
          </p>
        </div>

        {/* Google */}
        <div className="border-b p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold">Google (Calendar + Docs)</p>
                <p className="text-sm text-muted-foreground">Sincronizar calendario e documentos</p>
              </div>
            </div>
            <button
              onClick={() => signIn("google", { callbackUrl: "/settings" })}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              Conectar Google
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Cada membro da equipa liga o seu Google para sincronizar o calendario e ter acesso aos Google Docs. Clica em "Conectar Google" ou usa o botao na pagina de login.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
        <h3 className="font-semibold text-blue-800">Como funciona a analise automatica?</h3>
        <ol className="mt-3 space-y-2 text-sm text-blue-700 list-decimal list-inside">
          <li><strong>Reuniao acontece</strong> - no Google Meet, Zoom, ou qualquer plataforma com Fireflies ativo</li>
          <li><strong>Fireflies transcreve</strong> - e envia automaticamente para a plataforma via webhook</li>
          <li><strong>IA analisa</strong> - gera resumo, plano de acao, score e feedback</li>
          <li><strong>Tudo registado</strong> - na sessao do cliente, com action items e proximos passos</li>
        </ol>
        <div className="mt-3 border-t border-blue-200 pt-3">
          <p className="text-sm font-medium text-blue-800">Para analisar chamadas manualmente:</p>
          <p className="text-sm text-blue-700">
            Vai a <strong>Gravacoes &amp; IA</strong> &gt; <strong>Upload Chamada</strong> &gt; cola a transcricao &gt; a IA analisa automaticamente.
          </p>
        </div>
      </div>
    </div>
  );
}
