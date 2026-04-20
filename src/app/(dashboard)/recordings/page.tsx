"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Mic, Upload, Brain, ChevronRight, BookOpen, Plus, FileText,
  Trash2, X, Edit2,
} from "lucide-react";
import { UploadCallDialog } from "@/components/recordings/upload-call-dialog";

export default function RecordingsPage() {
  const [filter, setFilter] = useState<"all" | "analyzed" | "pending">("all");
  const [showUpload, setShowUpload] = useState(false);
  const [activeTab, setActiveTab] = useState<"recordings" | "knowledge">("recordings");

  const recordings = trpc.recordings.list.useQuery({
    analyzed: filter === "analyzed" ? true : filter === "pending" ? false : undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gravacoes & IA</h1>
          <p className="text-muted-foreground">Analise de chamadas e base de conhecimento</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Upload className="h-4 w-4" />
          Upload Chamada
        </button>
      </div>

      <UploadCallDialog open={showUpload} onClose={() => setShowUpload(false)} />

      {/* Tabs: Recordings vs Knowledge Base */}
      <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
        <button
          onClick={() => setActiveTab("recordings")}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "recordings" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Mic className="h-4 w-4" />
          Gravacoes
        </button>
        <button
          onClick={() => setActiveTab("knowledge")}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "knowledge" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <BookOpen className="h-4 w-4" />
          Base de Conhecimento IA
        </button>
      </div>

      {/* =================== RECORDINGS TAB =================== */}
      {activeTab === "recordings" && (
        <>
          <div className="flex gap-2">
            {[
              { key: "all", label: "Todas" },
              { key: "analyzed", label: "Analisadas" },
              { key: "pending", label: "Por analisar" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as typeof filter)}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  filter === tab.key ? "bg-gray-900 text-white" : "bg-card text-muted-foreground hover:bg-muted"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="rounded-xl border bg-card">
            <div className="divide-y">
              {recordings.isLoading && (
                <div className="p-8 text-center text-muted-foreground">A carregar...</div>
              )}
              {recordings.data?.length === 0 && (
                <div className="flex flex-col items-center gap-3 p-8 text-muted-foreground">
                  <Mic className="h-10 w-10 text-muted-foreground/30" />
                  <div className="text-center">
                    <p className="font-medium">Sem gravacoes</p>
                    <p className="text-sm">Clica em "Upload Chamada" para submeter uma gravacao para analise IA.</p>
                    <p className="mt-1 text-xs">Cola a transcricao e a IA analisa automaticamente contra os scripts na Base de Conhecimento.</p>
                  </div>
                </div>
              )}
              {recordings.data?.map((rec) => (
                <Link
                  key={rec.id}
                  href={`/recordings/${rec.id}`}
                  className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      rec.type === "CALL" ? "bg-yellow-50" : "bg-blue-50"
                    )}>
                      <Mic className={cn("h-5 w-5", rec.type === "CALL" ? "text-yellow-600" : "text-blue-600")} />
                    </div>
                    <div>
                      <p className="font-medium">{rec.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {rec.client.name} &middot; {rec.type === "CALL" ? "Chamada" : "Reuniao"}{" "}
                        {rec.duration ? `| ${Math.round(rec.duration / 60)}min` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {rec.aiScore !== null ? (
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-purple-600" />
                        <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-semibold text-purple-700">
                          {rec.aiScore}/100
                        </span>
                      </div>
                    ) : (
                      <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700">
                        Por analisar
                      </span>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {new Date(rec.createdAt).toLocaleDateString("pt-PT")}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {/* =================== KNOWLEDGE BASE TAB =================== */}
      {activeTab === "knowledge" && <KnowledgeBaseTab />}
    </div>
  );
}

// ===== KNOWLEDGE BASE COMPONENT =====
function KnowledgeBaseTab() {
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [docForm, setDocForm] = useState({ name: "", category: "", content: "", googleDocUrl: "", fileName: "", fileUrl: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  const docs = trpc.knowledge.list.useQuery(selectedCategory ? { category: selectedCategory } : undefined);
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
    onSuccess: () => {
      utils.knowledge.list.invalidate();
      setEditingId(null);
      setDocForm({ name: "", category: "", content: "", googleDocUrl: "", fileName: "", fileUrl: "" });
    },
  });

  const deleteDoc = trpc.knowledge.delete.useMutation({
    onSuccess: () => { utils.knowledge.list.invalidate(); utils.knowledge.categoryCounts.invalidate(); },
  });

  const CATEGORIES = [
    { id: "scripts-vendas", title: "Scripts de Vendas", desc: "Cold calls, reunioes, follow-ups", icon: "📞", color: "bg-yellow-50 border-yellow-200" },
    { id: "frameworks-reuniao", title: "Frameworks de Reuniao", desc: "Estruturas e modelos para reunioes", icon: "📋", color: "bg-blue-50 border-blue-200" },
    { id: "criterios-avaliacao", title: "Criterios de Avaliacao", desc: "Metricas para avaliar performance", icon: "📊", color: "bg-green-50 border-green-200" },
    { id: "materiais-formacao", title: "Materiais de Formacao", desc: "Formacao para equipa comercial", icon: "📚", color: "bg-purple-50 border-purple-200" },
    { id: "esquemas-sops", title: "Esquemas e SOPs", desc: "Processos, fluxos e procedimentos operacionais", icon: "🗺️", color: "bg-pink-50 border-pink-200" },
  ];

  function handleEdit(doc: { id: string; name: string; category: string | null; content: string; googleDocUrl?: string | null; fileName?: string | null; fileUrl?: string | null }) {
    setDocForm({
      name: doc.name,
      category: doc.category ?? "",
      content: doc.content,
      googleDocUrl: doc.googleDocUrl ?? "",
      fileName: doc.fileName ?? "",
      fileUrl: doc.fileUrl ?? "",
    });
    setEditingId(doc.id);
    setShowAddDoc(true);
  }

  return (
    <>
      <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600" />
          <h3 className="font-semibold text-purple-800">Base de Conhecimento IA</h3>
        </div>
        <p className="mt-1 text-sm text-purple-700">
          Adiciona aqui os documentos, scripts de vendas e materiais de referencia.
          A IA usa esta base para analisar chamadas e reunioes de forma mais precisa e alinhada com o vosso metodo.
        </p>
        <p className="mt-2 text-xs text-purple-600">
          {allDocs.data?.length ?? 0} documentos na base de conhecimento
        </p>
      </div>

      {/* Categories filter */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <button
          onClick={() => setSelectedCategory("")}
          className={cn("rounded-xl border p-3 text-left transition-colors",
            !selectedCategory ? "border-purple-500 bg-purple-50" : "bg-card hover:bg-muted/50"
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
              selectedCategory === cat.id ? "border-purple-500 bg-purple-50" : cn(cat.color)
            )}
          >
            <span className="text-2xl">{cat.icon}</span>
            <p className="font-semibold text-sm mt-1">{cat.title}</p>
            <p className="text-[10px] text-muted-foreground">{counts.data?.[cat.id] ?? 0} documentos</p>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">
          {selectedCategory ? CATEGORIES.find(c => c.id === selectedCategory)?.title : "Todos os Documentos"}
        </h2>
        <button
          onClick={() => { setEditingId(null); setDocForm({ name: "", category: "", content: "", googleDocUrl: "", fileName: "", fileUrl: "" }); setShowAddDoc(true); }}
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
        >
          <Plus className="h-4 w-4" /> Adicionar Documento
        </button>
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
              <p className="font-medium">Sem documentos</p>
              <p className="text-sm text-center max-w-md">
                Adiciona scripts de vendas, frameworks, criterios de avaliacao. A IA vai usar tudo como referencia nas analises.
              </p>
            </div>
          )}
          {docs.data?.map((doc) => {
            const cat = CATEGORIES.find(c => c.id === doc.category);
            return (
              <div key={doc.id} className="flex items-start gap-3 p-4 group">
                <div className="text-2xl shrink-0">{cat?.icon ?? "📄"}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {cat?.title ?? doc.category ?? "Sem categoria"} &middot; {doc.content.length} caracteres
                    {doc.googleDocUrl && <> &middot; <a href={doc.googleDocUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Doc</a></>}
                    {doc.fileName && <> &middot; {doc.fileUrl ? <a href={doc.fileUrl} download={doc.fileName} className="text-green-600 hover:underline">{doc.fileName}</a> : <span className="text-green-600">{doc.fileName}</span>}</>}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {doc.content.slice(0, 200)}{doc.content.length > 200 ? "..." : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEdit(doc)}
                    className="rounded border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Editar"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Apagar "${doc.name}"?`)) deleteDoc.mutate(doc.id); }}
                    className="rounded border p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
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
              <button onClick={() => setShowAddDoc(false)} className="rounded-lg p-1 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editingId) {
                  updateDoc.mutate({
                    id: editingId,
                    name: docForm.name,
                    category: docForm.category,
                    content: docForm.content,
                    googleDocUrl: docForm.googleDocUrl || undefined,
                    fileName: docForm.fileName || undefined,
                    fileUrl: docForm.fileUrl || undefined,
                  });
                } else {
                  createDoc.mutate({
                    name: docForm.name,
                    category: docForm.category,
                    pillar: docForm.category || "geral",
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
                <input
                  type="text"
                  required
                  value={docForm.name}
                  onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-card"
                  placeholder="Ex: Script Cold Call Parcerias"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Categoria *</label>
                <select
                  required
                  value={docForm.category}
                  onChange={(e) => setDocForm({ ...docForm, category: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-card"
                >
                  <option value="">Selecionar...</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              {/* Google Docs link */}
              <div>
                <label className="mb-1 block text-sm font-medium">Link Google Docs (opcional)</label>
                <input
                  type="url"
                  value={docForm.googleDocUrl}
                  onChange={(e) => setDocForm({ ...docForm, googleDocUrl: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-card"
                  placeholder="https://docs.google.com/document/d/..."
                />
                <p className="mt-1 text-xs text-muted-foreground">Cola aqui o link do Google Docs, Sheets ou Slides para referencia direta.</p>
              </div>

              {/* File upload */}
              <div>
                <label className="mb-1 block text-sm font-medium">Ficheiro anexo (opcional)</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.md,.xlsx,.pptx"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    // For now, store as base64 data URL. Upgrade to S3/R2 later.
                    const reader = new FileReader();
                    reader.onload = () => {
                      setDocForm({
                        ...docForm,
                        fileName: file.name,
                        fileUrl: reader.result as string,
                      });
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-card file:mr-3 file:rounded file:border-0 file:bg-purple-600 file:text-white file:text-xs file:px-3 file:py-1.5 file:cursor-pointer"
                />
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
                <textarea
                  required={!docForm.googleDocUrl && !docForm.fileName}
                  value={docForm.content}
                  onChange={(e) => setDocForm({ ...docForm, content: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono bg-card"
                  rows={12}
                  placeholder="Cola aqui o conteudo do script, framework ou documento...&#10;&#10;A IA vai usar este conteudo como referencia para analisar chamadas e reunioes.&#10;&#10;(Opcional se anexaste ficheiro ou link Google Docs acima)"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {docForm.content.length} caracteres &middot; Podes colar texto, anexar ficheiro ou adicionar link Google Docs.
                </p>
              </div>

              {(createDoc.error || updateDoc.error) && (
                <p className="text-sm text-red-600">{(createDoc.error ?? updateDoc.error)?.message}</p>
              )}

              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setShowAddDoc(false)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createDoc.isPending || updateDoc.isPending}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {editingId
                    ? (updateDoc.isPending ? "A guardar..." : "Guardar")
                    : (createDoc.isPending ? "A adicionar..." : "Adicionar")
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
