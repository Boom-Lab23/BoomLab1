"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { BarChart3, Users, Phone, ChevronRight, Building2, Shield, Home, FolderKanban, Lock } from "lucide-react";

const MARKET_CONFIG = {
  CREDITO: { label: "Credito", color: "#2D76FC", icon: Building2 },
  SEGUROS: { label: "Seguros", color: "#16a34a", icon: Shield },
  IMOBILIARIO: { label: "Imobiliario", color: "#ea580c", icon: Home },
} as const;

export default function WorkspacePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const role = (session?.user as Record<string, unknown>)?.role as string | undefined;
  const isGuest = role === "GUEST_CLIENT" || role === "GUEST_TEAM_MEMBER";
  const assignedWorkspaceClientId = (session?.user as Record<string, unknown>)?.assignedWorkspaceClientId as string | undefined;

  // Guests: redirect to their own workspace, or show empty state
  useEffect(() => {
    if (isGuest && assignedWorkspaceClientId) {
      router.replace(`/workspace/${assignedWorkspaceClientId}`);
    }
  }, [isGuest, assignedWorkspaceClientId, router]);

  const clients = trpc.clients.list.useQuery({}, { enabled: !isGuest });
  const dashboards = trpc.dashboards.list.useQuery(undefined, { enabled: !isGuest });

  // Guest without workspace assigned: show informative empty state
  if (isGuest && !assignedWorkspaceClientId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-xl border bg-card p-8 text-center max-w-md">
          <Lock className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <h1 className="mt-3 text-lg font-bold">Sem workspace atribuido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A BoomLab ainda nao te atribuiu acesso a um workspace. Fala com o teu gestor BoomLab para ativar o acesso.
          </p>
        </div>
      </div>
    );
  }

  // Guest with workspace: while redirect happens show a loader
  if (isGuest) {
    return <div className="p-8 text-center text-muted-foreground">A abrir o teu workspace...</div>;
  }

  const dashboardByClient = new Map((dashboards.data ?? []).map(d => [d.clientId, d]));
  const clientList = clients.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workspace</h1>
          <p className="text-muted-foreground">Dashboard, CRM Leads e Analise de Vendas por cliente</p>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <div className="flex items-start gap-2">
          <FolderKanban className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">3 folhas por cliente</p>
            <p className="text-xs text-blue-800 mt-0.5">
              <strong>Dashboard Comercial</strong> (KPIs por mercado) &middot; <strong>CRM Leads</strong> (pipeline + duplicados) &middot; <strong>Analise de Vendas</strong> (analise de chamadas por comercial).
            </p>
          </div>
        </div>
      </div>

      {clients.isLoading ? (
        <div className="p-8 text-center text-muted-foreground">A carregar...</div>
      ) : clientList.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          Sem clientes. Cria um cliente primeiro em /clientes.
        </div>
      ) : (
        <div className="grid gap-3">
          {clientList.map((c) => {
            const db = dashboardByClient.get(c.id);
            const market = db?.market as keyof typeof MARKET_CONFIG | undefined;
            const cfg = market ? MARKET_CONFIG[market] : null;
            const Icon = cfg?.icon ?? FolderKanban;
            return (
              <Link key={c.id} href={`/workspace/${c.id}`} className="flex items-center gap-4 rounded-xl border bg-card p-4 hover:bg-muted/50 transition-colors">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg" style={{ backgroundColor: cfg ? `${cfg.color}18` : "hsl(var(--muted))" }}>
                  <Icon className="h-5 w-5" style={{ color: cfg?.color ?? "hsl(var(--muted-foreground))" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    {cfg && (
                      <span className="rounded-full px-1.5 py-0.5 font-medium" style={{ backgroundColor: `${cfg.color}15`, color: cfg.color }}>
                        {cfg.label}
                      </span>
                    )}
                    <span className="flex items-center gap-0.5"><BarChart3 className="h-3 w-3" /> {db ? "Dashboard" : "sem dashboard"}</span>
                    <span className="flex items-center gap-0.5"><Users className="h-3 w-3" /> CRM Leads</span>
                    <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" /> Sales Analysis</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
