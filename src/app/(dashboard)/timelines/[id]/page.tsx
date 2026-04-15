"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Plus, X, Calendar, Trash2, Edit2, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TimelineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const timeline = trpc.timelines.getById.useQuery(id);
  const utils = trpc.useUtils();

  const [showAddPhase, setShowAddPhase] = useState(false);
  const [phaseForm, setPhaseForm] = useState({ title: "", startDate: "", endDate: "" });
  const [showAddModule, setShowAddModule] = useState<string | null>(null);
  const [moduleForm, setModuleForm] = useState({ title: "", consultantName: "", consultantRole: "" });
  const [showAddSession, setShowAddSession] = useState<string | null>(null);
  const [sessionForm, setSessionForm] = useState({ subtitle: "", description: "", topics: "" });
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [editSessionForm, setEditSessionForm] = useState({ subtitle: "", description: "", topics: "" });

  const addPhase = trpc.timelines.addPhase.useMutation({ onSuccess: () => { utils.timelines.getById.invalidate(); setShowAddPhase(false); setPhaseForm({ title: "", startDate: "", endDate: "" }); } });
  const addModule = trpc.timelines.addModule.useMutation({ onSuccess: () => { utils.timelines.getById.invalidate(); setShowAddModule(null); setModuleForm({ title: "", consultantName: "", consultantRole: "" }); } });
  const addSession = trpc.timelines.addSession.useMutation({ onSuccess: () => { utils.timelines.getById.invalidate(); setShowAddSession(null); setSessionForm({ subtitle: "", description: "", topics: "" }); } });
  const updateSession = trpc.timelines.updateSession.useMutation({ onSuccess: () => { utils.timelines.getById.invalidate(); setEditingSession(null); } });
  const deleteTimeline = trpc.timelines.delete.useMutation({ onSuccess: () => router.push("/timelines") });
  const deletePhase = trpc.timelines.deletePhase.useMutation({ onSuccess: () => utils.timelines.getById.invalidate() });

  if (timeline.isLoading) return <div className="p-8 text-center text-muted-foreground">A carregar...</div>;
  if (!timeline.data) return <div className="p-8 text-center text-muted-foreground">Timeline nao encontrada</div>;

  const t = timeline.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/timelines" className="rounded-lg p-2 hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-muted-foreground">{t.client.name} &middot; {t.phases.length} fases</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddPhase(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Fase
          </button>
          <button
            onClick={() => { if (confirm("Eliminar esta timeline e todas as fases?")) deleteTimeline.mutate(id); }}
            className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Timeline Phases */}
      {t.phases.map((phase) => (
        <div key={phase.id} className="space-y-4">
          {/* Phase Header */}
          <div className="relative rounded-2xl p-8 text-center" style={{ background: "linear-gradient(135deg, #0a1628 0%, #132040 50%, #0d1a30 100%)" }}>
            {/* Phase actions */}
            <div className="absolute top-3 right-3 flex gap-1">
              <button
                onClick={() => { if (confirm("Eliminar Fase " + phase.number + " e todo o conteudo?")) deletePhase.mutate(phase.id); }}
                className="rounded p-1.5 text-gray-500 hover:text-red-400 hover:bg-white/10"
                title="Eliminar fase"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs tracking-widest uppercase text-[#2D76FC] mb-2">BoomLab</p>
            <h2 className="text-4xl font-bold text-white mb-3">Fase {phase.number}</h2>
            <p className="text-lg text-gray-300">{phase.title}</p>
            {phase.startDate && phase.endDate && (
              <p className="mt-3 text-sm">
                <span className="text-[#2D76FC] font-semibold">Timeline</span>
                <span className="text-gray-300">: {new Date(phase.startDate).toLocaleDateString("pt-PT")} - {new Date(phase.endDate).toLocaleDateString("pt-PT")}</span>
              </p>
            )}
          </div>

          {/* Modules */}
          {phase.modules.map((mod) => (
            <div key={mod.id} className="rounded-2xl p-6 md:p-8" style={{ background: "linear-gradient(135deg, #0a1628 0%, #0f1d35 100%)" }}>
              <p className="text-lg font-bold text-white mb-4">{mod.title}</p>
              {mod.consultantName && (
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-700 text-white text-sm font-semibold">
                    {mod.consultantName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-white font-medium">{mod.consultantName}</p>
                    {mod.consultantRole && <p className="text-sm"><span className="text-gray-400">Consultor </span><span className="text-[#2D76FC]">{mod.consultantRole}</span></p>}
                  </div>
                </div>
              )}

              {/* Sessions grid */}
              <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
                {mod.sessions.map((sess) => (
                  <div key={sess.id} className="group relative">
                    {/* Session actions */}
                    <div className="absolute top-0 right-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditingSession(sess.id); setEditSessionForm({ subtitle: sess.subtitle ?? "", description: sess.description ?? "", topics: sess.topics.join("\n") }); }}
                        className="rounded p-1 text-gray-500 hover:text-[#2D76FC] hover:bg-white/10"
                        title="Editar"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                    </div>

                    <span className="inline-block rounded bg-[#2D76FC] px-3 py-1 text-sm font-semibold text-white mb-3">
                      Sessao {sess.number}
                    </span>
                    {sess.subtitle && <p className="text-[#2D76FC] text-sm font-medium mb-1">{sess.subtitle}</p>}
                    {sess.description && <p className="text-gray-400 text-sm mb-2">{sess.description}</p>}
                    <ul className="space-y-1">
                      {sess.topics.map((topic, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                          <span className="mt-1.5 h-1 w-1 rounded-full bg-gray-500 shrink-0" />
                          {topic}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                <button onClick={() => setShowAddSession(mod.id)} className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-600 p-6 text-sm text-gray-500 hover:border-[#2D76FC] hover:text-[#2D76FC] transition-colors">
                  <Plus className="h-4 w-4" /> Sessao
                </button>
              </div>
            </div>
          ))}

          <button onClick={() => setShowAddModule(phase.id)} className="w-full rounded-xl border border-dashed border-muted-foreground/20 p-4 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
            <Plus className="inline h-4 w-4 mr-1" /> Modulo na Fase {phase.number}
          </button>
        </div>
      ))}

      {t.phases.length === 0 && (
        <div className="rounded-2xl p-12 text-center" style={{ background: "linear-gradient(135deg, #0a1628 0%, #132040 100%)" }}>
          <Calendar className="mx-auto h-12 w-12 text-gray-600 mb-3" />
          <p className="text-lg font-medium text-white">Comeca por adicionar uma fase</p>
          <p className="text-sm text-gray-400 mt-1">Cada fase tem modulos e sessoes.</p>
        </div>
      )}

      {/* ===== DIALOGS ===== */}

      {showAddPhase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 animate-scale-in">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Nova Fase</h2>
              <button onClick={() => setShowAddPhase(false)} className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); addPhase.mutate({ timelineId: id, number: t.phases.length + 1, title: phaseForm.title, startDate: phaseForm.startDate ? new Date(phaseForm.startDate) : undefined, endDate: phaseForm.endDate ? new Date(phaseForm.endDate) : undefined }); }} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Titulo *</label>
                <input type="text" required value={phaseForm.title} onChange={(e) => setPhaseForm({ ...phaseForm, title: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" placeholder="Ex: Analise estrategica + gestao comercial" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-1 block text-sm font-medium">Inicio</label><input type="date" value={phaseForm.startDate} onChange={(e) => setPhaseForm({ ...phaseForm, startDate: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" /></div>
                <div><label className="mb-1 block text-sm font-medium">Fim</label><input type="date" value={phaseForm.endDate} onChange={(e) => setPhaseForm({ ...phaseForm, endDate: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" /></div>
              </div>
              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setShowAddPhase(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={addPhase.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">Criar Fase</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddModule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 animate-scale-in">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Novo Modulo</h2>
              <button onClick={() => setShowAddModule(null)} className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); addModule.mutate({ phaseId: showAddModule, title: moduleForm.title, consultantName: moduleForm.consultantName || undefined, consultantRole: moduleForm.consultantRole || undefined }); }} className="space-y-4">
              <div><label className="mb-1 block text-sm font-medium">Titulo *</label><input type="text" required value={moduleForm.title} onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" placeholder="Ex: Consultoria comercial" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-1 block text-sm font-medium">Consultor</label><input type="text" value={moduleForm.consultantName} onChange={(e) => setModuleForm({ ...moduleForm, consultantName: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" /></div>
                <div><label className="mb-1 block text-sm font-medium">Role</label><input type="text" value={moduleForm.consultantRole} onChange={(e) => setModuleForm({ ...moduleForm, consultantRole: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" placeholder="Ex: Vendas" /></div>
              </div>
              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setShowAddModule(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={addModule.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">Criar Modulo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 animate-scale-in">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Nova Sessao</h2>
              <button onClick={() => setShowAddSession(null)} className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); const mod = t.phases.flatMap(p => p.modules).find(m => m.id === showAddSession); addSession.mutate({ moduleId: showAddSession, number: (mod?.sessions.length ?? 0) + 1, subtitle: sessionForm.subtitle || undefined, description: sessionForm.description || undefined, topics: sessionForm.topics.split("\n").filter(Boolean) }); }} className="space-y-4">
              <div><label className="mb-1 block text-sm font-medium">Subtitulo</label><input type="text" value={sessionForm.subtitle} onChange={(e) => setSessionForm({ ...sessionForm, subtitle: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" placeholder="Ex: Consultoria estrategica" /></div>
              <div><label className="mb-1 block text-sm font-medium">Descricao</label><input type="text" value={sessionForm.description} onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" placeholder="Ex: Equipa comercial" /></div>
              <div><label className="mb-1 block text-sm font-medium">Topicos (um por linha)</label><textarea value={sessionForm.topics} onChange={(e) => setSessionForm({ ...sessionForm, topics: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" rows={5} placeholder="Topico 1&#10;Topico 2&#10;Topico 3" /></div>
              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setShowAddSession(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={addSession.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">Criar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Session Dialog */}
      {editingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 animate-scale-in">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Editar Sessao</h2>
              <button onClick={() => setEditingSession(null)} className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); updateSession.mutate({ id: editingSession, subtitle: editSessionForm.subtitle || undefined, description: editSessionForm.description || undefined, topics: editSessionForm.topics.split("\n").filter(Boolean) }); }} className="space-y-4">
              <div><label className="mb-1 block text-sm font-medium">Subtitulo</label><input type="text" value={editSessionForm.subtitle} onChange={(e) => setEditSessionForm({ ...editSessionForm, subtitle: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" /></div>
              <div><label className="mb-1 block text-sm font-medium">Descricao</label><input type="text" value={editSessionForm.description} onChange={(e) => setEditSessionForm({ ...editSessionForm, description: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" /></div>
              <div><label className="mb-1 block text-sm font-medium">Topicos (um por linha)</label><textarea value={editSessionForm.topics} onChange={(e) => setEditSessionForm({ ...editSessionForm, topics: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm bg-card" rows={5} /></div>
              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setEditingSession(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={updateSession.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
