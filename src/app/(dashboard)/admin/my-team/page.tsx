"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, UserPlus, Trash2, Loader2 } from "lucide-react";

export default function MyTeamPage() {
  const { data: authSession } = useSession();
  const role = (authSession?.user as Record<string, unknown> | undefined)?.role as string | undefined;
  const isClient = role === "GUEST_CLIENT";

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "" });

  const utils = trpc.useUtils();
  const team = trpc.admin.myTeamList.useQuery(undefined, { enabled: isClient });
  const addMember = trpc.admin.myTeamAdd.useMutation({
    onSuccess: () => {
      utils.admin.myTeamList.invalidate();
      setShowAdd(false);
      setForm({ name: "", email: "" });
    },
  });
  const removeMember = trpc.admin.myTeamRemove.useMutation({
    onSuccess: () => utils.admin.myTeamList.invalidate(),
  });

  if (!authSession) {
    return <div className="p-8 text-center text-muted-foreground">A carregar...</div>;
  }

  if (!isClient) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Esta pagina e para clientes (GUEST_CLIENT) gerirem a sua equipa.</p>
        <Link href="/" className="mt-4 inline-block text-primary hover:underline">Voltar ao dashboard</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">A minha equipa</h1>
          <p className="text-muted-foreground">Adiciona e gere os membros da tua equipa que vao ter acesso a plataforma.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <UserPlus className="h-4 w-4" /> Adicionar membro
        </button>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-semibold">Membros ({team.data?.length ?? 0})</h2>
        </div>
        <div className="divide-y">
          {team.isLoading && (
            <div className="p-6 text-center text-sm text-muted-foreground">A carregar...</div>
          )}
          {team.data?.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Sem membros adicionados. Clica em &quot;Adicionar membro&quot; para comecar.
            </div>
          )}
          {team.data?.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{m.name}</p>
                <p className="text-sm text-muted-foreground">{m.email}</p>
                <p className="text-xs text-muted-foreground">Adicionado a {new Date(m.createdAt).toLocaleDateString("pt-PT")}</p>
              </div>
              <button
                onClick={() => {
                  if (confirm(`Remover ${m.name} da tua equipa? O acesso a plataforma sera desactivado.`)) {
                    removeMember.mutate({ userId: m.id });
                  }
                }}
                disabled={removeMember.isPending}
                className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remover
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Adicionar Membro */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">Adicionar membro da equipa</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addMember.mutate(form);
              }}
              className="space-y-3"
            >
              <div>
                <label className="mb-1 block text-xs font-medium">Nome *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border bg-card px-3 py-2 text-sm"
                  placeholder="Joao Silva"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Email *</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-lg border bg-card px-3 py-2 text-sm"
                  placeholder="joao@empresa.pt"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Vai receber email de boas-vindas com password temporaria.
                </p>
              </div>
              {addMember.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  {addMember.error.message}
                </div>
              )}
              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addMember.isPending}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {addMember.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> A adicionar...</> : "Adicionar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
