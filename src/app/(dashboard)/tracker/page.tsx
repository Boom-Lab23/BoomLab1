"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Plus, X, Clock, CheckCircle2, Circle, AlertTriangle, Trash2, Pencil,
  Target, TrendingUp, ListChecks, Calendar as CalendarIcon,
} from "lucide-react";

const CATEGORIES: { value: string; label: string; color: string }[] = [
  { value: "PROSPECAO", label: "Prospecao", color: "text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40" },
  { value: "FOLLOW_UP", label: "Follow-up", color: "text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/40" },
  { value: "REUNIAO", label: "Reuniao", color: "text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40" },
  { value: "ADMIN", label: "Admin", color: "text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-900/40" },
  { value: "OUTROS", label: "Outros", color: "text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900/40" },
];

const PRIORITIES: { value: string; label: string; color: string; order: number }[] = [
  { value: "URGENTE", label: "Urgente", color: "text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40", order: 4 },
  { value: "ALTA", label: "Alta", color: "text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/40", order: 3 },
  { value: "MEDIA", label: "Media", color: "text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/40", order: 2 },
  { value: "BAIXA", label: "Baixa", color: "text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900/40", order: 1 },
];

const STATUSES: { value: string; label: string; color: string }[] = [
  { value: "POR_FAZER", label: "Por fazer", color: "text-muted-foreground" },
  { value: "EM_CURSO", label: "Em curso", color: "text-blue-600 dark:text-blue-400" },
  { value: "FEITO", label: "Feito", color: "text-green-600 dark:text-green-400" },
  { value: "CANCELADO", label: "Cancelado", color: "text-red-600 dark:text-red-400" },
];

