"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn, getStatusColor, formatStatus, getPillarFromModule, PILLARS } from "@/lib/utils";
import { Calendar, CheckCircle2, Clock, Star, Mic, FileText, ChevronRight, Plus } from "lucide-react";
import { CreateSessionDialog } from "@/components/sessions/create-session-dialog";

export default function SessionsPage() {
  const [module, setModule] = useState("");
  const [status, setStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const sessions = trpc.sessions.list.useQuery({
    module: module || undefined,
    status: status || undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sessoes</h1>
          <p className="text-muted-foreground">Timeline de todas as sessoes</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Nova Sessao
        </button>
      </div>

      <CreateSessionDialog open={showCreate} onClose={() => setShowCreate(false)} />

      {/* Pillar Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setModule("")}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            !module ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-muted"
          )}
        >
          Todos
        </button>
        {PILLARS.map((p) => (
          <button
            key={p.id}
            onClick={() => setModule(module === p.id ? "" : p.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              module === p.id ? "text-white" : "bg-card text-muted-foreground hover:bg-muted"
            )}
            style={module === p.id ? { backgroundColor: p.color } : undefined}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: module === p.id ? "white" : p.color }}
            />
            {p.label}
          </button>
        ))}
      </div>

      {/* Status Filter */}
      <div className="flex gap-2">
        {["", "POR_AGENDAR", "MARCADA", "CONCLUIDA", "REAGENDADA", "FALTOU", "CANCELADA"].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              status === s ? "bg-gray-900 text-white" : "bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            {s ? formatStatus(s) : "Todos"}
          </button>
        ))}
      </div>

      {/* Sessions List */}
      <div className="rounded-xl border bg-card">
        <div className="divide-y">
          {sessions.isLoading && (
            <div className="p-8 text-center text-muted-foreground">A carregar...</div>
          )}
          {sessions.data?.length === 0 && (
            <div className="flex flex-col items-center gap-2 p-8 text-muted-foreground">
              <Calendar className="h-8 w-8" />
              <p>Sem sessoes encontradas</p>
            </div>
          )}
          {sessions.data?.map((session) => {
            const pillar = getPillarFromModule(session.module);
            return (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: pillar ? `${pillar.color}15` : "#f3f4f6" }}
                  >
                    {session.status === "CONCLUIDA" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <Clock className="h-5 w-5" style={{ color: pillar?.color ?? "#6b7280" }} />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{session.title}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {pillar && (
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: pillar.color }} />
                      )}
                      <span>{session.client.name}</span>
                      <span>&middot;</span>
                      <span>{session.topic ?? session.module}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {session.evaluation && (
                    <div className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 text-yellow-500" />
                      <span className="text-sm font-medium">{session.evaluation}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {session._count.recordings > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mic className="h-3.5 w-3.5" /> {session._count.recordings}
                      </span>
                    )}
                    {session._count.documents > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" /> {session._count.documents}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm">
                      {session.date
                        ? new Date(session.date).toLocaleDateString("pt-PT", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "-"}
                    </p>
                    <span className={cn("text-xs", getStatusColor(session.status), "rounded px-1.5 py-0.5")}>
                      {formatStatus(session.status)}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
