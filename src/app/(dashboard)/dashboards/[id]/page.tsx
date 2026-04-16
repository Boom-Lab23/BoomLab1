"use client";

import { use, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ArrowLeft, BarChart3, Plus, X, Phone, TrendingUp, Users, Target, Calendar } from "lucide-react";

const MARKET_LABELS = { CREDITO: "Credito", SEGUROS: "Seguros", IMOBILIARIO: "Imobiliario" };
const MARKET_COLORS = { CREDITO: "#2D76FC", SEGUROS: "#16a34a", IMOBILIARIO: "#ea580c" };
const CHANNELS = ["Cold Calling", "LinkedIn", "Anuncios", "Referencias", "Cross-Sell", "Outros"];

export default function DashboardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [period, setPeriod] = useState<"week" | "month" | "trimester" | "year">("month");
  const [showEOD, setShowEOD] = useState(false);
  const [eod, setEod] = useState({ commercial: "", channel: "Cold Calling", date: new Date().toISOString().split("T")[0], callsMade: "", callsAnswered: "", conversions: "", agendamentos: "", escrituras: "", angariacoes: "", decisionMakers: "", notes: "" });

  const dashboard = trpc.dashboards.getById.useQuery(id);
  const kpis = trpc.dashboards.kpis.useQuery({ dashboardId: id, period });
  const utils = trpc.useUtils();

  const addRecord = trpc.dashboards.addRecord.useMutation({
    onSuccess: () => { utils.dashboards.getById.invalidate(); utils.dashboards.kpis.invalidate(); setShowEOD(false); },
  });

  if (dashboard.isLoading) return <div className="p-8 text-center text-muted-foreground">A carregar...</div>;
  if (!dashboard.data) return <div className="p-8 text-center text-muted-foreground">Dashboard nao encontrada</div>;

  const db = dashboard.data;
  const color = MARKET_COLORS[db.market] ?? "#2D76FC";
  const k = kpis.data;

  return (
    <div className="space-y-6">
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
        <button onClick={() => setShowEOD(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Registo Diario
        </button>
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
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Target className="h-3.5 w-3.5" /> Show-up Rate</div>
          <p className="text-2xl font-bold mt-1">{k?.totals.showUpRate?.toFixed(0) ?? 0}%</p>
          <p className="text-[10px] text-muted-foreground">{k?.totals.comparecimentos ?? 0} comparecimentos</p>
        </div>
      </div>

      {/* Objectives Progress */}
      {k?.objectives && Object.keys(k.objectives).length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Target className="h-4 w-4" style={{ color }} /> Objetivos</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {Object.entries(k.objectives).map(([key, target]) => {
              const current = key === "chamadas" ? k.totals.calls : key === "conversoes" ? k.totals.conversions : key === "agendamentos" ? k.totals.agendamentos : 0;
              const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize">{key}</span>
                    <span className="font-medium">{current}/{target}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{pct.toFixed(0)}%</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Performance by Commercial (ranking) */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b p-4">
          <Users className="h-4 w-4" style={{ color }} />
          <h2 className="font-semibold">Performance Comerciais</h2>
        </div>
        {!k?.byCommercial?.length ? (
          <p className="p-6 text-sm text-muted-foreground text-center">Sem registos neste periodo</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left p-3">#</th>
                  <th className="text-left p-3">Comercial</th>
                  <th className="text-right p-3">Chamadas</th>
                  <th className="text-right p-3">Atendidas</th>
                  <th className="text-right p-3">Conversoes</th>
                  <th className="text-right p-3">TC%</th>
                  <th className="text-right p-3">Agendamentos</th>
                  {db.market === "CREDITO" && <th className="text-right p-3">Escrituras</th>}
                  {db.market === "SEGUROS" && <th className="text-right p-3">Angariacoes</th>}
                  {db.market === "IMOBILIARIO" && <th className="text-right p-3">Decision Makers</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {k.byCommercial.map((c, i) => (
                  <tr key={c.name} className="hover:bg-muted/50">
                    <td className="p-3 font-bold" style={{ color: i === 0 ? color : undefined }}>{i + 1}º</td>
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="p-3 text-right">{c.calls}</td>
                    <td className="p-3 text-right">{c.answered}</td>
                    <td className="p-3 text-right font-medium">{c.conversions}</td>
                    <td className="p-3 text-right">
                      <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium",
                        c.conversionRate > 80 ? "bg-green-100 text-green-700" : c.conversionRate > 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                      )}>{c.conversionRate.toFixed(1)}%</span>
                    </td>
                    <td className="p-3 text-right">{c.agendamentos}</td>
                    {db.market === "CREDITO" && <td className="p-3 text-right">{c.escrituras}</td>}
                    {db.market === "SEGUROS" && <td className="p-3 text-right">{c.angariacoes}</td>}
                    {db.market === "IMOBILIARIO" && <td className="p-3 text-right">{c.decisionMakers}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Records */}
      <div className="rounded-xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-semibold">Registos Recentes</h2>
          <p className="text-xs text-muted-foreground">{db.records.length} registos</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left p-2">Data</th>
                <th className="text-left p-2">Comercial</th>
                <th className="text-left p-2">Canal</th>
                <th className="text-right p-2">Calls</th>
                <th className="text-right p-2">Atend.</th>
                <th className="text-right p-2">Conv.</th>
                <th className="text-right p-2">TC%</th>
                <th className="text-right p-2">Agend.</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {db.records.slice(0, 30).map((r) => (
                <tr key={r.id} className="hover:bg-muted/50">
                  <td className="p-2">{new Date(r.date).toLocaleDateString("pt-PT")}</td>
                  <td className="p-2 font-medium">{r.commercial}</td>
                  <td className="p-2">{r.channel}</td>
                  <td className="p-2 text-right">{r.callsMade}</td>
                  <td className="p-2 text-right">{r.callsAnswered}</td>
                  <td className="p-2 text-right">{r.conversions}</td>
                  <td className="p-2 text-right">{r.conversionRate?.toFixed(1)}%</td>
                  <td className="p-2 text-right">{r.agendamentos ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* EOD Form Dialog */}
      {showEOD && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 animate-scale-in">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Registo Diario (End of Day)</h2>
              <button onClick={() => setShowEOD(false)} className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              addRecord.mutate({
                dashboardId: id,
                date: new Date(eod.date),
                commercial: eod.commercial,
                channel: eod.channel,
                callsMade: parseInt(eod.callsMade) || 0,
                callsAnswered: parseInt(eod.callsAnswered) || 0,
                conversions: parseInt(eod.conversions) || 0,
                agendamentos: parseInt(eod.agendamentos) || 0,
                escrituras: db.market === "CREDITO" ? parseInt(eod.escrituras) || 0 : undefined,
                angariacoes: db.market === "SEGUROS" ? parseInt(eod.angariacoes) || 0 : undefined,
                decisionMakers: db.market === "IMOBILIARIO" ? parseInt(eod.decisionMakers) || 0 : undefined,
                notes: eod.notes || undefined,
              });
            }} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium">Comercial *</label>
                  <input type="text" required value={eod.commercial} onChange={(e) => setEod({ ...eod, commercial: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" placeholder="Nome" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Data</label>
                  <input type="date" value={eod.date} onChange={(e) => setEod({ ...eod, date: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Canal</label>
                <select value={eod.channel} onChange={(e) => setEod({ ...eod, channel: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card">
                  {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <p className="text-xs font-semibold text-muted-foreground pt-2">Metricas</p>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="mb-0.5 block text-[10px] font-medium">Chamadas</label><input type="number" value={eod.callsMade} onChange={(e) => setEod({ ...eod, callsMade: e.target.value })} className="w-full rounded-lg border px-2 py-1.5 text-sm bg-card" /></div>
                <div><label className="mb-0.5 block text-[10px] font-medium">Atendidas</label><input type="number" value={eod.callsAnswered} onChange={(e) => setEod({ ...eod, callsAnswered: e.target.value })} className="w-full rounded-lg border px-2 py-1.5 text-sm bg-card" /></div>
                <div><label className="mb-0.5 block text-[10px] font-medium">Conversoes</label><input type="number" value={eod.conversions} onChange={(e) => setEod({ ...eod, conversions: e.target.value })} className="w-full rounded-lg border px-2 py-1.5 text-sm bg-card" /></div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div><label className="mb-0.5 block text-[10px] font-medium">Agendamentos</label><input type="number" value={eod.agendamentos} onChange={(e) => setEod({ ...eod, agendamentos: e.target.value })} className="w-full rounded-lg border px-2 py-1.5 text-sm bg-card" /></div>
                {db.market === "CREDITO" && (
                  <div><label className="mb-0.5 block text-[10px] font-medium">Escrituras</label><input type="number" value={eod.escrituras} onChange={(e) => setEod({ ...eod, escrituras: e.target.value })} className="w-full rounded-lg border px-2 py-1.5 text-sm bg-card" /></div>
                )}
                {db.market === "SEGUROS" && (
                  <div><label className="mb-0.5 block text-[10px] font-medium">Angariacoes</label><input type="number" value={eod.angariacoes} onChange={(e) => setEod({ ...eod, angariacoes: e.target.value })} className="w-full rounded-lg border px-2 py-1.5 text-sm bg-card" /></div>
                )}
                {db.market === "IMOBILIARIO" && (
                  <div><label className="mb-0.5 block text-[10px] font-medium">Decision Makers</label><input type="number" value={eod.decisionMakers} onChange={(e) => setEod({ ...eod, decisionMakers: e.target.value })} className="w-full rounded-lg border px-2 py-1.5 text-sm bg-card" /></div>
                )}
              </div>

              <div><label className="mb-0.5 block text-[10px] font-medium">Notas</label><input type="text" value={eod.notes} onChange={(e) => setEod({ ...eod, notes: e.target.value })} className="w-full rounded-lg border px-2 py-1.5 text-sm bg-card" placeholder="Opcional" /></div>

              <div className="flex justify-end gap-3 border-t pt-3">
                <button type="button" onClick={() => setShowEOD(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={addRecord.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                  {addRecord.isPending ? "A guardar..." : "Registar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
