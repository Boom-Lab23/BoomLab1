"use client";

import { use, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Send, Hash, Pin, Users, Building2, Bot, Paperclip,
  Plus, Lock, Settings2, Shield, ChevronDown, ChevronRight,
  UserPlus, UserMinus, X, Check,
} from "lucide-react";

type MemberWithPerms = {
  id: string;
  userId: string;
  role: string;
  user: { id: string; name: string; email: string; image: string | null };
  permissions: { permission: string; granted: boolean }[];
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Proprietario",
  ADMIN: "Administrador",
  MEMBER: "Membro",
  GUEST: "Convidado",
};

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-purple-100 text-purple-700",
  ADMIN: "bg-blue-100 text-blue-700",
  MEMBER: "bg-gray-100 text-gray-700",
  GUEST: "bg-orange-100 text-orange-700",
};

const PERMISSION_LABELS: Record<string, string> = {
  SEND_MESSAGES: "Enviar mensagens",
  DELETE_MESSAGES: "Apagar mensagens proprias",
  DELETE_ANY_MESSAGE: "Apagar qualquer mensagem",
  PIN_MESSAGES: "Fixar mensagens",
  INVITE_MEMBERS: "Convidar membros",
  REMOVE_MEMBERS: "Remover membros",
  MANAGE_SUB_CHANNELS: "Gerir sub-canais",
  MANAGE_PERMISSIONS: "Gerir permissoes",
  UPLOAD_FILES: "Upload de ficheiros",
  VIEW_HISTORY: "Ver historico",
};

