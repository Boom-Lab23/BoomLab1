"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Plus, X, Phone, TrendingUp, Users, Target, BarChart3, UserPlus, Trash2,
  Network, CheckCircle2, Handshake, Filter, Check, AlertTriangle, Calendar,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell,
} from "recharts";
import {
  MARKET_LABELS, MARKET_COLORS, MARKET_CHANNELS, MARKET_VERTENTES,
  getChannelLabel, getChannelColor,
  type MarketKey,
} from "@/lib/market-config";

export default function DashboardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: authSession } = useSession();
  const userRole = (authSession?.user as Record<string, unknown>)?.role as string | undefined;
  const isGuest = userRole === "GUEST_CLIENT" || userRole === "GUEST_TEAM_MEMBER";
  const assignedWorkspaceClientId = (authSession?.user as Record<string, unknown>)?.assignedWorkspaceClientId as string | undefined;
  // Only ADMIN / CONSULTANT / MANAGER can delete. Guests (equipas comerciais do cliente) nao.
  const canDeleteRecords = userRole === "ADMIN" || userRole === "CONSULTANT" || userRole === "MANAGER";

  const [period, setPeriod] = useState<"week" | "month" | "trimester" | "year">("month");
  const [activeTab, setActiveTab] = useState<"overview" | "channels" | "growth" | "vertentes">("overview");
  const [showEOD, setShowEOD] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [newCommercial, setNewCommercial] = useState("");

  // Bulk-delete state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkFilter, setBulkFilter] = useState({
    commercial: "",
    from: "",
    to: "",
  });

  const dashboard = trpc.dashboards.getById.useQuery(id);
  const kpis = trpc.dashboards.kpis.useQuery({ dashboardId: id, period });
  const growthKpis = trpc.dashboards.growthKpis.useQuery({ dashboardId: id });
  const chartData = trpc.dashboards.chartData.useQuery({ dashboardId: id, months: 3 });
  const utils = trpc.useUtils();

  const market: MarketKey = (dashboard.data?.market as MarketKey) ?? "CREDITO";
  const channels = MARKET_CHANNELS[market] ?? MARKET_CHANNELS.CREDITO;
  const vertentes = MARKET_VERTENTES[market] ?? MARKET_VERTENTES.CREDITO;

  const [eod, setEod] = useState<Record<string, string>>({
    commercial: "",
    channel: channels[0]?.key ?? "cold-calling",
    date: new Date().toISOString().split("T")[0],
    callsMade: "", callsAnswered: "",
    reunioesAgendadas: "", reunioesEfetuadas: "", conversoesFeitas: "",
    notes: "",
  });

  const addRecord = trpc.dashboards.addRecord.useMutation({
    onSuccess: () => {
      utils.dashboards.getById.invalidate();
      utils.dashboards.kpis.invalidate();
      utils.dashboards.growthKpis.invalidate();
      utils.dashboards.chartData.invalidate();
      setShowEOD(false);
    },
  });

  const updateDashboard = trpc.dashboards.update.useMutation({
    onSuccess: () => utils.dashboards.getById.invalidate(),
  });

  const deleteRecord = trpc.dashboards.deleteRecord.useMutation({
    onSuccess: () => {
      utils.dashboards.getById.invalidate();
      utils.dashboards.kpis.invalidate();
      utils.dashboards.growthKpis.invalidate();
      utils.dashboards.chartData.invalidate();
    },
  });

  const deleteRecords = trpc.dashboards.deleteRecords.useMutation({
    onSuccess: (res) => {
      utils.dashboards.getById.invalidate();
      utils.dashboards.kpis.invalidate();
      utils.dashboards.growthKpis.invalidate();
      utils.dashboards.chartData.invalidate();
      alert(`${res.deleted} registo(s) apagado(s) com sucesso.`);
      setShowBulkDialog(false);
      setSelectedIds(new Set());
      setSelectMode(false);
      setBulkFilter({ commercial: "", from: "", to: "" });
    },
  });

  const users = trpc.admin.listUsers.useQuery();
  const assignedUsers = (users.data ?? []).filter(u => u.assignedDashboardId === id);

  if (dashboard.isLoading) return <div className="p-8 text-center text-muted-foreground">A carregar...</div>;
  if (!dashboard.data) return <div className="p-8 text-center text-muted-foreground">Dashboard nao encontrada</div>;

  const db = dashboard.data;

  // Guard para clientes: so podem ver dashboards do seu cliente atribuido
  if (isGuest && db.clientId !== assignedWorkspaceClientId) {
    return (
      <div className="p-8 text-center">
        <p className="text-lg font-semibold">Acesso negado</p>
        <p className="mt-2 text-sm text-muted-foreground">Esta dashboard nao pertence ao teu workspace.</p>
      </div>
    );
  }
  const color = MARKET_COLORS[market] ?? "#2D76FC";
  const k = kpis.data;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboards" className="rounded-lg p-2 hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{db.client.name}</h1>
          <div className="flex items-center gap-2">
            <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${color}15`, color }}>{MARKET_LABELS[market]}</span>
            <span className="text-sm text-muted-foreground">Departamento Comercial</span>
          </div>
        </div>
        <button onClick={() => setShowTeam(true)} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted">
          <Users className="h-4 w-4" /> Equipa ({db.commercials.length})
        </button>
        <button onClick={() => setShowEOD(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Registo
        </button>
      </div>

      {/* Team Members Badge */}
      {db.commercials.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Equipa Comercial:</span>
          {db.commercials.map((name) => (
            <span key={name} className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: `${color}15`, color }}>
              {name}
            </span>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border bg-muted/50 p-1 overflow-x-auto">
        {[
          { key: "overview", label: "Overview", icon: BarChart3 },
          { key: "channels", label: "Canais de Aquisicao", icon: Network },
          { key: "growth", label: "Growth KPIs", icon: TrendingUp },
          { key: "vertentes", label: "Vertentes", icon: Target },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap",
              activeTab === tab.key ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}>
            <tab.icon className="h-3.5 w-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Period selector */}
      <div className="flex gap-1">
        {(["week", "month", "trimester", "year"] as const).map((p) => (
          <button key={p} onClick={() => setPeriod(p)}
            className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              period === p ? "bg-gray-900 text-white" : "bg-card text-muted-foreground hover:bg-muted"
            )}>
            {p === "week" ? "Semana" : p === "month" ? "Mes" : p === "trimester" ? "Trimestre" : "Ano"}
          </button>
        ))}
      </div>

      {/* ========== OVERVIEW TAB ========== */}
      {activeTab === "overview" && (<>
        {/* KPI Cards - totais do pipeline */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Phone className="h-3.5 w-3.5" /> Contactos</div>
            <p className="text-2xl font-bold mt-1">{k?.totals.calls ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">{k?.totals.answered ?? 0} respondidos</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Calendar className="h-3.5 w-3.5" /> Reun. Agendadas</div>
            <p className="text-2xl font-bold mt-1">{k?.totals.reunioesAgendadas ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">no pipeline</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Handshake className="h-3.5 w-3.5" /> Reun. Efetuadas</div>
            <p className="text-2xl font-bold mt-1">{k?.totals.reunioesEfetuadas ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">aconteceram</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5" /> Conversoes</div>
            <p className="text-2xl font-bold mt-1">{k?.totals.conversoesFeitas ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">fechadas</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Target className="h-3.5 w-3.5" /> TC Global</div>
            <p className="text-2xl font-bold mt-1">{k?.totals.conversionRate?.toFixed(1) ?? 0}%</p>
            <p className="text-[10px] text-muted-foreground">contactos -&gt; fecho</p>
          </div>
        </div>

        {/* Taxas do Pipeline - Credito tem 5 etapas, outros mercados 3 */}
        {market === "CREDITO" ? (
          <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
            <div className="rounded-xl border bg-card p-4 border-l-4" style={{ borderLeftColor: color }}>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-semibold" style={{ color }}>1</span>
                Agendamento
              </div>
              <p className="text-xl font-bold mt-1" style={{ color }}>{k?.totals.tcAgendamento?.toFixed(1) ?? 0}%</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {k?.totals.reunioesAgendadas ?? 0} / {k?.totals.calls ?? 0}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4 border-l-4 border-l-purple-500">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 font-semibold">2</span>
                Show-up
              </div>
              <p className="text-xl font-bold mt-1 text-purple-600 dark:text-purple-400">{k?.totals.tcShowUp?.toFixed(1) ?? 0}%</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {k?.totals.reunioesEfetuadas ?? 0} / {k?.totals.reunioesAgendadas ?? 0}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4 border-l-4 border-l-orange-500">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 font-semibold">3</span>
                Pedido Docs
              </div>
              <p className="text-xl font-bold mt-1 text-orange-600 dark:text-orange-400">{k?.totals.tcPedidoDocs?.toFixed(1) ?? 0}%</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {k?.totals.documentacoesPedidas ?? 0} / {k?.totals.reunioesEfetuadas ?? 0}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4 border-l-4 border-l-yellow-500">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 font-semibold">4</span>
                Recolha Docs
              </div>
              <p className="text-xl font-bold mt-1 text-yellow-600 dark:text-yellow-400">{k?.totals.tcRecolhaDocs?.toFixed(1) ?? 0}%</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {k?.totals.documentacoesRecolhidas ?? 0} / {k?.totals.documentacoesPedidas ?? 0}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4 border-l-4 border-l-green-500 col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-1.5 py-0.5 font-semibold">5</span>
                Fecho
              </div>
              <p className="text-xl font-bold mt-1 text-green-600 dark:text-green-400">{k?.totals.tcFechoDocs?.toFixed(1) ?? 0}%</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {k?.totals.conversoesFeitas ?? 0} / {k?.totals.documentacoesRecolhidas ?? 0}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
            <div className="rounded-xl border bg-card p-4 border-l-4" style={{ borderLeftColor: color }}>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-semibold" style={{ color }}>1 -&gt; 3</span>
                Taxa de Agendamento
              </div>
              <p className="text-2xl font-bold mt-1" style={{ color }}>{k?.totals.tcAgendamento?.toFixed(1) ?? 0}%</p>
              <p className="text-[10px] text-muted-foreground">
                {k?.totals.reunioesAgendadas ?? 0} agendadas / {k?.totals.calls ?? 0} contactos
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4 border-l-4 border-l-purple-500">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 font-semibold">3 -&gt; 4</span>
                Taxa de Show-up
              </div>
              <p className="text-2xl font-bold mt-1 text-purple-600 dark:text-purple-400">{k?.totals.tcShowUp?.toFixed(1) ?? 0}%</p>
              <p className="text-[10px] text-muted-foreground">
                {k?.totals.reunioesEfetuadas ?? 0} efetuadas / {k?.totals.reunioesAgendadas ?? 0} agendadas
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4 border-l-4 border-l-green-500">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-1.5 py-0.5 font-semibold">4 -&gt; 5</span>
                Taxa de Fecho
              </div>
              <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">{k?.totals.tcFecho?.toFixed(1) ?? 0}%</p>
              <p className="text-[10px] text-muted-foreground">
                {k?.totals.conversoesFeitas ?? 0} fechadas / {k?.totals.reunioesEfetuadas ?? 0} efetuadas
              </p>
            </div>
          </div>
        )}

        {/* Charts */}
        {chartData.data && chartData.data.length > 1 && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-semibold mb-3">Contactos & Conversoes</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="calls" stroke={color} strokeWidth={2} dot={false} name="Contactos" />
                  <Line type="monotone" dataKey="conversoesFeitas" stroke="#16a34a" strokeWidth={2} dot={false} name="Conversoes" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-semibold mb-3">Taxa Conversao (%)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="conversionRate" stroke="#8b5cf6" strokeWidth={2} dot={false} name="TC%" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Performance Ranking */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b p-4">
            <Users className="h-4 w-4" style={{ color }} />
            <h2 className="font-semibold">Performance Comerciais</h2>
          </div>
          {!k?.byCommercial?.length ? (
            <p className="p-6 text-sm text-muted-foreground text-center">Sem registos</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left p-3">#</th><th className="text-left p-3">Comercial</th>
                  <th className="text-right p-3" title="Contactos feitos">Ctct.</th>
                  <th className="text-right p-3" title="Reunioes agendadas">Agen.</th>
                  <th className="text-right p-3" title="Reunioes efetuadas">Efet.</th>
                  <th className="text-right p-3" title="Conversoes feitas">Conv.</th>
                  <th className="text-right p-3" title="Taxa agendamento (Contactos -> Agendadas)">TC Agen.</th>
                  <th className="text-right p-3" title="Taxa show-up (Agendadas -> Efetuadas)">Show-up</th>
                  <th className="text-right p-3" title="Taxa de fecho (Efetuadas -> Conversoes)">TC Fecho</th>
                </tr></thead>
                <tbody className="divide-y">
                  {k.byCommercial.map((c, i) => (
                    <tr key={c.name} className="hover:bg-muted/50">
                      <td className="p-3 font-bold" style={{ color: i === 0 ? color : undefined }}>{i + 1}º</td>
                      <td className="p-3 font-medium">{c.name}</td>
                      <td className="p-3 text-right">{c.calls}</td>
                      <td className="p-3 text-right">{c.reunioesAgendadas}</td>
                      <td className="p-3 text-right">{c.reunioesEfetuadas}</td>
                      <td className="p-3 text-right font-medium">{c.conversoesFeitas}</td>
                      <td className="p-3 text-right text-xs">{c.tcAgendamento.toFixed(1)}%</td>
                      <td className="p-3 text-right text-xs text-purple-600">{c.tcShowUp.toFixed(0)}%</td>
                      <td className="p-3 text-right">
                        <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium",
                          c.tcFecho > 40 ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" :
                          c.tcFecho > 20 ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300" :
                          "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                        )}>
                          {c.tcFecho.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>)}

      {/* ========== CHANNELS (Canais de Aquisicao) TAB ========== */}
      {activeTab === "channels" && (<>
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Network className="h-4 w-4" style={{ color }} />
            <h2 className="font-semibold">Canais de Aquisicao - {MARKET_LABELS[market]}</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Leads e conversoes agregadas por canal de aquisicao ({period === "week" ? "semana" : period === "month" ? "mes atual" : period === "trimester" ? "trimestre" : "ano"}).
          </p>

          {!k?.byChannel?.length ? (
            <p className="p-6 text-sm text-muted-foreground text-center">Sem registos para calcular distribuicao por canal.</p>
          ) : (
            <>
              {/* Summary cards per channel */}
              <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 mb-6">
                {k.byChannel.map((ch) => {
                  const chColor = getChannelColor(market, ch.channel);
                  const chLabel = getChannelLabel(market, ch.channel);
                  return (
                    <div key={ch.channel} className="rounded-xl border p-3" style={{ borderLeft: `3px solid ${chColor}` }}>
                      <p className="text-[11px] font-semibold" style={{ color: chColor }}>{chLabel}</p>
                      <div className="mt-1 flex items-baseline gap-1">
                        <p className="text-xl font-bold">{ch.calls}</p>
                        <span className="text-[10px] text-muted-foreground">contactos</span>
                      </div>
                      <div className="mt-1 space-y-0.5 text-[11px]">
                        <div className="flex justify-between"><span className="text-muted-foreground">Reunioes</span><span className="font-medium">{ch.reunioesEfetuadas}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Conversoes</span><span className="font-medium text-green-600">{ch.conversoesFeitas}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">% do total</span><span className="font-medium">{ch.pctOfCalls.toFixed(0)}%</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">TC</span><span className="font-medium">{ch.conversionRate.toFixed(1)}%</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pie chart: distribution of contacts per channel */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-3">% Contactos por Canal</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={k.byChannel}
                        dataKey="calls"
                        nameKey="channel"
                        cx="50%" cy="50%"
                        outerRadius={85}
                        label={(entry: { channel: string; pctOfCalls: number }) =>
                          `${getChannelLabel(market, entry.channel)} ${entry.pctOfCalls.toFixed(0)}%`
                        }
                      >
                        {k.byChannel.map((ch) => (
                          <Cell key={ch.channel} fill={getChannelColor(market, ch.channel)} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ fontSize: 12 }}
                        formatter={(val: number, _name, props: { payload?: { channel?: string } }) =>
                          [val, getChannelLabel(market, props.payload?.channel ?? "")]
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-3">% Conversoes por Canal</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={k.byChannel.filter(c => c.conversoesFeitas > 0)}
                        dataKey="conversoesFeitas"
                        nameKey="channel"
                        cx="50%" cy="50%"
                        outerRadius={85}
                        label={(entry: { channel: string; pctOfConversoes: number }) =>
                          `${getChannelLabel(market, entry.channel)} ${entry.pctOfConversoes.toFixed(0)}%`
                        }
                      >
                        {k.byChannel.filter(c => c.conversoesFeitas > 0).map((ch) => (
                          <Cell key={ch.channel} fill={getChannelColor(market, ch.channel)} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ fontSize: 12 }}
                        formatter={(val: number, _name, props: { payload?: { channel?: string } }) =>
                          [val, getChannelLabel(market, props.payload?.channel ?? "")]
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bar chart: metrics per channel */}
              <div className="rounded-xl border bg-card p-4 mt-4">
                <h3 className="text-sm font-semibold mb-3">Comparacao por Canal</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={k.byChannel.map(c => ({ ...c, label: getChannelLabel(market, c.channel) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="calls" fill={color} name="Contactos" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="reunioesEfetuadas" fill="#8b5cf6" name="Reunioes" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="conversoesFeitas" fill="#16a34a" name="Conversoes" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>

        {/* Channel reference guide */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 p-4">
          <p className="text-sm text-blue-900 dark:text-blue-200 font-medium mb-2">Canais especificos do mercado {MARKET_LABELS[market]}:</p>
          <div className="grid gap-2 md:grid-cols-2">
            {channels.map((ch) => (
              <div key={ch.key} className="flex items-start gap-2 text-xs text-blue-800 dark:text-blue-300">
                <span className="mt-0.5 inline-block h-2 w-2 rounded-full shrink-0" style={{ background: ch.color }} />
                <div>
                  <span className="font-semibold">{ch.label}</span>
                  {ch.description && <span className="text-blue-700 dark:text-blue-300"> - {ch.description}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </>)}

      {/* ========== GROWTH KPIs TAB ========== */}
      {activeTab === "growth" && (<>
        <div className="rounded-xl border bg-card">
          <div className="border-b p-4">
            <h2 className="font-semibold">Growth KPIs por Semana</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Evolucao semanal das metricas principais</p>
          </div>
          {!growthKpis.data?.length ? (
            <p className="p-6 text-sm text-muted-foreground text-center">Sem dados</p>
          ) : (<>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={growthKpis.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="calls" fill={color} name="Contactos" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="reunioesEfetuadas" fill="#8b5cf6" name="Reunioes" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="conversoesFeitas" fill="#16a34a" name="Conversoes" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto border-t">
              <table className="w-full text-xs">
                <thead><tr className="border-b text-muted-foreground">
                  <th className="text-left p-2">Semana</th><th className="text-left p-2">Mes</th>
                  <th className="text-right p-2">Contactos</th><th className="text-right p-2">Respondidos</th>
                  <th className="text-right p-2">Reunioes</th><th className="text-right p-2">Conversoes</th>
                </tr></thead>
                <tbody className="divide-y">
                  {growthKpis.data.map((w) => (
                    <tr key={w.key} className="hover:bg-muted/50">
                      <td className="p-2 font-medium">{w.label}</td><td className="p-2">{w.month}</td>
                      <td className="p-2 text-right">{w.calls}</td><td className="p-2 text-right">{w.answered}</td>
                      <td className="p-2 text-right">{w.reunioesEfetuadas}</td>
                      <td className="p-2 text-right font-medium text-green-600">{w.conversoesFeitas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>)}
        </div>

        {/* Weekly per-channel stacked bar */}
        {growthKpis.data && growthKpis.data.length > 0 && (
          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold mb-1">Contactos por Canal por Semana</h3>
            <p className="text-xs text-muted-foreground mb-3">Como cada canal contribui ao longo do tempo</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={growthKpis.data.map((w) => {
                const row: Record<string, unknown> = { label: w.label };
                for (const ch of channels) {
                  row[ch.key] = w.channelCalls?.[ch.key] ?? 0;
                }
                return row;
              })}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {channels.map((ch) => (
                  <Bar key={ch.key} dataKey={ch.key} stackId="contacts" fill={ch.color} name={ch.label} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </>)}

      {/* ========== VERTENTES TAB ========== */}
      {activeTab === "vertentes" && (<>
        <div className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold mb-3">Vertentes - {MARKET_LABELS[market]}</h2>
          <p className="text-xs text-muted-foreground mb-4">Detalhes por tipo de produto/servico</p>

          {growthKpis.data && growthKpis.data.length > 0 && (
            <div className="mb-4">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={growthKpis.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {vertentes.map((v, i) => {
                    const colors = ["#2D76FC", "#16a34a", "#ea580c", "#8b5cf6", "#ec4899", "#0891b2"];
                    const dataKey =
                      v.key === "creditoHabitacaoN" ? "creditoHab" :
                      v.key === "creditoPessoalN" ? "creditoPes" :
                      v.key === "creditoConsumoN" ? "creditoCon" :
                      v.key === "cartoesN" ? "cartoes" :
                      v.key === "segurosCrossN" ? "segurosCross" :
                      v.key === "segurosVidaN" ? "segurosVida" :
                      v.key === "segurosSaudeN" ? "segurosSaude" :
                      v.key === "segurosAutoN" ? "segurosAuto" :
                      v.key === "segurosHabitacaoN" ? "segurosHab" :
                      v.key === "segurosMultiN" ? "segurosMulti" :
                      v.key === "segurosOutrosN" ? "segurosOutros" :
                      v.key === "imoAngariacaoN" ? "imoAngariacao" :
                      v.key === "imoVendaN" ? "imoVenda" :
                      v.key === "imoArrendamentoN" ? "imoArrendamento" :
                      v.key === "imoComercialN" ? "imoComercial" : v.key;
                    return <Bar key={v.key} dataKey={dataKey} fill={colors[i % colors.length]} name={v.label} radius={[2, 2, 0, 0]} />;
                  })}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
            {vertentes.map((v) => {
              const totalN = db.records.reduce((s, r) => s + ((r as unknown as Record<string, number>)[v.key] ?? 0), 0);
              const totalV = db.records.reduce((s, r) => s + ((r as unknown as Record<string, number>)[v.vKey] ?? 0), 0);
              return (
                <div key={v.key} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{v.label}</p>
                  <p className="text-xl font-bold mt-0.5">{totalN}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {totalV > 0 ? `${totalV.toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}` : "sem valor"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </>)}

      {/* Recent Records (always visible) */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-semibold">Registos Recentes</h2>
          <p className="text-xs text-muted-foreground">{db.records.length} registos no total</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b text-muted-foreground">
              <th className="text-left p-2">Data</th><th className="text-left p-2">Comercial</th>
              <th className="text-left p-2">Canal</th><th className="text-right p-2">Contactos</th>
              <th className="text-right p-2">Reun.</th><th className="text-right p-2">Conv.</th>
              <th className="text-right p-2">TC%</th>
              {canDeleteRecords && <th className="text-right p-2 w-10"></th>}
            </tr></thead>
            <tbody className="divide-y">
              {db.records.slice(0, 20).map((r) => (
                <tr key={r.id} className="hover:bg-muted/50 group">
                  <td className="p-2">{new Date(r.date).toLocaleDateString("pt-PT")}</td>
                  <td className="p-2 font-medium">{r.commercial}</td>
                  <td className="p-2">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: getChannelColor(market, r.channel) }} />
                      {getChannelLabel(market, r.channel)}
                    </span>
                  </td>
                  <td className="p-2 text-right">{r.callsMade}</td>
                  <td className="p-2 text-right">{r.reunioesEfetuadas ?? r.agendamentos ?? 0}</td>
                  <td className="p-2 text-right">{r.conversoesFeitas ?? r.conversions ?? 0}</td>
                  <td className="p-2 text-right">{r.conversionRate?.toFixed(1)}%</td>
                  {canDeleteRecords && (
                    <td className="p-2 text-right">
                      <button
                        onClick={() => {
                          if (confirm(`Apagar registo de ${r.commercial} de ${new Date(r.date).toLocaleDateString("pt-PT")}?`)) {
                            deleteRecord.mutate(r.id);
                          }
                        }}
                        disabled={deleteRecord.isPending}
                        className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 transition-opacity disabled:opacity-50"
                        title="Apagar registo"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {db.records.length === 0 && <tr><td colSpan={canDeleteRecords ? 8 : 7} className="p-6 text-center text-muted-foreground">Sem registos. Usa o botao &quot;Registo&quot; para adicionar.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Team Management Dialog */}
      {showTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 animate-scale-in">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Equipa Comercial</h2>
              <button onClick={() => setShowTeam(false)} className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Os nomes dos membros aparecerao no formulario de Registo Diario e nas classificacoes.
            </p>

            {assignedUsers.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Utilizadores com acesso</p>
                <div className="space-y-1">
                  {assignedUsers.map(u => (
                    <div key={u.id} className="flex items-center justify-between rounded-lg border p-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{u.name}</p>
                          <p className="text-[10px] text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                      {!db.commercials.includes(u.name) && (
                        <button
                          onClick={() => updateDashboard.mutate({ id, commercials: [...db.commercials, u.name] })}
                          className="text-xs text-primary hover:underline"
                        >
                          Adicionar
                        </button>
                      )}
                      {db.commercials.includes(u.name) && (
                        <span className="text-xs text-muted-foreground">Ja adicionado</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Membros da equipa ({db.commercials.length})</p>
              {db.commercials.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nenhum membro adicionado.</p>
              ) : (
                <div className="space-y-1">
                  {db.commercials.map((name) => (
                    <div key={name} className="flex items-center justify-between rounded-lg border p-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium text-white" style={{ backgroundColor: color }}>
                          {name.charAt(0)}
                        </div>
                        <p className="text-sm font-medium">{name}</p>
                      </div>
                      <button
                        onClick={() => updateDashboard.mutate({ id, commercials: db.commercials.filter(n => n !== name) })}
                        className="rounded p-1 text-muted-foreground hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t pt-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Adicionar manualmente</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCommercial}
                  onChange={(e) => setNewCommercial(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newCommercial.trim()) {
                      e.preventDefault();
                      updateDashboard.mutate({ id, commercials: [...db.commercials, newCommercial.trim()] });
                      setNewCommercial("");
                    }
                  }}
                  placeholder="Nome do comercial"
                  className="flex-1 rounded-lg border px-3 py-2 text-sm bg-card"
                />
                <button
                  onClick={() => {
                    if (!newCommercial.trim()) return;
                    updateDashboard.mutate({ id, commercials: [...db.commercials, newCommercial.trim()] });
                    setNewCommercial("");
                  }}
                  disabled={!newCommercial.trim() || updateDashboard.isPending}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex justify-end border-t pt-4 mt-4">
              <button onClick={() => setShowTeam(false)} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* EOD Form */}
      {showEOD && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 animate-scale-in">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Registo Diario</h2>
              <button onClick={() => setShowEOD(false)} className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const data: Record<string, unknown> = {
                dashboardId: id,
                date: new Date(eod.date),
                commercial: eod.commercial,
                channel: eod.channel,
                callsMade: parseInt(eod.callsMade) || 0,
                callsAnswered: parseInt(eod.callsAnswered) || 0,
                reunioesAgendadas: parseInt(eod.reunioesAgendadas) || 0,
                reunioesEfetuadas: parseInt(eod.reunioesEfetuadas) || 0,
                conversoesFeitas: parseInt(eod.conversoesFeitas) || 0,
                notes: eod.notes || undefined,
              };
              for (const v of vertentes) {
                if (eod[v.key]) data[v.key] = parseInt(eod[v.key]) || 0;
                if (eod[v.vKey]) data[v.vKey] = parseFloat(eod[v.vKey]) || 0;
              }
              addRecord.mutate(data as Parameters<typeof addRecord.mutate>[0]);
            }} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-0.5 block text-xs font-medium">Comercial *</label>
                  {db.commercials.length > 0 ? (
                    <select required value={eod.commercial} onChange={(e) => setEod({ ...eod, commercial: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card">
                      <option value="">Selecionar...</option>
                      {db.commercials.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                  ) : (
                    <input type="text" required value={eod.commercial} onChange={(e) => setEod({ ...eod, commercial: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" placeholder="Adiciona membros na Equipa" />
                  )}
                </div>
                <div><label className="mb-0.5 block text-xs font-medium">Data</label><input type="date" value={eod.date} onChange={(e) => setEod({ ...eod, date: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" /></div>
              </div>

              {/* Canal de aquisicao - especifico do mercado */}
              <div>
                <label className="mb-0.5 block text-xs font-medium">
                  Canal de Aquisicao <span className="text-[10px] text-muted-foreground">({MARKET_LABELS[market]})</span>
                </label>
                <select value={eod.channel} onChange={(e) => setEod({ ...eod, channel: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card">
                  {channels.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {channels.find(c => c.key === eod.channel)?.description}
                </p>
              </div>

              <p className="text-xs font-semibold text-muted-foreground pt-1">Pipeline Comercial (5 etapas)</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <div>
                  <label className="mb-0.5 block text-[10px]">1. Contactos Feitos</label>
                  <input type="number" min="0" value={eod.callsMade} onChange={(e) => setEod({ ...eod, callsMade: e.target.value })} className="w-full rounded border px-2 py-1.5 text-sm bg-card" />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px]">2. Respondidos</label>
                  <input type="number" min="0" value={eod.callsAnswered} onChange={(e) => setEod({ ...eod, callsAnswered: e.target.value })} className="w-full rounded border px-2 py-1.5 text-sm bg-card" />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px]">3. Reun. Agendadas</label>
                  <input type="number" min="0" value={eod.reunioesAgendadas} onChange={(e) => setEod({ ...eod, reunioesAgendadas: e.target.value })} className="w-full rounded border px-2 py-1.5 text-sm bg-card" />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px]">4. Reun. Efetuadas</label>
                  <input type="number" min="0" value={eod.reunioesEfetuadas} onChange={(e) => setEod({ ...eod, reunioesEfetuadas: e.target.value })} className="w-full rounded border px-2 py-1.5 text-sm bg-card" />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px]">5. Conversoes</label>
                  <input type="number" min="0" value={eod.conversoesFeitas} onChange={(e) => setEod({ ...eod, conversoesFeitas: e.target.value })} className="w-full rounded border px-2 py-1.5 text-sm bg-card" />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                <strong>Agendadas</strong>: reunioes marcadas no calendario. <strong>Efetuadas</strong>: as que realmente aconteceram. <strong>Conversoes</strong>: fecho de contrato.
              </p>

              <p className="text-xs font-semibold pt-1" style={{ color }}>Vertentes - {MARKET_LABELS[market]}</p>
              <div className="grid grid-cols-2 gap-2">
                {vertentes.map((v) => (
                  <div key={v.key} className="grid grid-cols-2 gap-1">
                    <div><label className="mb-0.5 block text-[10px]">Nº {v.short}</label><input type="number" value={eod[v.key] ?? ""} onChange={(e) => setEod({ ...eod, [v.key]: e.target.value })} className="w-full rounded border px-2 py-1 text-sm bg-card" /></div>
                    <div><label className="mb-0.5 block text-[10px]">Valor {v.short}</label><input type="number" step="0.01" value={eod[v.vKey] ?? ""} onChange={(e) => setEod({ ...eod, [v.vKey]: e.target.value })} className="w-full rounded border px-2 py-1 text-sm bg-card" /></div>
                  </div>
                ))}
              </div>

              <div><label className="mb-0.5 block text-[10px]">Notas</label><input type="text" value={eod.notes} onChange={(e) => setEod({ ...eod, notes: e.target.value })} className="w-full rounded border px-2 py-1.5 text-sm bg-card" /></div>
              <div className="flex justify-end gap-3 border-t pt-3">
                <button type="button" onClick={() => setShowEOD(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={addRecord.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">{addRecord.isPending ? "..." : "Registar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
