"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Users, Plus, X, Shield, ShieldCheck, UserCheck, UserX,
  Mail, Lock, Eye, EyeOff, RotateCcw, Calendar, MessageSquare,
} from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  CONSULTANT: "Consultor",
  MANAGER: "Gestor",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  CONSULTANT: "bg-blue-100 text-blue-700",
  MANAGER: "bg-green-100 text-green-700",
};

export default function AdminUsersPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [showResetPw, setShowResetPw] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "CONSULTANT" as string,
  });

  const users = trpc.admin.listUsers.useQuery();
  const utils = trpc.useUtils();

  const createUser = trpc.admin.createUser.useMutation({
    onSuccess: () => {
      utils.admin.listUsers.invalidate();
      setShowCreate(false);
      setForm({ name: "", email: "", password: "", role: "CONSULTANT" });
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
    onSuccess: () => {
      setShowResetPw(null);
      setNewPassword("");
    },
  });

  const activeUsers = users.data?.filter((u) => u.isActive) ?? [];
  const inactiveUsers = users.data?.filter((u) => !u.isActive) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestao de Utilizadores</h1>
          <p className="text-muted-foreground">
            {activeUsers.length} ativos, {inactiveUsers.length} inativos
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo Utilizador
        </button>
      </div>

      {/* Users List */}
      <div className="rounded-xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-semibold">Utilizadores Ativos</h2>
        </div>
        <div className="divide-y">
          {activeUsers.length === 0 && (
            <div className="flex flex-col items-center gap-2 p-8 text-muted-foreground">
              <Users className="h-8 w-8" />
              <p className="text-sm">Sem utilizadores. Cria o primeiro.</p>
            </div>
          )}
          {activeUsers.map((user) => (
            <div key={user.id} className="flex items-center gap-4 p-4">
              {/* Avatar */}
              {user.image ? (
                <img src={user.image} alt="" className="h-10 w-10 rounded-full" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-medium text-white">
                  {user.name.charAt(0)}
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{user.name}</p>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", ROLE_COLORS[user.role])}>
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                  {user.googleConnected && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                      Google
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {user._count.sessions}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> {user._count.messages}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {/* Role selector */}
                <select
                  value={user.role}
                  onChange={(e) =>
                    updateUser.mutate({
                      id: user.id,
                      data: { role: e.target.value as "ADMIN" | "CONSULTANT" | "MANAGER" },
                    })
                  }
                  className="rounded-lg border bg-card px-2 py-1 text-xs"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="MANAGER">Gestor</option>
                  <option value="CONSULTANT">Consultor</option>
                </select>

                {/* Reset password */}
                <button
                  onClick={() => setShowResetPw(user.id)}
                  className="rounded-lg border p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Reset password"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>

                {/* Deactivate */}
                <button
                  onClick={() => deactivateUser.mutate(user.id)}
                  className="rounded-lg border p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                  title="Desativar"
                >
                  <UserX className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Inactive Users */}
      {inactiveUsers.length > 0 && (
        <div className="rounded-xl border bg-card">
          <div className="border-b p-4">
            <h2 className="font-semibold text-muted-foreground">Utilizadores Inativos</h2>
          </div>
          <div className="divide-y">
            {inactiveUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-4 p-4 opacity-60">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-500">
                  {user.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <button
                  onClick={() => activateUser.mutate(user.id)}
                  className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Reativar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create User Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 animate-scale-in">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Novo Utilizador</h2>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-1 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createUser.mutate({
                  name: form.name,
                  email: form.email,
                  password: form.password,
                  role: form.role as "ADMIN" | "CONSULTANT" | "MANAGER",
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium">Nome *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="email@boomlab.agency"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 pr-10 text-sm"
                    placeholder="Minimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Role</label>
                <div className="flex gap-2">
                  {(["CONSULTANT", "MANAGER", "ADMIN"] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setForm({ ...form, role })}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                        form.role === role
                          ? "border-primary bg-primary/10 text-primary"
                          : "hover:bg-muted"
                      )}
                    >
                      {role === "ADMIN" && <ShieldCheck className="h-3.5 w-3.5" />}
                      {role === "MANAGER" && <Shield className="h-3.5 w-3.5" />}
                      {role === "CONSULTANT" && <UserCheck className="h-3.5 w-3.5" />}
                      {ROLE_LABELS[role]}
                    </button>
                  ))}
                </div>
              </div>

              {createUser.error && (
                <p className="text-sm text-red-600">{createUser.error.message}</p>
              )}

              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createUser.isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {createUser.isPending ? "A criar..." : "Criar Utilizador"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Dialog */}
      {showResetPw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 animate-scale-in">
            <h2 className="mb-4 text-lg font-bold">Reset Password</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                resetPassword.mutate({ userId: showResetPw, newPassword });
              }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium">Nova Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowResetPw(null)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">
                  Cancelar
                </button>
                <button type="submit" disabled={resetPassword.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                  {resetPassword.isPending ? "A guardar..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
