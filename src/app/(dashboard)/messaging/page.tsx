"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  MessageSquare, Hash, Users, Plus, Search, Building2, Megaphone,
  Lock, ChevronRight, Settings2, X,
} from "lucide-react";

const TYPE_ICONS = { CLIENT: Building2, TEAM: Users, GENERAL: Megaphone, DIRECT: MessageSquare };
const TYPE_LABELS = { CLIENT: "Clientes", TEAM: "Equipa", GENERAL: "Geral", DIRECT: "Diretas" };

export default function MessagingPage() {
  const [filter, setFilter] = useState<"" | "CLIENT" | "TEAM" | "GENERAL">("");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newChannel, setNewChannel] = useState({ name: "", description: "", type: "CLIENT" as string, isPrivate: true });

  const channels = trpc.messaging.channels.useQuery(filter ? { type: filter as "CLIENT" } : {});
  const clients = trpc.clients.list.useQuery({});
  const utils = trpc.useUtils();

  const createChannel = trpc.messaging.createChannel.useMutation({
    onSuccess: () => {
      utils.messaging.channels.invalidate();
      setShowCreate(false);
      setNewChannel({ name: "", description: "", type: "CLIENT", isPrivate: true });
    },
  });

  const filtered = channels.data?.filter((ch) =>
    search ? ch.name.toLowerCase().includes(search.toLowerCase()) : true
  );

  // Group channels by type
  const clientChannels = filtered?.filter((c) => c.type === "CLIENT") ?? [];
  const teamChannels = filtered?.filter((c) => c.type === "TEAM") ?? [];
  const generalChannels = filtered?.filter((c) => c.type === "GENERAL") ?? [];

  function ChannelGroup({ title, icon: Icon, channels: chs, color }: {
    title: string; icon: React.ElementType; channels: typeof clientChannels; color: string;
  }) {
    if (chs.length === 0 && filter) return null;
    return (
      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b p-3 px-4">
          <Icon className="h-4 w-4" style={{ color }} />
          <h3 className="text-sm font-semibold">{title}</h3>
          <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{chs.length}</span>
        </div>
        <div className="divide-y">
          {chs.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground italic">Sem canais</p>
          )}
          {chs.map((channel) => {
            const Icon2 = TYPE_ICONS[channel.type] ?? Hash;
            const lastMsg = channel.messages[0];
            return (
              <Link
                key={channel.id}
                href={`/messaging/${channel.id}`}
                className="flex items-center gap-3 p-3 px-4 transition-colors hover:bg-muted/50"
              >
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg text-white text-sm font-semibold")}
                  style={{ backgroundColor: color }}>
                  {channel.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{channel.name}</p>
                    {channel.isPrivate && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {lastMsg
                      ? `${lastMsg.author.name}: ${lastMsg.content.slice(0, 50)}`
                      : channel.description ?? "Sem mensagens"}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {channel._count.subChannels > 0 && (
                    <span className="text-xs text-muted-foreground">{channel._count.subChannels} sub</span>
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
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">BoomLab Mensagens</h1>
          <p className="text-muted-foreground">Comunicacao interna e com clientes</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo Canal
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Pesquisar canais..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 bg-transparent text-sm outline-none" />
        </div>
        <div className="flex gap-1">
          {(["", "CLIENT", "TEAM", "GENERAL"] as const).map((type) => (
            <button key={type} onClick={() => setFilter(type)}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                filter === type ? "bg-gray-900 text-white" : "bg-card text-muted-foreground hover:bg-muted"
              )}>
              {type ? TYPE_LABELS[type] : "Todos"}
            </button>
          ))}
        </div>
      </div>

      {/* Channel Groups */}
      <div className="space-y-4">
        {(!filter || filter === "CLIENT") && (
          <ChannelGroup title="Canais de Clientes" icon={Building2} channels={clientChannels} color="#2563eb" />
        )}
        {(!filter || filter === "TEAM") && (
          <ChannelGroup title="Canais da Equipa" icon={Users} channels={teamChannels} color="#16a34a" />
        )}
        {(!filter || filter === "GENERAL") && (
          <ChannelGroup title="Canais Gerais" icon={Megaphone} channels={generalChannels} color="#9333ea" />
        )}
      </div>

      {/* Create Channel Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Novo Canal</h2>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-1 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              createChannel.mutate({
                name: newChannel.name,
                description: newChannel.description || undefined,
                type: newChannel.type as "CLIENT",
                isPrivate: newChannel.isPrivate,
                createdById: "temp-user-id", // Will use session user
              });
            }} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Nome do Canal *</label>
                <input type="text" required value={newChannel.name}
                  onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Ex: Finitaipas" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Descricao</label>
                <input type="text" value={newChannel.description}
                  onChange={(e) => setNewChannel({ ...newChannel, description: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Para que serve este canal" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Tipo</label>
                <div className="flex gap-2">
                  {[
                    { value: "CLIENT", label: "Cliente", icon: Building2, color: "#2563eb" },
                    { value: "TEAM", label: "Equipa", icon: Users, color: "#16a34a" },
                    { value: "GENERAL", label: "Geral", icon: Megaphone, color: "#9333ea" },
                  ].map((t) => (
                    <button key={t.value} type="button"
                      onClick={() => setNewChannel({ ...newChannel, type: t.value })}
                      className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                        newChannel.type === t.value ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted"
                      )}>
                      <t.icon className="h-4 w-4" style={{ color: t.color }} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newChannel.isPrivate}
                  onChange={(e) => setNewChannel({ ...newChannel, isPrivate: e.target.checked })} />
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                Canal privado (apenas membros convidados)
              </label>
              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={createChannel.isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
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
