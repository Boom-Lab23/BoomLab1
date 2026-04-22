"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { X, Upload, Mic } from "lucide-react";

export function UploadCallDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const clients = trpc.clients.list.useQuery({});
  const createRecording = trpc.recordings.create.useMutation({
    onSuccess: () => {
      utils.recordings.list.invalidate();
      onClose();
      setForm(initialForm);
    },
  });

  const initialForm = {
    title: "",
    type: "CALL" as "CALL" | "MEETING",
    clientId: "",
    transcript: "",
    scriptName: "",
    duration: "",
  };

  const [form, setForm] = useState(initialForm);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createRecording.mutate({
      title: form.title,
      type: form.type,
      clientId: form.clientId,
      transcript: form.transcript || undefined,
      scriptName: form.scriptName || undefined,
      duration: form.duration ? parseInt(form.duration) * 60 : undefined,
      fileUrl: "pending-upload", // placeholder - will be replaced by actual upload
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Upload de Chamada</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="mb-1 block text-sm font-medium">Titulo *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Ex: Cold Call - Parceiro X"
            />
          </div>

          {/* Type + Duration */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Tipo</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as "CALL" | "MEETING" })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="CALL">Chamada</option>
                <option value="MEETING">Reuniao</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Duracao (minutos)</label>
              <input
                type="number"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Ex: 15"
              />
            </div>
          </div>

          {/* Client */}
          <div>
            <label className="mb-1 block text-sm font-medium">Cliente *</label>
            <select
              required
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">Selecionar cliente...</option>
              {clients.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Script name */}
          <div>
            <label className="mb-1 block text-sm font-medium">Script de Avaliacao (opcional)</label>
            <input
              type="text"
              value={form.scriptName}
              onChange={(e) => setForm({ ...form, scriptName: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Nome do script (ex: Cold Call Parcerias)"
            />
          </div>

          {/* File upload area */}
          <div>
            <label className="mb-1 block text-sm font-medium">Ficheiro de Audio</label>
            <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-8">
              <div className="text-center">
                <Upload className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Arrasta o ficheiro ou clica para selecionar
                </p>
                <p className="text-xs text-muted-foreground">MP3, WAV, M4A, WebM (max 500MB)</p>
              </div>
            </div>
          </div>

          {/* Transcript (paste manually or auto-generated) */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              Transcricao
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                (cola aqui ou sera gerada automaticamente)
              </span>
            </label>
            <textarea
              value={form.transcript}
              onChange={(e) => setForm({ ...form, transcript: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
              rows={8}
              placeholder="Cola a transcricao da chamada aqui...&#10;&#10;A IA vai analisar automaticamente assim que submeteres."
            />
          </div>

          {/* Info box */}
          <div className="rounded-lg bg-purple-50 dark:bg-purple-950/30 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-purple-800 dark:text-purple-300">
              <Mic className="h-4 w-4" />
              Analise IA Automatica
            </div>
            <p className="mt-1 text-xs text-purple-600 dark:text-purple-400">
              Assim que a transcricao estiver disponivel, a IA analisa automaticamente a chamada
              contra o script de vendas, dando score, pontos fortes, areas de melhoria e dicas de coaching.
            </p>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 border-t pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createRecording.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {createRecording.isPending ? "A submeter..." : "Submeter e Analisar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
