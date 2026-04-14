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
  BAIXO: "bg-green-100 text-green-700",
  MEDIO: "bg-yellow-100 text-yellow-700",
  ALTO: "bg-red-100 text-red-700",
};

function daysUntilEnd(endDate: Date | string | null): number | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getUrgencyColor(days: number | null): string {
  if (days === null) return "";
  if (days < 0) return "text-red-600 bg-red-50";
  if (days <= 14) return "text-red-600 bg-red-50";
  if (days <= 30) return "text-orange-600 bg-orange-50";
  return "text-green-600 bg-green-50";
}

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const clients = trpc.clients.list.useQuery({
    search: search || undefined,
    status: status || undefined,
  });

  // Sort by project end date (closest first)
  const sortedClients = [...(clients.data ?? [])].sort((a, b) => {
    if (!a.projectEnd && !b.projectEnd) return 0;
    if (!a.projectEnd) return 1;
    if (!b.projectEnd) return -1;
    return new Date(a.projectEnd).getTime() - new Date(b.projectEnd).getTime();
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

                {/* Status */}
                <div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", getStatusColor(client.status))}>
                    {formatStatus(client.status)}
                  </span>
                </div>

                {/* Risk */}
                <div>
                  {client.risk && (
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", RISK_COLORS[client.risk])}>
                      {client.risk === "BAIXO" ? "Baixo" : client.risk === "MEDIO" ? "Medio" : "Alto"}
                    </span>
                  )}
                </div>

                {/* Offer */}
                <div className="hidden md:flex gap-1 flex-wrap">
                  {client.offer.map((o) => (
                    <span key={o} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{o}</span>
                  ))}
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
