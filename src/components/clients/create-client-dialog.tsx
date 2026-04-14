"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { X } from "lucide-react";

const CORE_BUSINESS_OPTIONS = [
  "Intermediacao de Credito",
  "Mediacao de Seguros",
  "Agencia Imobiliaria",
  "Agencia de Consultoria",
];

const OFFER_OPTIONS = ["Consultoria", "IA", "Mentoria", "BoomClub"];

export function CreateClientDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const createClient = trpc.clients.create.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate();
      utils.clients.stats.invalidate();
      onClose();
      setForm(initialForm);
    },
  });

  const initialForm = {
    name: "",
    ceo: "",
    email: "",
    phone: "",
    coreBusiness: "",
    composition: "",
    painPoints: "",
    projectDuration: "",
    projectStart: "",
    projectEnd: "",
    status: "PRE_ARRANQUE",
    offer: [] as string[],
    risk: "",
    ticket: "",
    billing: "",
    expectations: "",
    salesConsulting: false,
  };

  const [form, setForm] = useState(initialForm);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createClient.mutate({
      name: form.name,
      ceo: form.ceo || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      coreBusiness: form.coreBusiness || undefined,
      composition: form.composition || undefined,
      painPoints: form.painPoints || undefined,
      projectDuration: form.projectDuration || undefined,
      projectStart: form.projectStart ? new Date(form.projectStart) : undefined,
      projectEnd: form.projectEnd ? new Date(form.projectEnd) : undefined,
      status: form.status,
      offer: form.offer,
      risk: form.risk || undefined,
      ticket: form.ticket ? parseFloat(form.ticket) : undefined,
      billing: form.billing ? parseFloat(form.billing) : undefined,
      expectations: form.expectations || undefined,
      salesConsulting: form.salesConsulting,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Novo Cliente</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome e CEO */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Nome da Empresa *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Ex: Finitaipas"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">CEO</label>
              <input
                type="text"
                value={form.ceo}
                onChange={(e) => setForm({ ...form, ceo: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Email e Telefone */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Contacto</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Core Business e Composicao */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Core Business</label>
              <select
                value={form.coreBusiness}
                onChange={(e) => setForm({ ...form, coreBusiness: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">Selecionar...</option>
                {CORE_BUSINESS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Composicao da Empresa</label>
              <input
                type="text"
                value={form.composition}
                onChange={(e) => setForm({ ...form, composition: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Ex: 2 pessoas"
              />
            </div>
          </div>

          {/* Dores */}
          <div>
            <label className="mb-1 block text-sm font-medium">Dores e Necessidades</label>
            <textarea
              value={form.painPoints}
              onChange={(e) => setForm({ ...form, painPoints: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              rows={2}
            />
          </div>

          {/* Datas e Duracao */}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Inicio Projeto</label>
              <input
                type="date"
                value={form.projectStart}
                onChange={(e) => setForm({ ...form, projectStart: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Fim Projeto</label>
              <input
                type="date"
                value={form.projectEnd}
                onChange={(e) => setForm({ ...form, projectEnd: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Duracao</label>
              <input
                type="text"
                value={form.projectDuration}
                onChange={(e) => setForm({ ...form, projectDuration: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Ex: 3 meses"
              />
            </div>
          </div>

          {/* Offer (multi-select) */}
          <div>
            <label className="mb-1 block text-sm font-medium">Offer</label>
            <div className="flex flex-wrap gap-2">
              {OFFER_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm cursor-pointer hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={form.offer.includes(opt)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setForm({ ...form, offer: [...form.offer, opt] });
                      } else {
                        setForm({ ...form, offer: form.offer.filter((o) => o !== opt) });
                      }
                    }}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          {/* Status, Risco, Ticket */}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Estado</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="FECHADO">Fechado</option>
                <option value="COBRADO">Cobrado</option>
                <option value="PRE_ARRANQUE">Pre-arranque</option>
                <option value="LEVANTAMENTO">Levantamento</option>
                <option value="APRESENTACAO_TIMELINE">Apresentacao Timeline</option>
                <option value="ATIVO">Ativo</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Risco</label>
              <select
                value={form.risk}
                onChange={(e) => setForm({ ...form, risk: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">Sem risco</option>
                <option value="BAIXO">Baixo</option>
                <option value="MEDIO">Medio</option>
                <option value="ALTO">Alto</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Ticket (EUR)</label>
              <input
                type="number"
                value={form.ticket}
                onChange={(e) => setForm({ ...form, ticket: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Expectativas */}
          <div>
            <label className="mb-1 block text-sm font-medium">Expectativas e Acordos</label>
            <textarea
              value={form.expectations}
              onChange={(e) => setForm({ ...form, expectations: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              rows={2}
            />
          </div>

          {/* Consultoria de Vendas */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.salesConsulting}
              onChange={(e) => setForm({ ...form, salesConsulting: e.target.checked })}
            />
            Consultoria de Vendas
          </label>

          {/* Submit */}
          <div className="flex justify-end gap-3 border-t pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createClient.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {createClient.isPending ? "A criar..." : "Criar Cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
