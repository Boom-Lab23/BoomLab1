"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Users, Plus, X, ArrowRight, UserPlus, TrendingUp,
  Clock, CheckCircle2, XCircle, Phone, Mail,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING: { label: "Pendente", color: "bg-gray-100 text-gray-700", icon: Clock },
  CONTACTED: { label: "Contactado", color: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300", icon: Phone },
  MEETING_SCHEDULED: { label: "Reuniao Agendada", color: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300", icon: Users },
  PROPOSAL_SENT: { label: "Proposta Enviada", color: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300", icon: Mail },
  CONVERTED: { label: "Convertido", color: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300", icon: CheckCircle2 },
  LOST: { label: "Perdido", color: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300", icon: XCircle },
};

const PIPELINE_ORDER = ["PENDING", "CONTACTED", "MEETING_SCHEDULED", "PROPOSAL_SENT", "CONVERTED", "LOST"];

export default function ReferralsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ referrerClientId: "", referredName: "", referredEmail: "", referredPhone: "", notes: "" });
  const [filterStatus, setFilterStatus] = useState("");

  const referrals = trpc.referrals.list.useQuery(filterStatus ? { status: filterStatus } : {});
  const stats = trpc.referrals.stats.useQuery();
  const clients = trpc.clients.list.useQuery({});
  const utils = trpc.useUtils();

  const createReferral = trpc.referrals.create.useMutation({
    onSuccess: () => { utils.referrals.list.invalidate(); utils.referrals.stats.invalidate(); setShowCreate(false); setForm({ referrerClientId: "", referredName: "", referredEmail: "", referredPhone: "", notes: "" }); },
  });

  const updateStatus = trpc.referrals.updateStatus.useMutation({
    onSuccess: () => { utils.referrals.list.invalidate(); utils.referrals.stats.invalidate(); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Referencias</h1>
          <p className="text-muted-foreground">Tracking de referrals por cliente</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Nova Referencia
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{stats.data?.total ?? 0}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Em Pipeline</p>
          <p className="text-2xl font-bold text-[#2D76FC]">{stats.data?.pending ?? 0}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Convertidos</p>
          <p className="text-2xl font-bold text-green-600">{stats.data?.converted ?? 0}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Taxa Conversao</p>
          <p className="text-2xl font-bold">{stats.data?.total ? Math.round((stats.data.converted / stats.data.total) * 100) : 0}%</p>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setFilterStatus("")} className={cn("rounded-full px-3 py-1 text-xs font-medium", !filterStatus ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-muted")}>Todos</button>
        {PIPELINE_ORDER.map((status) => {
          const config = STATUS_CONFIG[status];
          return (
            <button key={status} onClick={() => setFilterStatus(filterStatus === status ? "" : status)} className={cn("rounded-full px-3 py-1 text-xs font-medium", filterStatus === status ? config.color : "bg-card text-muted-foreground hover:bg-muted")}>
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Referrals List */}
      <div className="rounded-xl border bg-card">
        <div className="divide-y">
          {referrals.isLoading && <p className="p-8 text-center text-sm text-muted-foreground">A carregar...</p>}
          {referrals.data?.length === 0 && !referrals.isLoading && (
            <div className="flex flex-col items-center gap-2 p-8 text-muted-foreground">
              <UserPlus className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm">Sem referencias</p>
              <p className="text-xs">Adiciona referencias de clientes para tracking.</p>
            </div>
          )}
          {referrals.data?.map((ref) => {
            const config = STATUS_CONFIG[ref.status] ?? STATUS_CONFIG.PENDING;
            const StatusIcon = config.icon;
            const currentIdx = PIPELINE_ORDER.indexOf(ref.status);
            const nextStatus = currentIdx < 4 ? PIPELINE_ORDER[currentIdx + 1] : null;

            return (
              <div key={ref.id} className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2D76FC]/10 text-[#2D76FC] text-sm font-semibold">
                  {ref.referredName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{ref.referredName}</p>
                  <p className="text-xs text-muted-foreground">
                    Referido por <span className="font-medium">{ref.referrerClient.name}</span>
                    {ref.referredEmail && <> &middot; {ref.referredEmail}</>}
                    {ref.referredPhone && <> &middot; {ref.referredPhone}</>}
                  </p>
                  {ref.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{ref.notes}</p>}
                </div>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium flex items-center gap-1", config.color)}>
                  <StatusIcon className="h-3 w-3" /> {config.label}
                </span>
                {nextStatus && ref.status !== "CONVERTED" && ref.status !== "LOST" && (
                  <button
                    onClick={() => updateStatus.mutate({ id: ref.id, status: nextStatus as "PENDING" })}
                    className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                    title={`Avancar para ${STATUS_CONFIG[nextStatus]?.label}`}
                  >
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 animate-scale-in">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Nova Referencia</h2>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); createReferral.mutate({ referrerClientId: form.referrerClientId, referredName: form.referredName, referredEmail: form.referredEmail || undefined, referredPhone: form.referredPhone || undefined, notes: form.notes || undefined }); }} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Cliente que referiu *</label>
                <select required value={form.referrerClientId} onChange={(e) => setForm({ ...form, referrerClientId: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card">
                  <option value="">Selecionar...</option>
                  {clients.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Nome do referido *</label>
                <input type="text" required value={form.referredName} onChange={(e) => setForm({ ...form, referredName: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" placeholder="Nome da pessoa/empresa" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Email</label>
                  <input type="email" value={form.referredEmail} onChange={(e) => setForm({ ...form, referredEmail: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Telefone</label>
                  <input type="text" value={form.referredPhone} onChange={(e) => setForm({ ...form, referredPhone: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Notas</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" rows={2} />
              </div>
              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={createReferral.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">Criar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
