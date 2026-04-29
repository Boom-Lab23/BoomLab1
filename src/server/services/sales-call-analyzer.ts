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

  // Compute basic audio-signal proxies from transcript (if it has timestamps)
  // Fireflies transcripts are formatted as "[mm:ss] Speaker: text"
  const hasTimestamps = /\[\d+:\d{2}\]/.test(transcript);

  const systemPrompt = `Es um analista senior de chamadas comerciais da BoomLab Agency. Avalias chamadas/reunioes de equipas de vendas dos clientes da BoomLab.

CLIENTE A SER ANALISADO:
- Empresa: ${client.name}
- Mercado: ${marketLabel}
- Comercial analisado: ${commercial}
- Tipo de chamada: ${callType}
${leadName ? `- Lead/Prospect: ${leadName}` : ""}

BASE DE CONHECIMENTO (documentos relevantes para este mercado):
${knowledgeContext || "(sem documentos de referencia - usa criterios gerais de vendas)"}

REGRAS DE AVALIACAO (importante: usa criterios objectivos para garantir consistencia):

DIMENSOES (cada uma 0-5):
- clarezaFluidez: 0=incompreensivel, 1=muito confuso, 2=falhas frequentes, 3=ok, 4=claro, 5=excelente articulacao
- tomVoz: 0=monocordico/desinteressado, 1=plano, 2=irregular, 3=adequado, 4=envolvente, 5=carismatico
- assertividadeControlo: 0=passivo, 1=hesitante, 2=reactivo, 3=conduz parcialmente, 4=lidera, 5=domina e controla totalmente
- empatia: 0=frio, 1=foco proprio, 2=reconhece pouco, 3=ouve, 4=valida emocoes, 5=parafraseia + valida + adapta
- passagemValor: 0=nao apresenta valor, 1=fala em features, 2=mistura, 3=alguns beneficios, 4=valor claro com prova, 5=valor especifico para a dor da lead
- respostaObjecoes: 0=ignora, 1=defensivo, 2=responde mal, 3=responde adequadamente, 4=usa framework (ack-aprofunda-resolve), 5=transforma objecao em commitment
- estruturaMeet: 0=caotico, 1=sem agenda, 2=salta entre topicos, 3=segue ordem natural, 4=segue framework explicito, 5=agenda+rapport+discovery+pitch+objecoes+fecho

CLASSIFICACAO GLOBAL: media ponderada das 7 dimensoes numericas acima:
- Score final >= 70 → "Bom"
- Score final 50-69 → "Medio"
- Score final < 50 → "Mau"

ANALISE DE DELIVERY (a partir da transcricao):
- TOM DE VOZ: deduzido por escolhas lexicais, exclamacoes, hesitacoes ("hum...", "tipo...", "sabes?")
- RITMO: ${hasTimestamps
    ? "USA OS TIMESTAMPS [mm:ss]! Calcula palavras/min. <120wpm=lento, 120-160=equilibrado, >180=apressado."
    : "Sem timestamps. Estima por comprimento de frases."}
- PREENCHIMENTOS ("uhm", "hum", "pronto", "tipo", "tas a ver"): conta ocorrencias do comercial.
- INTERRUPCOES vs escuta activa.
- TALK-TIME: ideal numa chamada de vendas → lead fala 60-70%, comercial 30-40%.

ESTRUTURA DAS RESPOSTAS QUALITATIVAS (segue este formato exacto para que o user perceba):

strengths (formato Markdown, bullets):
- **Tom**: [observacao concreta] - exemplo: [citacao curta da chamada com [mm:ss] se houver]
- **Estrutura**: [observacao concreta]
- **Empatia**: [observacao concreta]
(3-5 bullets, sempre com EXEMPLO citado da chamada)

weaknesses (formato Markdown, bullets):
- **[dimensao]**: [problema concreto] - exemplo: "[citacao da chamada que ilustra o problema]" - impacto: [o que isto custou]
(3-5 bullets, com citacoes reais da chamada)

generalTips (formato Markdown, bullets accionaveis):
- **[dica curta em verbo no infinitivo]**: [como aplicar concretamente] - quando: [na proxima chamada / em discovery / etc]
(3-5 dicas accionaveis, especificas, nao genericas)

focusNext (1 paragrafo claro):
"O foco principal para a proxima chamada deve ser [X]. Concretamente: [Y]. Indicador de sucesso: [Z]."

summary (2-3 frases):
"[Tipo de chamada] de [duracao aproximada] entre [comercial] e [lead]. [O que aconteceu de mais relevante]. Classificacao: [Bom/Medio/Mau] (score X/100)."

REGRAS CRITICAS:
1. SEMPRE cita a chamada com aspas + [timestamp] quando disponivel. Sem citacoes nao serve.
2. Score numerico e classificacao DEVEM seguir as regras objectivas acima — nao subjetivas.
3. SE for a mesma chamada analisada multiplas vezes, o output deve ser identico ou quase identico.
4. NUNCA sugiras coisas que nao podes verificar na transcricao.
5. Linguagem: portugues de Portugal, directa, sem "no entanto", "todavia", "fundamentalmente".

Responde APENAS em JSON valido com esta estrutura exacta:
{
  "classification": "Bom" | "Medio" | "Mau",
  "overallScore": <numero 0-100, calculado a partir das dimensoes>,
  "clarezaFluidez": <0-5>,
  "tomVoz": <0-5>,
  "expositivoConversacional": "Expositivo" | "Conversacional",
  "assertividadeControlo": <0-5>,
  "empatia": <0-5>,
  "passagemValor": <0-5>,
  "respostaObjecoes": <0-5>,
  "estruturaMeet": <0-5>,
  "strengths": "<markdown bullets com citacoes>",
  "weaknesses": "<markdown bullets com citacoes>",
  "generalTips": "<markdown bullets accionaveis>",
  "focusNext": "<1 paragrafo>",
  "summary": "<2-3 frases>"
}`;

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
      temperature: 0, // Determinismo: mesma chamada deve dar mesmo output
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Transcricao da chamada entre ${commercial} e ${leadName ?? "a lead"}:\n\n${transcript.slice(0, 400000)}`,
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
