"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, BarChart3, Users, Phone, ExternalLink, Plus, X, AlertTriangle,
  Mail, Eye, EyeOff, Trash2, Sparkles, Upload, Brain, Loader2,
} from "lucide-react";

type Tab = "dashboard" | "leads" | "analysis";

const LEAD_STATUS_LABELS: Record<string, string> = {
  NOVA: "Nova", CONTACTADA: "Contactada", QUALIFICADA: "Qualificada",
  REUNIAO_AGENDADA: "Reuniao Agendada", REUNIAO_EFETUADA: "Reuniao Efetuada",
  PROPOSTA_ENVIADA: "Proposta Enviada", NEGOCIACAO: "Negociacao",
  FECHADA_GANHA: "Ganha", FECHADA_PERDIDA: "Perdida", EM_PAUSA: "Em Pausa",
};

const LEAD_STATUS_COLORS: Record<string, string> = {
  NOVA: "bg-blue-100 text-blue-700", CONTACTADA: "bg-indigo-100 text-indigo-700",
  QUALIFICADA: "bg-purple-100 text-purple-700",
  REUNIAO_AGENDADA: "bg-yellow-100 text-yellow-700", REUNIAO_EFETUADA: "bg-amber-100 text-amber-700",
  PROPOSTA_ENVIADA: "bg-orange-100 text-orange-700", NEGOCIACAO: "bg-pink-100 text-pink-700",
  FECHADA_GANHA: "bg-green-100 text-green-700", FECHADA_PERDIDA: "bg-red-100 text-red-700",
  EM_PAUSA: "bg-gray-100 text-gray-700",
};

export default function ClientWorkspacePage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const [tab, setTab] = useState<Tab>("dashboard");

  const client = trpc.clients.getById.useQuery(clientId);
  const dashboard = trpc.dashboards.getByClientId.useQuery(clientId);

  if (client.isLoading) return <div className="p-8 text-center text-muted-foreground">A carregar...</div>;
  if (!client.data) return <div className="p-8 text-center text-muted-foreground">Cliente nao encontrado</div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/workspace" className="rounded-lg p-2 hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{client.data.name}</h1>
          <p className="text-sm text-muted-foreground">Workspace &middot; 3 folhas</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border bg-muted/50 p-1 overflow-x-auto">
        {[
          { key: "dashboard", label: "Dashboard", icon: BarChart3 },
          { key: "leads", label: "CRM Leads", icon: Users },
          { key: "analysis", label: "Analise de Vendas", icon: Phone },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as Tab)}
            className={cn("flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap",
              tab === t.key ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <DashboardTab clientId={clientId} dashboardId={dashboard.data?.id} />
      )}
      {tab === "leads" && <LeadsTab clientId={clientId} />}
      {tab === "analysis" && <SalesAnalysisTab clientId={clientId} />}
    </div>
  );
}

