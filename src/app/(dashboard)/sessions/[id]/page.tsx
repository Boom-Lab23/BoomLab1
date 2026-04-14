"use client";

import { use } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn, getStatusColor, formatStatus, getPillarFromModule } from "@/lib/utils";
import {
  ArrowLeft, Calendar, User, Star, Mic, FileText, CheckCircle2,
  Bot, ListChecks, ExternalLink, Sparkles, Send, MessageSquare,
  TrendingUp, TrendingDown, Clock, Target,
} from "lucide-react";

type ActionPlanItem = {
  task: string;
  responsible: string;
  deadline: string;
  priority: "alta" | "media" | "baixa";
};

type ActionPlan = {
  items: ActionPlanItem[];
  nextMeetingTopics: string[];
  followUpDate: string;
};

type SessionAnalysis = {
  summary: string;
  feedback: string;
  score: number;
  strengths: string[];
  improvements: string[];
  keyDecisions: string[];
};

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const session = trpc.sessions.getById.useQuery(id);
  const analyzeMeeting = trpc.fireflies.analyzeMeeting.useMutation({
    onSuccess: () => session.refetch(),
  });
  const sendToSlack = trpc.slack.sendActionPlan.useMutation({
    onSuccess: () => session.refetch(),
  });

  if (session.isLoading) {
    return <div className="p-8 text-center text-muted-foreground">A carregar...</div>;
  }

  if (!session.data) {
    return <div className="p-8 text-center text-muted-foreground">Sessao nao encontrada</div>;
  }

  const s = session.data;
  const pillar = getPillarFromModule(s.module);
  const actionItems = (s.actionItems as string[] | null) ?? [];
  const actionPlan = s.actionPlan as unknown as ActionPlan | null;
  const analysis = s.aiAnalysis as unknown as SessionAnalysis | null;

  const priorityColors: Record<string, string> = {
    alta: "bg-red-100 text-red-700",
    media: "bg-yellow-100 text-yellow-700",
    baixa: "bg-green-100 text-green-700",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/sessions" className="rounded-lg p-2 transition-colors hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{s.title}</h1>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", getStatusColor(s.status))}>
              {formatStatus(s.status)}
            </span>
            {s.aiScore !== null && s.aiScore !== undefined && (
              <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
                IA: {s.aiScore}/100
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {pillar && (
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pillar.color }} />
                {pillar.label}
              </span>
            )}
            {s.topic && <><span>&middot;</span><span>{s.topic}</span></>}
          </div>
        </div>
        {/* Action buttons */}
        <div className="flex gap-2">
          {s.firefliesNotes && !s.aiAnalysis && (
            <button
              onClick={() => analyzeMeeting.mutate(s.id)}
              disabled={analyzeMeeting.isPending}
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {analyzeMeeting.isPending ? "A analisar..." : "Analisar com IA"}
            </button>
          )}
          {actionPlan && (
            <button
              onClick={() => sendToSlack.mutate(s.id)}
              disabled={sendToSlack.isPending || !!s.actionPlanSentAt}
              className="flex items-center gap-2 rounded-lg bg-[#4A154B] px-4 py-2 text-sm font-medium text-white hover:bg-[#3a1039] disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {s.actionPlanSentAt
                ? `Enviado ${new Date(s.actionPlanSentAt).toLocaleDateString("pt-PT")}`
                : sendToSlack.isPending
                  ? "A enviar..."
                  : "Enviar para Slack"}
            </button>
          )}
        </div>
      </div>

      {/* Meta cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" /> Data
          </div>
          <p className="mt-1 font-medium">
            {s.date ? new Date(s.date).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" }) : "-"}
          </p>
        </div>
        <Link href={`/clients/${s.clientId}`} className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" /> Cliente
          </div>
          <p className="mt-1 font-medium">{s.client.name}</p>
        </Link>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" /> Responsavel
          </div>
          <p className="mt-1 font-medium">{s.assignedTo?.name ?? "Sem atribuicao"}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Star className="h-4 w-4" /> Avaliacao
          </div>
          <p className="mt-1 text-2xl font-bold">{s.evaluation ?? "-"}<span className="text-sm font-normal text-muted-foreground">/10</span></p>
        </div>
      </div>

      {/* AI Analysis (if available) */}
      {analysis && (
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b p-4">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <h2 className="font-semibold">Analise IA da Reuniao</h2>
            <span className="ml-auto text-2xl font-bold text-purple-600">{analysis.score}/100</span>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            {/* Feedback */}
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-muted-foreground">{analysis.feedback}</p>
              {/* Strengths */}
              <div>
                <h3 className="mb-1 flex items-center gap-1 text-sm font-medium text-green-700">
                  <TrendingUp className="h-4 w-4" /> Pontos Fortes
                </h3>
                <ul className="space-y-0.5">
                  {analysis.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-muted-foreground">+ {s}</li>
                  ))}
                </ul>
              </div>
              {/* Improvements */}
              <div>
                <h3 className="mb-1 flex items-center gap-1 text-sm font-medium text-orange-700">
                  <TrendingDown className="h-4 w-4" /> Areas de Melhoria
                </h3>
                <ul className="space-y-0.5">
                  {analysis.improvements.map((s, i) => (
                    <li key={i} className="text-sm text-muted-foreground">- {s}</li>
                  ))}
                </ul>
              </div>
            </div>
            {/* Key Decisions */}
            {analysis.keyDecisions?.length > 0 && (
              <div>
                <h3 className="mb-2 flex items-center gap-1 text-sm font-medium">
                  <Target className="h-4 w-4" /> Decisoes-Chave
                </h3>
                <ul className="space-y-1">
                  {analysis.keyDecisions.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Summary / Fireflies */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b p-4">
            <Bot className="h-5 w-5 text-purple-600" />
            <h2 className="font-semibold">Resumo da Reuniao</h2>
            {s.firefliesId ? (
              <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Fireflies</span>
            ) : (
              <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">Por sincronizar</span>
            )}
          </div>
          <div className="p-4">
            {s.firefliesSummary ? (
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{s.firefliesSummary}</p>
            ) : (
              <div className="text-center py-4">
                <Bot className="mx-auto h-10 w-10 text-muted-foreground/30" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Resumo aparecera automaticamente apos a reuniao ser processada pelo Fireflies.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Plan */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b p-4">
            <ListChecks className="h-5 w-5 text-blue-600" />
            <h2 className="font-semibold">Plano de Acao</h2>
            {s.actionPlanSentAt && (
              <span className="ml-auto flex items-center gap-1 rounded-full bg-[#4A154B]/10 px-2 py-0.5 text-xs text-[#4A154B]">
                <MessageSquare className="h-3 w-3" /> Enviado via Slack
              </span>
            )}
          </div>
          <div className="p-4">
            {actionPlan ? (
              <div className="space-y-3">
                {actionPlan.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                    <span className={cn("mt-0.5 rounded px-1.5 py-0.5 text-xs font-medium", priorityColors[item.priority] ?? "bg-gray-100")}>
                      {item.priority}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.task}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.responsible} &middot; Prazo: {item.deadline}
                      </p>
                    </div>
                  </div>
                ))}
                {actionPlan.nextMeetingTopics?.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Topicos proxima reuniao:</p>
                    <ul className="space-y-0.5">
                      {actionPlan.nextMeetingTopics.map((t, i) => (
                        <li key={i} className="text-sm text-muted-foreground">• {t}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {actionPlan.followUpDate && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> Follow-up: {actionPlan.followUpDate}
                  </p>
                )}
              </div>
            ) : actionItems.length > 0 ? (
              <ul className="space-y-2">
                {actionItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Plano de acao sera gerado automaticamente quando a reuniao for analisada pela IA.
              </p>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-xl border bg-card">
          <div className="border-b p-4">
            <h2 className="font-semibold">Notas da Sessao</h2>
          </div>
          <div className="p-4">
            {s.notes ? (
              <div className="prose prose-sm max-w-none whitespace-pre-wrap">{s.notes}</div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Sem notas manuais.</p>
            )}
          </div>
        </div>

        {/* Recordings & Documents */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-card">
            <div className="flex items-center gap-2 border-b p-4">
              <Mic className="h-5 w-5 text-red-600" />
              <h2 className="font-semibold">Gravacoes</h2>
            </div>
            <div className="divide-y">
              {s.recordings.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground italic">Sem gravacoes</p>
              ) : (
                s.recordings.map((rec) => (
                  <Link key={rec.id} href={`/recordings/${rec.id}`} className="flex items-center justify-between p-3 transition-colors hover:bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Mic className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{rec.title}</span>
                    </div>
                    {rec.aiScore !== null && (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                        IA: {rec.aiScore}/100
                      </span>
                    )}
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-card">
            <div className="flex items-center gap-2 border-b p-4">
              <FileText className="h-5 w-5 text-blue-600" />
              <h2 className="font-semibold">Documentos</h2>
            </div>
            <div className="divide-y">
              {s.documents.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground italic">Sem documentos</p>
              ) : (
                s.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{doc.title}</span>
                    </div>
                    {doc.googleDocsUrl && (
                      <a href={doc.googleDocsUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full transcript (collapsible) */}
      {s.firefliesNotes && (
        <details className="rounded-xl border bg-card">
          <summary className="cursor-pointer p-4 font-semibold hover:bg-muted/50">
            Transcricao Completa
          </summary>
          <div className="max-h-[500px] overflow-y-auto border-t p-4">
            <pre className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground font-sans">
              {s.firefliesNotes}
            </pre>
          </div>
        </details>
      )}
    </div>
  );
}
