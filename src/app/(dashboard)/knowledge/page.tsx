"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Brain, BookOpen, Plus, Trash2, X, Edit2, RefreshCw, Tag, Check,
} from "lucide-react";

const CATEGORIES = [
  { id: "scripts-vendas", title: "Scripts de Vendas", desc: "Cold calls, reunioes, follow-ups", icon: "📞", color: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200" },
  { id: "frameworks-reuniao", title: "Frameworks de Reuniao", desc: "Estruturas e modelos para reunioes", icon: "📋", color: "bg-blue-50 dark:bg-blue-950/30 border-blue-200" },
  { id: "criterios-avaliacao", title: "Criterios de Avaliacao", desc: "Metricas para avaliar performance", icon: "📊", color: "bg-green-50 dark:bg-green-950/30 border-green-200" },
  { id: "materiais-formacao", title: "Materiais de Formacao", desc: "Formacao para equipa comercial", icon: "📚", color: "bg-purple-50 dark:bg-purple-950/30 border-purple-200" },
  { id: "esquemas-sops", title: "Esquemas e SOPs", desc: "Processos, fluxos e procedimentos operacionais", icon: "🗺️", color: "bg-pink-50 dark:bg-pink-950/30 border-pink-200" },
];

const MARKET_BADGES: Record<string, { label: string; color: string }> = {
  ALL: { label: "Todos os mercados", color: "bg-gray-100 text-gray-700" },
  CREDITO: { label: "Credito", color: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" },
  SEGUROS: { label: "Seguros", color: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" },
  IMOBILIARIO: { label: "Imobiliario", color: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300" },
};

export default function KnowledgePage() {
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedMarket, setSelectedMarket] = useState<"ALL" | "CREDITO" | "SEGUROS" | "IMOBILIARIO">("ALL");
  const [docForm, setDocForm] = useState({ name: "", category: "", content: "", googleDocUrl: "", fileName: "", fileUrl: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingMarketsFor, setEditingMarketsFor] = useState<string | null>(null);

  const docs = trpc.knowledge.list.useQuery({
    category: selectedCategory || undefined,
    market: selectedMarket,
  });
  const allDocs = trpc.knowledge.list.useQuery();
  const counts = trpc.knowledge.categoryCounts.useQuery();
  const utils = trpc.useUtils();

  const createDoc = trpc.knowledge.create.useMutation({
    onSuccess: () => {
      utils.knowledge.list.invalidate();
      utils.knowledge.categoryCounts.invalidate();
      setShowAddDoc(false);
      setDocForm({ name: "", category: "", content: "", googleDocUrl: "", fileName: "", fileUrl: "" });
    },
  });

  const updateDoc = trpc.knowledge.update.useMutation({
    onSuccess: () => { utils.knowledge.list.invalidate(); setEditingId(null); setDocForm({ name: "", category: "", content: "", googleDocUrl: "", fileName: "", fileUrl: "" }); },
  });

  const deleteDoc = trpc.knowledge.delete.useMutation({
    onSuccess: () => { utils.knowledge.list.invalidate(); utils.knowledge.categoryCounts.invalidate(); },
  });

  const redetect = trpc.knowledge.redetectMarkets.useMutation({
    onSuccess: () => utils.knowledge.list.invalidate(),
  });

  const setMarkets = trpc.knowledge.setMarkets.useMutation({
    onSuccess: () => { utils.knowledge.list.invalidate(); setEditingMarketsFor(null); },
  });

  const syncFromDoc = trpc.knowledge.syncFromGoogleDoc.useMutation({
    onSuccess: () => utils.knowledge.list.invalidate(),
  });

  function handleEdit(doc: { id: string; name: string; category: string | null; content: string; googleDocUrl?: string | null; fileName?: string | null; fileUrl?: string | null }) {
    setDocForm({
      name: doc.name, category: doc.category ?? "", content: doc.content,
      googleDocUrl: doc.googleDocUrl ?? "", fileName: doc.fileName ?? "", fileUrl: doc.fileUrl ?? "",
    });
    setEditingId(doc.id);
    setShowAddDoc(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Base de Conhecimento IA</h1>
          <p className="text-muted-foreground">Documentos de referencia usados pela IA para analisar chamadas e reunioes</p>
        </div>
        <button
          onClick={() => { setEditingId(null); setDocForm({ name: "", category: "", content: "", googleDocUrl: "", fileName: "", fileUrl: "" }); setShowAddDoc(true); }}
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
        >
          <Plus className="h-4 w-4" /> Adicionar Documento
        </button>
      </div>

      <div className="rounded-xl border border-purple-200 bg-purple-50 dark:bg-purple-950/30 p-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600" />
          <h3 className="font-semibold text-purple-800 dark:text-purple-300">Como funciona</h3>
        </div>
        <p className="mt-1 text-sm text-purple-700 dark:text-purple-300">
          Quando adicionas um documento, a IA deteta automaticamente a que mercado(s) ele se aplica (Credito, Seguros, Imobiliario ou todos).
          Quando analisas uma chamada no Workspace de um cliente, a IA usa <strong>apenas</strong> os documentos relevantes para o mercado desse cliente.
        </p>
        <p className="mt-2 text-xs text-purple-600">
          {allDocs.data?.length ?? 0} documentos ativos na base de conhecimento
        </p>
      </div>

      {/* Category filter */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <button
          onClick={() => setSelectedCategory("")}
          className={cn("rounded-xl border p-3 text-left transition-colors",
            !selectedCategory ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30" : "bg-card hover:bg-muted/50"
          )}
        >
          <span className="text-2xl">📚</span>
          <p className="font-semibold text-sm mt-1">Todos</p>
          <p className="text-[10px] text-muted-foreground">{allDocs.data?.length ?? 0} documentos</p>
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(selectedCategory === cat.id ? "" : cat.id)}
            className={cn("rounded-xl border p-3 text-left transition-colors",
              selectedCategory === cat.id ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30" : cn(cat.color)
            )}
          >
            <span className="text-2xl">{cat.icon}</span>
            <p className="font-semibold text-sm mt-1">{cat.title}</p>
            <p className="text-[10px] text-muted-foreground">{counts.data?.[cat.id] ?? 0} documentos</p>
          </button>
        ))}
      </div>

      {/* Market filter */}
      <div className="flex gap-2 items-center flex-wrap">
        <span className="text-xs text-muted-foreground">Filtrar por mercado:</span>
        {(["ALL", "CREDITO", "SEGUROS", "IMOBILIARIO"] as const).map((m) => {
          const b = MARKET_BADGES[m];
          return (
            <button key={m}
              onClick={() => setSelectedMarket(m)}
              className={cn("rounded-full px-3 py-1 text-xs font-medium border",
                selectedMarket === m ? "border-purple-500 bg-purple-600 text-white" : cn(b.color, "border-transparent")
              )}>
              {m === "ALL" ? "Todos" : b.label}
            </button>
          );
        })}
      </div>

      {/* Documents list */}
      <div className="rounded-xl border bg-card">
        <div className="divide-y">
          {docs.isLoading && (
            <p className="p-6 text-center text-sm text-muted-foreground">A carregar...</p>
          )}
          {docs.data?.length === 0 && !docs.isLoading && (
            <div className="flex flex-col items-center gap-2 p-8 text-muted-foreground">
              <BookOpen className="h-10 w-10 text-muted-foreground/30" />
              <p className="font-medium">Sem documentos nesta vista</p>
              <p className="text-sm text-center max-w-md">
                Adiciona scripts de vendas, frameworks, criterios de avaliacao, SOPs. A IA vai usar tudo como referencia.
              </p>
            </div>
          )}
          {docs.data?.map((doc) => {
            const cat = CATEGORIES.find(c => c.id === doc.category);
            const markets = doc.markets ?? ["ALL"];
            return (
              <div key={doc.id} className="flex items-start gap-3 p-4 group">
                <div className="text-2xl shrink-0">{cat?.icon ?? "📄"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{doc.name}</p>
                    {markets.map((m: string) => {
                      const b = MARKET_BADGES[m] ?? MARKET_BADGES.ALL;
                      return (
                        <span key={m} className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", b.color)}>
                          {b.label}
                        </span>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {cat?.title ?? doc.category ?? "Sem categoria"} &middot; {doc.content.length} caracteres
                    {doc.googleDocUrl && <> &middot; <a href={doc.googleDocUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Doc</a></>}
                    {doc.fileName && <> &middot; {doc.fileUrl ? <a href={doc.fileUrl} download={doc.fileName} className="text-green-600 hover:underline">{doc.fileName}</a> : <span className="text-green-600">{doc.fileName}</span>}</>}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {doc.content.slice(0, 200)}{doc.content.length > 200 ? "..." : ""}
                  </p>

                  {/* Markets editor */}
                  {editingMarketsFor === doc.id && (
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">Mercados:</span>
                      {(["ALL", "CREDITO", "SEGUROS", "IMOBILIARIO"] as const).map((m) => {
                        const b = MARKET_BADGES[m];
                        const active = markets.includes(m);
                        return (
                          <button key={m}
                            onClick={() => {
                              let next: string[];
                              if (m === "ALL") next = ["ALL"];
                              else {
                                const withoutAll = markets.filter((x: string) => x !== "ALL");
                                next = active ? withoutAll.filter((x: string) => x !== m) : [...withoutAll, m];
                                if (next.length === 0) next = ["ALL"];
                              }
                              setMarkets.mutate({ id: doc.id, markets: next as ["ALL"] });
                            }}
                            className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium border",
                              active ? cn(b.color, "border-transparent") : "border-border"
                            )}>
                            {active && <Check className="h-2.5 w-2.5 inline" />} {b.label}
                          </button>
                        );
                      })}
                      <button onClick={() => setEditingMarketsFor(null)} className="text-[10px] text-muted-foreground hover:underline">fechar</button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditingMarketsFor(editingMarketsFor === doc.id ? null : doc.id)}
                    className="rounded border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Editar mercados"
                  >
                    <Tag className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => redetect.mutate({ id: doc.id })}
                    disabled={redetect.isPending}
                    className="rounded border p-1.5 text-muted-foreground hover:bg-purple-50 dark:hover:bg-purple-950/30 hover:text-purple-600 disabled:opacity-50"
                    title="Re-detetar mercados com IA"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", redetect.isPending && "animate-spin")} />
                  </button>
                  {doc.googleDocUrl && (
                    <button
                      onClick={async () => {
                        try {
                          await syncFromDoc.mutateAsync({ id: doc.id });
                        } catch (err) {
                          alert(`Sync falhou: ${err instanceof Error ? err.message : String(err)}`);
                        }
                      }}
                      disabled={syncFromDoc.isPending}
                      className="rounded border p-1.5 text-muted-foreground hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-600 disabled:opacity-50"
                      title="Sincronizar conteudo do Google Doc (puxar versao mais recente)"
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", syncFromDoc.isPending && "animate-spin", !syncFromDoc.isPending && "text-blue-600")} />
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(doc)}
                    className="rounded border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Editar"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Apagar &quot;${doc.name}&quot;?`)) deleteDoc.mutate(doc.id); }}
                    className="rounded border p-1.5 text-muted-foreground hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600"
                    title="Apagar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add/Edit Document Dialog */}
      {showAddDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-6 animate-scale-in">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {editingId ? "Editar Documento" : "Adicionar a Base de Conhecimento"}
              </h2>
              <button onClick={() => setShowAddDoc(false)} className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editingId) {
                  updateDoc.mutate({
                    id: editingId, name: docForm.name, category: docForm.category, content: docForm.content,
                    googleDocUrl: docForm.googleDocUrl || undefined,
                    fileName: docForm.fileName || undefined,
                    fileUrl: docForm.fileUrl || undefined,
                  });
                } else {
                  createDoc.mutate({
                    name: docForm.name, category: docForm.category, pillar: docForm.category || "geral",
                    content: docForm.content || (docForm.googleDocUrl ? `[Google Doc: ${docForm.googleDocUrl}]` : ""),
                    googleDocUrl: docForm.googleDocUrl || undefined,
                    fileName: docForm.fileName || undefined,
                    fileUrl: docForm.fileUrl || undefined,
                  });
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium">Nome do Documento *</label>
                <input type="text" required value={docForm.name} onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-card" placeholder="Ex: Script Cold Call Parcerias" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Categoria *</label>
                <select required value={docForm.category} onChange={(e) => setDocForm({ ...docForm, category: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-card">
                  <option value="">Selecionar...</option>
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  A IA vai detetar automaticamente a que mercado(s) se aplica (Credito, Seguros, Imobiliario ou todos).
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Link Google Docs (opcional)</label>
                <input type="url" value={docForm.googleDocUrl} onChange={(e) => setDocForm({ ...docForm, googleDocUrl: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-card" placeholder="https://docs.google.com/document/d/..." />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Ficheiro anexo (opcional)</label>
                <input type="file" accept=".pdf,.doc,.docx,.txt,.md,.xlsx,.pptx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setDocForm({ ...docForm, fileName: file.name, fileUrl: reader.result as string });
                    reader.readAsDataURL(file);
                  }}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-card file:mr-3 file:rounded file:border-0 file:bg-purple-600 file:text-white file:text-xs file:px-3 file:py-1.5 file:cursor-pointer" />
                {docForm.fileName && (
                  <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                    ✓ {docForm.fileName} anexado
                    <button type="button" onClick={() => setDocForm({ ...docForm, fileName: "", fileUrl: "" })} className="ml-1 text-red-600 hover:underline">remover</button>
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Conteudo do Documento {!docForm.googleDocUrl && !docForm.fileName && "*"}
                </label>
                <textarea required={!docForm.googleDocUrl && !docForm.fileName}
                  value={docForm.content} onChange={(e) => setDocForm({ ...docForm, content: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono bg-card" rows={12}
                  placeholder="Cola aqui o conteudo do script, framework ou documento..." />
                <p className="mt-1 text-xs text-muted-foreground">
                  {docForm.content.length} caracteres &middot; A IA analisa o conteudo para detetar os mercados relevantes.
                </p>
              </div>

              {(createDoc.error || updateDoc.error) && (
                <p className="text-sm text-red-600">{(createDoc.error ?? updateDoc.error)?.message}</p>
              )}

              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setShowAddDoc(false)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={createDoc.isPending || updateDoc.isPending}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">
                  {editingId
                    ? (updateDoc.isPending ? "A guardar..." : "Guardar")
                    : (createDoc.isPending ? "A detetar mercados..." : "Adicionar")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
