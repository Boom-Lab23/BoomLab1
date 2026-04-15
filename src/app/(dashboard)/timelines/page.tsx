"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Plus, ChevronRight, Calendar, Layers, X } from "lucide-react";

export default function TimelinesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newClientId, setNewClientId] = useState("");

  const timelines = trpc.timelines.list.useQuery({});
  const clients = trpc.clients.list.useQuery({});
  const utils = trpc.useUtils();

  const createTimeline = trpc.timelines.create.useMutation({
    onSuccess: () => {
      utils.timelines.list.invalidate();
      setShowCreate(false);
      setNewTitle("");
      setNewClientId("");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Timelines</h1>
          <p className="text-muted-foreground">Timelines de projeto por cliente</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Nova Timeline
        </button>
      </div>

      {/* Timelines List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {timelines.isLoading && <p className="text-sm text-muted-foreground col-span-3">A carregar...</p>}
        {timelines.data?.length === 0 && !timelines.isLoading && (
          <div className="col-span-3 flex flex-col items-center gap-3 p-12 text-muted-foreground rounded-xl border bg-card">
            <Layers className="h-10 w-10 text-muted-foreground/30" />
            <p className="font-medium">Sem timelines</p>
            <p className="text-sm">Cria uma timeline para apresentar o projeto ao cliente.</p>
          </div>
        )}
        {timelines.data?.map((timeline) => (
          <Link
            key={timeline.id}
            href={`/timelines/${timeline.id}`}
            className="rounded-xl border bg-card p-5 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2D76FC]/10">
                <Layers className="h-5 w-5 text-[#2D76FC]" />
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="font-semibold">{timeline.title}</p>
            <p className="text-sm text-muted-foreground">{timeline.client.name}</p>
            <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
              <span>{timeline.phases.length} fases</span>
              <span>{timeline.phases.reduce((acc, p) => acc + p.modules.length, 0)} modulos</span>
              <span>{timeline.phases.reduce((acc, p) => acc + p.modules.reduce((a, m) => a + m.sessions.length, 0), 0)} sessoes</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Create Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 animate-scale-in">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Nova Timeline</h2>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); createTimeline.mutate({ clientId: newClientId, title: newTitle }); }} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Cliente *</label>
                <select required value={newClientId} onChange={(e) => {
                  setNewClientId(e.target.value);
                  const client = clients.data?.find(c => c.id === e.target.value);
                  if (client) setNewTitle(`Timeline ${client.name}`);
                }} className="w-full rounded-lg border px-3 py-2 text-sm bg-card">
                  <option value="">Selecionar...</option>
                  {clients.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Titulo *</label>
                <input type="text" required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" placeholder="Timeline NomeCliente" />
              </div>
              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={createTimeline.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                  {createTimeline.isPending ? "A criar..." : "Criar Timeline"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
