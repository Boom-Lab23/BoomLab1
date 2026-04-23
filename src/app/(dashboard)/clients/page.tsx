"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn, getStatusColor, formatStatus } from "@/lib/utils";
import { Search, Users, ChevronRight, Plus, Clock, AlertTriangle, Calendar } from "lucide-react";
import { CreateClientDialog } from "@/components/clients/create-client-dialog";

const STATUS_FILTERS = [
  { value: "", label: "Todos" },
  { value: "ATIVO", label: "Ativos" },
  { value: "LEVANTAMENTO", label: "Levantamento" },
  { value: "PRE_ARRANQUE", label: "Pre-arranque" },
  { value: "APRESENTACAO_TIMELINE", label: "Apres. Timeline" },
  { value: "INATIVO", label: "Inativos" },
  { value: "PROJETO_FINALIZADO", label: "Finalizados" },
];

const RISK_COLORS: Record<string, string> = {
  BAIXO: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  MEDIO: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300",
  ALTO: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
};

function daysUntilEnd(endDate: Date | string | null): number | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getUrgencyColor(days: number | null): string {
  if (days === null) return "";
  if (days < 0) return "text-red-600 bg-red-50 dark:bg-red-950/30";
  if (days <= 14) return "text-red-600 bg-red-50 dark:bg-red-950/30";
  if (days <= 30) return "text-orange-600 bg-orange-50 dark:bg-orange-950/30";
  return "text-green-600 bg-green-50 dark:bg-green-950/30";
}

const STATUS_OPTIONS = [
  { value: "FECHADO", label: "Fechado" },
  { value: "COBRADO", label: "Cobrado" },
  { value: "PRE_ARRANQUE", label: "Pre-arranque" },
  { value: "LEVANTAMENTO", label: "Levantamento" },
  { value: "APRESENTACAO_TIMELINE", label: "Apres. Timeline" },
  { value: "ATIVO", label: "Ativo" },
  { value: "INATIVO", label: "Inativo" },
  { value: "PROJETO_FINALIZADO", label: "Finalizado" },
];

