"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  FileText, ExternalLink, FolderOpen, Plus, Search, X, Trash2,
  Building2, Shield, Rocket, Briefcase, BarChart3, Megaphone, Users,
  GripVertical, ArrowRight,
} from "lucide-react";

const MARKETS = [
  { id: "credito", label: "Credito", icon: Building2, color: "#2D76FC", desc: "Intermediacao de credito" },
  { id: "seguros", label: "Seguros", icon: Shield, color: "#16a34a", desc: "Mediacao de seguros" },
  { id: "imobiliario", label: "Imobiliario", icon: Building2, color: "#ea580c", desc: "Agencias imobiliarias" },
  { id: "ads-funnel", label: "Ads Funnel", icon: Megaphone, color: "#8b5cf6", desc: "Anuncios e funis" },
  { id: "geral", label: "Geral", icon: Briefcase, color: "#6b7280", desc: "Documentos transversais" },
  { id: "levantamentos", label: "Levantamentos", icon: BarChart3, color: "#0891b2", desc: "Levantamentos de clientes" },
  { id: "rh", label: "Recursos Humanos", icon: Users, color: "#ec4899", desc: "Recrutamento e RH" },
  { id: "boom-club", label: "BoomClub", icon: Rocket, color: "#f59e0b", desc: "Retencao e OKRs" },
  { id: "estrutura-servico", label: "Estrutura Servico", icon: FolderOpen, color: "#64748b", desc: "Operacao interna" },
];

