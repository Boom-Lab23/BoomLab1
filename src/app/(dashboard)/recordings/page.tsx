"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Mic, Upload, Brain, ChevronRight, BookOpen, Plus, FileText,
  Trash2, X,
} from "lucide-react";
import { UploadCallDialog } from "@/components/recordings/upload-call-dialog";

export default function RecordingsPage() {
  const [filter, setFilter] = useState<"all" | "analyzed" | "pending">("all");
  const [showUpload, setShowUpload] = useState(false);
  const [activeTab, setActiveTab] = useState<"recordings" | "knowledge">("recordings");
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [docForm, setDocForm] = useState({ name: "", pillar: "", content: "" });

  const recordings = trpc.recordings.list.useQuery({
    analyzed: filter === "analyzed" ? true : filter === "pending" ? false : undefined,
  });

  // AI Scripts as knowledge base
  const utils = trpc.useUtils();

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
      {activeTab === "knowledge" && (
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
          </div>

          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Documentos de Referencia</h2>
            <button
              onClick={() => setShowAddDoc(true)}
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
            >
              <Plus className="h-4 w-4" />
              Adicionar Documento
            </button>
          </div>

          {/* Knowledge documents list */}
          <div className="space-y-3">
            {/* Placeholder categories */}
            {[
              { title: "Scripts de Vendas", desc: "Scripts para cold calls, reunioes de venda, follow-ups", icon: "📞", color: "bg-yellow-50 border-yellow-200" },
              { title: "Frameworks de Reuniao", desc: "Estruturas e modelos para conduzir reunioes eficazes", icon: "📋", color: "bg-blue-50 border-blue-200" },
              { title: "Criterios de Avaliacao", desc: "Metricas e criterios para avaliar performance comercial", icon: "📊", color: "bg-green-50 border-green-200" },
              { title: "Materiais de Formacao", desc: "Documentos de formacao para a equipa comercial", icon: "📚", color: "bg-purple-50 border-purple-200" },
            ].map((cat) => (
              <div key={cat.title} className={cn("rounded-xl border p-4", cat.color)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{cat.icon}</span>
                    <div>
                      <p className="font-semibold">{cat.title}</p>
                      <p className="text-sm text-muted-foreground">{cat.desc}</p>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">0 documentos</span>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border bg-card">
            <div className="flex flex-col items-center gap-3 p-8 text-muted-foreground">
              <BookOpen className="h-10 w-10 text-muted-foreground/30" />
              <div className="text-center">
                <p className="font-medium">Comeca por adicionar documentos</p>
                <p className="text-sm">
                  Adiciona scripts de vendas, frameworks de reuniao, criterios de avaliacao e qualquer material
                  que queiras que a IA use como referencia nas analises.
                </p>
              </div>
            </div>
          </div>

          {/* Add Document Dialog */}
          {showAddDoc && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-6 animate-scale-in">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold">Adicionar a Base de Conhecimento</h2>
                  <button onClick={() => setShowAddDoc(false)} className="rounded-lg p-1 hover:bg-muted">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    // TODO: Save to AIScript model
                    setShowAddDoc(false);
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
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      placeholder="Ex: Script Cold Call Parcerias"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Categoria</label>
                    <select
                      value={docForm.pillar}
                      onChange={(e) => setDocForm({ ...docForm, pillar: e.target.value })}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    >
                      <option value="">Selecionar...</option>
                      <option value="scripts-vendas">Scripts de Vendas</option>
                      <option value="frameworks-reuniao">Frameworks de Reuniao</option>
                      <option value="criterios-avaliacao">Criterios de Avaliacao</option>
                      <option value="materiais-formacao">Materiais de Formacao</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Conteudo do Documento *
                    </label>
                    <textarea
                      required
                      value={docForm.content}
                      onChange={(e) => setDocForm({ ...docForm, content: e.target.value })}
                      className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
                      rows={15}
                      placeholder="Cola aqui o conteudo do script, framework ou documento...&#10;&#10;A IA vai usar este conteudo como referencia para analisar chamadas e reunioes."
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Podes colar texto, scripts, criterios de avaliacao, etc. A IA vai usar tudo isto como base para as analises.
                    </p>
                  </div>

                  <div className="flex justify-end gap-3 border-t pt-4">
                    <button type="button" onClick={() => setShowAddDoc(false)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">
                      Cancelar
                    </button>
                    <button type="submit" className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700">
                      Adicionar a Base de Conhecimento
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
