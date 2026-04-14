"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PILLARS } from "@/lib/utils";
import { X } from "lucide-react";

const SESSION_TOPICS: Record<string, string[]> = {
  "gestao-comercial": [
    "Overview",
    "Metricas e Dashboard",
    "Comunicacao Interna e Accountability",
  ],
  "consultoria-comercial": [
    "Jornada da Lead",
    "Sistema de Nutricao",
    "Frameworks das Reunioes",
    "Reativacao de Leads",
    "Ciclo de Vendas",
  ],
  parcerias: [
    "Processo Comercial e Prospeccao",
    "Leadscrapping e Pre-qualificacao",
    "Estrutura Cold Call e Spreadsheets",
    "Analise de Chamadas e Roleplay",
    "Overview c/ CEO",
  ],
  "ads-funnel": [
    "Delinear Funil",
    "Setup c/ Gestor de Trafego",
    "Overview Pre-campanhas",
    "Overview e Analise do Funil",
  ],
  "cold-calls": [
    "Processo Comercial",
    "Estrutura da Cold Call",
    "Leadscrapping e Pre-qualificacao",
    "Dashboard e Formacao de Vendas",
    "Overview e Formacao de Vendas",
  ],
  "linkedin-outreach": [
    "Overview e Setup Waalaxy",
    "Analisar Respostas e Follow-ups",
    "Overview",
  ],
  acompanhamento: ["Acompanhamento Semanal"],
};

export function CreateSessionDialog({
  open,
  onClose,
  defaultClientId,
}: {
  open: boolean;
  onClose: () => void;
  defaultClientId?: string;
}) {
  const utils = trpc.useUtils();
  const clients = trpc.clients.list.useQuery({});
  const createSession = trpc.sessions.create.useMutation({
    onSuccess: () => {
      utils.sessions.list.invalidate();
      utils.sessions.upcoming.invalidate();
      onClose();
      setForm(initialForm);
    },
  });

  const initialForm = {
    title: "",
    module: "",
    topic: "",
    date: "",
    time: "",
    status: "POR_AGENDAR",
    clientId: defaultClientId ?? "",
    notes: "",
  };

  const [form, setForm] = useState(initialForm);

  const topics = form.module ? SESSION_TOPICS[form.module] ?? [] : [];

  if (!open) return null;

  function handleModuleChange(module: string) {
    const pillar = PILLARS.find((p) => p.id === module);
    setForm({
      ...form,
      module,
      topic: "",
      title: pillar ? `${pillar.label}` : "",
    });
  }

  function handleTopicChange(topic: string) {
    const pillar = PILLARS.find((p) => p.id === form.module);
    setForm({
      ...form,
      topic,
      title: pillar ? `${pillar.label} - ${topic}` : topic,
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dateTime = form.date && form.time
      ? new Date(`${form.date}T${form.time}`)
      : form.date
        ? new Date(form.date)
        : undefined;

    createSession.mutate({
      title: form.title,
      module: form.module,
      topic: form.topic || undefined,
      date: dateTime,
      status: form.status,
      clientId: form.clientId,
      notes: form.notes || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Nova Sessao</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          {/* Module (Pillar) */}
          <div>
            <label className="mb-1 block text-sm font-medium">Pilar / Modulo *</label>
            <div className="flex flex-wrap gap-2">
              {PILLARS.filter((p) => p.id !== "boom-club").map((pillar) => (
                <button
                  key={pillar.id}
                  type="button"
                  onClick={() => handleModuleChange(pillar.id)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    form.module === pillar.id
                      ? "text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                  style={form.module === pillar.id ? { backgroundColor: pillar.color } : undefined}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: form.module === pillar.id ? "white" : pillar.color }}
                  />
                  {pillar.label}
                </button>
              ))}
            </div>
          </div>

          {/* Topic */}
          {topics.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium">Tema</label>
              <select
                value={form.topic}
                onChange={(e) => handleTopicChange(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">Selecionar tema...</option>
                {topics.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}

          {/* Title (auto-generated but editable) */}
          <div>
            <label className="mb-1 block text-sm font-medium">Titulo *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Ex: Consultoria Comercial S1"
            />
          </div>

          {/* Date and Time */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Data</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Hora</label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="mb-1 block text-sm font-medium">Estado</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="POR_AGENDAR">Por agendar</option>
              <option value="MARCADA">Marcada</option>
              <option value="AGUARDAR_CONFIRMACAO">Aguardar Confirmacao</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium">Notas (opcional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              rows={3}
              placeholder="Notas previas para a sessao..."
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 border-t pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createSession.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {createSession.isPending ? "A criar..." : "Criar Sessao"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
