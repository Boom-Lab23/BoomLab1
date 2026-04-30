"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Plus, X, Shield, ShieldCheck, UserCheck, UserX,
  Eye, EyeOff, RotateCcw, Mail, Send,
  Building2, User, CheckCircle2, XCircle, KeyRound, AlertCircle,
} from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  CONSULTANT: "Consultor",
  MANAGER: "Gestor",
  GUEST_CLIENT: "Cliente",
  GUEST_TEAM_MEMBER: "Equipa Cliente",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
  CONSULTANT: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  MANAGER: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  GUEST_CLIENT: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300",
  GUEST_TEAM_MEMBER: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300",
};

const ROLE_ICONS: Record<string, React.ElementType> = {
  ADMIN: ShieldCheck,
  CONSULTANT: UserCheck,
  MANAGER: Shield,
  GUEST_CLIENT: Building2,
  GUEST_TEAM_MEMBER: User,
};

export default function AdminUsersPage() {
  const { data: authSession } = useSession();
  const myRole = (authSession?.user as Record<string, unknown>)?.role as string | undefined;
  const isAdmin = myRole === "ADMIN";
  const isManager = myRole === "MANAGER";
  const canManage = isAdmin || isManager;

  const [showCreate, setShowCreate] = useState(false);
  const [showResetPw, setShowResetPw] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [editPermsUserId, setEditPermsUserId] = useState<string | null>(null);
  const [editPermsForm, setEditPermsForm] = useState({ assignedChannelId: "", assignedWorkspaceClientId: "" });
  const [createResult, setCreateResult] = useState<{
    emailSent: boolean;
    emailError?: string;
    generatedPassword?: string;
  } | null>(null);
  const [resendNotice, setResendNotice] = useState<{ userId: string; success: boolean; error?: string; newPassword?: string; email?: string } | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "CONSULTANT" as string,
    assignedChannelId: "",
    assignedDashboardId: "",
    assignedWorkspaceClientId: "",
    assignedSubChannelIds: [] as string[],
    sendWelcomeEmail: true,
    autoGeneratePassword: true,
  });

  const users = trpc.admin.listUsers.useQuery();
  const channels = trpc.messaging.channels.useQuery({});
  const dashboardsList = trpc.dashboards.list.useQuery();
  const clientsList = trpc.clients.list.useQuery({});
  const utils = trpc.useUtils();

  const createUser = trpc.admin.createUser.useMutation({
    onSuccess: (data) => {
      utils.admin.listUsers.invalidate();
      setCreateResult({
        emailSent: data.emailSent,
        emailError: data.emailError,
        generatedPassword: data.generatedPassword,
      });
      setForm({ name: "", email: "", password: "", role: "CONSULTANT", assignedChannelId: "", assignedDashboardId: "", assignedWorkspaceClientId: "", assignedSubChannelIds: [], sendWelcomeEmail: true, autoGeneratePassword: true });
    },
  });

  const updateUser = trpc.admin.updateUser.useMutation({
    onSuccess: () => utils.admin.listUsers.invalidate(),
  });

  const deactivateUser = trpc.admin.deactivateUser.useMutation({
    onSuccess: () => utils.admin.listUsers.invalidate(),
  });

  const activateUser = trpc.admin.activateUser.useMutation({
    onSuccess: () => utils.admin.listUsers.invalidate(),
  });

  const resetPassword = trpc.admin.resetPassword.useMutation({
    onSuccess: () => { setShowResetPw(null); setNewPassword(""); utils.admin.listUsers.invalidate(); },
  });

  const resendWelcome = trpc.admin.resendWelcomeEmail.useMutation({
    onSuccess: (data, variables) => {
      utils.admin.listUsers.invalidate();
      setResendNotice({
        userId: variables.userId,
        success: data.success,
        error: data.error,
        newPassword: data.newPassword,
        email: data.email,
      });
      // Mantem aberto ate o admin fechar manualmente (a password e info util)
    },
  });

  const resetAndEmail = trpc.admin.resetPasswordAndEmail.useMutation({
    onSuccess: (data, variables) => {
      utils.admin.listUsers.invalidate();
      setResendNotice({
        userId: variables.userId,
        success: data.success,
        error: data.error,
        newPassword: data.newPassword,
        email: data.email,
      });
    },
  });

  const isGuestRole = form.role === "GUEST_CLIENT" || form.role === "GUEST_TEAM_MEMBER";
  const selectedChannel = channels.data?.find((c) => c.id === form.assignedChannelId);

  // Group users
  const internalUsers = users.data?.filter((u) => u.isActive && !u.role.startsWith("GUEST")) ?? [];
  const guestUsers = users.data?.filter((u) => u.isActive && u.role.startsWith("GUEST")) ?? [];
  const inactiveUsers = users.data?.filter((u) => !u.isActive) ?? [];

  if (!canManage) {
    return (
      <div className="p-8 text-center">
        <p className="text-lg font-semibold">Acesso negado</p>
        <p className="mt-2 text-sm text-muted-foreground">Apenas administradores e gestores podem gerir utilizadores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestao de Utilizadores</h1>
          <p className="text-muted-foreground">
            {internalUsers.length} equipa, {guestUsers.length} clientes, {inactiveUsers.length} inativos
            {isManager && <span className="ml-2 rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-300">Gestor</span>}
          </p>
        </div>
        <button
          onClick={() => { setCreateResult(null); setShowCreate(true); }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo Utilizador
        </button>
      </div>

      {isManager && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 p-3 text-sm text-blue-800 dark:text-blue-300">
          Como <strong>gestor</strong>, podes atribuir acessos (workspace + canal de mensagens) a clientes e equipas, reenviar credenciais e resetar passwords. Operacoes destrutivas (apagar contas, alterar roles) sao reservadas a administradores.
        </div>
      )}

      {/* Global resend notice */}
      {resendNotice && (
        <div className={cn(
          "rounded-lg border p-3 text-sm",
          resendNotice.success ? "border-green-200 bg-green-50 dark:bg-green-950/30 text-green-800" : "border-red-200 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
        )}>
          <div className="flex items-start gap-2">
            {resendNotice.success ? <CheckCircle2 className="h-4 w-4 mt-0.5" /> : <AlertCircle className="h-4 w-4 mt-0.5" />}
            <div className="flex-1">
              <p className="font-medium">
                {resendNotice.success
                  ? "Email enviado com sucesso."
                  : `Falha a enviar email: ${resendNotice.error ?? "erro desconhecido"}`}
              </p>
              {resendNotice.newPassword && (
                <div className="mt-2 rounded border border-green-300 bg-white p-2 text-xs text-green-900 dark:text-green-200">
                  <p className="font-semibold mb-1">Credenciais geradas (guarda por precaucao):</p>
                  <p>Email: <code className="font-mono bg-gray-100 px-1 rounded">{resendNotice.email}</code></p>
                  <p>Password: <code className="font-mono bg-gray-100 px-1 rounded select-all">{resendNotice.newPassword}</code></p>
                  <p className="text-green-700 dark:text-green-300 mt-1">O cliente pode usar estas credenciais mesmo que o email tenha falhado. Email normalizado automaticamente para lowercase.</p>
                </div>
              )}
            </div>
            <button onClick={() => setResendNotice(null)} className="text-xs opacity-60 hover:opacity-100">&times;</button>
          </div>
        </div>
      )}

      {/* Internal Team */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b p-4">
          <Shield className="h-4 w-4 text-[#2D76FC]" />
          <h2 className="font-semibold">Equipa BoomLab</h2>
          <span className="ml-auto text-sm text-muted-foreground">{internalUsers.length}</span>
        </div>
        <div className="divide-y">
          {internalUsers.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground text-center">Sem membros da equipa.</p>
          )}
          {internalUsers.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              onChangeRole={(role) => updateUser.mutate({ id: user.id, data: { role: role as "ADMIN" } })}
              onChangePersonality={(p) =>
                updateUser.mutate({ id: user.id, data: { personality: p } })
              }
              onDeactivate={() => deactivateUser.mutate(user.id)}
              onResetPw={() => setShowResetPw(user.id)}
              onResendEmail={() => resendWelcome.mutate({ userId: user.id })}
              onResetAndEmail={() => resetAndEmail.mutate({ userId: user.id })}
              onUpdateNameEmail={(patch) => updateUser.mutate({ id: user.id, data: patch })}
              onEditPerms={() => {
                setEditPermsUserId(user.id);
                setEditPermsForm({
                  assignedChannelId: user.assignedChannelId ?? "",
                  assignedWorkspaceClientId: user.assignedWorkspaceClient?.id ?? "",
                });
              }}
              isBusy={resendWelcome.isPending || resetAndEmail.isPending}
            />
          ))}
        </div>
      </div>

      {/* Guest Users (Clients) */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b p-4">
          <Building2 className="h-4 w-4 text-orange-500" />
          <h2 className="font-semibold">Clientes & Equipas de Clientes</h2>
          <span className="ml-auto text-sm text-muted-foreground">{guestUsers.length}</span>
        </div>
        <div className="divide-y">
          {guestUsers.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground text-center">Sem clientes com acesso. Cria um utilizador com role &quot;Cliente&quot;.</p>
          )}
          {guestUsers.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              onChangeRole={(role) => updateUser.mutate({ id: user.id, data: { role: role as "ADMIN" } })}
              onDeactivate={() => deactivateUser.mutate(user.id)}
              onResetPw={() => setShowResetPw(user.id)}
              onResendEmail={() => resendWelcome.mutate({ userId: user.id })}
              onResetAndEmail={() => resetAndEmail.mutate({ userId: user.id })}
              onUpdateNameEmail={(patch) => updateUser.mutate({ id: user.id, data: patch })}
              onEditPerms={() => {
                setEditPermsUserId(user.id);
                setEditPermsForm({
                  assignedChannelId: user.assignedChannelId ?? "",
                  assignedWorkspaceClientId: user.assignedWorkspaceClient?.id ?? "",
                });
              }}
              isBusy={resendWelcome.isPending || resetAndEmail.isPending}
            />
          ))}
        </div>
      </div>

      {/* Inactive */}
      {inactiveUsers.length > 0 && (
        <div className="rounded-xl border bg-card">
          <div className="border-b p-4">
            <h2 className="font-semibold text-muted-foreground">Inativos</h2>
          </div>
          <div className="divide-y">
            {inactiveUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-4 p-4 opacity-50">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-500">{user.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <button onClick={() => activateUser.mutate(user.id)} className="rounded-lg border px-3 py-1 text-xs hover:bg-muted">Reativar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============ CREATE USER DIALOG ============ */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 animate-scale-in">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Novo Utilizador</h2>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>

            {/* Success result */}
            {createResult && (
              <div className="mb-4 space-y-2 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 p-4 text-sm">
                <div className="flex items-center gap-2 font-medium text-green-800 dark:text-green-300">
                  <CheckCircle2 className="h-4 w-4" />
                  Utilizador criado com sucesso!
                </div>
                {createResult.emailSent && (
                  <p className="text-green-700 dark:text-green-300">✉️ Email de boas-vindas enviado com as credenciais de acesso.</p>
                )}
                {!createResult.emailSent && createResult.emailError && (
                  <div className="flex items-start gap-2 text-red-700 dark:text-red-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Email nao enviado: {createResult.emailError}</span>
                  </div>
                )}
                {createResult.generatedPassword && (
                  <div className="rounded border border-amber-200 bg-amber-50 p-2 text-amber-900">
                    <strong>Password gerada:</strong> <code className="font-mono">{createResult.generatedPassword}</code>
                    <p className="mt-1 text-xs">Guarda esta password caso o email nao chegue ao destinatario.</p>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <button onClick={() => { setCreateResult(null); setShowCreate(false); }} className="rounded-lg border px-3 py-1.5 text-xs hover:bg-white">Fechar</button>
                  <button onClick={() => setCreateResult(null)} className="rounded-lg bg-primary px-3 py-1.5 text-xs text-white hover:bg-primary/90">Criar outro</button>
                </div>
              </div>
            )}

            {!createResult && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createUser.mutate({
                  name: form.name,
                  email: form.email,
                  password: form.autoGeneratePassword ? undefined : form.password,
                  role: form.role as "ADMIN",
                  assignedChannelId: form.assignedChannelId || undefined,
                  assignedDashboardId: form.assignedDashboardId || undefined,
                  assignedWorkspaceClientId: form.assignedWorkspaceClientId || undefined,
                  assignedSubChannelIds: form.assignedSubChannelIds.length ? form.assignedSubChannelIds : undefined,
                  sendWelcomeEmail: form.sendWelcomeEmail,
                });
              }}
              className="space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Nome *</label>
                  <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" placeholder="Nome completo" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Email *</label>
                  <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" placeholder="email@empresa.pt" />
                </div>
              </div>

              {/* Password section */}
              <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.autoGeneratePassword}
                    onChange={(e) => setForm({ ...form, autoGeneratePassword: e.target.checked })}
                    className="rounded"
                  />
                  <KeyRound className="h-4 w-4 text-primary" />
                  Gerar password automatica (recomendado)
                </label>

                {!form.autoGeneratePassword && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Password *</label>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} required={!form.autoGeneratePassword} minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-lg border px-3 py-2 pr-10 text-sm bg-card" placeholder="Min. 6 caracteres" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.sendWelcomeEmail}
                    onChange={(e) => setForm({ ...form, sendWelcomeEmail: e.target.checked })}
                    className="rounded"
                  />
                  <Mail className="h-4 w-4 text-primary" />
                  Enviar email de boas-vindas com credenciais
                </label>
                {form.sendWelcomeEmail && (
                  <p className="text-xs text-muted-foreground pl-6">
                    O utilizador vai receber um email com as credenciais e sera obrigado a alterar a password no primeiro login.
                  </p>
                )}
              </div>

              {/* Role Selection */}
              <div>
                <label className="mb-2 block text-sm font-medium">Tipo de Utilizador</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {(["CONSULTANT", "MANAGER", "ADMIN", "GUEST_CLIENT", "GUEST_TEAM_MEMBER"] as const).map((role) => {
                    const Icon = ROLE_ICONS[role] ?? UserCheck;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setForm({ ...form, role, assignedChannelId: "", assignedSubChannelIds: [] })}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                          form.role === role ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {ROLE_LABELS[role]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Channel Selection - only for Guest roles */}
              {isGuestRole && (
                <div className="space-y-3 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/30 p-4">
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                    {form.role === "GUEST_CLIENT" ? "Canal do Cliente" : "Canal da Equipa do Cliente"}
                  </p>
                  <p className="text-xs text-orange-600">
                    Este utilizador so vai ver o canal e/ou dashboard selecionados. Nao tera acesso a mais nada da plataforma.
                  </p>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-orange-800 dark:text-orange-300">Canal *</label>
                    <select
                      required
                      value={form.assignedChannelId}
                      onChange={(e) => setForm({ ...form, assignedChannelId: e.target.value, assignedSubChannelIds: [] })}
                      className="w-full rounded-lg border px-3 py-2 text-sm bg-white"
                    >
                      <option value="">Selecionar canal...</option>
                      {channels.data?.filter((c) => c.type === "CLIENT").map((ch) => (
                        <option key={ch.id} value={ch.id}>{ch.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Sub-channel selection */}
                  {selectedChannel && selectedChannel.subChannels.length > 0 && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-orange-800 dark:text-orange-300">Sub-canais com acesso</label>
                      <p className="mb-2 text-xs text-orange-600">Seleciona a que sub-canais este utilizador tem acesso:</p>
                      <div className="space-y-1.5">
                        {selectedChannel.subChannels.map((sub) => (
                          <label key={sub.id} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={form.assignedSubChannelIds.includes(sub.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setForm({ ...form, assignedSubChannelIds: [...form.assignedSubChannelIds, sub.id] });
                                } else {
                                  setForm({ ...form, assignedSubChannelIds: form.assignedSubChannelIds.filter((id) => id !== sub.id) });
                                }
                              }}
                              className="rounded"
                            />
                            # {sub.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Workspace access (completo: Dashboard + CRM Leads + Sales Analysis) */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-orange-800 dark:text-orange-300">Workspace (opcional)</label>
                    <select
                      value={form.assignedWorkspaceClientId}
                      onChange={(e) => setForm({ ...form, assignedWorkspaceClientId: e.target.value })}
                      className="w-full rounded-lg border px-3 py-2 text-sm bg-white"
                    >
                      <option value="">Sem acesso a workspace</option>
                      {clientsList.data?.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-orange-600">
                      Da acesso ao workspace do cliente (Dashboard + CRM Leads + Analise de Vendas).
                    </p>
                  </div>

                  {/* Legacy dashboard-only access (oculto se workspace atribuido) */}
                  {!form.assignedWorkspaceClientId && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-orange-700 dark:text-orange-300">Opcoes avancadas (legacy)</summary>
                      <div className="mt-2">
                        <label className="mb-1 block text-xs font-medium text-orange-800 dark:text-orange-300">Dashboard isolada (opcional)</label>
                        <select
                          value={form.assignedDashboardId}
                          onChange={(e) => setForm({ ...form, assignedDashboardId: e.target.value })}
                          className="w-full rounded-lg border px-3 py-2 text-xs bg-white"
                        >
                          <option value="">Nao atribuir</option>
                          {dashboardsList.data?.map((db) => (
                            <option key={db.id} value={db.id}>{db.client.name} ({db.market})</option>
                          ))}
                        </select>
                        <p className="mt-1 text-[10px] text-orange-600">
                          Alternativa: so dashboard isolada (sem CRM Leads ou Sales Analysis). Preferir o Workspace acima.
                        </p>
                      </div>
                    </details>
                  )}
                </div>
              )}

              {createUser.error && (
                <p className="text-sm text-red-600">{createUser.error.message}</p>
              )}

              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={createUser.isPending || (isGuestRole && !form.assignedChannelId)} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                  {createUser.isPending ? "A criar..." : "Criar Utilizador"}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}

      {/* Reset Password Dialog */}
      {showResetPw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 animate-scale-in">
            <h2 className="mb-4 text-lg font-bold">Reset Password</h2>
            <form onSubmit={(e) => { e.preventDefault(); resetPassword.mutate({ userId: showResetPw, newPassword }); }} className="space-y-4">
              <input type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" placeholder="Nova password" />
              <p className="text-xs text-muted-foreground">O utilizador sera obrigado a alterar esta password no proximo login.</p>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowResetPw(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={resetPassword.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Permissions (workspace + channel) Dialog */}
      {editPermsUserId && (() => {
        const target = users.data?.find(u => u.id === editPermsUserId);
        if (!target) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-md rounded-2xl bg-card p-6 animate-scale-in">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Editar Acessos</h2>
                  <p className="text-xs text-muted-foreground">{target.name}</p>
                </div>
                <button onClick={() => setEditPermsUserId(null)} className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Workspace do cliente</label>
                  <select
                    value={editPermsForm.assignedWorkspaceClientId}
                    onChange={(e) => setEditPermsForm({ ...editPermsForm, assignedWorkspaceClientId: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm bg-card"
                  >
                    <option value="">Sem acesso a workspace</option>
                    {clientsList.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">Da acesso a Dashboard + CRM Leads + Analise de Vendas do cliente selecionado.</p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Canal de mensagens</label>
                  <select
                    value={editPermsForm.assignedChannelId}
                    onChange={(e) => setEditPermsForm({ ...editPermsForm, assignedChannelId: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm bg-card"
                  >
                    <option value="">Sem acesso a canal</option>
                    {channels.data?.filter(c => c.type === "CLIENT").map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">O cliente so ve este canal de mensagens. Nunca ve canais internos da BoomLab.</p>
                </div>

                {updateUser.error && (
                  <p className="text-xs text-red-600">Erro: {updateUser.error.message}</p>
                )}
              </div>

              <div className="mt-5 flex justify-end gap-3 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setEditPermsUserId(null)}
                  className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={updateUser.isPending}
                  onClick={() => {
                    updateUser.mutate({
                      id: editPermsUserId,
                      data: {
                        assignedChannelId: editPermsForm.assignedChannelId || null,
                        assignedWorkspaceClientId: editPermsForm.assignedWorkspaceClientId || null,
                      },
                    }, {
                      onSuccess: () => setEditPermsUserId(null),
                    });
                  }}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {updateUser.isPending ? "A guardar..." : "Guardar acessos"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// Consent badge
function ConsentBadge({ accepted, label }: { accepted: boolean; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-medium",
      accepted ? "bg-green-100 dark:bg-green-900/40 text-green-700" : "bg-red-100 dark:bg-red-900/40 text-red-600"
    )}>
      {accepted ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
      {label}
    </span>
  );
}

// User row component
function UserRow({ user, onChangeRole, onChangePersonality, onDeactivate, onResetPw, onResendEmail, onResetAndEmail, onEditPerms, onUpdateNameEmail, isBusy }: {
  user: {
    id: string; name: string; email: string; role: string;
    image: string | null; assignedChannel?: { name: string } | null;
    assignedChannelId?: string | null;
    assignedDashboard?: { client: { name: string }; market: string } | null;
    assignedWorkspaceClient?: { id: string; name: string } | null;
    consentPrivacyPolicy?: boolean; consentTerms?: boolean; consentDPA?: boolean;
    consentDataDeletion?: boolean; consentAIAnalysis?: boolean; consentsAcceptedAt?: string | null;
    welcomeEmailSentAt?: string | null; mustChangePassword?: boolean;
    salesProfile?: unknown;
    _count: { sessions: number; messages: number };
  };
  onChangeRole: (role: string) => void;
  onChangePersonality?: (p: "Introvertido" | "Extrovertido" | "Misto" | null) => void;
  onDeactivate: () => void;
  onResetPw: () => void;
  onResendEmail: () => void;
  onResetAndEmail: () => void;
  onEditPerms: () => void;
  onUpdateNameEmail: (patch: { name?: string; email?: string }) => void;
  isBusy?: boolean;
}) {
  const isGuest = user.role === "GUEST_CLIENT" || user.role === "GUEST_TEAM_MEMBER";
  // Extrai personalidade do salesProfile JSON (se existir)
  const personality = (() => {
    const sp = user.salesProfile as { personality?: string } | null | undefined;
    const p = sp?.personality;
    if (p === "Introvertido" || p === "Extrovertido" || p === "Misto") return p;
    return "";
  })();
  const hasAnyConsent = user.consentPrivacyPolicy || user.consentTerms || user.consentDPA;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: user.name, email: user.email });

  function startEdit() {
    setDraft({ name: user.name, email: user.email });
    setEditing(true);
  }
  function saveEdit() {
    const patch: { name?: string; email?: string } = {};
    if (draft.name.trim() && draft.name.trim() !== user.name) patch.name = draft.name.trim();
    if (draft.email.trim() && draft.email.trim().toLowerCase() !== user.email.toLowerCase()) patch.email = draft.email.trim().toLowerCase();
    if (Object.keys(patch).length > 0) onUpdateNameEmail(patch);
    setEditing(false);
  }

  return (
    <div className="p-3 md:p-4">
      <div className="flex items-center gap-3">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="h-9 w-9 rounded-full" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
            {user.name.charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-1.5">
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(false); }}
                placeholder="Nome"
                autoFocus
                className="w-full rounded border px-2 py-1 text-sm bg-card text-foreground"
              />
              <input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(false); }}
                placeholder="Email"
                className="w-full rounded border px-2 py-1 text-xs bg-card text-foreground"
              />
              <div className="flex gap-1">
                <button onClick={saveEdit} className="rounded bg-primary px-2 py-0.5 text-[10px] font-medium text-white hover:bg-primary/90">Guardar</button>
                <button onClick={() => setEditing(false)} className="rounded border px-2 py-0.5 text-[10px] hover:bg-muted">Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium">{user.name}</p>
                <button
                  onClick={startEdit}
                  className="text-[10px] text-primary hover:underline opacity-60 hover:opacity-100"
                  title="Editar nome e email"
                >
                  editar
                </button>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", ROLE_COLORS[user.role] ?? "bg-gray-100")}>
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
                {user.mustChangePassword && (
                  <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300" title="Utilizador ainda nao alterou a password">
                    1o login pendente
                  </span>
                )}
                {/* Badge 'email enviado' so aparece enquanto o 1o login esta pendente. Depois do primeiro login, desaparece. */}
                {user.welcomeEmailSentAt && user.mustChangePassword && (
                  <span className="rounded-full bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300" title={`Email enviado em ${new Date(user.welcomeEmailSentAt).toLocaleString("pt-PT")}`}>
                    ✉️ enviado
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </>
          )}
          {/* Acessos restritos SO para guests. Internos (admin/manager/consultor) tem acesso global. */}
          {isGuest && user.assignedChannel && (
            <p className="text-xs text-orange-600">Canal: {user.assignedChannel.name}</p>
          )}
          {isGuest && user.assignedWorkspaceClient && (
            <p className="text-xs text-[#2D76FC]">Workspace: {user.assignedWorkspaceClient.name}</p>
          )}
          {isGuest && !user.assignedWorkspaceClient && user.assignedDashboard && (
            <p className="text-xs text-[#2D76FC]">Dashboard: {user.assignedDashboard.client.name} ({user.assignedDashboard.market})</p>
          )}
          {!isGuest && (user.role === "MANAGER" || user.role === "ADMIN") && (
            <p className="text-xs text-green-600">Acesso global a plataforma</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <select value={user.role} onChange={(e) => onChangeRole(e.target.value)} className="hidden md:block rounded border bg-card px-1.5 py-1 text-xs">
            <option value="ADMIN">Admin</option>
            <option value="MANAGER">Gestor</option>
            <option value="CONSULTANT">Consultor</option>
            <option value="GUEST_CLIENT">Cliente</option>
            <option value="GUEST_TEAM_MEMBER">Equipa Cliente</option>
          </select>
          {/* Personalidade do comercial (so para non-guests). Usado pelo
              analisador de chamadas para adaptar dicas e tom do feedback. */}
          {!isGuest && onChangePersonality && (
            <select
              value={personality}
              onChange={(e) => {
                const v = e.target.value;
                onChangePersonality(v === "" ? null : (v as "Introvertido" | "Extrovertido" | "Misto"));
              }}
              className="hidden md:block rounded border bg-card px-1.5 py-1 text-xs"
              title="Personalidade do comercial (usado pela IA para personalizar feedback de chamadas)"
            >
              <option value="">Sem perfil</option>
              <option value="Introvertido">Introvertido</option>
              <option value="Extrovertido">Extrovertido</option>
              <option value="Misto">Misto</option>
            </select>
          )}
          <button
            onClick={onResendEmail}
            disabled={isBusy}
            className="rounded border p-1.5 text-muted-foreground hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-600 disabled:opacity-50"
            title="Reenviar email de acesso (gera nova password)"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onResetAndEmail}
            disabled={isBusy}
            className="rounded border p-1.5 text-muted-foreground hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50"
            title="Reset password + enviar email"
          >
            <Mail className="h-3.5 w-3.5" />
          </button>
          {isGuest && (
            <button
              onClick={onEditPerms}
              className="rounded border p-1.5 text-muted-foreground hover:bg-purple-50 dark:hover:bg-purple-950/30 hover:text-purple-600"
              title="Editar acessos (workspace + canal)"
            >
              <KeyRound className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={onResetPw} className="rounded border p-1.5 text-muted-foreground hover:bg-muted" title="Reset password manual"><RotateCcw className="h-3.5 w-3.5" /></button>
          <button onClick={onDeactivate} className="rounded border p-1.5 text-muted-foreground hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600" title="Desativar"><UserX className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      {/* Consents row */}
      {hasAnyConsent && (
        <div className="mt-2 ml-12 flex flex-wrap gap-1">
          <ConsentBadge accepted={!!user.consentPrivacyPolicy} label="Privacidade" />
          <ConsentBadge accepted={!!user.consentTerms} label="Termos" />
          <ConsentBadge accepted={!!user.consentDPA} label="DPA" />
          <ConsentBadge accepted={!!user.consentDataDeletion} label="Esquecimento" />
          <ConsentBadge accepted={!!user.consentAIAnalysis} label="Analise IA" />
          {user.consentsAcceptedAt && (
            <span className="text-[9px] text-muted-foreground ml-1">
              Aceite: {new Date(user.consentsAcceptedAt).toLocaleDateString("pt-PT")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
