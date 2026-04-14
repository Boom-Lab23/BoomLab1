"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn, getStatusColor, formatStatus } from "@/lib/utils";
import { Search, Filter, Users, ChevronRight, Plus } from "lucide-react";
import { CreateClientDialog } from "@/components/clients/create-client-dialog";

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "ATIVO", label: "Ativo" },
  { value: "PRE_ARRANQUE", label: "Pre-arranque" },
  { value: "LEVANTAMENTO", label: "Levantamento" },
  { value: "APRESENTACAO_TIMELINE", label: "Apresentacao Timeline" },
  { value: "INATIVO", label: "Inativo" },
  { value: "PROJETO_FINALIZADO", label: "Projeto Finalizado" },
  { value: "FECHADO", label: "Fechado" },
  { value: "COBRADO", label: "Cobrado" },
];

const OFFER_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "Consultoria", label: "Consultoria" },
  { value: "IA", label: "IA" },
  { value: "Mentoria", label: "Mentoria" },
  { value: "BoomClub", label: "BoomClub" },
];

const RISK_COLORS: Record<string, string> = {
  BAIXO: "bg-green-100 text-green-700",
  MEDIO: "bg-yellow-100 text-yellow-700",
  ALTO: "bg-red-100 text-red-700",
};

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [offer, setOffer] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const clients = trpc.clients.list.useQuery({
    search: search || undefined,
    status: status || undefined,
    offer: offer || undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">
            {clients.data?.length ?? 0} clientes encontrados
          </p>
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
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Pesquisar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 bg-transparent text-sm outline-none"
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border bg-card px-3 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Estado: {opt.label}
            </option>
          ))}
        </select>

        <select
          value={offer}
          onChange={(e) => setOffer(e.target.value)}
          className="rounded-lg border bg-card px-3 py-2 text-sm"
        >
          {OFFER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Offer: {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Client List */}
      <div className="rounded-xl border bg-card">
        <div className="divide-y">
          {clients.isLoading && (
            <div className="p-8 text-center text-muted-foreground">A carregar...</div>
          )}
          {clients.data?.length === 0 && (
            <div className="flex flex-col items-center gap-2 p-8 text-muted-foreground">
              <Users className="h-8 w-8" />
              <p>Sem clientes encontrados</p>
            </div>
          )}
          {clients.data?.map((client) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 font-semibold text-blue-600">
                  {client.name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium">{client.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {client.ceo ? `CEO: ${client.ceo}` : ""}{" "}
                    {client.coreBusiness ? `| ${client.coreBusiness}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Offers */}
                <div className="flex gap-1">
                  {client.offer.map((o) => (
                    <span
                      key={o}
                      className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
                    >
                      {o}
                    </span>
                  ))}
                </div>

                {/* Risk */}
                {client.risk && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      RISK_COLORS[client.risk] ?? "bg-gray-100"
                    )}
                  >
                    {client.risk}
                  </span>
                )}

                {/* Status */}
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    getStatusColor(client.status)
                  )}
                >
                  {formatStatus(client.status)}
                </span>

                {/* Counts */}
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>{client._count.sessions} sessoes</span>
                  <span>{client._count.recordings} gravacoes</span>
                </div>

                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
