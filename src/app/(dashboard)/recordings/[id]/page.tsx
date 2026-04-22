"use client";

import { use } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import type { AIAnalysisResult } from "@/types";
import { ArrowLeft, Mic, Brain, TrendingUp, TrendingDown, Minus, Play } from "lucide-react";

export default function RecordingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const recording = trpc.recordings.getById.useQuery(id);

  if (recording.isLoading) {
    return <div className="p-8 text-center text-muted-foreground">A carregar...</div>;
  }

  if (!recording.data) {
    return <div className="p-8 text-center text-muted-foreground">Gravacao nao encontrada</div>;
  }

  const rec = recording.data;
  const analysis = rec.aiAnalysis as AIAnalysisResult | null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/recordings" className="rounded-lg p-2 transition-colors hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{rec.title}</h1>
          <p className="text-muted-foreground">
            {rec.client.name} &middot; {rec.type === "CALL" ? "Chamada" : "Reuniao"}{" "}
            {rec.duration ? `| ${Math.round(rec.duration / 60)} minutos` : ""}
          </p>
        </div>
      </div>

      {/* Player */}
      <div className="rounded-xl border bg-gray-900 p-4 md:p-6">
        {rec.fileUrl ? (
          <>
            {/\.(mp4|webm|mov)(\?|$)/i.test(rec.fileUrl) ? (
              <video src={rec.fileUrl} controls className="w-full rounded-lg bg-black" preload="metadata">
                O teu browser nao suporta video.
              </video>
            ) : /\.(mp3|wav|m4a|ogg|aac)(\?|$)/i.test(rec.fileUrl) || rec.fileUrl.startsWith("data:audio") ? (
              <audio src={rec.fileUrl} controls className="w-full" preload="metadata">
                O teu browser nao suporta audio.
              </audio>
            ) : rec.fileUrl.includes("fireflies.ai") ? (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/20">
                    <Play className="h-5 w-5 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Gravacao no Fireflies</p>
                    <p className="text-xs text-gray-400">Abre no Fireflies para ouvir com transcricao sincronizada</p>
                  </div>
                </div>
                <a
                  href={rec.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
                >
                  Abrir no Fireflies
                </a>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="text-sm text-gray-300">Gravacao disponivel externamente</p>
                <a
                  href={rec.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 shadow-sm"
                >
                  Abrir / Download
                </a>
              </div>
            )}
            {rec.duration && (
              <p className="mt-2 text-xs text-gray-400">
                Duracao: {Math.floor(rec.duration / 60)}:{String(rec.duration % 60).padStart(2, "0")}
              </p>
            )}
          </>
        ) : (
          <div className="flex items-center gap-3 text-gray-400">
            <Play className="h-5 w-5" />
            <p className="text-sm">Sem ficheiro de audio/video disponivel. Apenas a transcricao foi importada.</p>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* AI Analysis */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b p-4">
            <Brain className="h-5 w-5 text-purple-400" />
            <h2 className="font-semibold text-foreground">Analise IA</h2>
            {rec.aiScore !== null && (
              <span className="ml-auto text-2xl font-bold text-purple-400">{rec.aiScore}/100</span>
            )}
          </div>
          <div className="p-4">
            {analysis ? (
              <div className="space-y-4">
                {/* Criteria Scores */}
                <div className="space-y-2">
                  {analysis.criteria.map((c, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{c.name}</span>
                        <span className="font-medium text-foreground">{c.score}/{c.maxScore}</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-purple-500"
                          style={{ width: `${(c.score / c.maxScore) * 100}%` }}
                        />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{c.feedback}</p>
                    </div>
                  ))}
                </div>

                {/* Strengths */}
                {analysis.strengths.length > 0 && (
                  <div>
                    <h3 className="mb-2 flex items-center gap-1 text-sm font-medium text-green-400">
                      <TrendingUp className="h-4 w-4" /> Pontos Fortes
                    </h3>
                    <ul className="space-y-1">
                      {analysis.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-foreground/90">+ {s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Improvements */}
                {analysis.improvements.length > 0 && (
                  <div>
                    <h3 className="mb-2 flex items-center gap-1 text-sm font-medium text-orange-400">
                      <TrendingDown className="h-4 w-4" /> Areas de Melhoria
                    </h3>
                    <ul className="space-y-1">
                      {analysis.improvements.map((s, i) => (
                        <li key={i} className="text-sm text-foreground/90">- {s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Summary */}
                <div className="border-t pt-3">
                  <p className="text-sm leading-relaxed text-foreground/90">{analysis.summary}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <Brain className="mx-auto h-12 w-12 text-muted-foreground/30" />
                <p className="mt-2 text-sm text-muted-foreground">Analise IA ainda nao realizada</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Para analisar esta chamada, vai ao{" "}
                  <Link href={`/workspace/${rec.clientId}`} className="text-purple-600 underline">
                    Workspace do cliente
                  </Link>{" "}
                  → Analise de Vendas → Analisar Chamada (IA).
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Tom, ritmo, cadencia e 8 dimensoes de scoring sao avaliados automaticamente usando a Base de Conhecimento do mercado do cliente.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Transcript */}
        <div className="rounded-xl border bg-card">
          <div className="border-b p-4">
            <h2 className="font-semibold">Transcricao</h2>
          </div>
          <div className="max-h-[600px] overflow-y-auto p-4">
            {rec.transcript ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{rec.transcript}</p>
            ) : (
              <div className="text-center">
                <Mic className="mx-auto h-12 w-12 text-muted-foreground/30" />
                <p className="mt-2 text-sm text-muted-foreground">Transcricao nao disponivel</p>
                <button className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  Transcrever
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
