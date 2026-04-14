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
      <div className="rounded-xl border bg-gray-900 p-6">
        <div className="flex items-center gap-4">
          <button className="flex h-12 w-12 items-center justify-center rounded-full bg-card text-gray-900">
            <Play className="h-5 w-5 ml-0.5" />
          </button>
          <div className="flex-1">
            <div className="h-2 rounded-full bg-gray-700">
              <div className="h-2 w-0 rounded-full bg-card" />
            </div>
            <div className="mt-1 flex justify-between text-xs text-gray-400">
              <span>0:00</span>
              <span>{rec.duration ? `${Math.floor(rec.duration / 60)}:${String(rec.duration % 60).padStart(2, "0")}` : "-"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* AI Analysis */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b p-4">
            <Brain className="h-5 w-5 text-purple-600" />
            <h2 className="font-semibold">Analise IA</h2>
            {rec.aiScore !== null && (
              <span className="ml-auto text-2xl font-bold text-purple-600">{rec.aiScore}/100</span>
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
                        <span>{c.name}</span>
                        <span className="font-medium">{c.score}/{c.maxScore}</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full bg-purple-600"
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
                    <h3 className="mb-2 flex items-center gap-1 text-sm font-medium text-green-700">
                      <TrendingUp className="h-4 w-4" /> Pontos Fortes
                    </h3>
                    <ul className="space-y-1">
                      {analysis.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-muted-foreground">+ {s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Improvements */}
                {analysis.improvements.length > 0 && (
                  <div>
                    <h3 className="mb-2 flex items-center gap-1 text-sm font-medium text-orange-700">
                      <TrendingDown className="h-4 w-4" /> Areas de Melhoria
                    </h3>
                    <ul className="space-y-1">
                      {analysis.improvements.map((s, i) => (
                        <li key={i} className="text-sm text-muted-foreground">- {s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Summary */}
                <div className="border-t pt-3">
                  <p className="text-sm leading-relaxed text-muted-foreground">{analysis.summary}</p>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <Brain className="mx-auto h-12 w-12 text-muted-foreground/30" />
                <p className="mt-2 text-sm text-muted-foreground">Analise IA ainda nao realizada</p>
                <button className="mt-3 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700">
                  Analisar com IA
                </button>
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
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{rec.transcript}</p>
            ) : (
              <div className="text-center">
                <Mic className="mx-auto h-12 w-12 text-muted-foreground/30" />
                <p className="mt-2 text-sm text-muted-foreground">Transcricao nao disponivel</p>
                <button className="mt-3 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
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
