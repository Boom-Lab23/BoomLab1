"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn, PILLARS, getStatusColor, formatStatus, getPillarFromModule } from "@/lib/utils";
import {
  Users, Calendar, Mic, Rocket, AlertTriangle, TrendingUp,
  CheckCircle2, Clock, Star, ArrowRight, MessageSquare, FileText,
  Brain, BarChart3,
} from "lucide-react";

function StatCard({
  title, value, icon: Icon, color, subtitle, href,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
  href?: string;
}) {
  const content = (
    <div className={cn("rounded-xl border bg-card p-5 transition-colors", href && "hover:bg-muted/50")}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-3xl font-bold">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="rounded-lg p-3" style={{ backgroundColor: `${color}15` }}>
          <Icon className="h-6 w-6" style={{ color }} />
        </div>
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

export default function DashboardPage() {
  const stats = trpc.clients.stats.useQuery();
  const upcoming = trpc.sessions.upcoming.useQuery();
  const recentSessions = trpc.sessions.list.useQuery({ status: "CONCLUIDA" });
  const pendingRecordings = trpc.recordings.list.useQuery({ analyzed: false });

  // Count sessions by pillar for the chart
  const pillarCounts: Record<string, number> = {};
  recentSessions.data?.forEach((s) => {
    const p = getPillarFromModule(s.module);
    if (p) pillarCounts[p.id] = (pillarCounts[p.id] ?? 0) + 1;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visao geral do servico</p>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Clientes Ativos"
          value={stats.data?.active ?? 0}
          icon={Users}
          color="#16a34a"
          subtitle={`${stats.data?.total ?? 0} total`}
          href="/clients"
        />
        <StatCard
          title="Proximas Sessoes"
          value={upcoming.data?.length ?? 0}
          icon={Calendar}
          color="#2563eb"
          subtitle="Agendadas"
          href="/sessions"
        />
        <StatCard
          title="CSAT Medio"
          value={stats.data?.avgCsat?.toFixed(1) ?? "-"}
          icon={TrendingUp}
          color="#9333ea"
          subtitle="De 1 a 10"
        />
        <StatCard
          title="Por Analisar"
          value={pendingRecordings.data?.length ?? 0}
          icon={Brain}
          color="#ea580c"
          subtitle="Gravacoes sem IA"
          href="/recordings"
        />
        <StatCard
          title="Boom Club"
          value={stats.data?.boomClub ?? 0}
          icon={Rocket}
          color="#0891b2"
          subtitle="Retencao"
          href="/boom-club"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upcoming Sessions */}
        <div className="lg:col-span-2 rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-semibold">Proximas Sessoes</h2>
            <Link href="/sessions" className="flex items-center gap-1 text-sm text-primary hover:underline">
              Ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y">
            {upcoming.data?.length === 0 && (
              <div className="flex flex-col items-center gap-2 p-8 text-muted-foreground">
                <Calendar className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm">Sem sessoes agendadas</p>
              </div>
            )}
            {upcoming.data?.slice(0, 6).map((session) => {
              const pillar = getPillarFromModule(session.module);
              return (
                <Link
                  key={session.id}
                  href={`/sessions/${session.id}`}
                  className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{ backgroundColor: pillar ? `${pillar.color}15` : "#f3f4f6" }}
                    >
                      <Clock className="h-5 w-5" style={{ color: pillar?.color ?? "#6b7280" }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{session.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{session.client.name}</span>
                        {pillar && (
                          <>
                            <span>&middot;</span>
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: pillar.color }} />
                              {pillar.label}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {session.date
                        ? new Date(session.date).toLocaleDateString("pt-PT", { day: "numeric", month: "short" })
                        : "-"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {session.date
                        ? new Date(session.date).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
                        : ""}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Quick Actions + Pillar Distribution */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 font-semibold">Acoes Rapidas</h2>
            <div className="space-y-2">
              <Link href="/clients" className="flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50">
                <Users className="h-4 w-4 text-green-600" />
                <span>Novo Cliente</span>
              </Link>
              <Link href="/sessions" className="flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span>Nova Sessao</span>
              </Link>
              <Link href="/recordings" className="flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50">
                <Mic className="h-4 w-4 text-red-600" />
                <span>Upload Chamada</span>
              </Link>
              <Link href="/messaging" className="flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50">
                <MessageSquare className="h-4 w-4 text-purple-600" />
                <span>Mensagens</span>
              </Link>
            </div>
          </div>

          {/* Pillar Distribution */}
          <div className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 font-semibold">Sessoes por Pilar</h2>
            {Object.keys(pillarCounts).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados ainda</p>
            ) : (
              <div className="space-y-2">
                {PILLARS.filter((p) => pillarCounts[p.id]).map((pillar) => {
                  const count = pillarCounts[pillar.id] ?? 0;
                  const total = Object.values(pillarCounts).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={pillar.id}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: pillar.color }} />
                          {pillar.label}
                        </span>
                        <span className="font-medium">{count}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-gray-100">
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: pillar.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Analyzed Sessions */}
      {recentSessions.data && recentSessions.data.filter((s) => s.aiScore).length > 0 && (
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-semibold">Sessoes Recentes com Analise IA</h2>
          </div>
          <div className="divide-y">
            {recentSessions.data
              .filter((s) => s.aiScore)
              .slice(0, 5)
              .map((session) => {
                const pillar = getPillarFromModule(session.module);
                return (
                  <Link
                    key={session.id}
                    href={`/sessions/${session.id}`}
                    className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
                        <Brain className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{session.title}</p>
                        <p className="text-xs text-muted-foreground">{session.client.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-sm font-semibold text-purple-700">
                        {session.aiScore}/100
                      </span>
                      {session.evaluation && (
                        <div className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-yellow-500" />
                          <span className="text-sm">{session.evaluation}/10</span>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
          </div>
        </div>
      )}

      {/* Alerts */}
      <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          <h3 className="font-semibold text-orange-800">Alertas</h3>
        </div>
        <ul className="mt-2 space-y-1 text-sm text-orange-700">
          {(pendingRecordings.data?.length ?? 0) > 0 && (
            <li>
              <Link href="/recordings" className="hover:underline">
                {pendingRecordings.data?.length} gravacao(oes) por analisar com IA
              </Link>
            </li>
          )}
          <li>Sessoes concluidas sem notas do Fireflies aparecerao aqui</li>
          <li>Contratos a expirar nos proximos 30 dias</li>
        </ul>
      </div>
    </div>
  );
}