export default function DocumentsPage() {
  const [activeTab, setActiveTab] = useState<"docs" | "drives">("docs");
  const [selectedMarket, setSelectedMarket] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showMove, setShowMove] = useState<string | null>(null);
  const [newDoc, setNewDoc] = useState({ title: "", pillar: "", googleDocsUrl: "", clientId: "" });

  const documents = trpc.documents.list.useQuery(
    selectedMarket ? { pillar: selectedMarket } : {}
  );
  const allDocs = trpc.documents.list.useQuery({});
  const clients = trpc.clients.list.useQuery({});
  const utils = trpc.useUtils();

  const createDoc = trpc.documents.create.useMutation({
    onSuccess: () => {
      utils.documents.list.invalidate();
      setShowAdd(false);
      setNewDoc({ title: "", pillar: "", googleDocsUrl: "", clientId: "" });
    },
  });

  const deleteDoc = trpc.documents.delete.useMutation({
    onSuccess: () => utils.documents.list.invalidate(),
  });

  // Count docs per market
  const marketCounts: Record<string, number> = {};
  allDocs.data?.forEach((doc) => {
    marketCounts[doc.pillar] = (marketCounts[doc.pillar] ?? 0) + 1;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documentos</h1>
          <p className="text-muted-foreground">Organizados por mercado - {allDocs.data?.length ?? 0} documentos</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Adicionar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
        <button onClick={() => setActiveTab("docs")} className={cn("flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors", activeTab === "docs" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          <FileText className="h-4 w-4" /> Documentos
        </button>
        <button onClick={() => setActiveTab("drives")} className={cn("flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors", activeTab === "drives" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          <FolderOpen className="h-4 w-4" /> Drives de Clientes
        </button>
      </div>

      {/* ===== DRIVES DE CLIENTES TAB ===== */}
      {activeTab === "drives" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
            <p className="text-sm text-blue-800">
              <FolderOpen className="inline h-4 w-4 mr-1" />
              Pastas de clientes na Google Drive. Cada cliente tem a sua pasta com todos os documentos do projeto.
            </p>
          </div>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {clients.data?.map((client) => (
              <a
                key={client.id}
                href={`https://drive.google.com/drive/search?q=${encodeURIComponent(client.name + " X Boomlab")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2D76FC]/10 text-[#2D76FC] text-sm font-semibold">
                  {client.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{client.name}</p>
                  <p className="text-[10px] text-muted-foreground">Abrir Drive do cliente</p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ===== DOCUMENTOS TAB ===== */}
      {activeTab === "docs" && (<>

      {/* Market Folders */}
      <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <button
          onClick={() => setSelectedMarket("")}
          className={cn(
            "rounded-xl border p-3 text-left transition-colors",
            !selectedMarket ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/50"
          )}
        >
          <FolderOpen className="h-5 w-5 text-muted-foreground mb-1" />
          <p className="text-sm font-medium">Todos</p>
          <p className="text-[10px] text-muted-foreground">{allDocs.data?.length ?? 0} docs</p>
        </button>
        {MARKETS.map((market) => {
          const count = marketCounts[market.id] ?? 0;
          const Icon = market.icon;
          return (
            <button
              key={market.id}
              onClick={() => setSelectedMarket(selectedMarket === market.id ? "" : market.id)}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                selectedMarket === market.id ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/50"
              )}
            >
              <Icon className="h-5 w-5 mb-1" style={{ color: market.color }} />
              <p className="text-sm font-medium">{market.label}</p>
              <p className="text-[10px] text-muted-foreground">{count} docs</p>
            </button>
          );
        })}
      </div>

      {/* Document List */}
      <div className="rounded-xl border bg-card">
        <div className="divide-y">
          {documents.isLoading && (
            <div className="p-8 text-center text-muted-foreground text-sm">A carregar...</div>
          )}
          {documents.data?.length === 0 && !documents.isLoading && (
            <div className="flex flex-col items-center gap-2 p-8 text-muted-foreground">
              <FileText className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm">Sem documentos {selectedMarket ? "neste mercado" : ""}</p>
            </div>
          )}
          {documents.data?.map((doc) => {
            const market = MARKETS.find((m) => m.id === doc.pillar);
            return (
              <div key={doc.id} className="flex items-center gap-3 p-3 group">
                {/* Drag handle */}
                <button
                  onClick={() => setShowMove(doc.id)}
                  className="cursor-grab text-muted-foreground/30 hover:text-muted-foreground"
                  title="Mover para outra pasta"
                >
                  <GripVertical className="h-4 w-4" />
                </button>

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: market ? `${market.color}15` : "#f3f4f6" }}>
                  <FileText className="h-4 w-4" style={{ color: market?.color ?? "#6b7280" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.title}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    {market && (
                      <span className="rounded bg-muted px-1.5 py-0.5">{market.label}</span>
                    )}
                    {doc.client && <span>{doc.client.name}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {doc.googleDocsUrl && (
                    <a href={doc.googleDocsUrl} target="_blank" rel="noopener noreferrer" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Abrir no Google Docs">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button onClick={() => setShowMove(doc.id)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Mover">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => deleteDoc.mutate(doc.id)} className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600" title="Remover">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      </>)}

      {/* Move Document Dialog */}
      {showMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 animate-scale-in">
            <h2 className="mb-3 text-lg font-bold">Mover para...</h2>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {MARKETS.map((market) => {
                const Icon = market.icon;
                return (
                  <button
                    key={market.id}
                    onClick={async () => {
                      // Update document pillar via direct API
                      await fetch("/api/trpc/documents.create", { method: "POST" }); // placeholder
                      setShowMove(null);
                      utils.documents.list.invalidate();
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors"
                  >
                    <Icon className="h-5 w-5" style={{ color: market.color }} />
                    <div>
                      <p className="text-sm font-medium">{market.label}</p>
                      <p className="text-[10px] text-muted-foreground">{market.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setShowMove(null)} className="mt-3 w-full rounded-lg border py-2 text-sm hover:bg-muted">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Add Document Dialog */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-card p-6 animate-scale-in">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Adicionar Documento</h2>
              <button onClick={() => setShowAdd(false)} className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); createDoc.mutate({ title: newDoc.title, pillar: newDoc.pillar, googleDocsUrl: newDoc.googleDocsUrl || undefined, clientId: newDoc.clientId || undefined }); }} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Titulo *</label>
                <input type="text" required value={newDoc.title} onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Mercado *</label>
                <select required value={newDoc.pillar} onChange={(e) => setNewDoc({ ...newDoc, pillar: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card">
                  <option value="">Selecionar...</option>
                  {MARKETS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Link Google Docs</label>
                <input type="url" value={newDoc.googleDocsUrl} onChange={(e) => setNewDoc({ ...newDoc, googleDocsUrl: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" placeholder="https://docs.google.com/document/d/..." />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Cliente</label>
                <select value={newDoc.clientId} onChange={(e) => setNewDoc({ ...newDoc, clientId: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card">
                  <option value="">Sem cliente</option>
                  {clients.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={createDoc.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                  {createDoc.isPending ? "A adicionar..." : "Adicionar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
