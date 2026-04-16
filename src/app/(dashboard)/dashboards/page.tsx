"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { BarChart3, Plus, ChevronRight, X, Building2, Shield, Home } from "lucide-react";

const MARKET_CONFIG = {
  CREDITO: { label: "Credito", color: "#2D76FC", icon: Building2 },
  SEGUROS: { label: "Seguros", color: "#16a34a", icon: Shield },
  IMOBILIARIO: { label: "Imobiliario", color: "#ea580c", icon: Home },
};

export default function DashboardsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ clientId: "", market: "CREDITO" as string });

  const dashboards = trpc.dashboards.list.useQuery();
  const clients = trpc.clients.list.useQuery({});
  const utils = trpc.useUtils();

  const createDashboard = trpc.dashboards.create.useMutation({
    onSuccess: () => { utils.dashboards.list.invalidate(); setShowCreate(false); },
  });

  // Clients without dashboard
  const clientsWithDashboard = new Set(dashboards.data?.map(d => d.clientId) ?? []);
  const availableClients = clients.data?.filter(c => !clientsWithDashboard.has(c.id)) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboards Comerciais</h1>
          <p className="text-muted-foreground">Dashboard do departamento comercial por cliente</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Nova Dashboard
        </button>
      </div>

      {/* Dashboards by market */}
      {(["CREDITO", "SEGUROS", "IMOBILIARIO"] as const).map((market) => {
        const config = MARKET_CONFIG[market];
        const Icon = config.icon;
        const marketDashboards = dashboards.data?.filter(d => d.market === market) ?? [];
        if (marketDashboards.length === 0) return null;

        return (
          <div key={market}>
            <div className="flex items-center gap-2 mb-3">
              <Icon className="h-4 w-4" style={{ color: config.color }} />
              <h2 className="text-sm font-semibold">{config.label}</h2>
              <span className="text-xs text-muted-foreground">({marketDashboards.length})</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {marketDashboards.map((db) => (
                <Link key={db.id} href={`/dashboards/${db.id}`} className="rounded-xl border bg-card p-5 transition-colors hover:bg-muted/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${config.color}15` }}>
                      <BarChart3 className="h-5 w-5" style={{ color: config.color }} />
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="font-semibold">{db.client.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${config.color}15`, color: config.color }}>{config.label}</span>
                    <span className="text-xs text-muted-foreground">{db._count.records} registos</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}

      {dashboards.data?.length === 0 && !dashboards.isLoading && (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-12 text-muted-foreground">
          <BarChart3 className="h-10 w-10 text-muted-foreground/30" />
          <p className="font-medium">Sem dashboards</p>
          <p className="text-sm">Cria uma dashboard para um cliente para comecar a registar metricas comerciais.</p>
        </div>
      )}

      {/* Create Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 animate-scale-in">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Nova Dashboard</h2>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); createDashboard.mutate({ clientId: form.clientId, market: form.market as "CREDITO" }); }} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Cliente *</label>
                <select required value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card">
                  <option value="">Selecionar...</option>
                  {availableClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Mercado *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["CREDITO", "SEGUROS", "IMOBILIARIO"] as const).map((m) => {
                    const cfg = MARKET_CONFIG[m];
                    const Icon = cfg.icon;
                    return (
                      <button key={m} type="button" onClick={() => setForm({ ...form, market: m })}
                        className={cn("flex flex-col items-center gap-1 rounded-lg border p-3 text-xs font-medium transition-colors",
                          form.market === m ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted"
                        )}>
                        <Icon className="h-5 w-5" style={{ color: form.market === m ? cfg.color : undefined }} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={createDashboard.isPending || !form.clientId} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">Criar Dashboard</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
