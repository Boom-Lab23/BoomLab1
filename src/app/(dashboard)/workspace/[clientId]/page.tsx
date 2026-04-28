"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, BarChart3, Users, Phone, ExternalLink, Plus, X, AlertTriangle,
  Mail, Eye, EyeOff, Trash2, Sparkles, Brain, Loader2, Edit,
} from "lucide-react";

type Tab = "dashboard" | "leads" | "analysis";

const LEAD_STATUS_LABELS: Record<string, string> = {
  NOVA: "Nova", CONTACTADA: "Contactada", QUALIFICADA: "Qualificada",
  REUNIAO_AGENDADA: "Reuniao Agendada", REUNIAO_EFETUADA: "Reuniao Efetuada",
  PROPOSTA_ENVIADA: "Proposta Enviada", NEGOCIACAO: "Negociacao",
  FECHADA_GANHA: "Ganha", FECHADA_PERDIDA: "Perdida", EM_PAUSA: "Em Pausa",
};

const LEAD_STATUS_COLORS: Record<string, string> = {
  NOVA: "bg-blue-100 dark:bg-blue-900/40 text-blue-700", CONTACTADA: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300",
  QUALIFICADA: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
  REUNIAO_AGENDADA: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300", REUNIAO_EFETUADA: "bg-amber-100 text-amber-700",
  PROPOSTA_ENVIADA: "bg-orange-100 dark:bg-orange-900/40 text-orange-700", NEGOCIACAO: "bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300",
  FECHADA_GANHA: "bg-green-100 dark:bg-green-900/40 text-green-700", FECHADA_PERDIDA: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
  EM_PAUSA: "bg-gray-100 text-gray-700",
};

