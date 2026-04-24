"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Plus, X, Phone, TrendingUp, Users, Target, BarChart3, UserPlus, Trash2,
  Network, CheckCircle2, Handshake, Filter, Check, AlertTriangle, Calendar, Pencil,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell,
} from "recharts";
import {
  MARKET_LABELS, MARKET_COLORS, MARKET_CHANNELS, MARKET_VERTENTES,
  MARKET_PIPELINE_LABELS,
  getChannelLabel, getChannelColor,
  type MarketKey,
} from "@/lib/market-config";

export default function DashboardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: authSession } = useSession();
  const userRole = (authSession?.user as Record<string, unknown>)?.role as string | undefined;
  const isGuest = userRole === "GUEST_CLIENT" || userRole === "GUEST_TEAM_MEMBER";
  const assignedWorkspaceClientId = (authSession?.user as Record<string, unknown>)?.assignedWorkspaceClientId as string | undefined;
  // Permissoes:
  // - Editar registos: CLIENTE (GUEST_CLIENT) + ADMIN. Equipa do cliente (GUEST_TEAM_MEMBER) NAO edita.
  // - Apagar registos: DESACTIVADO (nao ha delete)
  // Apenas ADMIN, MANAGER, CONSULTANT e GUEST_CLIENT (o proprio cliente) podem editar.
  // GUEST_TEAM_MEMBER (equipa do cliente) nao pode editar registos.
  const canEditRecords = userRole === "ADMIN" || userRole === "MANAGER" || userRole === "CONSULTANT" || userRole === "GUEST_CLIENT";
  const canDeleteRecords = false;

  const [period, setPeriod] = useState<"week" | "month" | "trimester" | "year" | "custom">("month");
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>(() => {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: firstOfMonth.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
  });
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
  const kpis = trpc.dashboards.kpis.useQuery({
    dashboardId: id,
    period,
    ...(period === "custom" ? { dateFrom: new Date(customRange.from), dateTo: new Date(customRange.to) } : {}),
  });
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
    leads: "",
    callsMade: "", callsAnswered: "",
    sals: "", sqls: "",
    reunioesAgendadas: "", reunioesEfetuadas: "",
    documentacoesPedidas: "", documentacoesRecolhidas: "", documentacoesCompletas: "",
    acordosVerbais: "",
    conversoesFeitas: "",
    diasSalDocs: "", diasDocsSql: "", diasSqlEscritura: "",
    notes: "",
  });
  // Dropdown dinamico de creditos (multiplos por registo)
  type CreditLine = { key: string; n: string; v: string };
  const [creditLines, setCreditLines] = useState<CreditLine[]>([]);

  // Helper: cold calls tem pipeline especial (sem docs, conversao = parceria)
  const isColdCallEod = eod.channel === "cold-calling";
  const showDocsInEod = market === "CREDITO" && !isColdCallEod;
  const showSalsSqlsInEod = !isColdCallEod;
  const conversionLabel = isColdCallEod ? "Parceria Estabelecida" : (market === "CREDITO" ? "Escritura" : "Conversao");

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

  // Edicao de registos existentes
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    leads: "",
    callsMade: "", callsAnswered: "",
    sals: "", sqls: "",
    reunioesAgendadas: "", reunioesEfetuadas: "",
    documentacoesPedidas: "", documentacoesRecolhidas: "", documentacoesCompletas: "",
    acordosVerbais: "",
    conversoesFeitas: "",
    diasSalDocs: "", diasDocsSql: "", diasSqlEscritura: "",
    notes: "",
  });
  const updateRecord = trpc.dashboards.updateRecord.useMutation({
    onSuccess: () => {
      utils.dashboards.getById.invalidate();
      utils.dashboards.kpis.invalidate();
      utils.dashboards.growthKpis.invalidate();
      utils.dashboards.chartData.invalidate();
      setEditingRecordId(null);
    },
  });

  // Bulk delete removido - apenas edit via mutation updateRecord
  const _deleteRecords = trpc.dashboards.deleteRecords.useMutation({
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
      <div className="flex flex-wrap items-center gap-1">
        {(["week", "month", "trimester", "year", "custom"] as const).map((p) => (
          <button key={p} onClick={() => setPeriod(p)}
            className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              period === p ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-card text-muted-foreground hover:bg-muted"
            )}>
            {p === "week" ? "Semana" : p === "month" ? "Mes" : p === "trimester" ? "Trimestre" : p === "year" ? "Ano" : "Personalizado"}
          </button>
        ))}
        {period === "custom" && (
          <div className="flex items-center gap-2 ml-2 rounded-lg border bg-card px-3 py-1">
            <span className="text-xs text-muted-foreground">De</span>
            <input
              type="date"
              value={customRange.from}
              onChange={(e) => setCustomRange({ ...customRange, from: e.target.value })}
              className="bg-transparent text-xs text-foreground outline-none"
            />
            <span className="text-xs text-muted-foreground">ate</span>
            <input
              type="date"
              value={customRange.to}
              onChange={(e) => setCustomRange({ ...customRange, to: e.target.value })}
              className="bg-transparent text-xs text-foreground outline-none"
            />
          </div>
        )}
      </div>

      {/* ========== OVERVIEW TAB ========== */}
      {activeTab === "overview" && (<>
        {/* Destaque: Valor Total (label por mercado) */}
        <div className="relative overflow-hidden rounded-2xl border-2 p-6 shadow-lg" style={{ borderColor: color, background: `linear-gradient(135deg, ${color}12, ${color}03)` }}>
            <div className="absolute top-0 right-0 opacity-10">
              <TrendingUp className="h-32 w-32" style={{ color }} />
            </div>
            <div className="relative">
              <p className="text-sm font-medium uppercase tracking-wide" style={{ color }}>{MARKET_PIPELINE_LABELS[market].valorTotal}</p>
              <p className="mt-1 text-4xl md:text-5xl font-bold" style={{ color }}>
                €{Number((k as unknown as Record<string, number>)?.totals?.valorEscriturado ?? 0).toLocaleString("pt-PT", { maximumFractionDigits: 0 })}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {k?.totals.conversoesFeitas ?? 0} {market === "CREDITO" ? "escrituras realizadas" : market === "SEGUROS" ? "apolices emitidas" : "vendas realizadas"} · periodo: {period === "week" ? "semana" : period === "month" ? "mes" : period === "trimester" ? "trimestre" : period === "year" ? "ano" : `${customRange.from} a ${customRange.to}`}
              </p>
              {/* Breakdown por tipo (so para CREDITO) */}
              {market === "CREDITO" && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                  {[
                    { label: "Habitacao", val: (k as unknown as Record<string, Record<string, number>>)?.totals?.valorCreditoHab ?? 0 },
                    { label: "Pessoal", val: (k as unknown as Record<string, Record<string, number>>)?.totals?.valorCreditoPes ?? 0 },
                    { label: "Consumo", val: (k as unknown as Record<string, Record<string, number>>)?.totals?.valorCreditoCon ?? 0 },
                    { label: "Transferencia", val: (k as unknown as Record<string, Record<string, number>>)?.totals?.valorCreditoTransf ?? 0 },
                    { label: "Cartoes", val: (k as unknown as Record<string, Record<string, number>>)?.totals?.valorCartoes ?? 0 },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg bg-card/80 backdrop-blur border px-3 py-2">
                      <p className="text-[10px] text-muted-foreground uppercase">{item.label}</p>
                      <p className="font-bold">€{Number(item.val).toLocaleString("pt-PT", { maximumFractionDigits: 0 })}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

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
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" /> {market === "CREDITO" ? "Escrituras" : "Conversoes"}
            </div>
            <p className="text-2xl font-bold mt-1">{k?.totals.conversoesFeitas ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">{market === "CREDITO" ? "escrituradas" : "fechadas"}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Target className="h-3.5 w-3.5" /> TC Global</div>
            <p className="text-2xl font-bold mt-1">{k?.totals.conversionRate?.toFixed(1) ?? 0}%</p>
            <p className="text-[10px] text-muted-foreground">contactos -&gt; fecho</p>
          </div>
        </div>

        {/* Pipeline completo com 8 taxas (segundo estrutura nova BoomLab) */}
        {(() => {
          const kt = (k as unknown as Record<string, Record<string, number | null>>)?.totals;
          const pipelineLabels = MARKET_PIPELINE_LABELS[market];
          const docsLabel = market === "CREDITO" ? "Doc. Completa" : "Levant. Completo";
          const convLabel = market === "SEGUROS" ? "Apólice" : market === "IMOBILIARIO" ? "Venda" : "Escritura";

          const cards = [
            { label: "Contacto", value: kt?.tcContacto, num: k?.totals.calls, denom: kt?.leads, color: color, fromTo: `${k?.totals.calls ?? 0}/${kt?.leads ?? 0}` },
            { label: "Lead → SAL", value: kt?.tcLeadSal, num: k?.totals.sals, denom: k?.totals.calls, color: "#6366f1", fromTo: `${k?.totals.sals ?? 0}/${k?.totals.calls ?? 0}` },
            { label: `SAL → ${docsLabel}`, value: kt?.tcSalDocsCompletas, num: kt?.documentacoesCompletas, denom: k?.totals.sals, color: "#8b5cf6", fromTo: `${kt?.documentacoesCompletas ?? 0}/${k?.totals.sals ?? 0}` },
            { label: "Comparecimento", value: kt?.tcShowUp, num: k?.totals.reunioesEfetuadas, denom: k?.totals.reunioesAgendadas, color: "#a855f7", fromTo: `${k?.totals.reunioesEfetuadas ?? 0}/${k?.totals.reunioesAgendadas ?? 0}` },
            { label: "SAL → SQL", value: kt?.tcSalSql, num: k?.totals.sqls, denom: k?.totals.sals, color: "#ec4899", fromTo: `${k?.totals.sqls ?? 0}/${k?.totals.sals ?? 0}` },
            { label: "SQL → AV", value: kt?.tcSqlAcordo, num: kt?.acordosVerbais, denom: k?.totals.sqls, color: "#f59e0b", fromTo: `${kt?.acordosVerbais ?? 0}/${k?.totals.sqls ?? 0}` },
            { label: `AV → ${convLabel}`, value: kt?.tcAcordoConv, num: k?.totals.conversoesFeitas, denom: kt?.acordosVerbais, color: "#10b981", fromTo: `${k?.totals.conversoesFeitas ?? 0}/${kt?.acordosVerbais ?? 0}` },
            { label: "TC Global", value: k?.totals.conversionRate, num: k?.totals.conversoesFeitas, denom: k?.totals.calls, color: "#16a34a", fromTo: `${k?.totals.conversoesFeitas ?? 0}/${k?.totals.calls ?? 0}` },
          ];

          return (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Taxas de Conversão</p>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
                {cards.map((c) => (
                  <div key={c.label} className="rounded-xl border bg-card p-3 border-l-4" style={{ borderLeftColor: c.color }}>
                    <div className="text-[10px] text-muted-foreground truncate" title={c.label}>{c.label}</div>
                    <p className="text-lg font-bold mt-0.5" style={{ color: c.color }}>
                      {typeof c.value === "number" ? c.value.toFixed(1) : "0.0"}%
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">{c.fromTo}</p>
                  </div>
                ))}
              </div>

              {/* Duracao Ciclo de Vendas + Ticket Medio */}
              <div className="grid gap-3 grid-cols-1 md:grid-cols-4 mt-4">
                <div className="rounded-xl border bg-card p-4 md:col-span-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Duração Média do Ciclo de Vendas</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-[10px] text-muted-foreground truncate">{pipelineLabels.tempoSalDocs}</p>
                      <p className="text-xl font-bold mt-0.5">{kt?.diasSalDocs != null ? `${Number(kt.diasSalDocs).toFixed(1)} dias` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground truncate">{pipelineLabels.tempoDocsSql}</p>
                      <p className="text-xl font-bold mt-0.5">{kt?.diasDocsSql != null ? `${Number(kt.diasDocsSql).toFixed(1)} dias` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground truncate">{pipelineLabels.tempoSqlConv}</p>
                      <p className="text-xl font-bold mt-0.5">{kt?.diasSqlEscritura != null ? `${Number(kt.diasSqlEscritura).toFixed(1)} dias` : "—"}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border bg-card p-4" style={{ background: `linear-gradient(135deg, ${color}10, transparent)` }}>
                  <p className="text-xs font-semibold text-muted-foreground">{pipelineLabels.ticketMedio}</p>
                  <p className="text-2xl font-bold mt-1" style={{ color }}>
                    €{Number(kt?.ticketMedio ?? 0).toLocaleString("pt-PT", { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] text-muted-foreground">por {convLabel.toLowerCase()}</p>
                </div>
              </div>
            </div>
          );
        })()}

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
              <th className="text-right p-2">Reun.</th><th className="text-right p-2">{market === "CREDITO" ? "Escrit." : "Conv."}</th>
              <th className="text-right p-2">TC%</th>
              {canEditRecords && <th className="text-right p-2 w-10"></th>}
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
                  {canEditRecords && (
                    <td className="p-2 text-right">
                      <button
                        onClick={() => {
                          setEditingRecordId(r.id);
                          const rec = r as unknown as Record<string, number | null | undefined>;
                          setEditForm({
                            leads: String(rec.leads ?? ""),
                            callsMade: String(r.callsMade ?? ""),
                            callsAnswered: String(r.callsAnswered ?? ""),
                            sals: String(rec.sals ?? ""),
                            sqls: String(rec.sqls ?? ""),
                            reunioesAgendadas: String(r.agendamentos ?? ""),
                            reunioesEfetuadas: String(r.reunioesEfetuadas ?? r.reunioes ?? ""),
                            documentacoesPedidas: String(rec.documentacoesPedidas ?? ""),
                            documentacoesRecolhidas: String(rec.documentacoesRecolhidas ?? ""),
                            documentacoesCompletas: String(rec.documentacoesCompletas ?? ""),
                            acordosVerbais: String(rec.acordosVerbais ?? ""),
                            conversoesFeitas: String(r.conversoesFeitas ?? r.conversions ?? ""),
                            diasSalDocs: String(rec.diasSalDocs ?? ""),
                            diasDocsSql: String(rec.diasDocsSql ?? ""),
                            diasSqlEscritura: String(rec.diasSqlEscritura ?? ""),
                            notes: r.notes ?? "",
                          });
                        }}
                        className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-600 transition-opacity"
                        title="Editar registo"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {db.records.length === 0 && <tr><td colSpan={canEditRecords ? 8 : 7} className="p-6 text-center text-muted-foreground">Sem registos. Usa o botao &quot;Registo&quot; para adicionar.</td></tr>}
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
                leads: parseInt(eod.leads) || 0,
                callsMade: parseInt(eod.callsMade) || 0,
                callsAnswered: parseInt(eod.callsAnswered) || 0,
                sals: showSalsSqlsInEod ? (parseInt(eod.sals) || 0) : 0,
                sqls: showSalsSqlsInEod ? (parseInt(eod.sqls) || 0) : 0,
                reunioesAgendadas: parseInt(eod.reunioesAgendadas) || 0,
                reunioesEfetuadas: parseInt(eod.reunioesEfetuadas) || 0,
                documentacoesPedidas: showDocsInEod ? (parseInt(eod.documentacoesPedidas) || 0) : 0,
                documentacoesRecolhidas: showDocsInEod ? (parseInt(eod.documentacoesRecolhidas) || 0) : 0,
                documentacoesCompletas: showSalsSqlsInEod ? (parseInt(eod.documentacoesCompletas) || 0) : 0,
                acordosVerbais: showSalsSqlsInEod ? (parseInt(eod.acordosVerbais) || 0) : 0,
                conversoesFeitas: parseInt(eod.conversoesFeitas) || 0,
                diasSalDocs: eod.diasSalDocs ? parseFloat(eod.diasSalDocs) : undefined,
                diasDocsSql: eod.diasDocsSql ? parseFloat(eod.diasDocsSql) : undefined,
                diasSqlEscritura: eod.diasSqlEscritura ? parseFloat(eod.diasSqlEscritura) : undefined,
                notes: eod.notes || undefined,
              };
              // Vertentes: em credito usa o dropdown dinamico; noutros mercados usa os campos antigos
              if (market === "CREDITO") {
                // Agrega multiplas linhas de credito por tipo
                const aggregated: Record<string, { n: number; v: number }> = {};
                for (const line of creditLines) {
                  if (!line.key) continue;
                  if (!aggregated[line.key]) aggregated[line.key] = { n: 0, v: 0 };
                  aggregated[line.key].n += parseInt(line.n) || 0;
                  aggregated[line.key].v += parseFloat(line.v) || 0;
                }
                for (const vertente of vertentes) {
                  if (aggregated[vertente.key]) {
                    data[vertente.key] = aggregated[vertente.key].n;
                    data[vertente.vKey] = aggregated[vertente.key].v;
                  }
                }
              } else {
                for (const v of vertentes) {
                  if (eod[v.key]) data[v.key] = parseInt(eod[v.key]) || 0;
                  if (eod[v.vKey]) data[v.vKey] = parseFloat(eod[v.vKey]) || 0;
                }
              }
              addRecord.mutate(data as Parameters<typeof addRecord.mutate>[0], {
                onSuccess: () => {
                  setCreditLines([]);
                },
              });
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

              {(() => {
                // Calcula etapas dinamicamente
                const docsCompletasLabel = market === "CREDITO" ? "Docs Completas" : "Levantamentos Completos";
                const steps: { label: string; key: keyof typeof eod; hint?: string }[] = [
                  { label: "Leads (topo funil)", key: "leads", hint: "Total leads geradas" },
                  { label: "Contactos", key: "callsMade" },
                  { label: "Respondidos", key: "callsAnswered" },
                ];
                if (showSalsSqlsInEod) {
                  steps.push({ label: "SALs", key: "sals", hint: "leads viaveis ao 1o contacto" });
                  steps.push({ label: docsCompletasLabel, key: "documentacoesCompletas" });
                }
                steps.push({ label: "Reun. Agendadas", key: "reunioesAgendadas" });
                steps.push({ label: "Comparecimentos", key: "reunioesEfetuadas" });
                if (showSalsSqlsInEod) {
                  steps.push({ label: "SQLs", key: "sqls", hint: "qualificadas (banco aprovou)" });
                  steps.push({ label: "Acordos Verbais", key: "acordosVerbais" });
                }
                if (showDocsInEod) {
                  steps.push({ label: "Docs Pedidas", key: "documentacoesPedidas" });
                  steps.push({ label: "Docs Recolhidas", key: "documentacoesRecolhidas" });
                }
                steps.push({ label: conversionLabel, key: "conversoesFeitas" });
                return (
                  <>
                    <p className="text-xs font-semibold text-muted-foreground pt-1">
                      Pipeline Comercial ({steps.length} etapas) · canal: <span style={{ color }}>{channels.find(c => c.key === eod.channel)?.label}</span>
                    </p>
                    <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
                      {steps.map((step, i) => (
                        <div key={step.key}>
                          <label className="mb-0.5 block text-[10px]">{i + 1}. {step.label}</label>
                          <input
                            type="number"
                            min="0"
                            value={eod[step.key] ?? ""}
                            onChange={(e) => setEod({ ...eod, [step.key]: e.target.value })}
                            className="w-full rounded border px-2 py-1.5 text-sm bg-card"
                          />
                        </div>
                      ))}
                    </div>
                    {isColdCallEod && (
                      <p className="text-[10px] text-blue-600 dark:text-blue-400">
                        <strong>Cold Calling B2B</strong>: foco em estabelecer parcerias (sem etapas de documentacao, sem SALs/SQLs).
                      </p>
                    )}
                    {!isColdCallEod && (
                      <p className="text-[10px] text-muted-foreground">
                        <strong>SALs</strong>: leads viaveis no 1o contacto. <strong>SQLs</strong>: leads qualificadas (banco aprovou).
                        {showDocsInEod && <> <strong>Docs</strong>: pipeline de recolha de documentacao.</>}
                      </p>
                    )}
                  </>
                );
              })()}

              {/* Duracao media do ciclo de vendas (opcional, preenchido quando conhecido) */}
              {!isColdCallEod && (() => {
                const tempoLabels = market === "SEGUROS"
                  ? { a: "SAL → Levantamento", b: "Levantamento → SQL", c: "SQL → Apólice" }
                  : market === "IMOBILIARIO"
                  ? { a: "SAL → Levantamento", b: "Levantamento → SQL", c: "SQL → Venda" }
                  : { a: "SAL → Docs Completas", b: "Docs → SQL", c: "SQL → Escritura" };
                return (
                  <>
                    <p className="text-xs font-semibold text-muted-foreground pt-1">Duracao media ciclo (dias) · opcional</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="mb-0.5 block text-[10px]">{tempoLabels.a}</label>
                        <input type="number" step="0.1" min="0" value={eod.diasSalDocs} onChange={(e) => setEod({ ...eod, diasSalDocs: e.target.value })} className="w-full rounded border px-2 py-1.5 text-sm bg-card" />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[10px]">{tempoLabels.b}</label>
                        <input type="number" step="0.1" min="0" value={eod.diasDocsSql} onChange={(e) => setEod({ ...eod, diasDocsSql: e.target.value })} className="w-full rounded border px-2 py-1.5 text-sm bg-card" />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[10px]">{tempoLabels.c}</label>
                        <input type="number" step="0.1" min="0" value={eod.diasSqlEscritura} onChange={(e) => setEod({ ...eod, diasSqlEscritura: e.target.value })} className="w-full rounded border px-2 py-1.5 text-sm bg-card" />
                      </div>
                    </div>
                  </>
                );
              })()}

              {market === "CREDITO" ? (
                <>
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xs font-semibold" style={{ color }}>Creditos do dia</p>
                    <button
                      type="button"
                      onClick={() => setCreditLines([...creditLines, { key: vertentes[0]?.key ?? "creditoHabitacaoN", n: "1", v: "" }])}
                      className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium hover:bg-muted"
                      style={{ borderColor: color, color }}
                    >
                      <Plus className="h-3 w-3" /> Adicionar credito
                    </button>
                  </div>
                  {creditLines.length === 0 ? (
                    <p className="rounded-lg border border-dashed py-3 text-center text-xs text-muted-foreground">
                      Ainda sem creditos. Clica em &quot;Adicionar credito&quot; para registar.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {creditLines.map((line, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_80px_120px_auto] gap-2 items-end">
                          <div>
                            <label className="mb-0.5 block text-[10px]">Tipo</label>
                            <select
                              value={line.key}
                              onChange={(e) => {
                                const copy = [...creditLines];
                                copy[idx] = { ...copy[idx], key: e.target.value };
                                setCreditLines(copy);
                              }}
                              className="w-full rounded border px-2 py-1.5 text-sm bg-card"
                            >
                              {vertentes.map((v) => (
                                <option key={v.key} value={v.key}>{v.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[10px]">Nº</label>
                            <input
                              type="number"
                              min="0"
                              value={line.n}
                              onChange={(e) => {
                                const copy = [...creditLines];
                                copy[idx] = { ...copy[idx], n: e.target.value };
                                setCreditLines(copy);
                              }}
                              className="w-full rounded border px-2 py-1.5 text-sm bg-card"
                            />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[10px]">Valor (€)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.v}
                              onChange={(e) => {
                                const copy = [...creditLines];
                                copy[idx] = { ...copy[idx], v: e.target.value };
                                setCreditLines(copy);
                              }}
                              className="w-full rounded border px-2 py-1.5 text-sm bg-card"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setCreditLines(creditLines.filter((_, i) => i !== idx))}
                            className="rounded p-1.5 text-muted-foreground hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600"
                            title="Remover"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold pt-1" style={{ color }}>Vertentes - {MARKET_LABELS[market]}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {vertentes.map((v) => (
                      <div key={v.key} className="grid grid-cols-2 gap-1">
                        <div><label className="mb-0.5 block text-[10px]">Nº {v.short}</label><input type="number" value={eod[v.key] ?? ""} onChange={(e) => setEod({ ...eod, [v.key]: e.target.value })} className="w-full rounded border px-2 py-1 text-sm bg-card" /></div>
                        <div><label className="mb-0.5 block text-[10px]">Valor {v.short}</label><input type="number" step="0.01" value={eod[v.vKey] ?? ""} onChange={(e) => setEod({ ...eod, [v.vKey]: e.target.value })} className="w-full rounded border px-2 py-1 text-sm bg-card" /></div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div><label className="mb-0.5 block text-[10px]">Notas</label><input type="text" value={eod.notes} onChange={(e) => setEod({ ...eod, notes: e.target.value })} className="w-full rounded border px-2 py-1.5 text-sm bg-card" /></div>
              <div className="flex justify-end gap-3 border-t pt-3">
                <button type="button" onClick={() => setShowEOD(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={addRecord.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">{addRecord.isPending ? "..." : "Registar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============ EDIT RECORD DIALOG ============ */}
      {editingRecordId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 animate-scale-in">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Editar Registo</h2>
              <button onClick={() => setEditingRecordId(null)} className="rounded-lg p-1 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!editingRecordId) return;
                // Determina canal do registo para saber se inclui docs/sals
                const editedRec = db.records.find((r) => r.id === editingRecordId);
                const editIsColdCall = editedRec?.channel === "cold-calling";
                const editShowDocs = market === "CREDITO" && !editIsColdCall;
                const editShowSals = !editIsColdCall;
                updateRecord.mutate({
                  id: editingRecordId,
                  data: {
                    leads: parseInt(editForm.leads) || 0,
                    callsMade: parseInt(editForm.callsMade) || 0,
                    callsAnswered: parseInt(editForm.callsAnswered) || 0,
                    sals: editShowSals ? (parseInt(editForm.sals) || 0) : 0,
                    sqls: editShowSals ? (parseInt(editForm.sqls) || 0) : 0,
                    acordosVerbais: editShowSals ? (parseInt(editForm.acordosVerbais) || 0) : 0,
                    reunioesAgendadas: parseInt(editForm.reunioesAgendadas) || 0,
                    reunioesEfetuadas: parseInt(editForm.reunioesEfetuadas) || 0,
                    documentacoesPedidas: editShowDocs ? (parseInt(editForm.documentacoesPedidas) || 0) : 0,
                    documentacoesRecolhidas: editShowDocs ? (parseInt(editForm.documentacoesRecolhidas) || 0) : 0,
                    documentacoesCompletas: editShowSals ? (parseInt(editForm.documentacoesCompletas) || 0) : 0,
                    conversoesFeitas: parseInt(editForm.conversoesFeitas) || 0,
                    diasSalDocs: editForm.diasSalDocs ? parseFloat(editForm.diasSalDocs) : undefined,
                    diasDocsSql: editForm.diasDocsSql ? parseFloat(editForm.diasDocsSql) : undefined,
                    diasSqlEscritura: editForm.diasSqlEscritura ? parseFloat(editForm.diasSqlEscritura) : undefined,
                    notes: editForm.notes || null,
                  },
                });
              }}
              className="space-y-3"
            >
              {(() => {
                const editedRec = db.records.find((r) => r.id === editingRecordId);
                const editIsColdCall = editedRec?.channel === "cold-calling";
                const editShowDocs = market === "CREDITO" && !editIsColdCall;
                const editShowSals = !editIsColdCall;
                const editConversionLabel = editIsColdCall ? "Parc. Estab." : (market === "CREDITO" ? "Escrituras" : "Conversoes");
                const docsCompletasLabel = market === "CREDITO" ? "Docs Completas" : "Levant. Completos";
                const steps: { label: string; key: keyof typeof editForm }[] = [
                  { label: "Leads", key: "leads" },
                  { label: "Contactos", key: "callsMade" },
                  { label: "Respondidos", key: "callsAnswered" },
                ];
                if (editShowSals) {
                  steps.push({ label: "SALs", key: "sals" });
                  steps.push({ label: docsCompletasLabel, key: "documentacoesCompletas" });
                }
                steps.push({ label: "Agendadas", key: "reunioesAgendadas" });
                steps.push({ label: "Comparecim.", key: "reunioesEfetuadas" });
                if (editShowSals) {
                  steps.push({ label: "SQLs", key: "sqls" });
                  steps.push({ label: "Acordos Verbais", key: "acordosVerbais" });
                }
                if (editShowDocs) {
                  steps.push({ label: "Docs Pedidas", key: "documentacoesPedidas" });
                  steps.push({ label: "Docs Recolhidas", key: "documentacoesRecolhidas" });
                }
                steps.push({ label: editConversionLabel, key: "conversoesFeitas" });
                return (
                  <>
                    <p className="text-xs font-semibold text-muted-foreground">
                      Pipeline ({steps.length} etapas) · canal: <span style={{ color }}>{getChannelLabel(market, editedRec?.channel ?? "")}</span>
                    </p>
                    <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
                      {steps.map((step, i) => (
                        <div key={step.key}>
                          <label className="mb-0.5 block text-[10px]">{i + 1}. {step.label}</label>
                          <input
                            type="number"
                            min="0"
                            value={editForm[step.key] ?? ""}
                            onChange={(e) => setEditForm({ ...editForm, [step.key]: e.target.value })}
                            className="w-full rounded border px-2 py-1.5 text-sm bg-card"
                          />
                        </div>
                      ))}
                    </div>
                    {editIsColdCall && (
                      <p className="text-[10px] text-blue-600 dark:text-blue-400">
                        Cold Calling B2B - sem documentacao nem SALs/SQLs (os campos so se aplicam a canais de leads particulares).
                      </p>
                    )}
                    {!editIsColdCall && (
                      <>
                        <p className="text-xs font-semibold text-muted-foreground pt-1">Duracao media ciclo (dias) · opcional</p>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="mb-0.5 block text-[10px]">SAL → {market === "CREDITO" ? "Docs" : "Levant."}</label>
                            <input type="number" step="0.1" min="0" value={editForm.diasSalDocs} onChange={(e) => setEditForm({ ...editForm, diasSalDocs: e.target.value })} className="w-full rounded border px-2 py-1.5 text-sm bg-card" />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[10px]">{market === "CREDITO" ? "Docs" : "Levant."} → SQL</label>
                            <input type="number" step="0.1" min="0" value={editForm.diasDocsSql} onChange={(e) => setEditForm({ ...editForm, diasDocsSql: e.target.value })} className="w-full rounded border px-2 py-1.5 text-sm bg-card" />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[10px]">SQL → {market === "CREDITO" ? "Escritura" : market === "SEGUROS" ? "Apólice" : "Venda"}</label>
                            <input type="number" step="0.1" min="0" value={editForm.diasSqlEscritura} onChange={(e) => setEditForm({ ...editForm, diasSqlEscritura: e.target.value })} className="w-full rounded border px-2 py-1.5 text-sm bg-card" />
                          </div>
                        </div>
                      </>
                    )}
                  </>
                );
              })()}

              <div>
                <label className="mb-0.5 block text-[10px]">Notas</label>
                <input type="text" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="w-full rounded border px-2 py-1.5 text-sm bg-card" />
              </div>

              {updateRecord.error && (
                <p className="text-xs text-red-600 dark:text-red-400">Erro: {updateRecord.error.message}</p>
              )}

              <div className="flex justify-end gap-3 border-t pt-3">
                <button type="button" onClick={() => setEditingRecordId(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={updateRecord.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                  {updateRecord.isPending ? "A guardar..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