// ============ DASHBOARD TAB - link to existing dashboard page ============
function DashboardTab({ clientId, dashboardId }: { clientId: string; dashboardId?: string }) {
  const utils = trpc.useUtils();
  const createDashboard = trpc.dashboards.create.useMutation({
    onSuccess: () => { utils.dashboards.getByClientId.invalidate(); utils.dashboards.list.invalidate(); },
  });
  const [market, setMarket] = useState<"CREDITO" | "SEGUROS" | "IMOBILIARIO">("CREDITO");

  if (!dashboardId) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <p className="mt-3 text-sm font-medium">Sem dashboard para este cliente</p>
        <p className="text-xs text-muted-foreground mb-4">Cria uma dashboard para comecar a monitorizar KPIs.</p>
        <div className="flex items-center justify-center gap-2">
          <select value={market} onChange={(e) => setMarket(e.target.value as "CREDITO")} className="rounded-lg border px-3 py-2 text-sm bg-card">
            <option value="CREDITO">Credito</option>
            <option value="SEGUROS">Seguros</option>
            <option value="IMOBILIARIO">Imobiliario</option>
          </select>
          <button
            onClick={() => createDashboard.mutate({ clientId, market, commercials: [] })}
            disabled={createDashboard.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {createDashboard.isPending ? "A criar..." : "Criar Dashboard"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground mb-3">Acede a dashboard completa para veres KPIs, canais de aquisicao, vertentes e growth.</p>
      <Link href={`/dashboards/${dashboardId}`} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
        <BarChart3 className="h-4 w-4" /> Abrir Dashboard <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

// ============ LEADS TAB ============
function LeadsTab({ clientId }: { clientId: string }) {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCommercial, setSelectedCommercial] = useState<string>("");
  const [form, setForm] = useState({
    commercial: "", name: "", company: "", email: "", phone: "", nif: "",
    source: "cold-calling", status: "NOVA", priority: "media", notes: "",
  });

  const dashboard = trpc.dashboards.getByClientId.useQuery(clientId);
  const leads = trpc.leads.list.useQuery({
    clientId,
    commercial: selectedCommercial || undefined,
  });
  const counts = trpc.leads.commercialsWithCounts.useQuery({ clientId });
  const duplicates = trpc.leads.duplicates.useQuery({ clientId });
  const utils = trpc.useUtils();

  const createLead = trpc.leads.create.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate();
      utils.leads.commercialsWithCounts.invalidate();
      utils.leads.duplicates.invalidate();
      setShowCreate(false);
      setForm({ commercial: "", name: "", company: "", email: "", phone: "", nif: "", source: "cold-calling", status: "NOVA", priority: "media", notes: "" });
    },
  });

  const updateLead = trpc.leads.update.useMutation({
    onSuccess: () => { utils.leads.list.invalidate(); utils.leads.commercialsWithCounts.invalidate(); },
  });

  const deleteLead = trpc.leads.delete.useMutation({
    onSuccess: () => { utils.leads.list.invalidate(); utils.leads.commercialsWithCounts.invalidate(); utils.leads.duplicates.invalidate(); },
  });

  const commercials = dashboard.data?.commercials ?? [];

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">CRM Leads</h2>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Nova Lead
        </button>
      </div>

      {/* Duplicate warnings */}
      {duplicates.data && duplicates.data.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">
                {duplicates.data.length} {duplicates.data.length === 1 ? "lead duplicada" : "leads duplicadas"} entre comerciais
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                A mesma lead esta a ser trabalhada por mais de um comercial. Coordenem para evitar conflito.
              </p>
            </div>
          </div>
          <div className="space-y-2 mt-3">
            {duplicates.data.slice(0, 5).map((conflict, i) => (
              <div key={i} className="rounded-lg border border-amber-200 bg-white p-2 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{conflict.leads[0].name}</span>
                  <span className="text-muted-foreground">match por {conflict.matchedBy}: {conflict.matchedValue}</span>
                </div>
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {conflict.commercials.map(c => (
                    <span key={c} className="rounded px-1.5 py-0.5 bg-amber-100 text-amber-800 font-medium">{c}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commercial tabs */}
      {counts.data && counts.data.length > 0 && (
        <div className="flex gap-1 overflow-x-auto flex-wrap">
          <button
            onClick={() => setSelectedCommercial("")}
            className={cn("rounded-full px-3 py-1.5 text-xs font-medium border whitespace-nowrap",
              !selectedCommercial ? "bg-primary text-white border-primary" : "bg-card hover:bg-muted"
            )}
          >
            Todos ({counts.data.reduce((s, c) => s + c.total, 0)})
          </button>
          {counts.data.map(c => (
            <button key={c.name}
              onClick={() => setSelectedCommercial(c.name)}
              className={cn("rounded-full px-3 py-1.5 text-xs font-medium border whitespace-nowrap flex items-center gap-1",
                selectedCommercial === c.name ? "bg-primary text-white border-primary" : "bg-card hover:bg-muted"
              )}
            >
              {c.name} <span className="opacity-75">({c.total})</span>
              {c.won > 0 && <span className="rounded bg-green-100 text-green-700 px-1 text-[10px]">{c.won}G</span>}
            </button>
          ))}
        </div>
      )}

      {/* Leads table */}
      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-xs text-muted-foreground">
              <th className="text-left p-2">Nome</th>
              <th className="text-left p-2">Comercial</th>
              <th className="text-left p-2">Empresa</th>
              <th className="text-left p-2">Contacto</th>
              <th className="text-left p-2">Origem</th>
              <th className="text-left p-2">Status</th>
              <th className="text-right p-2">Valor</th>
              <th className="text-right p-2"></th>
            </tr></thead>
            <tbody className="divide-y">
              {leads.isLoading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">A carregar...</td></tr>}
              {leads.data?.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Sem leads. Clica em &quot;Nova Lead&quot; para comecar.</td></tr>}
              {leads.data?.map(l => (
                <tr key={l.id} className="hover:bg-muted/50">
                  <td className="p-2">
                    <div className="font-medium">{l.name}</div>
                    {l.duplicateOfId && <div className="text-[10px] text-amber-600 flex items-center gap-0.5"><AlertTriangle className="h-2.5 w-2.5" /> duplicada</div>}
                  </td>
                  <td className="p-2 text-xs">{l.commercial}</td>
                  <td className="p-2 text-xs">{l.company ?? "-"}</td>
                  <td className="p-2 text-xs">
                    {l.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{l.email}</div>}
                    {l.phone && <div className="text-muted-foreground">{l.phone}</div>}
                  </td>
                  <td className="p-2 text-xs">{l.source ?? "-"}</td>
                  <td className="p-2">
                    <select
                      value={l.status}
                      onChange={(e) => updateLead.mutate({ id: l.id, data: { status: e.target.value as "NOVA" } })}
                      className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium border-0 cursor-pointer", LEAD_STATUS_COLORS[l.status])}
                    >
                      {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td className="p-2 text-right text-xs">{l.conversionValue ? `${l.conversionValue.toLocaleString("pt-PT")}€` : "-"}</td>
                  <td className="p-2 text-right">
                    <button onClick={() => { if (confirm("Apagar esta lead?")) deleteLead.mutate(l.id); }}
                      className="text-muted-foreground hover:text-red-600 p-1">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create lead dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Nova Lead</h2>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              createLead.mutate({
                clientId,
                commercial: form.commercial,
                name: form.name,
                company: form.company || undefined,
                email: form.email || undefined,
                phone: form.phone || undefined,
                nif: form.nif || undefined,
                source: form.source,
                status: form.status as "NOVA",
                priority: form.priority,
                notes: form.notes || undefined,
              });
            }} className="space-y-3">
              <div>
                <label className="mb-0.5 block text-xs font-medium">Comercial *</label>
                {commercials.length > 0 ? (
                  <select required value={form.commercial} onChange={(e) => setForm({ ...form, commercial: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card">
                    <option value="">Selecionar...</option>
                    {commercials.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <input type="text" required value={form.commercial} onChange={(e) => setForm({ ...form, commercial: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm bg-card" placeholder="Nome do comercial" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-0.5 block text-xs font-medium">Nome *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" /></div>
                <div><label className="mb-0.5 block text-xs font-medium">Empresa</label><input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" /></div>
                <div><label className="mb-0.5 block text-xs font-medium">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" /></div>
                <div><label className="mb-0.5 block text-xs font-medium">Telefone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" /></div>
                <div><label className="mb-0.5 block text-xs font-medium">NIF</label><input value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" /></div>
                <div><label className="mb-0.5 block text-xs font-medium">Origem</label>
                  <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card">
                    <option value="cold-calling">Cold Calling</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="anuncios">Anuncios</option>
                    <option value="parcerias">Parcerias</option>
                    <option value="referencias">Referencias</option>
                    <option value="presenciais">Presenciais</option>
                    <option value="companhia">Leads Companhia</option>
                    <option value="cross-sell">Cross-sell</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>
              </div>
              <div><label className="mb-0.5 block text-xs font-medium">Notas</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" /></div>

              {createLead.data?.duplicateWarning && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                  Atencao: esta lead pode ser duplicada de uma ja registada pelo comercial <strong>{createLead.data.duplicateWarning.commercial}</strong>.
                </div>
              )}

              <div className="flex justify-end gap-3 border-t pt-3">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={createLead.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">{createLead.isPending ? "..." : "Criar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ SALES ANALYSIS TAB ============
function SalesAnalysisTab({ clientId }: { clientId: string }) {
  const { data: session } = useSession();
  const userRole = (session?.user as Record<string, unknown>)?.role as string | undefined;
  const userName = session?.user?.name ?? "";
  const isManager = userRole === "ADMIN" || userRole === "MANAGER";

  const [showCreate, setShowCreate] = useState(false);
  const [showAnalyze, setShowAnalyze] = useState(false);
  const [selectedCommercial, setSelectedCommercial] = useState<string>("");
  const [form, setForm] = useState({
    commercial: "", leadName: "", callType: "Discovery Call", callDate: new Date().toISOString().split("T")[0],
    visibility: "COMMERCIAL_ONLY" as "COMMERCIAL_ONLY" | "WHOLE_TEAM",
    classification: "Medio", overallScore: "",
    clarezaFluidez: "", tomVoz: "", expositivoConversacional: "Conversacional",
    assertividadeControlo: "", empatia: "", passagemValor: "",
    respostaObjecoes: "", estruturaMeet: "",
    strengths: "", weaknesses: "", generalTips: "", focusNext: "", summary: "",
  });
  const [analyzeForm, setAnalyzeForm] = useState({
    commercial: "", leadName: "", callType: "Discovery Call",
    callDate: new Date().toISOString().split("T")[0],
    visibility: "COMMERCIAL_ONLY" as "COMMERCIAL_ONLY" | "WHOLE_TEAM",
    transcript: "", audioFileName: "", audioUrl: "",
    durationMinutes: "",
  });

  const dashboard = trpc.dashboards.getByClientId.useQuery(clientId);
  const analyses = trpc.salesAnalysis.list.useQuery({
    clientId,
    commercial: selectedCommercial || undefined,
    currentUser: userName,
    isManager,
  });
  const stats = trpc.salesAnalysis.statsPerCommercial.useQuery({ clientId });
  const utils = trpc.useUtils();

  const createAnalysis = trpc.salesAnalysis.create.useMutation({
    onSuccess: () => {
      utils.salesAnalysis.list.invalidate();
      utils.salesAnalysis.statsPerCommercial.invalidate();
      setShowCreate(false);
    },
  });

  const analyzeCall = trpc.salesAnalysis.analyzeCall.useMutation({
    onSuccess: () => {
      utils.salesAnalysis.list.invalidate();
      utils.salesAnalysis.statsPerCommercial.invalidate();
      setShowAnalyze(false);
      setAnalyzeForm({ commercial: "", leadName: "", callType: "Discovery Call", callDate: new Date().toISOString().split("T")[0], visibility: "COMMERCIAL_ONLY", transcript: "", audioFileName: "", audioUrl: "", durationMinutes: "" });
    },
  });

  const updateAnalysis = trpc.salesAnalysis.update.useMutation({
    onSuccess: () => utils.salesAnalysis.list.invalidate(),
  });

  const deleteAnalysis = trpc.salesAnalysis.delete.useMutation({
    onSuccess: () => { utils.salesAnalysis.list.invalidate(); utils.salesAnalysis.statsPerCommercial.invalidate(); },
  });

  const commercials = dashboard.data?.commercials ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">Analise de Vendas</h2>
          <p className="text-xs text-muted-foreground">Analises das chamadas dos comerciais, com classificacao e scoring</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAnalyze(true)} className="flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700">
            <Sparkles className="h-4 w-4" /> Analisar Chamada (IA)
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted">
            <Plus className="h-4 w-4" /> Manual
          </button>
        </div>
      </div>

      {/* Info banner about how AI analysis works */}
      <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-xs text-purple-900">
        <div className="flex items-start gap-2">
          <Brain className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Analise automatica com IA</p>
            <p className="text-purple-700 mt-0.5">
              Carrega a transcricao ou liga o ficheiro audio. A IA classifica a chamada, pontua nas 8 dimensoes e gera feedback usando <strong>apenas</strong> os documentos da Base de Conhecimento relevantes para o mercado deste cliente
              {dashboard.data?.market && <> (<strong>{dashboard.data.market}</strong>)</>}.
            </p>
          </div>
        </div>
      </div>

      {/* Commercial stats cards */}
      {stats.data && stats.data.length > 0 && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {stats.data.map(s => (
            <div key={s.name} className="rounded-xl border bg-card p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-3 w-3" />{s.name}</div>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-xl font-bold">{s.avgScore?.toFixed(0) ?? "-"}</p>
                <span className="text-[10px] text-muted-foreground">/100 media</span>
              </div>
              <div className="mt-1 text-[10px] flex gap-1">
                <span className="rounded bg-green-100 text-green-700 px-1 py-0.5">B: {s.bom}</span>
                <span className="rounded bg-yellow-100 text-yellow-700 px-1 py-0.5">M: {s.medio}</span>
                <span className="rounded bg-red-100 text-red-700 px-1 py-0.5">Mau: {s.mau}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Commercial filter */}
      {stats.data && stats.data.length > 0 && (
        <div className="flex gap-1 overflow-x-auto flex-wrap">
          <button onClick={() => setSelectedCommercial("")}
            className={cn("rounded-full px-3 py-1.5 text-xs font-medium border",
              !selectedCommercial ? "bg-primary text-white border-primary" : "bg-card hover:bg-muted"
            )}>
            Todos
          </button>
          {stats.data.map(s => (
            <button key={s.name} onClick={() => setSelectedCommercial(s.name)}
              className={cn("rounded-full px-3 py-1.5 text-xs font-medium border whitespace-nowrap",
                selectedCommercial === s.name ? "bg-primary text-white border-primary" : "bg-card hover:bg-muted"
              )}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Analyses list */}
      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-xs text-muted-foreground">
              <th className="text-left p-2">Data</th>
              <th className="text-left p-2">Comercial x Lead</th>
              <th className="text-left p-2">Tipo</th>
              <th className="text-left p-2">Classificacao</th>
              <th className="text-right p-2">Score</th>
              <th className="text-left p-2">Visibilidade</th>
              <th className="text-right p-2"></th>
            </tr></thead>
            <tbody className="divide-y">
              {analyses.isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">A carregar...</td></tr>}
              {analyses.data?.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Sem analises. Cria a primeira analise ou liga uma gravacao para auto-criar.</td></tr>}
              {analyses.data?.map(a => (
                <tr key={a.id} className="hover:bg-muted/50">
                  <td className="p-2 text-xs">{new Date(a.callDate).toLocaleDateString("pt-PT")}</td>
                  <td className="p-2 text-xs">
                    <div className="font-medium">{a.commercial}{a.leadName ? ` x ${a.leadName}` : ""}</div>
                    {a.summary && <div className="text-[10px] text-muted-foreground truncate max-w-xs">{a.summary}</div>}
                  </td>
                  <td className="p-2 text-xs">{a.callType}</td>
                  <td className="p-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium",
                      a.classification.toLowerCase().startsWith("bom") ? "bg-green-100 text-green-700" :
                      a.classification.toLowerCase().startsWith("med") ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700")}>
                      {a.classification}
                    </span>
                  </td>
                  <td className="p-2 text-right font-medium text-xs">{a.overallScore?.toFixed(0) ?? "-"}</td>
                  <td className="p-2">
                    <button
                      onClick={() => updateAnalysis.mutate({ id: a.id, data: { visibility: a.visibility === "COMMERCIAL_ONLY" ? "WHOLE_TEAM" : "COMMERCIAL_ONLY" } })}
                      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                        a.visibility === "WHOLE_TEAM" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700")}
                      title="Toggle visibilidade"
                    >
                      {a.visibility === "WHOLE_TEAM" ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                      {a.visibility === "WHOLE_TEAM" ? "Equipa" : "So comercial"}
                    </button>
                  </td>
                  <td className="p-2 text-right">
                    <button onClick={() => { if (confirm("Apagar?")) deleteAnalysis.mutate(a.id); }}
                      className="text-muted-foreground hover:text-red-600 p-1">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create analysis dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Nova Analise de Chamada</h2>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              createAnalysis.mutate({
                clientId,
                commercial: form.commercial,
                leadName: form.leadName || undefined,
                callType: form.callType,
                callDate: new Date(form.callDate),
                visibility: form.visibility,
                classification: form.classification,
                overallScore: form.overallScore ? parseFloat(form.overallScore) : undefined,
                clarezaFluidez: form.clarezaFluidez ? parseInt(form.clarezaFluidez) : undefined,
                tomVoz: form.tomVoz ? parseInt(form.tomVoz) : undefined,
                expositivoConversacional: form.expositivoConversacional,
                assertividadeControlo: form.assertividadeControlo ? parseInt(form.assertividadeControlo) : undefined,
                empatia: form.empatia ? parseInt(form.empatia) : undefined,
                passagemValor: form.passagemValor ? parseInt(form.passagemValor) : undefined,
                respostaObjecoes: form.respostaObjecoes ? parseInt(form.respostaObjecoes) : undefined,
                estruturaMeet: form.estruturaMeet ? parseInt(form.estruturaMeet) : undefined,
                strengths: form.strengths || undefined,
                weaknesses: form.weaknesses || undefined,
                generalTips: form.generalTips || undefined,
                focusNext: form.focusNext || undefined,
                summary: form.summary || undefined,
              });
            }} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-0.5 block text-xs font-medium">Comercial *</label>
                  {commercials.length > 0 ? (
                    <select required value={form.commercial} onChange={(e) => setForm({ ...form, commercial: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card">
                      <option value="">Selecionar...</option>
                      {commercials.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <input type="text" required value={form.commercial} onChange={(e) => setForm({ ...form, commercial: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" />
                  )}
                </div>
                <div><label className="mb-0.5 block text-xs font-medium">Lead / Cliente</label><input value={form.leadName} onChange={(e) => setForm({ ...form, leadName: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" /></div>
                <div><label className="mb-0.5 block text-xs font-medium">Tipo de Chamada</label>
                  <select value={form.callType} onChange={(e) => setForm({ ...form, callType: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card">
                    <option>Discovery Call</option>
                    <option>Cold Call</option>
                    <option>Ads Funnel</option>
                    <option>Inbound</option>
                    <option>Follow-up</option>
                    <option>Fecho</option>
                  </select>
                </div>
                <div><label className="mb-0.5 block text-xs font-medium">Data</label><input type="date" value={form.callDate} onChange={(e) => setForm({ ...form, callDate: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" /></div>
                <div><label className="mb-0.5 block text-xs font-medium">Classificacao</label>
                  <select value={form.classification} onChange={(e) => setForm({ ...form, classification: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card">
                    <option>Bom</option><option>Medio</option><option>Mau</option>
                  </select>
                </div>
                <div><label className="mb-0.5 block text-xs font-medium">Visibilidade</label>
                  <select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as "COMMERCIAL_ONLY" })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card">
                    <option value="COMMERCIAL_ONLY">So o comercial + gerencia</option>
                    <option value="WHOLE_TEAM">Toda a equipa</option>
                  </select>
                </div>
              </div>

              <p className="text-xs font-semibold text-muted-foreground pt-1">Scoring (0-5 em cada dimensao)</p>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="mb-0.5 block text-[10px]">Clareza/Fluidez</label><input type="number" min="0" max="5" value={form.clarezaFluidez} onChange={(e) => setForm({ ...form, clarezaFluidez: e.target.value })} className="w-full rounded border px-2 py-1 text-sm bg-card" /></div>
                <div><label className="mb-0.5 block text-[10px]">Tom Voz</label><input type="number" min="0" max="5" value={form.tomVoz} onChange={(e) => setForm({ ...form, tomVoz: e.target.value })} className="w-full rounded border px-2 py-1 text-sm bg-card" /></div>
                <div><label className="mb-0.5 block text-[10px]">Assertividade</label><input type="number" min="0" max="5" value={form.assertividadeControlo} onChange={(e) => setForm({ ...form, assertividadeControlo: e.target.value })} className="w-full rounded border px-2 py-1 text-sm bg-card" /></div>
                <div><label className="mb-0.5 block text-[10px]">Empatia</label><input type="number" min="0" max="5" value={form.empatia} onChange={(e) => setForm({ ...form, empatia: e.target.value })} className="w-full rounded border px-2 py-1 text-sm bg-card" /></div>
                <div><label className="mb-0.5 block text-[10px]">Passagem Valor</label><input type="number" min="0" max="5" value={form.passagemValor} onChange={(e) => setForm({ ...form, passagemValor: e.target.value })} className="w-full rounded border px-2 py-1 text-sm bg-card" /></div>
                <div><label className="mb-0.5 block text-[10px]">Resposta Objec.</label><input type="number" min="0" max="5" value={form.respostaObjecoes} onChange={(e) => setForm({ ...form, respostaObjecoes: e.target.value })} className="w-full rounded border px-2 py-1 text-sm bg-card" /></div>
                <div><label className="mb-0.5 block text-[10px]">Estrutura</label><input type="number" min="0" max="5" value={form.estruturaMeet} onChange={(e) => setForm({ ...form, estruturaMeet: e.target.value })} className="w-full rounded border px-2 py-1 text-sm bg-card" /></div>
                <div><label className="mb-0.5 block text-[10px]">Estilo</label>
                  <select value={form.expositivoConversacional} onChange={(e) => setForm({ ...form, expositivoConversacional: e.target.value })} className="w-full rounded border px-2 py-1 text-sm bg-card">
                    <option>Conversacional</option><option>Expositivo</option>
                  </select>
                </div>
                <div><label className="mb-0.5 block text-[10px]">Score Total (0-100)</label><input type="number" min="0" max="100" value={form.overallScore} onChange={(e) => setForm({ ...form, overallScore: e.target.value })} className="w-full rounded border px-2 py-1 text-sm bg-card" /></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-0.5 block text-xs font-medium">Pontos Fortes</label><textarea rows={3} value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" /></div>
                <div><label className="mb-0.5 block text-xs font-medium">Pontos Fracos</label><textarea rows={3} value={form.weaknesses} onChange={(e) => setForm({ ...form, weaknesses: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" /></div>
                <div><label className="mb-0.5 block text-xs font-medium">Dicas Gerais</label><textarea rows={3} value={form.generalTips} onChange={(e) => setForm({ ...form, generalTips: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" /></div>
                <div><label className="mb-0.5 block text-xs font-medium">Foco Proximas</label><textarea rows={3} value={form.focusNext} onChange={(e) => setForm({ ...form, focusNext: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" /></div>
              </div>

              <div className="flex justify-end gap-3 border-t pt-3">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={createAnalysis.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">{createAnalysis.isPending ? "..." : "Criar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Analyze with AI dialog */}
      {showAnalyze && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-600" />
                <h2 className="text-lg font-bold">Analisar Chamada com IA</h2>
              </div>
              <button onClick={() => setShowAnalyze(false)} className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>

            <div className="mb-3 rounded-lg border border-purple-200 bg-purple-50 p-2 text-xs text-purple-800">
              <p>A IA vai analisar a transcricao usando os documentos da Base de Conhecimento que se aplicam ao mercado <strong>{dashboard.data?.market ?? "deste cliente"}</strong>. Resultado automatico: classificacao, scores e feedback.</p>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              analyzeCall.mutate({
                clientId,
                commercial: analyzeForm.commercial,
                leadName: analyzeForm.leadName || undefined,
                callType: analyzeForm.callType,
                callDate: new Date(analyzeForm.callDate),
                transcript: analyzeForm.transcript,
                audioUrl: analyzeForm.audioUrl || undefined,
                audioFileName: analyzeForm.audioFileName || undefined,
                durationMinutes: analyzeForm.durationMinutes ? parseInt(analyzeForm.durationMinutes) : undefined,
                visibility: analyzeForm.visibility,
              });
            }} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-0.5 block text-xs font-medium">Comercial *</label>
                  {commercials.length > 0 ? (
                    <select required value={analyzeForm.commercial} onChange={(e) => setAnalyzeForm({ ...analyzeForm, commercial: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card">
                      <option value="">Selecionar...</option>
                      {commercials.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <input type="text" required value={analyzeForm.commercial} onChange={(e) => setAnalyzeForm({ ...analyzeForm, commercial: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" placeholder="Nome do comercial" />
                  )}
                </div>
                <div>
                  <label className="mb-0.5 block text-xs font-medium">Lead / Cliente</label>
                  <input value={analyzeForm.leadName} onChange={(e) => setAnalyzeForm({ ...analyzeForm, leadName: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" placeholder="Nome da lead" />
                </div>
                <div>
                  <label className="mb-0.5 block text-xs font-medium">Tipo</label>
                  <select value={analyzeForm.callType} onChange={(e) => setAnalyzeForm({ ...analyzeForm, callType: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card">
                    <option>Discovery Call</option>
                    <option>Cold Call</option>
                    <option>Ads Funnel</option>
                    <option>Inbound</option>
                    <option>Follow-up</option>
                    <option>Fecho</option>
                  </select>
                </div>
                <div>
                  <label className="mb-0.5 block text-xs font-medium">Data</label>
                  <input type="date" value={analyzeForm.callDate} onChange={(e) => setAnalyzeForm({ ...analyzeForm, callDate: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" />
                </div>
                <div>
                  <label className="mb-0.5 block text-xs font-medium">Duracao (min)</label>
                  <input type="number" min="0" value={analyzeForm.durationMinutes} onChange={(e) => setAnalyzeForm({ ...analyzeForm, durationMinutes: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" />
                </div>
                <div>
                  <label className="mb-0.5 block text-xs font-medium">Visibilidade</label>
                  <select value={analyzeForm.visibility} onChange={(e) => setAnalyzeForm({ ...analyzeForm, visibility: e.target.value as "COMMERCIAL_ONLY" })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card">
                    <option value="COMMERCIAL_ONLY">So o comercial + gerencia</option>
                    <option value="WHOLE_TEAM">Toda a equipa</option>
                  </select>
                </div>
              </div>

              {/* Audio file (optional) */}
              <div>
                <label className="mb-0.5 block text-xs font-medium">Ficheiro de audio / video (opcional)</label>
                <input
                  type="file"
                  accept="audio/*,video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setAnalyzeForm({
                      ...analyzeForm,
                      audioFileName: file.name,
                      audioUrl: reader.result as string,
                    });
                    reader.readAsDataURL(file);
                  }}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-card file:mr-3 file:rounded file:border-0 file:bg-purple-600 file:text-white file:text-xs file:px-3 file:py-1.5 file:cursor-pointer"
                />
                {analyzeForm.audioFileName && (
                  <p className="mt-1 text-xs text-green-600">
                    ✓ {analyzeForm.audioFileName}
                    <button type="button" onClick={() => setAnalyzeForm({ ...analyzeForm, audioFileName: "", audioUrl: "" })} className="ml-2 text-red-600 hover:underline">remover</button>
                  </p>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground">O audio fica guardado. A transcricao abaixo e que alimenta a IA.</p>
              </div>

              <div>
                <label className="mb-0.5 block text-xs font-medium">Transcricao da chamada *</label>
                <textarea
                  required
                  value={analyzeForm.transcript}
                  onChange={(e) => setAnalyzeForm({ ...analyzeForm, transcript: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-card font-mono"
                  rows={10}
                  placeholder="Cola aqui a transcricao completa da chamada (minimo 100 caracteres)..."
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {analyzeForm.transcript.length} caracteres
                </p>
              </div>

              {analyzeCall.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  Erro: {analyzeCall.error.message}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t pt-3">
                <button type="button" onClick={() => setShowAnalyze(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={analyzeCall.isPending || analyzeForm.transcript.length < 100}
                  className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">
                  {analyzeCall.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> A analisar...</> : <><Sparkles className="h-4 w-4" /> Analisar com IA</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