const OFFER_OPTIONS = ["Consultoria", "IA", "Mentoria", "BoomClub", "Ads", "Cold Calls", "LinkedIn"];

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const clients = trpc.clients.list.useQuery({
    search: search || undefined,
    status: status || undefined,
  });
  const utils = trpc.useUtils();
  const updateClient = trpc.clients.update.useMutation({
    onSuccess: () => utils.clients.list.invalidate(),
  });

  // Ordem desejada pelo utilizador:
  // 1. Clientes activos/pre-arranque com contrato a terminar brevemente (menos dias -> mais dias)
  // 2. Clientes sem data de fim
  // 3. Clientes cujo contrato ja expirou (mais recente primeiro)
  const now = Date.now();
  const sortedClients = [...(clients.data ?? [])].sort((a, b) => {
    const aExpires = a.projectEnd ? new Date(a.projectEnd).getTime() : null;
    const bExpires = b.projectEnd ? new Date(b.projectEnd).getTime() : null;
    const aExpired = aExpires !== null && aExpires < now;
    const bExpired = bExpires !== null && bExpires < now;

    // Expirados vao para o fim
    if (aExpired && !bExpired) return 1;
    if (!aExpired && bExpired) return -1;

    // Ambos expirados: mais recente primeiro
    if (aExpired && bExpired) return (bExpires ?? 0) - (aExpires ?? 0);

    // Sem data de fim: entre os activos, vai para o fim (antes dos expirados)
    if (aExpires === null && bExpires !== null) return 1;
    if (aExpires !== null && bExpires === null) return -1;
    if (aExpires === null && bExpires === null) return 0;

    // Activos com data: mais proximos primeiro
    return (aExpires ?? 0) - (bExpires ?? 0);
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">{clients.data?.length ?? 0} clientes | Ordenados por termino de contrato</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo Cliente
        </button>
      </div>

      <CreateClientDialog open={showCreate} onClose={() => setShowCreate(false)} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-40 md:w-48 bg-transparent text-sm outline-none" />
        </div>
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatus(status === s.value ? "" : s.value)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                status === s.value ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-muted"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Client List */}
      <div className="rounded-xl border bg-card">
        {/* Header */}
        <div className="hidden md:grid grid-cols-[1fr_120px_100px_100px_120px_32px] gap-4 border-b px-4 py-2 text-xs font-medium text-muted-foreground">
          <span>Cliente</span>
          <span>Estado</span>
          <span>Risco</span>
          <span>Offer</span>
          <span>Termino</span>
          <span></span>
        </div>

        <div className="divide-y">
          {clients.isLoading && (
            <div className="p-8 text-center text-muted-foreground">A carregar...</div>
          )}
          {sortedClients.length === 0 && !clients.isLoading && (
            <div className="flex flex-col items-center gap-2 p-8 text-muted-foreground">
              <Users className="h-8 w-8" />
              <p>Sem clientes encontrados</p>
            </div>
          )}
          {sortedClients.map((client) => {
            const days = daysUntilEnd(client.projectEnd);
            const urgency = getUrgencyColor(days);

            return (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50 md:grid md:grid-cols-[1fr_120px_100px_100px_120px_32px] md:gap-4"
              >
                {/* Name + CEO */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-semibold text-primary text-sm">
                    {client.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{client.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {client.ceo ? `CEO: ${client.ceo}` : ""} {client.coreBusiness ? `| ${client.coreBusiness}` : ""}
                    </p>
                  </div>
                </div>

                {/* Status - editavel */}
                <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                  <select
                    value={client.status}
                    onChange={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      updateClient.mutate({ id: client.id, data: { status: e.target.value } });
                    }}
                    className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium border-0 cursor-pointer", getStatusColor(client.status))}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                {/* Risk - editavel */}
                <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                  <select
                    value={client.risk ?? ""}
                    onChange={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      updateClient.mutate({ id: client.id, data: { risk: e.target.value || null } });
                    }}
                    className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium border-0 cursor-pointer",
                      client.risk ? RISK_COLORS[client.risk] : "bg-muted text-muted-foreground"
                    )}
                  >
                    <option value="">—</option>
                    <option value="BAIXO">Baixo</option>
                    <option value="MEDIO">Medio</option>
                    <option value="ALTO">Alto</option>
                  </select>
                </div>

                {/* Offer - editavel via dropdown multi */}
                <div className="hidden md:flex gap-1 flex-wrap" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                  <details className="relative" onClick={(e) => e.stopPropagation()}>
                    <summary className="list-none cursor-pointer flex gap-1 flex-wrap">
                      {client.offer.length === 0 ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted/70">+ Offer</span>
                      ) : (
                        client.offer.map((o) => (
                          <span key={o} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted/70">{o}</span>
                        ))
                      )}
                    </summary>
                    <div className="absolute z-20 mt-1 rounded-lg border bg-card p-2 shadow-lg min-w-[140px]">
                      {OFFER_OPTIONS.map((opt) => {
                        const checked = client.offer.includes(opt);
                        return (
                          <label key={opt} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                e.stopPropagation();
                                const newOffer = checked
                                  ? client.offer.filter((o) => o !== opt)
                                  : [...client.offer, opt];
                                updateClient.mutate({ id: client.id, data: { offer: newOffer } });
                              }}
                            />
                            {opt}
                          </label>
                        );
                      })}
                    </div>
                  </details>
                </div>

                {/* Contract end */}
                <div>
                  {client.projectEnd ? (
                    <div className={cn("flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium", urgency)}>
                      {days !== null && days < 0 ? (
                        <><AlertTriangle className="h-3 w-3" /> Expirado</>
                      ) : days !== null && days <= 14 ? (
                        <><Clock className="h-3 w-3" /> {days}d restantes</>
                      ) : days !== null && days <= 30 ? (
                        <><Clock className="h-3 w-3" /> {days}d restantes</>
                      ) : (
                        <><Calendar className="h-3 w-3" /> {new Date(client.projectEnd).toLocaleDateString("pt-PT", { day: "numeric", month: "short" })}</>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Sem data</span>
                  )}
                </div>

                <ChevronRight className="h-4 w-4 text-muted-foreground hidden md:block" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
