"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn, getStatusColor, formatStatus, getPillarFromModule, PILLARS } from "@/lib/utils";
import { Calendar, CheckCircle2, Clock, Star, Mic, FileText, ChevronRight, Plus, RefreshCw, AlertTriangle, X } from "lucide-react";
import { CreateSessionDialog } from "@/components/sessions/create-session-dialog";

// Apenas pilares comerciais aparecem como filtro nesta pagina
const COMMERCIAL_PILLARS = PILLARS.filter((p) =>
  ["gestao-comercial", "consultoria-comercial"].includes(p.id)
);

export default function SessionsPage() {
  const [module, setModule] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const sessions = trpc.sessions.list.useQuery({
    module: module || undefined,
  }, {
    // Auto-refresh: novas sessoes Fireflies aparecem sem F5
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const needsReview = trpc.sessions.needsReview.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const utils = trpc.useUtils();
  const syncFireflies = trpc.fireflies.sync.useMutation({
    onSuccess: () => {
      utils.sessions.list.invalidate();
      utils.sessions.needsReview.invalidate();
    },
  });
  const markMissed = trpc.sessions.markMissed.useMutation({
    onSuccess: () => {
      utils.sessions.list.invalidate();
      utils.sessions.needsReview.invalidate();
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sessoes</h1>
          <p className="text-muted-foreground">Timeline de todas as sessoes</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => syncFireflies.mutate()}
            disabled={syncFireflies.isPending}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            title="Puxa do Fireflies todas as reunioes recentes e cria sessoes automaticamente"
          >
            <RefreshCw className={`h-4 w-4 ${syncFireflies.isPending ? "animate-spin" : ""}`} />
            Sync Fireflies
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Nova Sessao
          </button>
        </div>
      </div>

      <CreateSessionDialog open={showCreate} onClose={() => setShowCreate(false)} />

      {syncFireflies.data && (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 p-3 text-sm text-green-800 dark:text-green-300">
          Sync concluido: <strong>{syncFireflies.data.fetched}</strong> reunioes analisadas &middot; <strong>{syncFireflies.data.matched}</strong> ligadas a sessoes existentes &middot; <strong>{syncFireflies.data.created}</strong> sessoes criadas automaticamente &middot; <strong>{syncFireflies.data.skipped}</strong> ja sincronizadas.
        </div>
      )}
      {syncFireflies.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
          Erro ao sincronizar: {syncFireflies.error.message}
        </div>
      )}

      {/* Pillar Tabs (so comerciais) */}
      <div className="flex flex-wrap gap-1.5 md:gap-2">
        <button
          onClick={() => setModule("")}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            !module ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-muted"
          )}
        >
          Todos
        </button>
        {COMMERCIAL_PILLARS.map((p) => (
          <button
            key={p.id}
            onClick={() => setModule(module === p.id ? "" : p.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              module === p.id ? "text-white" : "bg-card text-muted-foreground hover:bg-muted"
            )}
            style={module === p.id ? { backgroundColor: p.color } : undefined}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: module === p.id ? "white" : p.color }}
            />
            {p.label}
          </button>
        ))}
      </div>

      {/* SECCAO 1: Por Revisar (sessoes que passaram sem Fireflies) */}
      {(needsReview.data?.length ?? 0) > 0 && (
        <div className="rounded-xl border-2 border-orange-300 dark:border-orange-700 bg-orange-50/40 dark:bg-orange-950/20">
          <div className="border-b border-orange-200 dark:border-orange-800 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <h2 className="font-semibold text-orange-900 dark:text-orange-200">Por Revisar</h2>
              <span className="rounded-full bg-orange-200 dark:bg-orange-800 px-2 py-0.5 text-xs font-medium text-orange-900 dark:text-orange-200">
                {needsReview.data?.length}
              </span>
            </div>
            <p className="text-xs text-orange-800 dark:text-orange-300">
              Sessoes marcadas que ja passaram a data sem o Fireflies a transcrever. Indica o que aconteceu.
            </p>
          </div>
          <div className="divide-y divide-orange-200/40 dark:divide-orange-800/40">
            {needsReview.data?.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Clock className="h-5 w-5 text-orange-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.client.name} {s.assignedTo ? `· ${s.assignedTo.name}` : ""} · {s.date ? new Date(s.date).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) : "sem data"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      const dateStr = prompt("Nova data e hora (formato YYYY-MM-DD HH:mm):");
                      if (!dateStr) return;
                      const newDate = new Date(dateStr);
                      if (isNaN(newDate.getTime())) { alert("Data invalida"); return; }
                      markMissed.mutate({ id: s.id, reason: "REAGENDADA", newDate });
                    }}
                    disabled={markMissed.isPending}
                    className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800 disabled:opacity-50"
                  >
                    Reagendada
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Cancelar a sessao "${s.title}"?`)) {
                        markMissed.mutate({ id: s.id, reason: "CANCELADA" });
                      }
                    }}
                    disabled={markMissed.isPending}
                    className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800 disabled:opacity-50"
                  >
                    Cancelada
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Marcar como concluida sem Fireflies (reuniao aconteceu mas nao foi transcrita)?`)) {
                        markMissed.mutate({ id: s.id, reason: "FIREFLIES_AUSENTE" });
                      }
                    }}
                    disabled={markMissed.isPending}
                    className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:bg-gray-950/30 dark:text-gray-300 dark:border-gray-700 disabled:opacity-50"
                  >
                    Fireflies nao presente
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECCAO 2: Marcadas (futuras) */}
      {(() => {
        const now = Date.now();
        const futures = (sessions.data ?? []).filter((s) =>
          s.status === "MARCADA" && s.date && new Date(s.date).getTime() >= now
        );
        return (
          <div className="rounded-xl border bg-card">
            <div className="border-b p-4 flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                Sessoes Marcadas
              </h2>
              <span className="text-sm text-muted-foreground">{futures.length}</span>
            </div>
            <div className="divide-y">
              {futures.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">Sem sessoes marcadas para o futuro.</div>
              )}
              {futures.map((s) => <SessionRow key={s.id} session={s} />)}
            </div>
          </div>
        );
      })()}

      {/* SECCAO 3: Concluidas */}
      {(() => {
        const concluded = (sessions.data ?? []).filter((s) => s.status === "CONCLUIDA");
        return (
          <div className="rounded-xl border bg-card">
            <div className="border-b p-4 flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Sessoes Concluidas
              </h2>
              <span className="text-sm text-muted-foreground">{concluded.length}</span>
            </div>
            <div className="max-h-[800px] divide-y overflow-y-auto">
              {concluded.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">Sem sessoes concluidas.</div>
              )}
              {concluded.map((s) => <SessionRow key={s.id} session={s} />)}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

type SessionRowItem = {
  id: string;
  title: string;
  module: string;
  topic: string | null;
  date: Date | null;
  status: string;
  evaluation: number | null;
  client: { name: string };
  _count: { recordings: number; documents: number };
};

function SessionRow({ session }: { session: SessionRowItem }) {
  const pillar = getPillarFromModule(session.module);
  return (
    <Link
      key={session.id}
      href={`/sessions/${session.id}`}
      className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-center gap-4 min-w-0">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: pillar ? `${pillar.color}15` : "#f3f4f6" }}
        >
          {session.status === "CONCLUIDA" ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <Clock className="h-5 w-5" style={{ color: pillar?.color ?? "#6b7280" }} />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">{session.title}</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {pillar && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: pillar.color }} />}
            <span className="truncate">{session.client.name}</span>
            <span>&middot;</span>
            <span className="truncate">{session.topic ?? session.module}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        {session.evaluation && (
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 text-yellow-500" />
            <span className="text-sm font-medium">{session.evaluation}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          {session._count.recordings > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Mic className="h-3.5 w-3.5" /> {session._count.recordings}
            </span>
          )}
          {session._count.documents > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> {session._count.documents}
            </span>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm">
            {session.date ? new Date(session.date).toLocaleDateString("pt-PT", { day: "numeric", month: "short", year: "numeric" }) : "-"}
          </p>
          <span className={cn("text-xs", getStatusColor(session.status), "rounded px-1.5 py-0.5")}>
            {formatStatus(session.status)}
          </span>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </Link>
  );
}
