"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  MessageSquare, Hash, Users, Plus, Search, Building2,
  Lock, ChevronRight, X, Rocket,
} from "lucide-react";

export default function MessagingPage() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newChannel, setNewChannel] = useState({ name: "", description: "", clientId: "" });

  const channels = trpc.messaging.channels.useQuery({});
  const clients = trpc.clients.list.useQuery({});
  const utils = trpc.useUtils();

  const createChannel = trpc.messaging.createChannel.useMutation({
    onSuccess: () => {
      utils.messaging.channels.invalidate();
      setShowCreate(false);
      setNewChannel({ name: "", description: "", clientId: "" });
    },
  });

  const allChannels = channels.data ?? [];
  const clientChannels = allChannels.filter((c) => c.type === "CLIENT");
  const boomLabChannel = allChannels.filter((c) => c.type === "TEAM" || c.type === "GENERAL");

  const filteredClients = clientChannels.filter((ch) =>
    search ? ch.name.toLowerCase().includes(search.toLowerCase()) : true
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mensagens</h1>
          <p className="text-muted-foreground">Canais de comunicacao por cliente</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo Canal
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Pesquisar canais..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      {/* BoomLab Internal Channel */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b p-3 px-4">
          <Rocket className="h-4 w-4 text-[#2D76FC]" />
          <h3 className="text-sm font-semibold">BoomLab Interno</h3>
        </div>
        <div className="divide-y">
          {boomLabChannel.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              Cria o canal interno da BoomLab para comunicacao da equipa.
            </div>
          ) : (
            boomLabChannel.map((channel) => {
              const lastMsg = channel.messages[0];
              return (
                <Link
                  key={channel.id}
                  href={`/messaging/${channel.id}`}
                  className="flex items-center gap-3 p-3 px-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2D76FC] text-white text-sm font-semibold">
                    B
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{channel.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {lastMsg ? `${lastMsg.author.name}: ${lastMsg.content.slice(0, 50)}` : "Sem mensagens"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />{channel._count.members}
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Client Channels */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b p-3 px-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#2D76FC]" />
            <h3 className="text-sm font-semibold">Canais de Clientes</h3>
          </div>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{clientChannels.length}</span>
        </div>
        <div className="divide-y">
          {channels.isLoading && (
            <div className="p-8 text-center text-muted-foreground text-sm">A carregar...</div>
          )}
          {filteredClients.length === 0 && !channels.isLoading && (
            <div className="flex flex-col items-center gap-2 p-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm">Sem canais de clientes</p>
              <p className="text-xs">Cria um canal para comecar a comunicar com os clientes.</p>
            </div>
          )}
          {filteredClients.map((channel) => {
            const lastMsg = channel.messages[0];
            return (
              <Link
                key={channel.id}
                href={`/messaging/${channel.id}`}
                className="flex items-center gap-3 p-3 px-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2D76FC]/10 text-[#2D76FC] text-sm font-semibold">
                  {channel.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{channel.name}</p>
                    {channel.isPrivate && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {lastMsg ? `${lastMsg.author.name}: ${lastMsg.content.slice(0, 50)}` : channel.description ?? "Sem mensagens"}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {(channel._count as Record<string, number>).subChannels > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {(channel._count as Record<string, number>).subChannels} sub
                    </span>
                  )}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />{channel._count.members}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Create Channel Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 animate-scale-in">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Novo Canal</h2>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-1 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createChannel.mutate({
                  name: newChannel.name,
                  description: newChannel.description || undefined,
                  type: newChannel.clientId ? "CLIENT" : "TEAM",
                  clientId: newChannel.clientId || undefined,
                  isPrivate: true,
                  createdById: "temp-user-id",
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium">Cliente (opcional)</label>
                <select
                  value={newChannel.clientId}
                  onChange={(e) => {
                    const client = clients.data?.find((c) => c.id === e.target.value);
                    setNewChannel({
                      ...newChannel,
                      clientId: e.target.value,
                      name: client ? client.name : newChannel.name,
                    });
                  }}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-card"
                >
                  <option value="">Canal interno BoomLab</option>
                  {clients.data?.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Seleciona um cliente para criar o canal dele, ou deixa vazio para canal interno.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Nome do Canal *</label>
                <input
                  type="text"
                  required
                  value={newChannel.name}
                  onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-card"
                  placeholder="Ex: Finitaipas"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Descricao (opcional)</label>
                <input
                  type="text"
                  value={newChannel.description}
                  onChange={(e) => setNewChannel({ ...newChannel, description: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-card"
                  placeholder="Descricao do canal..."
                />
              </div>

              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createChannel.isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {createChannel.isPending ? "A criar..." : "Criar Canal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
