"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import {
  CheckCircle2, Copy, Calendar, Mic, Brain, Users, ChevronRight, User,
  Lock, Eye, EyeOff, AlertCircle, Sun, Moon, Palette, Shield,
} from "lucide-react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { data: session } = useSession();
  const userId = (session?.user as Record<string, unknown>)?.id as string | undefined;
  const userName = session?.user?.name ?? "Utilizador";
  const userEmail = session?.user?.email ?? "";
  const userRole = (session?.user as Record<string, unknown>)?.role as string | undefined;
  const googleConnected = (session?.user as Record<string, unknown>)?.googleConnected as boolean | undefined;
  const isGuest = userRole === "GUEST_CLIENT" || userRole === "GUEST_TEAM_MEMBER";

  const { theme, setTheme } = useTheme();
  const [copied, setCopied] = useState("");

  // Change password state
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  const changePassword = trpc.admin.changeOwnPassword.useMutation({
    onSuccess: () => {
      setPwSuccess(true);
      setPwForm({ current: "", next: "", confirm: "" });
      setTimeout(() => setPwSuccess(false), 4000);
    },
    onError: (err) => setPwError(err.message),
  });

  function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    if (pwForm.next !== pwForm.confirm) { setPwError("As passwords nao coincidem."); return; }
    if (pwForm.next.length < 8) { setPwError("A nova password tem de ter pelo menos 8 caracteres."); return; }
    if (pwForm.next === pwForm.current) { setPwError("A nova password tem de ser diferente da atual."); return; }
    if (!userId) { setPwError("Sessao invalida."); return; }
    changePassword.mutate({ userId, currentPassword: pwForm.current, newPassword: pwForm.next });
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  }

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/webhooks/fireflies`
    : "https://servico.boomlab.agency/api/webhooks/fireflies";

  // ============================================================
  // GUEST (CLIENT) SETTINGS - simplified
  // ============================================================
  if (isGuest) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold">Configuracoes</h1>
          <p className="text-muted-foreground">A tua conta</p>
        </div>

        {/* Account info */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b p-4">
            <User className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Conta</h2>
          </div>
          <div className="p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nome</span>
              <span className="font-medium">{userName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{userEmail}</span>
            </div>
          </div>
        </div>

        {/* Change password */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b p-4">
            <Shield className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Alterar password</h2>
          </div>
          <form onSubmit={submitPassword} className="p-4 space-y-3">
            {pwError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 p-2 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="h-3 w-3" /> {pwError}
              </div>
            )}
            {pwSuccess && (
              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 p-2 text-xs text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-3 w-3" /> Password atualizada com sucesso.
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium">Password atual</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showCurrent ? "text" : "password"}
                  required
                  value={pwForm.current}
                  onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 pl-9 pr-9 text-sm bg-card"
                />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showCurrent ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium">Nova password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showNext ? "text" : "password"}
                  required
                  minLength={8}
                  value={pwForm.next}
                  onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 pl-9 pr-9 text-sm bg-card"
                  placeholder="Min. 8 caracteres"
                />
                <button type="button" onClick={() => setShowNext(!showNext)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showNext ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium">Confirmar nova password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showNext ? "text" : "password"}
                  required
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 pl-9 text-sm bg-card"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={changePassword.isPending}
              className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {changePassword.isPending ? "A atualizar..." : "Guardar nova password"}
            </button>
          </form>
        </div>

        {/* Theme */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b p-4">
            <Palette className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Aparencia</h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => setTheme("light")}
              className={cn("flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors",
                theme === "light" ? "border-primary bg-primary/5" : "hover:bg-muted"
              )}
            >
              <Sun className="h-4 w-4" /> Modo claro
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={cn("flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors",
                theme === "dark" ? "border-primary bg-primary/5" : "hover:bg-muted"
              )}
            >
              <Moon className="h-4 w-4" /> Modo escuro
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // ADMIN / TEAM SETTINGS - full
  // ============================================================
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuracoes</h1>
        <p className="text-muted-foreground">Integracoes e gestao da plataforma</p>
      </div>

      {/* Quick Nav */}
      <div className="grid gap-3 md:grid-cols-3">
        <Link href="/admin/users" className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50">
          <div className="rounded-lg bg-blue-100 dark:bg-blue-900/40 p-2.5"><Users className="h-5 w-5 text-blue-600" /></div>
          <div className="flex-1"><p className="font-semibold">Utilizadores</p><p className="text-xs text-muted-foreground">Criar e gerir contas</p></div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link href="/knowledge" className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50">
          <div className="rounded-lg bg-purple-100 dark:bg-purple-900/40 p-2.5"><Brain className="h-5 w-5 text-purple-600" /></div>
          <div className="flex-1"><p className="font-semibold">Base de Conhecimento IA</p><p className="text-xs text-muted-foreground">Scripts e documentos</p></div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link href="/settings/scripts" className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50">
          <div className="rounded-lg bg-orange-100 dark:bg-orange-900/40 p-2.5"><Mic className="h-5 w-5 text-orange-600" /></div>
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

        <div className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold">Google (Calendar + Docs)</p>
                <p className="text-sm text-muted-foreground">Sincronizar o teu calendario e documentos</p>
              </div>
            </div>
            {googleConnected ? (
              <span className="flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/40 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">
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
        </div>
      </div>

      {/* Change password */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b p-4">
          <Shield className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Alterar password</h2>
        </div>
        <form onSubmit={submitPassword} className="p-4 space-y-3 max-w-md">
          {pwError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 p-2 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="h-3 w-3" /> {pwError}
            </div>
          )}
          {pwSuccess && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 p-2 text-xs text-green-700 dark:text-green-300">
              <CheckCircle2 className="h-3 w-3" /> Password atualizada com sucesso.
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            <input
              type="password"
              required
              placeholder="Password atual"
              value={pwForm.current}
              onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
              className="rounded-lg border px-3 py-2 text-sm bg-card"
            />
            <input
              type="password"
              required
              minLength={8}
              placeholder="Nova password"
              value={pwForm.next}
              onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
              className="rounded-lg border px-3 py-2 text-sm bg-card"
            />
            <input
              type="password"
              required
              placeholder="Confirmar"
              value={pwForm.confirm}
              onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
              className="rounded-lg border px-3 py-2 text-sm bg-card"
            />
          </div>
          <button
            type="submit"
            disabled={changePassword.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {changePassword.isPending ? "A atualizar..." : "Guardar nova password"}
          </button>
        </form>
      </div>

      {/* Global Integrations (admin) */}
      <div className="rounded-xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-semibold">Integracoes Globais</h2>
          <p className="text-xs text-muted-foreground">Configuradas para toda a equipa pelo administrador</p>
        </div>

        <div className="border-b p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/40">
                <Mic className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="font-semibold">Fireflies.ai</p>
                <p className="text-sm text-muted-foreground">Transcricao automatica de reunioes</p>
              </div>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/40 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">
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

        <div className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/40">
                <Brain className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold">Claude AI (Anthropic)</p>
                <p className="text-sm text-muted-foreground">Analise automatica de reunioes e chamadas</p>
              </div>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/40 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">
              <CheckCircle2 className="h-3 w-3" /> Conectado
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
