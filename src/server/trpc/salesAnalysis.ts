import { z } from "zod";
import { router, publicProcedure } from "./init";
import { analyzeSalesCall } from "../services/sales-call-analyzer";
import { analyzeAudioFromUrl, uploadAudioBuffer } from "../services/assembly-ai";

const VISIBILITY = ["COMMERCIAL_ONLY", "WHOLE_TEAM"] as const;

export const salesAnalysisRouter = router({
  // List analyses for a client - with visibility filtering
  list: publicProcedure
    .input(z.object({
      clientId: z.string(),
      commercial: z.string().optional(),    // filter by commercial
      currentUser: z.string().optional(),   // to apply visibility rules
      isManager: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { clientId: input.clientId };
      if (input.commercial) where.commercial = input.commercial;

      // Visibility filter: if not manager, only see own analyses + WHOLE_TEAM ones
      if (!input.isManager && input.currentUser) {
        where.OR = [
          { visibility: "WHOLE_TEAM" },
          { commercial: input.currentUser },
        ];
      }

      return ctx.prisma.salesAnalysis.findMany({
        where,
        orderBy: { callDate: "desc" },
        include: { recording: { select: { id: true, title: true, fileUrl: true } } },
      });
    }),

  // Get summary stats per commercial
  statsPerCommercial: publicProcedure
    .input(z.object({ clientId: z.string() }))
    .query(async ({ ctx, input }) => {
      const analyses = await ctx.prisma.salesAnalysis.findMany({
        where: { clientId: input.clientId },
        select: {
          commercial: true, overallScore: true, classification: true,
          clarezaFluidez: true, tomVoz: true, assertividadeControlo: true,
          empatia: true, passagemValor: true, respostaObjecoes: true, estruturaMeet: true,
        },
      });

      const map: Record<string, {
        total: number; bom: number; medio: number; mau: number;
        avgScore: number; scoreSum: number; scoreCount: number;
        dimAvg: Record<string, { sum: number; count: number }>;
      }> = {};

      for (const a of analyses) {
        if (!map[a.commercial]) {
          map[a.commercial] = {
            total: 0, bom: 0, medio: 0, mau: 0,
            avgScore: 0, scoreSum: 0, scoreCount: 0,
            dimAvg: {},
          };
        }
        const c = map[a.commercial];
        c.total++;
        const cl = (a.classification || "").toLowerCase();
        if (cl.startsWith("bom")) c.bom++;
        else if (cl.startsWith("med")) c.medio++;
        else if (cl.startsWith("mau")) c.mau++;
        if (a.overallScore != null) {
          c.scoreSum += a.overallScore;
          c.scoreCount++;
        }
        const dims: Array<[string, number | null]> = [
          ["clarezaFluidez", a.clarezaFluidez],
          ["tomVoz", a.tomVoz],
          ["assertividadeControlo", a.assertividadeControlo],
          ["empatia", a.empatia],
          ["passagemValor", a.passagemValor],
          ["respostaObjecoes", a.respostaObjecoes],
          ["estruturaMeet", a.estruturaMeet],
        ];
        for (const [k, v] of dims) {
          if (v == null) continue;
          if (!c.dimAvg[k]) c.dimAvg[k] = { sum: 0, count: 0 };
          c.dimAvg[k].sum += v;
          c.dimAvg[k].count++;
        }
      }

      return Object.entries(map).map(([name, data]) => ({
        name,
        total: data.total,
        bom: data.bom, medio: data.medio, mau: data.mau,
        avgScore: data.scoreCount > 0 ? data.scoreSum / data.scoreCount : null,
        dimensions: Object.fromEntries(
          Object.entries(data.dimAvg).map(([k, v]) => [k, v.count > 0 ? v.sum / v.count : null])
        ),
      })).sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));
    }),

  // Create analysis manually
  create: publicProcedure
    .input(z.object({
      clientId: z.string(),
      recordingId: z.string().optional(),
      commercial: z.string().min(1),
      leadName: z.string().optional(),
      callType: z.string().min(1),
      callDate: z.date(),
      durationMinutes: z.number().optional(),
      visibility: z.enum(VISIBILITY).default("COMMERCIAL_ONLY"),
      classification: z.string().min(1),
      overallScore: z.number().optional(),
      clarezaFluidez: z.number().min(0).max(5).optional(),
      tomVoz: z.number().min(0).max(5).optional(),
      expositivoConversacional: z.string().optional(),
      assertividadeControlo: z.number().min(0).max(5).optional(),
      empatia: z.number().min(0).max(5).optional(),
      passagemValor: z.number().min(0).max(5).optional(),
      respostaObjecoes: z.number().min(0).max(5).optional(),
      estruturaMeet: z.number().min(0).max(5).optional(),
      strengths: z.string().optional(),
      weaknesses: z.string().optional(),
      generalTips: z.string().optional(),
      focusNext: z.string().optional(),
      summary: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.salesAnalysis.create({ data: input });
    }),

  // Update analysis (edit fields + visibility + mark as presented)
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      data: z.object({
        classification: z.string().optional(),
        overallScore: z.number().optional(),
        visibility: z.enum(VISIBILITY).optional(),
        clarezaFluidez: z.number().optional(),
        tomVoz: z.number().optional(),
        expositivoConversacional: z.string().optional(),
        assertividadeControlo: z.number().optional(),
        empatia: z.number().optional(),
        passagemValor: z.number().optional(),
        respostaObjecoes: z.number().optional(),
        estruturaMeet: z.number().optional(),
        strengths: z.string().optional(),
        weaknesses: z.string().optional(),
        generalTips: z.string().optional(),
        focusNext: z.string().optional(),
        summary: z.string().optional(),
        presentedToCommercialAt: z.date().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.salesAnalysis.update({ where: { id: input.id }, data: input.data });
    }),

  delete: publicProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return ctx.prisma.salesAnalysis.delete({ where: { id: input } });
  }),

  // ============================================================
  // Upload de audio para AssemblyAI (data URL base64)
  // ============================================================
  uploadAudioToAssembly: publicProcedure
    .input(z.object({
      dataUrl: z.string().startsWith("data:"),  // data URL do browser
    }))
    .mutation(async ({ input }) => {
      // Extract base64 from data URL
      const match = input.dataUrl.match(/^data:[^;]+;base64,(.+)$/);
      if (!match) throw new Error("Data URL invalida.");
      const buffer = Buffer.from(match[1], "base64");
      const uploadUrl = await uploadAudioBuffer(buffer);
      return { uploadUrl };
    }),

  // ============================================================
  // analyzeCallDeep - usa AssemblyAI para transcricao + metricas reais
  // depois passa a transcricao ao Claude para avaliacao qualitativa
  // ============================================================
  analyzeCallDeep: publicProcedure
    .input(z.object({
      clientId: z.string(),
      commercial: z.string().min(1),
      leadName: z.string().optional(),
      callType: z.string().default("Discovery Call"),
      callDate: z.date().default(() => new Date()),
      audioUrl: z.string().url(),   // URL publico (upload da AssemblyAI ou externo)
      visibility: z.enum(["COMMERCIAL_ONLY", "WHOLE_TEAM"]).default("COMMERCIAL_ONLY"),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. AssemblyAI: transcreve + calcula metricas reais de audio
      const { transcript, metrics, plainText } = await analyzeAudioFromUrl(input.audioUrl);

      // 2. Claude: avalia qualitativamente usando a transcricao + metricas como contexto
      const enrichedTranscript = `${plainText}

=== METRICAS DE DELIVERY (AssemblyAI) ===
Duracao: ${Math.round(metrics.durationSeconds / 60)} min
Ritmo global: ${metrics.wordsPerMinute.toFixed(0)} palavras/min
Preenchimentos: ${metrics.fillerWords.total} (${metrics.fillerWords.perMinute.toFixed(1)} por min)
  - Distribuicao: ${Object.entries(metrics.fillerWords.byWord).map(([k, v]) => `${k}: ${v}`).join(", ")}
Pausas longas (>1.5s): total ${metrics.totalSilenceSec.toFixed(0)}s, maior ${metrics.longestPauseSec.toFixed(1)}s
Interrupcoes: ${metrics.interruptions}
Sentimento: ${metrics.sentimentBreakdown.positive} positivos, ${metrics.sentimentBreakdown.negative} negativos, ${metrics.sentimentBreakdown.neutral} neutros

Talk-time por speaker:
${metrics.speakers.map(s => `  ${s.speaker}: ${s.talkTimePct.toFixed(0)}% do tempo, ${s.wpm.toFixed(0)}wpm, ${s.wordCount} palavras`).join("\n")}`;

      const aiResult = await analyzeSalesCall({
        clientId: input.clientId,
        transcript: enrichedTranscript,
        commercial: input.commercial,
        leadName: input.leadName,
        callType: input.callType,
      });

      // 3. Persiste Recording com tudo
      const rec = await ctx.prisma.recording.create({
        data: {
          title: `${input.commercial} x ${input.leadName ?? "Lead"} - ${input.callType}`,
          type: "CALL",
          duration: Math.round(metrics.durationSeconds),
          fileUrl: input.audioUrl,
          transcript: plainText,
          clientId: input.clientId,
          aiAnalysis: aiResult as unknown as Record<string, unknown>,
          aiScore: aiResult.overallScore,
          analyzedAt: new Date(),
          assemblyTranscriptId: transcript.id,
          audioAnalysis: metrics as unknown as Record<string, unknown>,
          audioAnalyzedAt: new Date(),
        },
      });

      // 4. Cria SalesAnalysis ligada
      const analysis = await ctx.prisma.salesAnalysis.create({
        data: {
          clientId: input.clientId,
          recordingId: rec.id,
          commercial: input.commercial,
          leadName: input.leadName,
          callType: input.callType,
          callDate: input.callDate,
          durationMinutes: Math.round(metrics.durationSeconds / 60),
          visibility: input.visibility,
          classification: aiResult.classification,
          overallScore: aiResult.overallScore,
          clarezaFluidez: aiResult.clarezaFluidez,
          tomVoz: aiResult.tomVoz,
          expositivoConversacional: aiResult.expositivoConversacional,
          assertividadeControlo: aiResult.assertividadeControlo,
          empatia: aiResult.empatia,
          passagemValor: aiResult.passagemValor,
          respostaObjecoes: aiResult.respostaObjecoes,
          estruturaMeet: aiResult.estruturaMeet,
          strengths: aiResult.strengths,
          weaknesses: aiResult.weaknesses,
          generalTips: aiResult.generalTips,
          focusNext: aiResult.focusNext,
          summary: aiResult.summary,
        },
      });

      return { analysis, recording: rec, metrics, aiResult };
    }),

  // ============================================================
  // analyzeCall - upload a transcript (or audio+transcript) and
  // auto-create a SalesAnalysis with AI scoring using the KB
  // filtered by the client's market
  // ============================================================
  analyzeCall: publicProcedure
    .input(z.object({
      clientId: z.string(),
      commercial: z.string().min(1),
      leadName: z.string().optional(),
      callType: z.string().default("Discovery Call"),
      callDate: z.date().default(() => new Date()),
      transcript: z.string().min(100, "A transcricao tem de ter pelo menos 100 caracteres"),
      audioUrl: z.string().optional(),          // opcional: link para o ficheiro audio
      audioFileName: z.string().optional(),
      durationMinutes: z.number().optional(),
      visibility: z.enum(["COMMERCIAL_ONLY", "WHOLE_TEAM"]).default("COMMERCIAL_ONLY"),
    }))
    .mutation(async ({ ctx, input }) => {
      // Run AI analysis against the KB (filtered by client market)
      const result = await analyzeSalesCall({
        clientId: input.clientId,
        transcript: input.transcript,
        commercial: input.commercial,
        leadName: input.leadName,
        callType: input.callType,
      });

      // Store as SalesAnalysis. Also create a Recording so transcript is persisted.
      let recordingId: string | null = null;
      try {
        const rec = await ctx.prisma.recording.create({
          data: {
            title: `${input.commercial} x ${input.leadName ?? "Lead"} - ${input.callType}`,
            type: "CALL",
            duration: input.durationMinutes ? input.durationMinutes * 60 : null,
            fileUrl: input.audioUrl ?? "",
            transcript: input.transcript,
            clientId: input.clientId,
            aiAnalysis: result as unknown as Record<string, unknown>,
            aiScore: result.overallScore,
            analyzedAt: new Date(),
          },
        });
        recordingId = rec.id;
      } catch (err) {
        console.error("[analyzeCall] recording persistence failed (non-blocking):", err);
      }

      const analysis = await ctx.prisma.salesAnalysis.create({
        data: {
          clientId: input.clientId,
          recordingId,
          commercial: input.commercial,
          leadName: input.leadName,
          callType: input.callType,
          callDate: input.callDate,
          durationMinutes: input.durationMinutes,
          visibility: input.visibility,
          classification: result.classification,
          overallScore: result.overallScore,
          clarezaFluidez: result.clarezaFluidez,
          tomVoz: result.tomVoz,
          expositivoConversacional: result.expositivoConversacional,
          assertividadeControlo: result.assertividadeControlo,
          empatia: result.empatia,
          passagemValor: result.passagemValor,
          respostaObjecoes: result.respostaObjecoes,
          estruturaMeet: result.estruturaMeet,
          strengths: result.strengths,
          weaknesses: result.weaknesses,
          generalTips: result.generalTips,
          focusNext: result.focusNext,
          summary: result.summary,
        },
      });

      return { analysis, aiResult: result };
    }),
});
