"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Mic, Upload, Brain, ChevronRight } from "lucide-react";
import { UploadCallDialog } from "@/components/recordings/upload-call-dialog";

export default function RecordingsPage() {
  const [filter, setFilter] = useState<"all" | "analyzed" | "pending">("all");
  const [showUpload, setShowUpload] = useState(false);

  const recordings = trpc.recordings.list.useQuery({
    analyzed: filter === "analyzed" ? true : filter === "pending" ? false : undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gravacoes & IA</h1>
          <p className="text-muted-foreground">Gravacoes de chamadas e reunioes com analise IA</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Upload className="h-4 w-4" />
          Upload Chamada
        </button>
      </div>

      <UploadCallDialog open={showUpload} onClose={() => setShowUpload(false)} />

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[
          { key: "all", label: "Todas" },
          { key: "analyzed", label: "Analisadas" },
          { key: "pending", label: "Por analisar" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as typeof filter)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              filter === tab.key ? "bg-gray-900 text-white" : "bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Recordings List */}
      <div className="rounded-xl border bg-card">
        <div className="divide-y">
          {recordings.isLoading && (
            <div className="p-8 text-center text-muted-foreground">A carregar...</div>
          )}
          {recordings.data?.length === 0 && (
            <div className="flex flex-col items-center gap-2 p-8 text-muted-foreground">
              <Mic className="h-8 w-8" />
              <p>Sem gravacoes</p>
            </div>
          )}
          {recordings.data?.map((rec) => (
            <Link
              key={rec.id}
              href={`/recordings/${rec.id}`}
              className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  rec.type === "CALL" ? "bg-yellow-50" : "bg-blue-50"
                )}>
                  <Mic className={cn("h-5 w-5", rec.type === "CALL" ? "text-yellow-600" : "text-blue-600")} />
                </div>
                <div>
                  <p className="font-medium">{rec.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {rec.client.name} &middot; {rec.type === "CALL" ? "Chamada" : "Reuniao"}{" "}
                    {rec.duration ? `| ${Math.round(rec.duration / 60)}min` : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {rec.aiScore !== null ? (
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-purple-600" />
                    <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-semibold text-purple-700">
                      {rec.aiScore}/100
                    </span>
                  </div>
                ) : (
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700">
                    Por analisar
                  </span>
                )}
                <span className="text-sm text-muted-foreground">
                  {new Date(rec.createdAt).toLocaleDateString("pt-PT")}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