export default function TrackerPage() {
  const { data: session } = useSession();
  const userId = (session?.user as Record<string, unknown>)?.id as string | undefined;

  const [filter, setFilter] = useState<"all" | "active" | "today" | "overdue" | "done">("active");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "OUTROS",
    priority: "MEDIA",
    deadline: "",
    notes: "",
  });

  const tasks = trpc.tracker.list.useQuery(
    { userId: userId ?? "", includeCompleted: filter !== "active" },
    { enabled: !!userId }
  );
  const stats = trpc.tracker.stats.useQuery(
    { userId: userId ?? "" },
    { enabled: !!userId }
  );
  const utils = trpc.useUtils();

  const createTask = trpc.tracker.create.useMutation({
    onSuccess: () => {
      utils.tracker.list.invalidate();
      utils.tracker.stats.invalidate();
      setShowCreate(false);
      setForm({ title: "", description: "", category: "OUTROS", priority: "MEDIA", deadline: "", notes: "" });
    },
  });
  const updateTask = trpc.tracker.update.useMutation({
    onSuccess: () => {
      utils.tracker.list.invalidate();
      utils.tracker.stats.invalidate();
      setEditingId(null);
    },
  });
  const deleteTask = trpc.tracker.delete.useMutation({
    onSuccess: () => {
      utils.tracker.list.invalidate();
      utils.tracker.stats.invalidate();
    },
  });
  const toggleStatus = trpc.tracker.toggleStatus.useMutation({
    onSuccess: () => {
      utils.tracker.list.invalidate();
      utils.tracker.stats.invalidate();
    },
  });

  if (!userId) return null;

  // Apply client-side filter and sort
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let filtered = tasks.data ?? [];
  if (filter === "active") {
    filtered = filtered.filter((t) => t.status !== "FEITO" && t.status !== "CANCELADO");
  } else if (filter === "today") {
    filtered = filtered.filter((t) => {
      if (!t.deadline) return false;
      const d = new Date(t.deadline);
      return d >= today && d < tomorrow;
    });
  } else if (filter === "overdue") {
    filtered = filtered.filter((t) => t.status !== "FEITO" && t.status !== "CANCELADO" && t.deadline && new Date(t.deadline) < now);
  } else if (filter === "done") {
    filtered = filtered.filter((t) => t.status === "FEITO");
  }

  // Sort: status (active first), then priority (URGENTE first), then deadline
  const priorityRank: Record<string, number> = { URGENTE: 4, ALTA: 3, MEDIA: 2, BAIXA: 1 };
  const statusRank: Record<string, number> = { EM_CURSO: 0, POR_FAZER: 1, FEITO: 2, CANCELADO: 3 };
  filtered = [...filtered].sort((a, b) => {
    const sa = statusRank[a.status] ?? 99;
    const sb = statusRank[b.status] ?? 99;
    if (sa !== sb) return sa - sb;
    const pa = priorityRank[a.priority] ?? 0;
    const pb = priorityRank[b.priority] ?? 0;
    if (pa !== pb) return pb - pa;
    if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });

  // Stats
  const byStatus = stats.data?.byStatus ?? [];
  const todoCount = byStatus.find((s) => s.status === "POR_FAZER")?._count ?? 0;
  const inProgressCount = byStatus.find((s) => s.status === "EM_CURSO")?._count ?? 0;
  const overdueCount = stats.data?.overdue ?? 0;
  const todayDone = stats.data?.todayDone ?? 0;

  function openEdit(task: typeof filtered[number]) {
    setEditingId(task.id);
    setForm({
      title: task.title,
      description: task.description ?? "",
      category: task.category,
      priority: task.priority,
      deadline: task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : "",
      notes: task.notes ?? "",
    });
    setShowCreate(true);
  }

  function submitForm(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      title: form.title,
      description: form.description || undefined,
      category: form.category as "PROSPECAO" | "FOLLOW_UP" | "REUNIAO" | "ADMIN" | "OUTROS",
      priority: form.priority as "BAIXA" | "MEDIA" | "ALTA" | "URGENTE",
      deadline: form.deadline ? new Date(form.deadline) : null,
      notes: form.notes || undefined,
    };
    if (editingId) {
      updateTask.mutate({ id: editingId, data });
    } else {
      createTask.mutate({ userId, ...data });
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-primary" /> Accountability Tracker
          </h1>
          <p className="text-sm text-muted-foreground">Regista e acompanha as tuas tarefas diarias.</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setForm({ title: "", description: "", category: "OUTROS", priority: "MEDIA", deadline: "", notes: "" });
            setShowCreate(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Nova tarefa
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Circle className="h-3.5 w-3.5" /> Por fazer</div>
          <p className="text-2xl font-bold mt-1">{todoCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5 text-blue-600" /> Em curso</div>
          <p className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">{inProgressCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5 text-red-600" /> Atrasadas</div>
          <p className="text-2xl font-bold mt-1 text-red-600 dark:text-red-400">{overdueCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Feitas hoje</div>
          <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">{todayDone}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 rounded-lg border bg-muted/50 p-1 overflow-x-auto">
        {([
          { key: "active", label: "Activas", icon: Target },
          { key: "today", label: "Hoje", icon: CalendarIcon },
          { key: "overdue", label: "Atrasadas", icon: AlertTriangle },
          { key: "done", label: "Feitas", icon: CheckCircle2 },
          { key: "all", label: "Todas", icon: ListChecks },
        ] as const).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap",
              filter === f.key ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <f.icon className="h-3.5 w-3.5" /> {f.label}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="rounded-xl border bg-card divide-y">
        {tasks.isLoading && <div className="p-8 text-center text-muted-foreground">A carregar...</div>}
        {!tasks.isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-12 text-muted-foreground">
            <ListChecks className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm font-medium">Sem tarefas</p>
            <p className="text-xs">Clica em &quot;Nova tarefa&quot; para comecar.</p>
          </div>
        )}
        {filtered.map((task) => {
          const cat = CATEGORIES.find((c) => c.value === task.category);
          const pri = PRIORITIES.find((p) => p.value === task.priority);
          const overdue = task.deadline && new Date(task.deadline) < now && task.status !== "FEITO" && task.status !== "CANCELADO";
          const done = task.status === "FEITO";
          return (
            <div key={task.id} className="flex items-start gap-3 p-3 hover:bg-muted/40 group">
              <button
                onClick={() => toggleStatus.mutate({ id: task.id, status: done ? "POR_FAZER" : "FEITO" })}
                className="mt-0.5 shrink-0 rounded-full p-1 hover:bg-muted"
                title={done ? "Marcar como por fazer" : "Marcar como feito"}
              >
                {done ? <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={cn("font-medium", done && "line-through text-muted-foreground")}>{task.title}</p>
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", cat?.color)}>{cat?.label}</span>
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", pri?.color)}>{pri?.label}</span>
                  {task.status === "EM_CURSO" && (
                    <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">Em curso</span>
                  )}
                </div>
                {task.description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{task.description}</p>}
                <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                  {task.deadline && (
                    <span className={cn("flex items-center gap-1", overdue && "text-red-600 dark:text-red-400 font-medium")}>
                      <CalendarIcon className="h-3 w-3" />
                      {new Date(task.deadline).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}
                      {overdue && " · atrasada"}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {task.status !== "EM_CURSO" && task.status !== "FEITO" && (
                  <button
                    onClick={() => toggleStatus.mutate({ id: task.id, status: "EM_CURSO" })}
                    className="rounded p-1 text-muted-foreground hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-600"
                    title="Marcar em curso"
                  >
                    <Clock className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => openEdit(task)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted"
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Apagar tarefa "${task.title}"?`)) deleteTask.mutate({ id: task.id });
                  }}
                  className="rounded p-1 text-muted-foreground hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600"
                  title="Apagar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / edit dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{editingId ? "Editar tarefa" : "Nova tarefa"}</h2>
              <button onClick={() => { setShowCreate(false); setEditingId(null); }} className="rounded-lg p-1 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={submitForm} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Titulo *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-card"
                  placeholder="Ex: Ligar ao Dr. Silva sobre credito habitacao"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Descricao</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-card resize-none"
                  placeholder="Detalhes adicionais..."
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium">Categoria</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm bg-card"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Prioridade</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm bg-card"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Prazo (opcional)</label>
                <input
                  type="datetime-local"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-card"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Notas</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-card resize-none"
                  placeholder="Notas privadas..."
                />
              </div>

              {(createTask.error || updateTask.error) && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  Erro: {createTask.error?.message ?? updateTask.error?.message}
                </p>
              )}

              <div className="flex justify-end gap-3 border-t pt-3">
                <button type="button" onClick={() => { setShowCreate(false); setEditingId(null); }} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={createTask.isPending || updateTask.isPending || !form.title.trim()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                  {createTask.isPending || updateTask.isPending ? "A guardar..." : editingId ? "Guardar" : "Criar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
