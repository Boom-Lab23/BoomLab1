"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PILLARS, cn } from "@/lib/utils";
import {
  FileText, ExternalLink, FolderOpen, Plus, Search, X, Link2, Trash2,
} from "lucide-react";

export default function DocumentsPage() {
  const [selectedPillar, setSelectedPillar] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newDoc, setNewDoc] = useState({ title: "", pillar: "", googleDocsUrl: "", clientId: "" });

  const documents = trpc.documents.list.useQuery(
    selectedPillar ? { pillar: selectedPillar } : {}
  );
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

  // Count docs per pillar
  const allDocs = trpc.documents.list.useQuery({});
  const pillarCounts: Record<string, number> = {};
  allDocs.data?.forEach((doc) => {
    pillarCounts[doc.pillar] = (pillarCounts[doc.pillar] ?? 0) + 1;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documentos</h1>
          <p className="text-muted-foreground">
            Biblioteca de documentos organizada por pilar - integrada com Google Docs
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Adicionar Documento
        </button>
      </div>

      {/* Pillar Folders */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <button
          onClick={() => setSelectedPillar("")}
          className={cn(
            "rounded-xl border p-4 text-left transition-colors",
            !selectedPillar ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/50"
          )}
        >
          <div className="flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-gray-600" />
            <div>
              <p className="font-medium">Todos</p>
              <p className="text-xs text-muted-foreground">{allDocs.data?.length ?? 0} documentos</p>
            </div>
          </div>
        </button>
        {PILLARS.filter((p) => p.id !== "boom-club" && p.id !== "acompanhamento").map((pillar) => (
          <button
            key={pillar.id}
            onClick={() => setSelectedPillar(selectedPillar === pillar.id ? "" : pillar.id)}
            className={cn(
              "rounded-xl border p-4 text-left transition-colors",
              selectedPillar === pillar.id ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/50"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2" style={{ backgroundColor: `${pillar.color}15` }}>
                <FolderOpen className="h-4 w-4" style={{ color: pillar.color }} />
              </div>
              <div>
                <p className="font-medium text-sm">{pillar.label}</p>
                <p className="text-xs text-muted-foreground">{pillarCounts[pillar.id] ?? 0} documentos</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Documents List */}
      <div className="rounded-xl border bg-card">
        <div className="divide-y">
          {documents.isLoading && (
            <div className="p-8 text-center text-muted-foreground">A carregar...</div>
          )}
          {documents.data?.length === 0 && (
            <div className="flex flex-col items-center gap-2 p-8 text-muted-foreground">
              <FileText className="h-8 w-8" />
              <p>Sem documentos {selectedPillar ? "neste pilar" : ""}</p>
              <p className="text-xs">Adiciona documentos ou liga Google Docs</p>
            </div>
          )}
          {documents.data?.map((doc) => {
            const pillar = PILLARS.find((p) => p.id === doc.pillar);
            return (
              <div key={doc.id} className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {pillar && (
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: pillar.color }} />
                        {pillar.label}
                      </span>
                    )}
                    {doc.client && (
                      <>
                        <span>&middot;</span>
                        <span>{doc.client.name}</span>
                      </>
                    )}
                    {doc.googleDocsId && (
                      <>
                        <span>&middot;</span>
                        <span className="flex items-center gap-0.5">
                          <Link2 className="h-3 w-3" /> Google Docs
                        </span>
                      </>
                    )}
                    {doc.lastSyncedAt && (
                      <>
                        <span>&middot;</span>
                        <span>Sync: {new Date(doc.lastSyncedAt).toLocaleDateString("pt-PT")}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {doc.googleDocsUrl && (
                    <a
                      href={doc.googleDocsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Abrir no Google Docs"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <button
                    onClick={() => deleteDoc.mutate(doc.id)}
                    className="rounded-lg border p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    title="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Document Dialog */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Adicionar Documento</h2>
              <button onClick={() => setShowAdd(false)} className="rounded-lg p-1 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createDoc.mutate({
                  title: newDoc.title,
                  pillar: newDoc.pillar,
                  googleDocsUrl: newDoc.googleDocsUrl || undefined,
                  clientId: newDoc.clientId || undefined,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium">Titulo *</label>
                <input
                  type="text"
                  required
                  value={newDoc.title}
                  onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Nome do documento"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Pilar *</label>
                <select
                  required
                  value={newDoc.pillar}
                  onChange={(e) => setNewDoc({ ...newDoc, pillar: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">Selecionar pilar...</option>
                  {PILLARS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Link Google Docs (opcional)</label>
                <input
                  type="url"
                  value={newDoc.googleDocsUrl}
                  onChange={(e) => setNewDoc({ ...newDoc, googleDocsUrl: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="https://docs.google.com/document/d/..."
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Cola o link do Google Docs para manter sincronizado
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Cliente (opcional)</label>
                <select
                  value={newDoc.clientId}
                  onChange={(e) => setNewDoc({ ...newDoc, clientId: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">Sem cliente</option>
                  {clients.data?.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createDoc.isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
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
