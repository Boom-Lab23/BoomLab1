"use client";

import { trpc } from "@/lib/trpc";
import { cn, getStatusColor, formatStatus } from "@/lib/utils";
import { Rocket, TrendingUp, Users, Calendar } from "lucide-react";
import Link from "next/link";

export default function BoomClubPage() {
  const clients = trpc.clients.list.useQuery({ offer: "BoomClub" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Rocket className="h-6 w-6 text-cyan-600" />
          Boom Club
        </h1>
        <p className="text-muted-foreground">
          Clientes em fim de contrato - pipeline de retencao e revenue
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" /> Membros
          </div>
          <p className="mt-1 text-3xl font-bold">{clients.data?.length ?? 0}</p>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" /> Revenue Potencial
          </div>
          <p className="mt-1 text-3xl font-bold">
            {clients.data
              ? `${clients.data.reduce((sum, c) => sum + (c.ticket ?? 0), 0).toLocaleString("pt-PT")}€`
              : "-"}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" /> Contratos a expirar
          </div>
          <p className="mt-1 text-3xl font-bold">
            {clients.data?.filter((c) => {
              if (!c.projectEnd) return false;
              const diff = new Date(c.projectEnd).getTime() - Date.now();
              return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
            }).length ?? 0}
          </p>
          <p className="text-xs text-muted-foreground">nos proximos 30 dias</p>
        </div>
      </div>

      {/* Client List */}
      <div className="rounded-xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-semibold">Clientes Boom Club</h2>
        </div>
        <div className="divide-y">
          {clients.data?.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              Sem clientes no Boom Club
            </div>
          )}
          {clients.data?.map((client) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
            >
              <div>
                <p className="font-medium">{client.name}</p>
                <p className="text-sm text-muted-foreground">
                  {client.ceo ? `CEO: ${client.ceo}` : ""}{" "}
                  {client.projectEnd
                    ? `| Fim: ${new Date(client.projectEnd).toLocaleDateString("pt-PT")}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {client.ticket && (
                  <span className="text-sm font-medium">{client.ticket.toLocaleString("pt-PT")}€</span>
                )}
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", getStatusColor(client.status))}>
                  {formatStatus(client.status)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