export default function ChannelPage({ params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = use(params);
  const { data: authSession } = useSession();
  const role = (authSession?.user as Record<string, unknown>)?.role as string | undefined;
  const isGuest = role === "GUEST_CLIENT" || role === "GUEST_TEAM_MEMBER";
  const assignedChannelId = (authSession?.user as Record<string, unknown>)?.assignedChannelId as string | undefined;
  const guestBlocked = isGuest && assignedChannelId !== channelId;

  const [message, setMessage] = useState("");
  const [pendingFiles, setPendingFiles] = useState<Array<{ name: string; url: string; size: number; type: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ name: "", description: "", icon: "", isPrivate: false });
  const [activeSubChannel, setActiveSubChannel] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [showPermissions, setShowPermissions] = useState<string | null>(null);
  const [showCreateSub, setShowCreateSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [newSubPrivate, setNewSubPrivate] = useState(false);
  const [newSubMembers, setNewSubMembers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const channelData = trpc.messaging.getChannel.useQuery({ channelId });
  // Lista de TODOS os canais onde o utilizador e membro (para sidebar de navegacao tipo Slack)
  const allChannels = trpc.messaging.channels.useQuery({}, { enabled: !isGuest });
  const subChannelData = trpc.messaging.getSubChannel.useQuery(
    { subChannelId: activeSubChannel! },
    { enabled: !!activeSubChannel }
  );

  const sendMessage = trpc.messaging.sendMessage.useMutation({
    onSuccess: () => {
      setMessage("");
      if (activeSubChannel) subChannelData.refetch();
      else channelData.refetch();
    },
  });
  const togglePin = trpc.messaging.togglePin.useMutation({
    onSuccess: () => {
      if (activeSubChannel) subChannelData.refetch();
      else channelData.refetch();
    },
  });
  const updateRole = trpc.messaging.updateMemberRole.useMutation({
    onSuccess: () => channelData.refetch(),
  });
  const updatePerm = trpc.messaging.updatePermission.useMutation({
    onSuccess: () => channelData.refetch(),
  });
  const updateChannel = trpc.messaging.updateChannel.useMutation({
    onSuccess: () => { channelData.refetch(); setShowSettings(false); },
  });
  const deleteChannel = trpc.messaging.deleteChannel.useMutation({
    onSuccess: () => { window.location.href = "/messaging"; },
  });

  const removeMember = trpc.messaging.removeMember.useMutation({
    onSuccess: () => channelData.refetch(),
  });
  const createSubChannel = trpc.messaging.createSubChannel.useMutation({
    onSuccess: () => {
      channelData.refetch();
      setShowCreateSub(false);
      setNewSubName("");
      setNewSubPrivate(false);
      setNewSubMembers([]);
    },
  });

  const messages = activeSubChannel
    ? subChannelData.data?.messages ?? []
    : channelData.data?.messages ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (guestBlocked) {
    return (
      <div className="p-8 text-center">
        <p className="text-lg font-semibold">Acesso negado</p>
        <p className="mt-2 text-sm text-muted-foreground">Nao tens permissoes para aceder a este canal.</p>
      </div>
    );
  }
  if (channelData.isLoading) {
    return <div className="p-8 text-center text-muted-foreground">A carregar...</div>;
  }
  if (!channelData.data) {
    return <div className="p-8 text-center text-muted-foreground">Canal nao encontrado</div>;
  }

  const { channel } = channelData.data;
  const currentName = activeSubChannel
    ? channel.subChannels.find((s) => s.id === activeSubChannel)?.name ?? ""
    : channel.name;

  function handleSend() {
    if (!message.trim() && pendingFiles.length === 0) return;
    const authorId = channel.members[0]?.userId;
    if (!authorId) return;

    sendMessage.mutate({
      content: message || (pendingFiles.length > 0 ? `[${pendingFiles.length} ficheiro(s) anexado(s)]` : ""),
      channelId: activeSubChannel ? undefined : channelId,
      subChannelId: activeSubChannel ?? undefined,
      authorId,
      attachments: pendingFiles.length > 0 ? pendingFiles : undefined,
    }, {
      onSuccess: () => {
        setMessage("");
        setPendingFiles([]);
      },
    });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    // Max 10MB por ficheiro; converte para data URL
    const maxSize = 10 * 1024 * 1024;
    for (const file of files) {
      if (file.size > maxSize) {
        alert(`Ficheiro ${file.name} e demasiado grande (max 10MB).`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setPendingFiles((prev) => [...prev, {
          name: file.name,
          url: reader.result as string,
          size: file.size,
          type: file.type,
        }]);
      };
      reader.readAsDataURL(file);
    }
    // Reset input so same file can be picked again
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePendingFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function formatTime(date: Date | string) {
    return new Date(date).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  }

  const selectedMember = showPermissions
    ? channel.members.find((m) => m.userId === showPermissions)
    : null;

  return (
    <div className="flex h-[calc(100vh-7rem)]">
      {/* Sub-channel Sidebar - hidden on mobile */}
      <div className="hidden md:flex w-60 shrink-0 border-r bg-muted/30 flex-col">
        <div className="border-b p-3">
          <Link href="/messaging" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Todos os canais
          </Link>
          <div className="mt-2 flex items-center gap-2">
            <div className={cn("flex h-7 w-7 items-center justify-center rounded text-white text-xs font-semibold",
              channel.type === "CLIENT" ? "bg-blue-600" : channel.type === "TEAM" ? "bg-green-600" : "bg-purple-600"
            )}>
              {channel.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{channel.name}</p>
              <p className="text-xs text-muted-foreground">{channel.members.length} membros</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {/* Outros canais (navegacao rapida tipo Slack) */}
          {!isGuest && allChannels.data && allChannels.data.length > 1 && (
            <div className="mb-3">
              <div className="mb-1 px-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Canais</p>
              </div>
              {allChannels.data.map((ch) => (
                <Link
                  key={ch.id}
                  href={`/messaging/${ch.id}`}
                  className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    ch.id === channelId
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {ch.isPrivate ? <Lock className="h-3.5 w-3.5 shrink-0" /> : <Hash className="h-3.5 w-3.5 shrink-0" />}
                  <span className="truncate">{ch.name}</span>
                </Link>
              ))}
            </div>
          )}

          {/* Secao do canal atual */}
          <div className="mb-1 px-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Neste canal</p>
          </div>
          <button
            onClick={() => setActiveSubChannel(null)}
            className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
              !activeSubChannel ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Hash className="h-3.5 w-3.5" />
            geral
          </button>

          {/* Sub-channels */}
          <div className="mt-2">
            <div className="mb-1 px-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Sub-canais</p>
              <button
                onClick={() => setShowCreateSub(true)}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Criar sub-canal"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {channel.subChannels.map((sub) => (
              <button
                key={sub.id}
                onClick={() => setActiveSubChannel(sub.id)}
                className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  activeSubChannel === sub.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Hash className="h-3.5 w-3.5" />
                {sub.name.toLowerCase().replace(/\s+/g, "-")}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom actions */}
        <div className="border-t p-2 space-y-1">
          <button
            onClick={() => setShowMembers(!showMembers)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          >
            <Users className="h-3.5 w-3.5" />
            Membros ({channel.members.length})
          </button>
          {!isGuest && (
            <button
              onClick={() => {
                setSettingsForm({
                  name: channel.name,
                  description: channel.description ?? "",
                  icon: channel.icon ?? "",
                  isPrivate: channel.isPrivate,
                });
                setShowSettings(true);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Configuracoes
            </button>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Channel Header */}
        <div className="flex items-center gap-3 border-b bg-card px-4 py-2.5">
          <Hash className="h-4 w-4 text-muted-foreground" />
          <p className="font-semibold">{currentName}</p>
          {channel.isPrivate && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <Hash className="h-10 w-10 text-muted-foreground/20" />
              <p className="mt-2 font-medium">#{currentName}</p>
              <p className="text-sm">Envia a primeira mensagem</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={cn("group flex gap-3 rounded-lg px-2 py-1 hover:bg-muted/50", msg.isSystem && "bg-blue-50/50")}>
              {msg.author.image ? (
                <img src={msg.author.image} alt="" className="h-8 w-8 rounded-full mt-0.5" />
              ) : (
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-full mt-0.5 text-xs font-medium text-white",
                  msg.isSystem ? "bg-purple-600" : "bg-primary"
                )}>
                  {msg.isSystem ? <Bot className="h-4 w-4" /> : msg.author.name.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold">{msg.isSystem ? "Boom IA" : msg.author.name}</span>
                  <span className="text-xs text-muted-foreground">{formatTime(msg.createdAt)}</span>
                  {msg.isPinned && <Pin className="h-3 w-3 text-orange-500" />}
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                {/* Attachments */}
                {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(msg.attachments as Array<{ name: string; url: string; size?: number; type?: string }>).map((att, i) => {
                      const isImage = att.type?.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp)$/i.test(att.name);
                      if (isImage) {
                        return (
                          // eslint-disable-next-line @next/next/no-img-element
                          <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="block">
                            <img src={att.url} alt={att.name} className="max-h-40 max-w-xs rounded-lg border hover:opacity-80" />
                          </a>
                        );
                      }
                      return (
                        <a
                          key={i}
                          href={att.url}
                          download={att.name}
                          className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs hover:bg-muted"
                        >
                          <Paperclip className="h-3 w-3 text-muted-foreground" />
                          <span className="max-w-[200px] truncate font-medium">{att.name}</span>
                          {att.size && <span className="text-muted-foreground">{(att.size / 1024).toFixed(0)}KB</span>}
                        </a>
                      );
                    })}
                  </div>
                )}
                {msg._count.replies > 0 && (
                  <button className="mt-0.5 text-xs text-primary hover:underline">
                    {msg._count.replies} resposta{msg._count.replies > 1 ? "s" : ""}
                  </button>
                )}
              </div>
              <div className="invisible flex items-start gap-0.5 group-hover:visible">
                <button onClick={() => togglePin.mutate(msg.id)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted" title="Fixar">
                  <Pin className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="border-t bg-card p-3">
          {/* Pending files preview */}
          {pendingFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pendingFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border bg-muted/50 px-2 py-1 text-xs">
                  <Paperclip className="h-3 w-3" />
                  <span className="max-w-[180px] truncate">{f.name}</span>
                  <span className="text-muted-foreground">{(f.size / 1024).toFixed(0)}KB</span>
                  <button onClick={() => removePendingFile(i)} className="text-red-600 hover:underline">&times;</button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="flex items-end gap-2 rounded-xl border px-3 py-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Anexar ficheiro (max 10MB)"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={`Mensagem para #${currentName}...`}
              className="flex-1 resize-none bg-transparent text-sm outline-none" rows={1}
            />
            <button onClick={handleSend} disabled={(!message.trim() && pendingFiles.length === 0) || sendMessage.isPending}
              className="rounded-lg bg-primary p-1.5 text-white hover:bg-primary/90 disabled:opacity-50">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Channel Settings Dialog */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold">Configuracoes do Canal</h2>
              </div>
              <button onClick={() => setShowSettings(false)} className="rounded-lg p-1 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Nome do canal *</label>
                <input
                  type="text"
                  value={settingsForm.name}
                  onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-card"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Icon (emoji ou URL)</label>
                <input
                  type="text"
                  value={settingsForm.icon}
                  onChange={(e) => setSettingsForm({ ...settingsForm, icon: e.target.value })}
                  placeholder="🚀 ou https://..."
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-card"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Descricao</label>
                <textarea
                  value={settingsForm.description}
                  onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-card"
                  placeholder="Do que se trata este canal?"
                />
              </div>
              <label className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={settingsForm.isPrivate}
                  onChange={(e) => setSettingsForm({ ...settingsForm, isPrivate: e.target.checked })}
                  className="rounded"
                />
                <div>
                  <p className="text-sm font-medium flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Canal privado
                  </p>
                  <p className="text-xs text-muted-foreground">So membros podem ver este canal</p>
                </div>
              </label>

              {updateChannel.error && (
                <p className="text-xs text-red-600">Erro: {updateChannel.error.message}</p>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between border-t pt-4">
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Apagar o canal "${channel.name}" permanentemente? Todas as mensagens serao perdidas.`)) {
                    deleteChannel.mutate({ channelId });
                  }
                }}
                className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100"
                disabled={deleteChannel.isPending}
              >
                {deleteChannel.isPending ? "A apagar..." : "Apagar canal"}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={updateChannel.isPending || !settingsForm.name.trim()}
                  onClick={() => {
                    updateChannel.mutate({
                      channelId,
                      name: settingsForm.name,
                      description: settingsForm.description || null,
                      icon: settingsForm.icon || null,
                      isPrivate: settingsForm.isPrivate,
                    });
                  }}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {updateChannel.isPending ? "A guardar..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Members Panel (slide-out) */}
      {showMembers && (
        <div className="w-72 shrink-0 border-l bg-card overflow-y-auto">
          <div className="flex items-center justify-between border-b p-3">
            <h3 className="font-semibold">Membros</h3>
            <button onClick={() => { setShowMembers(false); setShowPermissions(null); }}
              className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>

          {showPermissions && selectedMember ? (
            /* Permission Editor */
            <div className="p-3 space-y-3">
              <button onClick={() => setShowPermissions(null)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                <ArrowLeft className="h-3 w-3" /> Voltar
              </button>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-white">
                  {selectedMember.user.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium">{selectedMember.user.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedMember.user.email}</p>
                </div>
              </div>

              {/* Role selector */}
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Role</p>
                <div className="flex flex-wrap gap-1">
                  {["OWNER", "ADMIN", "MEMBER", "GUEST"].map((role) => (
                    <button key={role}
                      onClick={() => updateRole.mutate({ channelId, userId: selectedMember.userId, role: role as "ADMIN" })}
                      className={cn("rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
                        selectedMember.role === role ? ROLE_COLORS[role] : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                      )}>
                      {ROLE_LABELS[role]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Permissions toggles */}
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Permissoes</p>
                <div className="space-y-1.5">
                  {Object.entries(PERMISSION_LABELS).map(([perm, label]) => {
                    const current = selectedMember.permissions.find((p) => p.permission === perm);
                    const granted = current?.granted ?? false;
                    return (
                      <label key={perm} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" checked={granted}
                          onChange={(e) => updatePerm.mutate({
                            channelId, userId: selectedMember.userId,
                            permission: perm, granted: e.target.checked,
                          })}
                          className="rounded" />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Sub-channel access */}
              {channel.subChannels.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Acesso a Sub-canais</p>
                  <div className="space-y-1">
                    {channel.subChannels.map((sub) => (
                      <label key={sub.id} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" defaultChecked className="rounded" />
                        #{sub.name.toLowerCase().replace(/\s+/g, "-")}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Remove member */}
              <button
                onClick={() => { removeMember.mutate({ channelId, userId: selectedMember.userId }); setShowPermissions(null); }}
                className="flex w-full items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                <UserMinus className="h-3.5 w-3.5" /> Remover do canal
              </button>
            </div>
          ) : (
            /* Member List */
            <div className="p-2">
              <button className="flex w-full items-center gap-2 rounded-lg border border-dashed p-2 text-sm text-muted-foreground hover:bg-muted/50 mb-2">
                <UserPlus className="h-4 w-4" /> Adicionar membro
              </button>
              {channel.members.map((member) => (
                <button key={member.id}
                  onClick={() => setShowPermissions(member.userId)}
                  className="flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors hover:bg-muted/50"
                >
                  {member.user.image ? (
                    <img src={member.user.image} alt="" className="h-7 w-7 rounded-full" />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-white">
                      {member.user.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member.user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
                  </div>
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", ROLE_COLORS[member.role])}>
                    {ROLE_LABELS[member.role] ?? member.role}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Sub-channel Dialog */}
      {showCreateSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 animate-scale-in">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Novo Sub-canal</h2>
              <button onClick={() => setShowCreateSub(false)} className="rounded-lg p-1 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const creatorId = channel.members[0]?.userId;
                if (!creatorId) return;
                createSubChannel.mutate({
                  name: newSubName,
                  channelId,
                  createdById: creatorId,
                  isPrivate: newSubPrivate,
                  memberIds: newSubMembers,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium">Nome do Sub-canal *</label>
                <input
                  type="text"
                  required
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-card"
                  placeholder="Ex: reunioes, documentos, geral..."
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newSubPrivate}
                    onChange={(e) => setNewSubPrivate(e.target.checked)}
                    className="rounded"
                  />
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  Sub-canal privado (so membros selecionados)
                </label>
              </div>

              {/* Member selection */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Quem tem acesso?
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    ({newSubMembers.length} selecionados)
                  </span>
                </label>
                <div className="max-h-[200px] overflow-y-auto space-y-1 rounded-lg border p-2">
                  {/* Select all */}
                  <label className="flex items-center gap-2 rounded p-1.5 text-sm cursor-pointer hover:bg-muted/50 font-medium">
                    <input
                      type="checkbox"
                      checked={newSubMembers.length === channel.members.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewSubMembers(channel.members.map((m) => m.userId));
                        } else {
                          setNewSubMembers([]);
                        }
                      }}
                      className="rounded"
                    />
                    Selecionar todos
                  </label>
                  <div className="h-px bg-border my-1" />

                  {channel.members.map((member) => (
                    <label
                      key={member.id}
                      className="flex items-center gap-2 rounded p-1.5 text-sm cursor-pointer hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={newSubMembers.includes(member.userId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewSubMembers([...newSubMembers, member.userId]);
                          } else {
                            setNewSubMembers(newSubMembers.filter((id) => id !== member.userId));
                          }
                        }}
                        className="rounded"
                      />
                      {member.user.image ? (
                        <img src={member.user.image} alt="" className="h-6 w-6 rounded-full" />
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-white">
                          {member.user.name.charAt(0)}
                        </div>
                      )}
                      <span className="flex-1 truncate">{member.user.name}</span>
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-medium", ROLE_COLORS[member.role])}>
                        {ROLE_LABELS[member.role]}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {createSubChannel.error && (
                <p className="text-sm text-red-600">{createSubChannel.error.message}</p>
              )}

              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setShowCreateSub(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createSubChannel.isPending || !newSubName.trim()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {createSubChannel.isPending ? "A criar..." : "Criar Sub-canal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
