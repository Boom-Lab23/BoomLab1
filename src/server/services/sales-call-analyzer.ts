import { prisma } from "@/lib/prisma";

// ============================================================
// MARKET DETECTION - Auto-detect which markets a KB doc applies to
// ============================================================
//
// Returns an array of market codes: "ALL" | "CREDITO" | "SEGUROS" | "IMOBILIARIO"
// If the doc is generic, returns ["ALL"]. Otherwise returns only relevant markets.

const VALID_MARKETS = ["ALL", "CREDITO", "SEGUROS", "IMOBILIARIO"] as const;
export type MarketCode = (typeof VALID_MARKETS)[number];

export async function detectDocumentMarkets(args: {
  name: string;
  category?: string | null;
  content: string;
}): Promise<MarketCode[]> {
  const { name, category, content } = args;
  if (!process.env.ANTHROPIC_API_KEY) {
    return ["ALL"]; // fallback if no API key
  }

  // Short content → heuristic fallback
  const lower = (name + " " + (category ?? "") + " " + content).toLowerCase();
  if (content.length < 200) {
    const markets: MarketCode[] = [];
    if (/cr[eé]dit|hipotec|intermedi|banc[aá]ri/i.test(lower)) markets.push("CREDITO");
    if (/segur|ap[oó]lic|fidelidade|allianz|generali|trauma/i.test(lower)) markets.push("SEGUROS");
    if (/imob|imov|vende-se|angaria|arrendamento|idealista/i.test(lower)) markets.push("IMOBILIARIO");
    return markets.length > 0 ? markets : ["ALL"];
  }

  const systemPrompt = `Es um classificador de documentos de vendas da BoomLab Agency.

A BoomLab trabalha com clientes de 3 mercados distintos:
- CREDITO: Intermediacao de credito (habitacao, pessoal, consumo, cartoes, parcerias com imobiliarias/contabilistas)
- SEGUROS: Corretagem e mediacao de seguros (vida, saude, auto, habitacao, multirriscos; parceiros: Fidelidade, Allianz, Generali, Tranquilidade...)
- IMOBILIARIO: Mediacao imobiliaria (angariacao, venda, arrendamento, comercial; portais como Idealista, Imovirtual)

O teu trabalho e classificar a que mercados um documento (script, SOP, framework, criterio, material) se aplica.

Regras:
- Se o documento e GENERICO (aplica-se a qualquer mercado comercial, ex: frameworks de reuniao genericos, objection handling universal, tecnicas de fecho, tom de voz) -> devolve ["ALL"]
- Se o documento menciona ou esta claramente focado num mercado especifico -> devolve so esse(s) mercado(s)
- Se abrange 2 mercados -> devolve ambos
- Nunca misturar "ALL" com mercados especificos. Ou "ALL", ou uma lista de mercados especificos.

Responde APENAS com um array JSON, sem explicacao. Exemplos validos:
["ALL"]
["CREDITO"]
["SEGUROS", "IMOBILIARIO"]
["CREDITO", "SEGUROS", "IMOBILIARIO"]`;

  const userContent = `Nome: ${name}
Categoria: ${category ?? "(sem categoria)"}

Conteudo (primeiros 6000 caracteres):
${content.slice(0, 6000)}

A que mercados se aplica este documento? Responde so com o array JSON.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 200,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) return ["ALL"];
    const data = await response.json();
    const text = data.content?.[0]?.text ?? "";
    const match = text.match(/\[[^\]]*\]/);
    if (!match) return ["ALL"];

    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return ["ALL"];

    const filtered = parsed.filter((m): m is MarketCode =>
      typeof m === "string" && (VALID_MARKETS as readonly string[]).includes(m)
    );

    if (filtered.length === 0) return ["ALL"];
    // If ALL is present, it should be alone
    if (filtered.includes("ALL")) return ["ALL"];
    return filtered;
  } catch (err) {
    console.error("[detectDocumentMarkets] Failed:", err);
    return ["ALL"];
  }
}

// ============================================================
// CALL ANALYSIS - Analyze a sales call for a specific client
// ============================================================

export interface SalesCallAnalysisResult {
  classification: "Bom" | "Medio" | "Mau";
  overallScore: number; // 0-100
  // 8 dimensions (0-5)
  clarezaFluidez: number;
  tomVoz: number;
  expositivoConversacional: "Expositivo" | "Conversacional";
  assertividadeControlo: number;
  empatia: number;
  passagemValor: number;
  respostaObjecoes: number;
  estruturaMeet: number;
  // Qualitative
  strengths: string;
  weaknesses: string;
  generalTips: string;
  focusNext: string;
  summary: string;
}

export async function analyzeSalesCall(args: {
  clientId: string;
  transcript: string;
  commercial: string;
  leadName?: string;
  callType: string;
}): Promise<SalesCallAnalysisResult> {
  const { clientId, transcript, commercial, leadName, callType } = args;

  // Fetch client + its market (via dashboard)
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: clientId },
    include: { dashboard: true },
  });
  const clientMarket = client.dashboard?.market ?? null; // MarketType enum: CREDITO | SEGUROS | IMOBILIARIO

  // Fetch knowledge base docs that apply to this market (or generic ALL)
  // Prisma `hasSome` on String[] field
  const knowledgeDocs = await prisma.aIScript.findMany({
    where: {
      isActive: true,
      OR: [
        { markets: { has: "ALL" } },
        clientMarket ? { markets: { has: clientMarket } } : { markets: { isEmpty: false } },
      ],
    },
    select: { name: true, category: true, content: true, markets: true },
    orderBy: { updatedAt: "desc" },
  });

  // Compose knowledge context
  const knowledgeContext = knowledgeDocs
    .map((d, i) => `--- Doc ${i + 1}: [${d.category ?? "geral"}] ${d.name} (${d.markets.join(", ")}) ---\n${d.content.slice(0, 8000)}`)
    .join("\n\n");

  const marketLabel = clientMarket
    ? (clientMarket === "CREDITO" ? "Credito (intermediacao de credito)"
      : clientMarket === "SEGUROS" ? "Seguros (mediacao de seguros)"
      : "Imobiliario (mediacao imobiliaria)")
    : "(nao definido)";

  const systemPrompt = `Es um analista senior de chamadas comerciais da BoomLab Agency. Avalias chamadas/reunioes de equipas de vendas dos clientes da BoomLab.

CLIENTE A SER ANALISADO:
- Empresa: ${client.name}
- Mercado: ${marketLabel}
- Comercial analisado: ${commercial}
- Tipo de chamada: ${callType}
${leadName ? `- Lead/Prospect: ${leadName}` : ""}

BASE DE CONHECIMENTO (documentos relevantes para este mercado):
${knowledgeContext || "(sem documentos de referencia - usa criterios gerais de vendas)"}

O teu trabalho:
1. Analisar a transcricao da chamada usando EXCLUSIVAMENTE os criterios e scripts acima (se existirem) + boas praticas gerais de vendas
2. Classificar de forma objetiva
3. Identificar pontos fortes (factuais, com exemplos da chamada)
4. Identificar pontos fracos (concretos, acionaveis)
5. Dar dicas praticas e foco para chamadas futuras

Responde APENAS em JSON valido com esta estrutura exata:
{
  "classification": "Bom" | "Medio" | "Mau",
  "overallScore": <numero 0-100>,
  "clarezaFluidez": <0-5>,
  "tomVoz": <0-5>,
  "expositivoConversacional": "Expositivo" | "Conversacional",
  "assertividadeControlo": <0-5>,
  "empatia": <0-5>,
  "passagemValor": <0-5>,
  "respostaObjecoes": <0-5>,
  "estruturaMeet": <0-5>,
  "strengths": "texto livre com pontos fortes, usa bullet points separados por quebras de linha",
  "weaknesses": "texto livre com pontos fracos",
  "generalTips": "dicas praticas de melhoria",
  "focusNext": "foco principal para as proximas chamadas deste comercial",
  "summary": "resumo executivo de 2-3 frases da chamada e avaliacao"
}

IMPORTANTE: a linguagem e sempre em portugues de Portugal, direta e sem floreados.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Transcricao da chamada entre ${commercial} e ${leadName ?? "a lead"}:\n\n${transcript.slice(0, 90000)}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Claude API error ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  const text: string = data.content?.[0]?.text ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Resposta da IA invalida (sem JSON).");

  const parsed = JSON.parse(jsonMatch[0]) as SalesCallAnalysisResult;
  return parsed;
}
