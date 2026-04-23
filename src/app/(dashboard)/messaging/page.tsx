"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  MessageSquare, Users, Plus, Search, Building2,
  Lock, ChevronRight, X, Rocket, Bell,
} from "lucide-react";
import { useMessagingNotifications } from "@/hooks/use-messaging-notifications";

export default function MessagingPage() {
  const { data: session } = useSession();
  const userId = (session?.user as Record<string, unknown>)?.id as string | undefined;
  const role = (session?.user as Record<string, unknown>)?.role as string | undefined;
  const isGuest = role === "GUEST_CLIENT" || role === "GUEST_TEAM_MEMBER";
  const assignedChannelId = (session?.user as Record<string, unknown>)?.assignedChannelId as string | undefined;

  const { permission, requestPermission, unreadByChannel } = useMessagingNotifications();

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newChannel, setNewChannel] = useState({ name: "", description: "", clientId: "", type: "CLIENT" as string });
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const channels = trpc.messaging.channels.useQuery({});
  const clients = trpc.clients.list.useQuery({}, { enabled: !isGuest });
  const utils = trpc.useUtils();

  const createChannel = trpc.messaging.createChannel.useMutation({
    onSuccess: () => {
      utils.messaging.channels.invalidate();
      setShowCreate(false);
      setNewChannel({ name: "", description: "", clientId: "", type: "CLIENT" });
    },
  });

  const allChannelsRaw = channels.data ?? [];
  // Guests only see their assigned channel - NEVER see BoomLab internal channels
  const allChannels = isGuest
    ? allChannelsRaw.filter((c) => c.id === assignedChannelId)
    : allChannelsRaw;
  const clientChannels = allChannels.filter((c) => c.type === "CLIENT");
  const boomLabChannels = isGuest ? [] : allChannels.filter((c) => c.type === "TEAM" || c.type === "GENERAL");

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
        {!isGuest && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Novo Canal
          </button>
        )}
      </div>

      {/* Notification permission banner */}
      {permission === "default" && !bannerDismissed && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-3">
          <Bell className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Activar notificacoes do browser</p>
            <p className="text-xs text-blue-700 dark:text-blue-300">Recebe aviso quando chega uma mensagem nova mesmo com outra aba aberta.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => requestPermission()}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              Activar
            </button>
            <button
              onClick={() => setBannerDismissed(true)}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Mais tarde
            </button>
          </div>
        </div>
      )}

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

      {/* BoomLab Internal - hidden for guests (clientes nao podem ver canais internos) */}
      {!isGuest && <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b p-3 px-4">
          <Rocket className="h-4 w-4 text-[#2D76FC]" />
          <h3 className="text-sm font-semibold">BoomLab Interno</h3>
        </div>
        <div className="divide-y">
          {boomLabChannels.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">
              Sem canal interno. Cria um clicando em "Novo Canal" e seleciona "Canal Interno BoomLab".
            </div>
          )}
          {boomLabChannels.map((channel) => {
            const lastMsg = channel.messages[0];
            return (
              <Link key={channel.id} href={`/messaging/${channel.id}`} className="flex items-center gap-3 p-3 px-4 transition-colors hover:bg-muted/50">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2D76FC] text-white text-sm font-semibold">B</div>
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
          })}
        </div>
      </div>}

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
          {filteredClients.length === 0 && !channels.isLoading && (
            <div className="flex flex-col items-center gap-2 p-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm">Sem canais de clientes</p>
              <p className="text-xs">Cria um canal para comecar a comunicar com os clientes.</p>
            </div>
          )}
          {channels.isLoading && (
            <div className="p-8 text-center text-sm text-muted-foreground">A carregar...</div>
          )}
          {filteredClients.map((channel) => {
            const lastMsg = channel.messages[0];
            const unread = unreadByChannel[channel.id] ?? 0;
            return (
              <Link key={channel.id} href={`/messaging/${channel.id}`} className="flex items-center gap-3 p-3 px-4 transition-colors hover:bg-muted/50">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2D76FC]/10 text-[#2D76FC] text-sm font-semibold">
                  {channel.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={cn("text-sm truncate", unread > 0 ? "font-bold" : "font-medium")}>{channel.name}</p>
                    {channel.isPrivate && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </div>
                  <p className={cn("text-xs truncate", unread > 0 ? "text-foreground/80 font-medium" : "text-muted-foreground")}>
                    {lastMsg ? `${lastMsg.author.name}: ${lastMsg.content.slice(0, 50)}` : channel.description ?? "Sem mensagens"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                  {unread > 0 && (
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white min-w-[20px] text-center">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                  <Users className="h-3 w-3" />{channel._count.members}
                  <ChevronRight className="h-4 w-4" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ============ CREATE CHANNEL DIALOG ============ */}
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
                if (!userId) return;
                createChannel.mutate({
                  name: newChannel.name,
                  description: newChannel.description || undefined,
                  type: newChannel.type as "CLIENT" | "TEAM",
                  clientId: newChannel.clientId || undefined,
                  createdById: userId,
                  isPrivate: newChannel.type === "CLIENT",
                });
              }}
              className="space-y-4"
            >
              {/* Channel Type */}
              <div>
                <label className="mb-2 block text-sm font-medium">Tipo de Canal</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewChannel({ ...newChannel, type: "CLIENT", clientId: "" })}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-colors",
                      newChannel.type === "CLIENT" ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
                    )}
                  >
                    <Building2 className="h-4 w-4" />
                    Canal de Cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewChannel({ ...newChannel, type: "TEAM", clientId: "", name: "" })}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-colors",
                      newChannel.type === "TEAM" ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
                    )}
                  >
                    <Rocket className="h-4 w-4" />
                    Canal Interno BoomLab
                  </button>
                </div>
              </div>

              {/* Client Selector - only for CLIENT type */}
              {newChannel.type === "CLIENT" && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Cliente *</label>
                  <select
                    required
                    value={newChannel.clientId}
                    onChange={(e) => {
                      const client = clients.data?.find((c) => c.id === e.target.value);
                      setNewChannel({
                        ...newChannel,
                        clientId: e.target.value,
                        name: client?.name ?? "",
                      });
                    }}
                    className="w-full rounded-lg border px-3 py-2 text-sm bg-card"
                  >
                    <option value="">Selecionar cliente...</option>
                    {clients.data?.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Channel Name */}
              <div>
                <label className="mb-1 block text-sm font-medium">Nome do Canal *</label>
                <input
                  type="text"
                  required
                  value={newChannel.name}
                  onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-card"
                  placeholder={newChannel.type === "CLIENT" ? "Nome do cliente" : "Ex: BoomLab Geral"}
                />
              </div>

              {/* Description */}
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

              {createChannel.error && (
                <p className="text-sm text-red-600">{createChannel.error.message}</p>
              )}

              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createChannel.isPending || !userId || (newChannel.type === "CLIENT" && !newChannel.clientId)}
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
