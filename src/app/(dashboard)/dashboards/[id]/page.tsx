"use client";

import { use, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ArrowLeft, Plus, X, Phone, TrendingUp, Users, Target, Calendar, BarChart3, UserPlus, Trash2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";

const MARKET_LABELS: Record<string, string> = { CREDITO: "Credito", SEGUROS: "Seguros", IMOBILIARIO: "Imobiliario" };
const MARKET_COLORS: Record<string, string> = { CREDITO: "#2D76FC", SEGUROS: "#16a34a", IMOBILIARIO: "#ea580c" };
const CHANNELS = ["Cold Calling", "LinkedIn", "Anuncios", "Referencias", "Cross-Sell", "Outros"];

const CREDITO_VERTENTES = [
  { key: "creditoHabitacaoN", vKey: "creditoHabitacaoV", label: "Credito Habitacao", short: "Hab." },
  { key: "creditoPessoalN", vKey: "creditoPessoalV", label: "Credito Pessoal", short: "Pes." },
  { key: "creditoConsumoN", vKey: "creditoConsumoV", label: "Credito Consumo", short: "Con." },
  { key: "cartoesN", vKey: "cartoesV", label: "Cartoes Credito", short: "Cart." },
  { key: "segurosCrossN", vKey: "segurosCrossV", label: "Seguros (Cross-sell)", short: "Seg." },
];

const SEGUROS_VERTENTES = [
  { key: "segurosVidaN", vKey: "segurosVidaV", label: "Vida", short: "Vida" },
  { key: "segurosSaudeN", vKey: "segurosSaudeV", label: "Saude", short: "Saude" },
  { key: "segurosAutoN", vKey: "segurosAutoV", label: "Automovel", short: "Auto" },
  { key: "segurosHabitacaoN", vKey: "segurosHabitacaoV", label: "Habitacao", short: "Hab." },
  { key: "segurosMultiN", vKey: "segurosMultiV", label: "Multirriscos", short: "Multi" },
  { key: "segurosOutrosN", vKey: "segurosOutrosV", label: "Outros", short: "Outros" },
];

const IMOB_VERTENTES = [
  { key: "imoAngariacaoN", vKey: "imoAngariacaoV", label: "Angariacao", short: "Ang." },
  { key: "imoVendaN", vKey: "imoVendaV", label: "Venda", short: "Venda" },
  { key: "imoArrendamentoN", vKey: "imoArrendamentoV", label: "Arrendamento", short: "Arr." },
  { key: "imoComercialN", vKey: "imoComercialV", label: "Comercial", short: "Com." },
];

export default function DashboardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [period, setPeriod] = useState<"week" | "month" | "trimester" | "year">("month");
  const [activeTab, setActiveTab] = useState<"overview" | "growth" | "vertentes">("overview");
  const [showEOD, setShowEOD] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [newCommercial, setNewCommercial] = useState("");
  const [eod, setEod] = useState<Record<string, string>>({ commercial: "", channel: "Cold Calling", date: new Date().toISOString().split("T")[0], callsMade: "", callsAnswered: "", conversions: "", agendamentos: "", notes: "" });

  const dashboard = trpc.dashboards.getById.useQuery(id);
  const kpis = trpc.dashboards.kpis.useQuery({ dashboardId: id, period });
  const growthKpis = trpc.dashboards.growthKpis.useQuery({ dashboardId: id });
  const chartData = trpc.dashboards.chartData.useQuery({ dashboardId: id, months: 3 });
  const utils = trpc.useUtils();

  const addRecord = trpc.dashboards.addRecord.useMutation({
    onSuccess: () => { utils.dashboards.getById.invalidate(); utils.dashboards.kpis.invalidate(); utils.dashboards.growthKpis.invalidate(); utils.dashboards.chartData.invalidate(); setShowEOD(false); },
  });

  const updateDashboard = trpc.dashboards.update.useMutation({
    onSuccess: () => utils.dashboards.getById.invalidate(),
  });

  const users = trpc.admin.listUsers.useQuery();
  const assignedUsers = (users.data ?? []).filter(u => u.assignedDashboardId === id);

  if (dashboard.isLoading) return <div className="p-8 text-center text-muted-foreground">A carregar...</div>;
  if (!dashboard.data) return <div className="p-8 text-center text-muted-foreground">Dashboard nao encontrada</div>;

  const db = dashboard.data;
  const color = MARKET_COLORS[db.market] ?? "#2D76FC";
  const k = kpis.data;
  const vertentes = db.market === "CREDITO" ? CREDITO_VERTENTES : db.market === "SEGUROS" ? SEGUROS_VERTENTES : IMOB_VERTENTES;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboards" className="rounded-lg p-2 hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{db.client.name}</h1>
          <div className="flex items-center gap-2">
            <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${color}15`, color }}>{MARKET_LABELS[db.market]}</span>
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
      <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
        {[
          { key: "overview", label: "Overview", icon: BarChart3 },
          { key: "growth", label: "Growth KPIs", icon: TrendingUp },
          { key: "vertentes", label: "Vertentes", icon: Target },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
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
        {/* KPI Cards */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Phone className="h-3.5 w-3.5" /> Chamadas</div>
            <p className="text-2xl font-bold mt-1">{k?.totals.calls ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">{k?.totals.answered ?? 0} atendidas</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" /> Conversoes</div>
            <p className="text-2xl font-bold mt-1">{k?.totals.conversions ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">TC: {k?.totals.conversionRate?.toFixed(1) ?? 0}%</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Calendar className="h-3.5 w-3.5" /> Agendamentos</div>
            <p className="text-2xl font-bold mt-1">{k?.totals.agendamentos ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">{k?.totals.reunioes ?? 0} reunioes</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Target className="h-3.5 w-3.5" /> Show-up</div>
            <p className="text-2xl font-bold mt-1">{k?.totals.showUpRate?.toFixed(0) ?? 0}%</p>
            <p className="text-[10px] text-muted-foreground">{k?.totals.comparecimentos ?? 0} comparecimentos</p>
          </div>
        </div>

        {/* Charts */}
        {chartData.data && chartData.data.length > 1 && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-semibold mb-3">Chamadas & Conversoes</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="calls" stroke={color} strokeWidth={2} dot={false} name="Chamadas" />
                  <Line type="monotone" dataKey="conversions" stroke="#16a34a" strokeWidth={2} dot={false} name="Conversoes" />
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
                  <th className="text-right p-3">Chamadas</th><th className="text-right p-3">Conversoes</th>
                  <th className="text-right p-3">TC%</th><th className="text-right p-3">Agend.</th>
                </tr></thead>
                <tbody className="divide-y">
                  {k.byCommercial.map((c, i) => (
                    <tr key={c.name} className="hover:bg-muted/50">
                      <td className="p-3 font-bold" style={{ color: i === 0 ? color : undefined }}>{i + 1}º</td>
                      <td className="p-3 font-medium">{c.name}</td>
                      <td className="p-3 text-right">{c.calls}</td>
                      <td className="p-3 text-right font-medium">{c.conversions}</td>
                      <td className="p-3 text-right"><span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", c.conversionRate > 80 ? "bg-green-100 text-green-700" : c.conversionRate > 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700")}>{c.conversionRate.toFixed(1)}%</span></td>
                      <td className="p-3 text-right">{c.agendamentos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>)}

      {/* ========== GROWTH KPIs TAB ========== */}
      {activeTab === "growth" && (<>
        <div className="rounded-xl border bg-card">
          <div className="border-b p-4">
            <h2 className="font-semibold">Growth KPIs por Semana</h2>
          </div>
          {!growthKpis.data?.length ? (
            <p className="p-6 text-sm text-muted-foreground text-center">Sem dados</p>
          ) : (<>
            {/* Chart */}
            <div className="p-4">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={growthKpis.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="calls" fill={color} name="Chamadas" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="conversions" fill="#16a34a" name="Conversoes" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="agendamentos" fill="#8b5cf6" name="Agendamentos" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Table */}
            <div className="overflow-x-auto border-t">
              <table className="w-full text-xs">
                <thead><tr className="border-b text-muted-foreground">
                  <th className="text-left p-2">Semana</th><th className="text-left p-2">Mes</th>
                  <th className="text-right p-2">Chamadas</th><th className="text-right p-2">Atendidas</th>
                  <th className="text-right p-2">Conversoes</th><th className="text-right p-2">Agend.</th>
                  <th className="text-right p-2">Reunioes</th><th className="text-right p-2">Comp.</th>
                </tr></thead>
                <tbody className="divide-y">
                  {growthKpis.data.map((w) => (
                    <tr key={w.key} className="hover:bg-muted/50">
                      <td className="p-2 font-medium">{w.label}</td><td className="p-2">{w.month}</td>
                      <td className="p-2 text-right">{w.calls}</td><td className="p-2 text-right">{w.answered}</td>
                      <td className="p-2 text-right font-medium">{w.conversions}</td><td className="p-2 text-right">{w.agendamentos}</td>
                      <td className="p-2 text-right">{w.reunioes}</td><td className="p-2 text-right">{w.comparecimentos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>)}
        </div>
      </>)}

      {/* ========== VERTENTES TAB ========== */}
      {activeTab === "vertentes" && (<>
        <div className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold mb-3">Vertentes - {MARKET_LABELS[db.market]}</h2>
          <p className="text-xs text-muted-foreground mb-4">Detalhes por tipo de produto/servico</p>

          {/* Vertentes chart */}
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
                    const dataKey = db.market === "CREDITO"
                      ? v.key === "creditoHabitacaoN" ? "creditoHab" : v.key === "creditoPessoalN" ? "creditoPes" : v.key === "creditoConsumoN" ? "creditoCon" : v.key === "cartoesN" ? "cartoes" : "segurosCross"
                      : db.market === "SEGUROS"
                        ? v.key === "segurosVidaN" ? "segurosVida" : v.key === "segurosSaudeN" ? "segurosSaude" : v.key === "segurosAutoN" ? "segurosAuto" : v.key === "segurosHabitacaoN" ? "segurosHab" : "segurosMulti"
                        : v.key === "imoAngariacaoN" ? "imoAngariacao" : v.key === "imoVendaN" ? "imoVenda" : "imoArrendamento";
                    return <Bar key={v.key} dataKey={dataKey} fill={colors[i % colors.length]} name={v.label} radius={[2, 2, 0, 0]} />;
                  })}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Vertentes summary cards */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
            {vertentes.map((v) => (
              <div key={v.key} className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{v.label}</p>
                <p className="text-xl font-bold mt-0.5">-</p>
                <p className="text-[10px] text-muted-foreground">Preencher via registos diarios</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            As vertentes sao preenchidas automaticamente a partir dos registos diarios (End of Day).
            Ao registar, seleciona o tipo de produto (ex: Credito Habitacao, Seguro Vida, Angariacao) para ver os dados aqui.
          </p>
        </div>
      </>)}

      {/* Recent Records (always visible) */}
      <div className="rounded-xl border bg-card">
        <div className="border-b p-4"><h2 className="font-semibold">Registos Recentes</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b text-muted-foreground">
              <th className="text-left p-2">Data</th><th className="text-left p-2">Comercial</th>
              <th className="text-left p-2">Canal</th><th className="text-right p-2">Calls</th>
              <th className="text-right p-2">Conv.</th><th className="text-right p-2">TC%</th>
              <th className="text-right p-2">Agend.</th>
            </tr></thead>
            <tbody className="divide-y">
              {db.records.slice(0, 20).map((r) => (
                <tr key={r.id} className="hover:bg-muted/50">
                  <td className="p-2">{new Date(r.date).toLocaleDateString("pt-PT")}</td>
                  <td className="p-2 font-medium">{r.commercial}</td>
                  <td className="p-2">{r.channel}</td>
                  <td className="p-2 text-right">{r.callsMade}</td>
                  <td className="p-2 text-right">{r.conversions}</td>
                  <td className="p-2 text-right">{r.conversionRate?.toFixed(1)}%</td>
                  <td className="p-2 text-right">{r.agendamentos ?? 0}</td>
                </tr>
              ))}
              {db.records.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Sem registos. Usa o botao "Registo" para adicionar.</td></tr>}
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

            {/* Users with access to this dashboard */}
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

            {/* Current team members */}
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Membros da equipa ({db.commercials.length})</p>
              {db.commercials.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nenhum membro adicionado. Adiciona nomes abaixo.</p>
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
                        className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add new member */}
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
                conversions: parseInt(eod.conversions) || 0,
                agendamentos: parseInt(eod.agendamentos) || 0,
                notes: eod.notes || undefined,
              };
              // Add market-specific fields
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
              <div><label className="mb-0.5 block text-xs font-medium">Canal</label>
                <select value={eod.channel} onChange={(e) => setEod({ ...eod, channel: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card">
                  {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <p className="text-xs font-semibold text-muted-foreground pt-1">Metricas Gerais</p>
              <div className="grid grid-cols-4 gap-2">
                <div><label className="mb-0.5 block text-[10px]">Chamadas</label><input type="number" value={eod.callsMade} onChange={(e) => setEod({ ...eod, callsMade: e.target.value })} className="w-full rounded border px-2 py-1.5 text-sm bg-card" /></div>
                <div><label className="mb-0.5 block text-[10px]">Atendidas</label><input type="number" value={eod.callsAnswered} onChange={(e) => setEod({ ...eod, callsAnswered: e.target.value })} className="w-full rounded border px-2 py-1.5 text-sm bg-card" /></div>
                <div><label className="mb-0.5 block text-[10px]">Conversoes</label><input type="number" value={eod.conversions} onChange={(e) => setEod({ ...eod, conversions: e.target.value })} className="w-full rounded border px-2 py-1.5 text-sm bg-card" /></div>
                <div><label className="mb-0.5 block text-[10px]">Agend.</label><input type="number" value={eod.agendamentos} onChange={(e) => setEod({ ...eod, agendamentos: e.target.value })} className="w-full rounded border px-2 py-1.5 text-sm bg-card" /></div>
              </div>

              <p className="text-xs font-semibold pt-1" style={{ color }}>Vertentes - {MARKET_LABELS[db.market]}</p>
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