export default function ClientWorkspacePage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const [tab, setTab] = useState<Tab>("dashboard");
  const { data: authSession } = useSession();
  const role = (authSession?.user as Record<string, unknown>)?.role as string | undefined;
  const isGuest = role === "GUEST_CLIENT" || role === "GUEST_TEAM_MEMBER";
  const assignedWorkspaceClientId = (authSession?.user as Record<string, unknown>)?.assignedWorkspaceClientId as string | undefined;
  const guestBlocked = isGuest && assignedWorkspaceClientId !== clientId;

  const client = trpc.clients.getById.useQuery(clientId, { enabled: !guestBlocked });
  const dashboard = trpc.dashboards.getByClientId.useQuery(clientId, { enabled: !guestBlocked });

  if (guestBlocked) {
    return (
      <div className="p-8 text-center">
        <p className="text-lg font-semibold">Acesso negado</p>
        <p className="mt-2 text-sm text-muted-foreground">Nao tens permissoes para aceder a este workspace.</p>
      </div>
    );
  }

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
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  // selectedCommercial: "" = "Duplicados entre comerciais", nome = folha do comercial
  // Inicializa com o 1o comercial da equipa (ou vazio para ver duplicados)
  const [selectedCommercial, setSelectedCommercial] = useState<string | null>(null);
  const [form, setForm] = useState({
    commercial: "",
    // Empresa
    company: "", companyEmail: "", companyLandline: "", companyMobile: "", nif: "",
    // Decisor
    name: "", email: "", phone: "",
    // Pipeline
    source: "prospecao-ativa", status: "NOVA", priority: "media", notes: "",
  });

  const dashboard = trpc.dashboards.getByClientId.useQuery(clientId);
  const leads = trpc.leads.list.useQuery({
    clientId,
    commercial: selectedCommercial || undefined,
  });
  const counts = trpc.leads.commercialsWithCounts.useQuery({ clientId });
  const duplicates = trpc.leads.duplicates.useQuery({ clientId });
  const utils = trpc.useUtils();

  const resetForm = () => setForm({ commercial: "", company: "", companyEmail: "", companyLandline: "", companyMobile: "", nif: "", name: "", email: "", phone: "", source: "prospecao-ativa", status: "NOVA", priority: "media", notes: "" });

  const createLead = trpc.leads.create.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate();
      utils.leads.commercialsWithCounts.invalidate();
      utils.leads.duplicates.invalidate();
      setShowCreate(false);
      resetForm();
    },
  });

  const updateLead = trpc.leads.update.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate();
      utils.leads.commercialsWithCounts.invalidate();
      utils.leads.duplicates.invalidate();
      setEditingLeadId(null);
      setShowCreate(false);
      resetForm();
    },
  });

  // Open edit dialog with lead values pre-filled
  function startEditLead(lead: {
    id: string; commercial: string; name: string; company: string;
    companyEmail?: string | null; companyLandline?: string | null; companyMobile?: string | null;
    email: string | null; phone: string | null; nif: string | null;
    source: string | null; status: string; priority: string | null; notes: string | null;
  }) {
    setEditingLeadId(lead.id);
    setForm({
      commercial: lead.commercial,
      company: lead.company ?? "",
      companyEmail: lead.companyEmail ?? "",
      companyLandline: lead.companyLandline ?? "",
      companyMobile: lead.companyMobile ?? "",
      nif: lead.nif ?? "",
      name: lead.name ?? "",
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      source: lead.source ?? "prospecao-ativa",
      status: lead.status,
      priority: lead.priority ?? "media",
      notes: lead.notes ?? "",
    });
    setShowCreate(true);
  }

  const deleteLead = trpc.leads.delete.useMutation({
    onSuccess: () => { utils.leads.list.invalidate(); utils.leads.commercialsWithCounts.invalidate(); utils.leads.duplicates.invalidate(); },
  });

  const commercials = dashboard.data?.commercials ?? [];

  // By default, select first commercial so CRM opens on their sheet
  const hasInitialized = selectedCommercial !== null;
  if (!hasInitialized && commercials.length > 0) {
    // initialize to first commercial on first render
    setTimeout(() => setSelectedCommercial(commercials[0]), 0);
  }

  const countsByName = new Map((counts.data ?? []).map(c => [c.name, c]));
  const duplicatesByLeadId = new Map<string, string[]>();
  for (const conflict of duplicates.data ?? []) {
    for (const l of conflict.leads) {
      const existing = duplicatesByLeadId.get(l.id) ?? [];
      duplicatesByLeadId.set(l.id, [...new Set([...existing, ...conflict.commercials.filter(c => c !== l.commercial)])]);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">CRM Leads</h2>
          <p className="text-xs text-muted-foreground">Uma folha por comercial. Cada um ve as suas leads. Sistema deteta duplicados entre comerciais.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Nova Lead
        </button>
      </div>

      {/* Commercial pages (each commercial = own sheet) */}
      <div className="flex gap-1 overflow-x-auto flex-wrap items-center">
        <span className="text-xs text-muted-foreground mr-1">Folha de:</span>
        {commercials.length === 0 ? (
          <span className="text-xs italic text-muted-foreground">Adiciona comerciais na dashboard primeiro</span>
        ) : (
          commercials.map((name) => {
            const c = countsByName.get(name);
            const total = c?.total ?? 0;
            const won = c?.won ?? 0;
            return (
              <button key={name}
                onClick={() => setSelectedCommercial(name)}
                className={cn("rounded-full px-3 py-1.5 text-xs font-medium border whitespace-nowrap flex items-center gap-1 transition-colors",
                  selectedCommercial === name ? "bg-primary text-white border-primary" : "bg-card hover:bg-muted"
                )}
              >
                {name} <span className="opacity-75">({total})</span>
                {won > 0 && <span className="rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-1 text-[10px]">{won}G</span>}
              </button>
            );
          })
        )}
        <span className="border-l mx-2 h-5" />
        <button
          onClick={() => setSelectedCommercial("")}
          className={cn("rounded-full px-3 py-1.5 text-xs font-medium border whitespace-nowrap flex items-center gap-1",
            selectedCommercial === "" ? "bg-amber-500 text-white border-amber-500" : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
          )}
          title="Ver todas as leads agregadas e conflitos entre comerciais"
        >
          <AlertTriangle className="h-3 w-3" />
          Vista conjunta ({(counts.data ?? []).reduce((s, c) => s + c.total, 0)})
          {duplicates.data && duplicates.data.length > 0 && (
            <span className="rounded bg-red-500 text-white px-1 text-[10px]">{duplicates.data.length}</span>
          )}
        </button>
      </div>

      {/* Header do comercial atual */}
      {selectedCommercial && (
        <div className="rounded-lg border bg-primary/5 p-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
            {selectedCommercial.charAt(0)}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Folha de {selectedCommercial}</p>
            <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
              <span>{countsByName.get(selectedCommercial)?.total ?? 0} leads total</span>
              <span className="text-green-600">{countsByName.get(selectedCommercial)?.won ?? 0} ganhas</span>
              <span className="text-blue-600">{countsByName.get(selectedCommercial)?.active ?? 0} ativas</span>
              <span className="text-red-600">{countsByName.get(selectedCommercial)?.lost ?? 0} perdidas</span>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate warnings - only visible in conjunct view */}
      {selectedCommercial === "" && duplicates.data && duplicates.data.length > 0 && (
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
            {duplicates.data.slice(0, 10).map((conflict, i) => (
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
                <tr key={l.id} className={cn("hover:bg-muted/50", duplicatesByLeadId.has(l.id) && "bg-amber-50/50")}>
                  <td className="p-2">
                    <div className="font-medium">{l.name}</div>
                    {duplicatesByLeadId.has(l.id) && (
                      <div className="text-[10px] text-amber-600 flex items-center gap-0.5" title="Esta lead tambem esta noutros comerciais">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        tambem em: {(duplicatesByLeadId.get(l.id) ?? []).join(", ")}
                      </div>
                    )}
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
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        onClick={() => startEditLead(l)}
                        className="text-muted-foreground hover:text-primary p-1"
                        title="Editar lead"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => { if (confirm("Apagar esta lead?")) deleteLead.mutate(l.id); }}
                        className="text-muted-foreground hover:text-red-600 p-1"
                        title="Apagar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
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
              <h2 className="text-lg font-bold">{editingLeadId ? "Editar Lead" : "Nova Lead"}</h2>
              <button onClick={() => { setShowCreate(false); setEditingLeadId(null); resetForm(); }} className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (editingLeadId) {
                updateLead.mutate({
                  id: editingLeadId,
                  data: {
                    commercial: form.commercial,
                    company: form.company,
                    companyEmail: form.companyEmail,
                    companyLandline: form.companyLandline,
                    companyMobile: form.companyMobile,
                    nif: form.nif,
                    name: form.name,
                    email: form.email,
                    phone: form.phone,
                    source: form.source,
                    status: form.status as "NOVA",
                    priority: form.priority,
                    notes: form.notes,
                  },
                });
              } else {
                createLead.mutate({
                  clientId,
                  commercial: form.commercial,
                  company: form.company,   // obrigatorio
                  companyEmail: form.companyEmail || undefined,
                  companyLandline: form.companyLandline || undefined,
                  companyMobile: form.companyMobile || undefined,
                  nif: form.nif || undefined,
                  name: form.name || undefined,
                  email: form.email || undefined,
                  phone: form.phone || undefined,
                  source: form.source,
                  status: form.status as "NOVA",
                  priority: form.priority,
                  notes: form.notes || undefined,
                });
              }
            }} className="space-y-3">
              <div>
                <label className="mb-0.5 block text-xs font-medium">Comercial *</label>
                <select
                  required
                  value={form.commercial}
                  onChange={(e) => setForm({ ...form, commercial: e.target.value })}
                  disabled={commercials.length === 0}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-card disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">{commercials.length === 0 ? "Sem comerciais - adiciona na Dashboard > Equipa" : "Selecionar..."}</option>
                  {commercials.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {commercials.length === 0 && (
                  <p className="mt-1 text-[10px] text-amber-600">
                    ⚠ Nao ha comerciais definidos. Vai ao separador Dashboard, clica em &quot;Equipa&quot; e adiciona os membros da equipa comercial do cliente.
                  </p>
                )}
              </div>
              {/* EMPRESA (obrigatoria) */}
              <div className="rounded-lg border border-blue-200 bg-blue-50/30 dark:bg-blue-950/20 p-3">
                <p className="mb-2 text-xs font-semibold text-blue-900 dark:text-blue-200">🏢 Empresa</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="mb-0.5 block text-[11px] font-medium">Nome Empresa *</label>
                    <input required value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[11px] font-medium">Email Geral</label>
                    <input type="email" value={form.companyEmail} onChange={(e) => setForm({ ...form, companyEmail: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" placeholder="geral@empresa.pt" />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[11px] font-medium">NIF</label>
                    <input value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[11px] font-medium">Nº Fixo</label>
                    <input value={form.companyLandline} onChange={(e) => setForm({ ...form, companyLandline: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" placeholder="21..." />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[11px] font-medium">Nº Movel *</label>
                    <input required value={form.companyMobile} onChange={(e) => setForm({ ...form, companyMobile: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" placeholder="9..." />
                  </div>
                </div>
              </div>

              {/* DECISOR (opcional) */}
              <div className="rounded-lg border border-purple-200 bg-purple-50/30 dark:bg-purple-950/20 p-3">
                <p className="mb-2 text-xs font-semibold text-purple-900 dark:text-purple-200">👤 Decisor (opcional)</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="mb-0.5 block text-[11px] font-medium">Nome do Decisor</label>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" placeholder="Pessoa com quem estas a falar" />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[11px] font-medium">Email</label>
                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[11px] font-medium">Nº Telefone</label>
                    <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-0.5 block text-xs font-medium">Origem</label>
                  <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card">
                    <option value="referencia">Referencia</option>
                    <option value="prospecao-ativa">Prospecao ativa</option>
                    <option value="redes-sociais">Redes sociais</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="mb-0.5 block text-xs font-medium">Prioridade</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card">
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baixa">Baixa</option>
                  </select>
                </div>
              </div>

              <div><label className="mb-0.5 block text-xs font-medium">Notas</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" /></div>

              {/* HARD BLOCK: lead duplicada detectada */}
              {createLead.error?.message.startsWith("DUPLICADA:") && (() => {
                const parts = createLead.error.message.split(":");
                const matchedOn = parts[1];
                const ownerCommercial = parts[2];
                const existingName = parts.slice(3).join(":");
                return (
                  <div className="rounded-lg border-2 border-red-400 bg-red-50 dark:bg-red-950/30 p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                      <div className="flex-1 text-sm text-red-900 dark:text-red-200">
                        <p className="font-bold">Lead ja existe!</p>
                        <p className="mt-1 text-xs">
                          Ja existe uma lead registada com o mesmo <strong>{matchedOn}</strong>.
                        </p>
                        <div className="mt-2 rounded border border-red-300 bg-white p-2 text-xs">
                          <p>🏢 <strong>{existingName}</strong></p>
                          <p className="text-red-700 dark:text-red-300 mt-0.5">👤 Comercial: <strong>{ownerCommercial}</strong></p>
                        </div>
                        <p className="mt-2 text-[11px] text-red-800 dark:text-red-300">
                          Coordena com {ownerCommercial} antes de avancar. Nao podes registar a mesma lead em 2 sitios.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {createLead.error && !createLead.error.message.startsWith("DUPLICADA:") && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 p-2 text-xs text-red-700 dark:text-red-300">
                  Erro: {createLead.error.message}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t pt-3">
                <button type="button" onClick={() => { setShowCreate(false); setEditingLeadId(null); resetForm(); }} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={createLead.isPending || updateLead.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                  {editingLeadId
                    ? (updateLead.isPending ? "A guardar..." : "Guardar alteracoes")
                    : (createLead.isPending ? "..." : "Criar")}
                </button>
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
  const [audioUploadStatus, setAudioUploadStatus] = useState<{
    state: "idle" | "uploading" | "queueing" | "done" | "error";
    fileName?: string;
    pct?: number;
    bytesUploaded?: number;
    bytesTotal?: number;
    error?: string;
    message?: string;
  }>({ state: "idle" });
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

  const queueAudioInFireflies = trpc.salesAnalysis.queueAudioInFireflies.useMutation();

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
      <div className="rounded-lg border border-purple-200 bg-purple-50 dark:bg-purple-950/30 p-3 text-xs text-purple-900 dark:text-purple-200">
        <div className="flex items-start gap-2">
          <Brain className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Analise automatica com IA</p>
            <p className="text-purple-700 dark:text-purple-300 mt-0.5">
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
                <span className="rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-1 py-0.5">B: {s.bom}</span>
                <span className="rounded bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 px-1 py-0.5">M: {s.medio}</span>
                <span className="rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-1 py-0.5">Mau: {s.mau}</span>
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
                      a.classification.toLowerCase().startsWith("bom") ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" :
                      a.classification.toLowerCase().startsWith("med") ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300" :
                      "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300")}>
                      {a.classification}
                    </span>
                  </td>
                  <td className="p-2 text-right font-medium text-xs">{a.overallScore?.toFixed(0) ?? "-"}</td>
                  <td className="p-2">
                    <button
                      onClick={() => updateAnalysis.mutate({ id: a.id, data: { visibility: a.visibility === "COMMERCIAL_ONLY" ? "WHOLE_TEAM" : "COMMERCIAL_ONLY" } })}
                      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                        a.visibility === "WHOLE_TEAM" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" : "bg-gray-100 text-gray-700")}
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

            <div className="mb-3 rounded-lg border border-purple-200 bg-purple-50 dark:bg-purple-950/30 p-2 text-xs text-purple-800 dark:text-purple-300">
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

              <div>
                <label className="mb-0.5 block text-xs font-medium">Transcricao da chamada</label>
                <textarea
                  value={analyzeForm.transcript}
                  onChange={(e) => setAnalyzeForm({ ...analyzeForm, transcript: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-card font-mono"
                  rows={8}
                  placeholder="Cola aqui a transcricao da chamada (min 100 chars). A IA do Claude analisa conteudo, objecoes, tom inferido, ritmo (a partir de timestamps [mm:ss] se houver), e da feedback estruturado em 8 dimensoes."
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {analyzeForm.transcript.length} caracteres
                </p>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-muted" /></div>
                <div className="relative flex justify-center"><span className="bg-card px-2 text-[10px] text-muted-foreground uppercase">ou envia o audio para o Fireflies</span></div>
              </div>

              {/* Upload audio para Fireflies transcrever automaticamente */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">🎙️ Carregar gravacao da chamada</p>
                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                  Carrega o ficheiro audio/video. O Fireflies vai transcrever, criar a Sessao + Recording e disparar a analise IA do Claude automaticamente quando terminar (~5-10min).
                </p>
                <input
                  type="file"
                  accept="audio/*,video/*"
                  onClick={(e) => {
                    // Reset value para permitir re-seleccionar o mesmo ficheiro depois dum erro
                    (e.currentTarget as HTMLInputElement).value = "";
                  }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!analyzeForm.commercial) {
                      setAudioUploadStatus({ state: "error", error: "Define primeiro o nome do comercial." });
                      return;
                    }
                    setAudioUploadStatus({ state: "uploading", fileName: file.name, pct: 0, bytesUploaded: 0, bytesTotal: file.size });

                    // Use XHR para conseguir progress events (fetch nao tem progress nativo)
                    const fd = new FormData();
                    fd.append("file", file);
                    const xhr = new XMLHttpRequest();
                    xhr.upload.onprogress = (ev) => {
                      if (ev.lengthComputable) {
                        const pct = Math.round((ev.loaded / ev.total) * 100);
                        setAudioUploadStatus((s) => ({ ...s, pct, bytesUploaded: ev.loaded, bytesTotal: ev.total }));
                      }
                    };
                    xhr.onerror = () => setAudioUploadStatus({ state: "error", fileName: file.name, error: "Falha de rede no upload." });
                    xhr.onload = async () => {
                      try {
                        const upJson = JSON.parse(xhr.responseText || "{}");
                        if (xhr.status < 200 || xhr.status >= 300) {
                          throw new Error(upJson.error ?? `Upload falhou (HTTP ${xhr.status})`);
                        }
                        setAudioUploadStatus({ state: "queueing", fileName: file.name, pct: 100, bytesUploaded: file.size, bytesTotal: file.size });
                        await queueAudioInFireflies.mutateAsync({
                          clientId,
                          commercial: analyzeForm.commercial,
                          leadName: analyzeForm.leadName || undefined,
                          callType: analyzeForm.callType,
                          audioPublicUrl: upJson.publicUrl,
                          title: `${analyzeForm.commercial} x ${analyzeForm.leadName || "Lead"} - ${analyzeForm.callType}`,
                        });
                        setAudioUploadStatus({ state: "done", fileName: file.name, message: "Enviado ao Fireflies! A analise aparece em 5-10 min." });
                      } catch (err) {
                        setAudioUploadStatus({ state: "error", fileName: file.name, error: err instanceof Error ? err.message : String(err) });
                      }
                    };
                    xhr.open("POST", "/api/uploads/call-audio");
                    xhr.send(fd);
                  }}
                  disabled={audioUploadStatus.state === "uploading" || audioUploadStatus.state === "queueing"}
                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-amber-600 file:text-white file:text-xs file:px-3 file:py-1.5 file:cursor-pointer disabled:opacity-50"
                />
                {audioUploadStatus.state === "uploading" && (
                  <div className="space-y-1">
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      <Loader2 className="h-3 w-3 inline animate-spin" /> A enviar {audioUploadStatus.fileName} ({audioUploadStatus.pct}% — {((audioUploadStatus.bytesUploaded ?? 0)/1024/1024).toFixed(1)}MB de {((audioUploadStatus.bytesTotal ?? 0)/1024/1024).toFixed(1)}MB)
                    </p>
                    <div className="h-1.5 w-full bg-amber-200 dark:bg-amber-900/40 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-600 transition-all" style={{ width: `${audioUploadStatus.pct ?? 0}%` }} />
                    </div>
                  </div>
                )}
                {audioUploadStatus.state === "queueing" && (
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    <Loader2 className="h-3 w-3 inline animate-spin" /> Upload completo. A pedir ao Fireflies para transcrever...
                  </p>
                )}
                {audioUploadStatus.state === "done" && (
                  <p className="rounded-lg bg-green-100 dark:bg-green-900/30 px-3 py-2 text-xs text-green-800 dark:text-green-300">
                    ✓ {audioUploadStatus.message}
                  </p>
                )}
                {audioUploadStatus.state === "error" && (
                  <p className="rounded-lg bg-red-100 dark:bg-red-900/30 px-3 py-2 text-xs text-red-800 dark:text-red-300">
                    ✗ {audioUploadStatus.error}
                  </p>
                )}
              </div>

              {(analyzeCall.error || queueAudioInFireflies.error) && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 p-2 text-xs text-red-700 dark:text-red-300">
                  Erro: {(analyzeCall.error ?? queueAudioInFireflies.error)?.message}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t pt-3 flex-wrap">
                <button type="button" onClick={() => setShowAnalyze(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>

                <button
                  type="submit"
                  disabled={analyzeCall.isPending || analyzeForm.transcript.length < 100}
                  className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {analyzeCall.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> A analisar...</> : <><Sparkles className="h-4 w-4" /> Analisar transcricao</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
