"use client";

import { use } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn, getStatusColor, formatStatus, getPillarFromModule } from "@/lib/utils";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  Calendar,
  Mic,
  FileText,
  ExternalLink,
  CheckCircle2,
  Clock,
  Star,
} from "lucide-react";

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const client = trpc.clients.getById.useQuery(id);

  if (client.isLoading) {
    return <div className="p-8 text-center text-muted-foreground">A carregar...</div>;
  }

  if (!client.data) {
    return <div className="p-8 text-center text-muted-foreground">Cliente nao encontrado</div>;
  }

  const c = client.data;
  const completedSessions = c.sessions.filter((s) => s.status === "CONCLUIDA").length;
  const totalSessions = c.sessions.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/clients"
          className="rounded-lg p-2 transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{c.name}</h1>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", getStatusColor(c.status))}>
              {formatStatus(c.status)}
            </span>
          </div>
          <p className="text-muted-foreground">
            {c.coreBusiness ?? ""} {c.ceo ? `| CEO: ${c.ceo}` : ""}
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Sessoes</p>
          <p className="text-2xl font-bold">
            {completedSessions}/{totalSessions}
          </p>
          <p className="text-xs text-muted-foreground">concluidas</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">CSAT</p>
          <p className="text-2xl font-bold">{c.csat ?? "-"}</p>
          <p className="text-xs text-muted-foreground">de 1 a 10</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Ticket</p>
          <p className="text-2xl font-bold">
            {c.ticket ? `${c.ticket.toLocaleString("pt-PT")}€` : "-"}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Faturacao</p>
          <p className="text-2xl font-bold">
            {c.billing ? `${c.billing.toLocaleString("pt-PT")}€` : "-"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        {/* Info */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="mb-4 font-semibold">Informacao</h2>
          <div className="space-y-3 text-sm">
            {c.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{c.email}</span>
              </div>
            )}
            {c.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{c.phone}</span>
              </div>
            )}
            {c.composition && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{c.composition}</span>
              </div>
            )}
            {c.projectStart && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {new Date(c.projectStart).toLocaleDateString("pt-PT")} -{" "}
                  {c.projectEnd ? new Date(c.projectEnd).toLocaleDateString("pt-PT") : "..."}
                </span>
              </div>
            )}
            {c.projectDuration && (
              <p className="text-muted-foreground">Duracao: {c.projectDuration}</p>
            )}
            {c.painPoints && (
              <div className="mt-3 border-t pt-3">
                <p className="mb-1 font-medium">Dores e Necessidades</p>
                <p className="text-muted-foreground">{c.painPoints}</p>
              </div>
            )}
            {c.expectations && (
              <div className="border-t pt-3">
                <p className="mb-1 font-medium">Expectativas</p>
                <p className="text-muted-foreground">{c.expectations}</p>
              </div>
            )}
            {/* Offers */}
            <div className="flex flex-wrap gap-1 border-t pt-3">
              {c.offer.map((o) => (
                <span key={o} className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {o}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Timeline / Sessions */}
        <div className="lg:col-span-2 rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-semibold">Timeline de Sessoes</h2>
            <span className="text-sm text-muted-foreground">{totalSessions} sessoes</span>
          </div>
          <div className="max-h-[500px] divide-y overflow-y-auto">
            {c.sessions.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">Sem sessoes registadas</div>
            )}
            {c.sessions.map((session) => {
              const pillar = getPillarFromModule(session.module);
              return (
                <Link
                  key={session.id}
                  href={`/sessions/${session.id}`}
                  className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{
                      backgroundColor: pillar ? `${pillar.color}15` : "#f3f4f6",
                    }}>
                      {session.status === "CONCLUIDA" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <Clock className="h-4 w-4" style={{ color: pillar?.color ?? "#6b7280" }} />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{session.title}</p>
                      <div className="flex items-center gap-2">
                        {pillar && (
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: pillar.color }}
                          />
                        )}
                        <p className="text-xs text-muted-foreground">
                          {session.topic ?? session.module}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    {session.evaluation && (
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-500" />
                        <span className="text-sm font-medium">{session.evaluation}</span>
                      </div>
                    )}
                    {session.recordings.length > 0 && (
                      <Mic className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm">
                        {session.date
                          ? new Date(session.date).toLocaleDateString("pt-PT", { day: "numeric", month: "short" })
                          : "-"}
                      </p>
                      <p className={cn("text-xs", getStatusColor(session.status) + " rounded px-1")}>
                        {formatStatus(session.status)}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recordings */}
      {c.recordings.length > 0 && (
        <div className="rounded-xl border bg-card">
          <div className="border-b p-4">
            <h2 className="font-semibold">Gravacoes</h2>
          </div>
          <div className="divide-y">
            {c.recordings.map((rec) => (
              <Link
                key={rec.id}
                href={`/recordings/${rec.id}`}
                className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <Mic className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium">{rec.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {rec.type === "CALL" ? "Chamada" : "Reuniao"}{" "}
                      {rec.duration ? `| ${Math.round(rec.duration / 60)}min` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {rec.aiScore !== null && (
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                      IA: {rec.aiScore}/100
                    </span>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {new Date(rec.createdAt).toLocaleDateString("pt-PT")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
