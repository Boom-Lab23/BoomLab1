"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Zap, CheckCircle2, XCircle, SkipForward, RefreshCw, Plus, Trash2,
  ArrowLeft, ExternalLink, AlertCircle,
} from "lucide-react";

const OFFER_OPTIONS = ["Consultoria", "IA", "Mentoria", "BoomClub", "Ads", "Cold Calls"];

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; label: string; classes: string }> = {
  processed: { icon: CheckCircle2, label: "Processado", classes: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" },
  skipped: { icon: SkipForward, label: "Ignorado", classes: "bg-slate-100 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300" },
  failed: { icon: XCircle, label: "Falhou", classes: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" },
  pending: { icon: AlertCircle, label: "Pendente", classes: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300" },
};

export default function GhlAdminPage() {
  const { data: session } = useSession();
  const role = (session?.user as Record<string, unknown>)?.role as string | undefined;

  const mappings = trpc.ghl.listMappings.useQuery();
  const events = trpc.ghl.events.useQuery({ limit: 30 });
  const utils = trpc.useUtils();

  const [form, setForm] = useState({ ghlPipelineId: "", ghlPipelineName: "", offer: "Consultoria", defaultPillars: "" });

  const upsert = trpc.ghl.upsertMapping.useMutation({
    onSuccess: () => {
      utils.ghl.listMappings.invalidate();
      setForm({ ghlPipelineId: "", ghlPipelineName: "", offer: "Consultoria", defaultPillars: "" });
    },
  });
  const deleteMapping = trpc.ghl.deleteMapping.useMutation({
    onSuccess: () => utils.ghl.listMappings.invalidate(),
  });
  const reprocess = trpc.ghl.reprocess.useMutation({
    onSuccess: () => utils.ghl.events.invalidate(),
  });
  const fetchPipelines = trpc.ghl.fetchPipelinesFromGhl.useMutation();

  if (role !== "ADMIN" && role !== "MANAGER") {
    return (
      <div className="p-8 text-center">
        <p className="text-lg font-semibold">Acesso negado</p>
        <p className="text-sm text-muted-foreground">So admins podem configurar a integracao GHL.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/users" className="rounded-lg p-2 hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-yellow-500" /> Integracao GoHighLevel
          </h1>
          <p className="text-sm text-muted-foreground">
            Webhooks recebidos do GHL + mapeamento de pipelines para ofertas BoomLab.
          </p>
        </div>
      </div>

      {/* Info URL */}
      <div className="rounded-xl border bg-blue-50 dark:bg-blue-950/30 p-4">
        <p className="text-sm font-medium text-blue-900 dark:text-blue-200">URL do Webhook (configura no GHL)</p>
        <code className="mt-1 block rounded bg-card px-3 py-2 text-xs font-mono break-all">
          https://servico.boomlab.cloud/api/webhooks/ghl
        </code>
        <p className="mt-2 text-xs text-blue-800 dark:text-blue-300">
          Adiciona o header <code className="rounded bg-card px-1 font-mono">X-Webhook-Secret</code> com o valor da env <code className="rounded bg-card px-1 font-mono">GHL_WEBHOOK_SECRET</code>.
        </p>
      </div>

      {/* Pipeline mappings */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="font-semibold">Mapeamentos Pipeline -&gt; Oferta</h2>
            <p className="text-xs text-muted-foreground">Quando deal e fechado ganho nesta pipeline, cria cliente com esta oferta.</p>
          </div>
          <button
            onClick={async () => {
              try {
                const pipelines = await fetchPipelines.mutateAsync();
                alert(`${pipelines.length} pipelines encontradas no GHL:\n\n${pipelines.map((p) => `${p.name} (${p.id})`).join("\n")}`);
              } catch (err) {
                alert(`Erro ao buscar pipelines: ${err instanceof Error ? err.message : String(err)}`);
              }
            }}
            disabled={fetchPipelines.isPending}
            className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", fetchPipelines.isPending && "animate-spin")} /> Buscar do GHL
          </button>
        </div>

        {/* Form inline para adicionar / editar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            upsert.mutate({
              ghlPipelineId: form.ghlPipelineId.trim(),
              ghlPipelineName: form.ghlPipelineName.trim() || form.ghlPipelineId.trim(),
              offer: form.offer,
              defaultPillars: form.defaultPillars.split(",").map((s) => s.trim()).filter(Boolean),
              isActive: true,
            });
          }}
          className="grid grid-cols-2 md:grid-cols-5 gap-2 p-4 border-b"
        >
          <input required placeholder="Pipeline ID (GHL)" value={form.ghlPipelineId} onChange={(e) => setForm({ ...form, ghlPipelineId: e.target.value })} className="rounded border px-2 py-1.5 text-sm bg-card col-span-2 md:col-span-1" />
          <input placeholder="Nome (ex: Principal)" value={form.ghlPipelineName} onChange={(e) => setForm({ ...form, ghlPipelineName: e.target.value })} className="rounded border px-2 py-1.5 text-sm bg-card" />
          <select value={form.offer} onChange={(e) => setForm({ ...form, offer: e.target.value })} className="rounded border px-2 py-1.5 text-sm bg-card">
            {OFFER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <input placeholder="Pilares (CSV)" value={form.defaultPillars} onChange={(e) => setForm({ ...form, defaultPillars: e.target.value })} className="rounded border px-2 py-1.5 text-sm bg-card" />
          <button type="submit" disabled={upsert.isPending} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
            <Plus className="h-4 w-4 inline" /> {upsert.isPending ? "..." : "Adicionar"}
          </button>
        </form>

        <div className="divide-y">
          {mappings.isLoading && <p className="p-4 text-sm text-muted-foreground">A carregar...</p>}
          {mappings.data?.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              Sem mapeamentos. Adiciona acima — precisas de ir ao GHL e copiar o Pipeline ID.
            </p>
          )}
          {mappings.data?.map((m) => (
            <div key={m.id} className="flex items-center gap-3 p-3 px-4 text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-medium">{m.ghlPipelineName}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">{m.ghlPipelineId}</p>
              </div>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{m.offer}</span>
              {m.defaultPillars.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {m.defaultPillars.slice(0, 3).join(", ")}
                  {m.defaultPillars.length > 3 && "..."}
                </span>
              )}
              <button
                onClick={() => {
                  if (confirm(`Remover mapeamento "${m.ghlPipelineName}"?`)) deleteMapping.mutate({ id: m.id });
                }}
                className="rounded p-1 text-muted-foreground hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600"
                title="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Events log */}
      <div className="rounded-xl border bg-card">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Eventos recebidos (ultimos 30)</h2>
          <p className="text-xs text-muted-foreground">Historico de webhooks do GHL e resultado do processamento.</p>
        </div>
        <div className="divide-y">
          {events.isLoading && <p className="p-4 text-sm text-muted-foreground">A carregar...</p>}
          {events.data?.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              Ainda nao chegou nenhum webhook. Quando o GHL disparar um deal fechado, aparece aqui.
            </p>
          )}
          {events.data?.map((ev) => {
            const cfg = STATUS_CONFIG[ev.status] ?? STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            return (
              <div key={ev.id} className="flex items-start gap-3 p-3 px-4 text-sm hover:bg-muted/30">
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium flex items-center gap-1", cfg.classes)}>
                  <Icon className="h-3 w-3" /> {cfg.label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">
                    Deal {ev.ghlDealId.slice(0, 12)}...
                    {ev.stageName && <span className="ml-2 text-xs text-muted-foreground">stage: {ev.stageName}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(ev.createdAt).toLocaleString("pt-PT")}
                    {ev.error && <span className="ml-2 text-red-600 dark:text-red-400">erro: {ev.error}</span>}
                  </p>
                  {ev.createdClientId && (
                    <Link href={`/clients/${ev.createdClientId}`} className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      Ver cliente <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
                {(ev.status === "failed" || ev.status === "skipped") && (
                  <button
                    onClick={() => {
                      if (confirm("Reprocessar este evento?")) reprocess.mutate({ eventId: ev.id });
                    }}
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                    title="Reprocessar"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
