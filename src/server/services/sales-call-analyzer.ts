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

export type CommercialPersonality = "Introvertido" | "Extrovertido" | "Misto";

export interface SalesCallAnalysisResult {
  classification: "Muito Bom" | "Bom" | "Medio" | "Mau";
  overallScore: number; // 0-100, calculado ponderado
  // 8 dimensions (0-5) - pesos: 20/20/10/20/5/10/10/5
  clarezaFluidez: number;
  tomVoz: number;
  expositivoConversacional: "Expositivo" | "Conversacional";
  assertividadeControlo: number;
  empatia: number;
  passagemValor: number;
  respostaObjecoes: number;
  estruturaMeet: number;
  // Lead inference (a IA deduz pelo comportamento na chamada)
  leadDecisionStyle?: "Racional" | "Emocional" | "Misto";
  leadDecisionNotes?: string;
  // Qualitative
  strengths: string;
  weaknesses: string;
  generalTips: string;
  focusNext: string;
  summary: string;
}

// Pesos das dimensoes (somam 100). Replicados das sheets DSIC.
const DIMENSION_WEIGHTS = {
  clarezaFluidez: 20,
  tomVoz: 20,
  expositivoConversacional: 10, // Expositivo=2, Conversacional=5 (escala intrinseca)
  assertividadeControlo: 20,
  empatia: 5,
  passagemValor: 10,
  respostaObjecoes: 10,
  estruturaMeet: 5,
} as const;

/**
 * Calcula score ponderado (0-100) a partir das dimensoes (0-5).
 * Formula: sum(dim * peso) / 5 = score em 0-100.
 */
function computeWeightedScore(dims: {
  clarezaFluidez: number;
  tomVoz: number;
  expositivoConversacional: "Expositivo" | "Conversacional";
  assertividadeControlo: number;
  empatia: number;
  passagemValor: number;
  respostaObjecoes: number;
  estruturaMeet: number;
}): number {
  // Conversacional=5 (ideal), Expositivo=2 (mau)
  const expValue = dims.expositivoConversacional === "Conversacional" ? 5 : 2;
  const sum =
    dims.clarezaFluidez * DIMENSION_WEIGHTS.clarezaFluidez +
    dims.tomVoz * DIMENSION_WEIGHTS.tomVoz +
    expValue * DIMENSION_WEIGHTS.expositivoConversacional +
    dims.assertividadeControlo * DIMENSION_WEIGHTS.assertividadeControlo +
    dims.empatia * DIMENSION_WEIGHTS.empatia +
    dims.passagemValor * DIMENSION_WEIGHTS.passagemValor +
    dims.respostaObjecoes * DIMENSION_WEIGHTS.respostaObjecoes +
    dims.estruturaMeet * DIMENSION_WEIGHTS.estruturaMeet;
  // sum esta em [0, 500] (5 * 100). Dividir por 5 -> [0, 100].
  return Math.round((sum / 5) * 10) / 10;
}

/**
 * Classificacao a partir do score ponderado (thresholds das sheets DSIC).
 *   0-49  -> Mau
 *  50-74  -> Medio
 *  75-89  -> Bom
 *  >=90   -> Muito Bom
 */
function classifyFromScore(score: number): "Muito Bom" | "Bom" | "Medio" | "Mau" {
  if (score >= 90) return "Muito Bom";
  if (score >= 75) return "Bom";
  if (score >= 50) return "Medio";
  return "Mau";
}

export async function analyzeSalesCall(args: {
  clientId: string;
  transcript: string;
  commercial: string;
  leadName?: string;
  callType: string;
  /**
   * Personalidade do comercial (opcional). Se passado, a IA personaliza
   * as dicas. Caso contrario, faz lookup nesta ordem:
   *   1. ClientCommercial.id (se commercialMemberId fornecido)
   *   2. ClientCommercial(clientId, name) — match por nome dentro do cliente
   *   3. User.salesProfile.personality por nome (legacy fallback)
   */
  commercialPersonality?: CommercialPersonality;
  commercialMemberId?: string;
}): Promise<SalesCallAnalysisResult> {
  const { clientId, transcript, commercial, leadName, callType } = args;
  let { commercialPersonality } = args;

  // 1. Lookup directo por commercialMemberId (preferido)
  if (!commercialPersonality && args.commercialMemberId) {
    try {
      const member = await prisma.clientCommercial.findUnique({
        where: { id: args.commercialMemberId },
        select: { personality: true },
      });
      const p = member?.personality;
      if (p === "Introvertido" || p === "Extrovertido" || p === "Misto") {
        commercialPersonality = p;
      }
    } catch (err) {
      console.warn("[analyzeSalesCall] failed to fetch commercialMember:", err);
    }
  }
  // 2. Lookup por nome dentro do cliente (caso commercial seja string sem id)
  if (!commercialPersonality && clientId && commercial) {
    try {
      const member = await prisma.clientCommercial.findFirst({
        where: {
          clientId,
          name: { equals: commercial, mode: "insensitive" },
          isActive: true,
        },
        select: { personality: true },
      });
      const p = member?.personality;
      if (p === "Introvertido" || p === "Extrovertido" || p === "Misto") {
        commercialPersonality = p;
      }
    } catch {
      // best-effort
    }
  }
  // 3. Legacy fallback: User.salesProfile.personality
  if (!commercialPersonality && commercial) {
    try {
      const user = await prisma.user.findFirst({
        where: { name: { equals: commercial, mode: "insensitive" } },
        select: { salesProfile: true },
      });
      const profile = user?.salesProfile as { personality?: string } | null;
      const p = profile?.personality;
      if (p === "Introvertido" || p === "Extrovertido" || p === "Misto") {
        commercialPersonality = p;
      }
    } catch {
      // ignore - lookup por nome e best-effort
    }
  }

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

  // Adapta dicas conforme personalidade do comercial (input manual da equipa)
  const personalityGuidance = commercialPersonality
    ? commercialPersonality === "Introvertido"
      ? `\n\nPERFIL DO COMERCIAL: INTROVERTIDO.
Ao redigir 'generalTips' e 'focusNext', usa este perfil:
- Reforca preparacao previa (scripts, perguntas pre-feitas) que dao seguranca.
- Sugere tecnicas de pausa/escuta activa - sao o ponto forte natural.
- Evita pedir energia/exuberancia artificiais; aponta para "tom firme e seguro" em vez de "energia explosiva".
- Trabalha tom de voz pela cadencia controlada, nao pela altura.`
      : commercialPersonality === "Extrovertido"
      ? `\n\nPERFIL DO COMERCIAL: EXTROVERTIDO.
Ao redigir 'generalTips' e 'focusNext', usa este perfil:
- Reforca disciplina de escuta (extrovertidos tendem a falar demais e perder talk-time ideal).
- Sugere pausar antes de responder, contar 2 segundos antes de avancar.
- Aponta para canalizar a energia em perguntas, nao em monologos.
- Cuidado com interrupcoes - extrovertidos cortam mais a lead.`
      : `\n\nPERFIL DO COMERCIAL: MISTO. Adapta as dicas conforme o que aparece na chamada (mais energia ou mais escuta).`
    : "";

  const systemPrompt = `Es um analista senior de chamadas comerciais da BoomLab Agency. Avalias chamadas/reunioes de equipas de vendas dos clientes da BoomLab. O teu output e usado pelo comercial para melhorar — tem de ser concreto, citado, accionavel.

CLIENTE A SER ANALISADO:
- Empresa: ${client.name}
- Mercado: ${marketLabel}
- Comercial analisado: ${commercial}${commercialPersonality ? ` (perfil: ${commercialPersonality})` : ""}
- Tipo de chamada: ${callType}
${leadName ? `- Lead/Prospect: ${leadName}` : ""}${personalityGuidance}

BASE DE CONHECIMENTO (documentos relevantes para este mercado):
${knowledgeContext || "(sem documentos de referencia - usa criterios gerais de vendas)"}

DIMENSOES (cada uma 0-5) e PESOS para o score final:
- clarezaFluidez (peso 20%): 0=incompreensivel, 1=muito confuso, 2=falhas frequentes, 3=ok, 4=claro, 5=excelente articulacao
- tomVoz (peso 20%): 0=monocordico/desinteressado, 1=plano, 2=irregular, 3=adequado, 4=envolvente, 5=carismatico
- expositivoConversacional (peso 10%): "Expositivo"=fala em monologos, sem perguntas (mau); "Conversacional"=alterna pergunta-resposta, conduz com perguntas (ideal)
- assertividadeControlo (peso 20%): 0=passivo, 1=hesitante, 2=reactivo, 3=conduz parcialmente, 4=lidera, 5=domina e controla totalmente
- empatia (peso 5%): 0=frio, 1=foco proprio, 2=reconhece pouco, 3=ouve, 4=valida emocoes, 5=parafraseia + valida + adapta
- passagemValor (peso 10%): 0=nao apresenta valor, 1=fala em features, 2=mistura, 3=alguns beneficios, 4=valor claro com prova, 5=valor especifico para a dor da lead
- respostaObjecoes (peso 10%): 0=ignora, 1=defensivo, 2=responde mal, 3=responde adequadamente, 4=usa framework (ack-aprofunda-resolve), 5=transforma objecao em commitment
- estruturaMeet (peso 5%): 0=caotico, 1=sem agenda, 2=salta entre topicos, 3=segue ordem natural, 4=segue framework explicito, 5=agenda+rapport+discovery+pitch+objecoes+fecho

CLASSIFICACAO GLOBAL (calculada do score ponderado das dimensoes):
- Score >= 90 → "Muito Bom"
- Score 75-89 → "Bom"
- Score 50-74 → "Medio"
- Score < 50  → "Mau"

NAO calcules tu o overallScore - poe um numero estimado mas o backend recalcula com a formula ponderada.

ANTI-PADROES PORTUGUESES A CACAR (penalizam tomVoz/assertividade/passagemValor — cita verbatim com timestamp se ocorrerem):
- "tem 1 minutinho", "tem um minuto", "nao roubo muito o seu tempo", "roubar uns segundos", "fazer algumas perguntas", "se calhar", "tipo assim"
- Diminutivos com "-inho/-inha" ("contactinho", "questaozinha", "negocinho") — tiram autoridade
- Hesitacoes "ahn", "hum", "uhm" frequentes (>3-4 por minuto)
- Apresentar reuniao como "para apresentar os nossos servicos" (errado: a reuniao e para alinhar expectativas e qualificar)
- Avancar para reuniao sem qualificar (sem perceber se faz sentido)
- Usar "vou" no singular pela equipa quando deveria ser "vamos" ("tem 47 segundos" em vez de "temos 47 segundos")

ANALISE DE DELIVERY (a partir da transcricao):
- TOM DE VOZ: deduzido por escolhas lexicais, exclamacoes, hesitacoes
- RITMO: ${hasTimestamps
    ? "USA OS TIMESTAMPS [mm:ss]! Calcula palavras/min. <120wpm=lento, 120-160=equilibrado, >180=apressado."
    : "Sem timestamps. Estima por comprimento de frases."}
- PREENCHIMENTOS: conta ocorrencias do comercial.
- INTERRUPCOES vs escuta activa.
- TALK-TIME ideal: lead 60-70%, comercial 30-40%. "Quem fala mais perde, quem fala menos ganha."

PERFIL DA LEAD (campo leadDecisionStyle): deduz pelo comportamento na chamada como a lead toma decisoes.
- "Racional" = pede dados, faz perguntas analiticas, foca em criterios objectivos, ROI, processos.
- "Emocional" = mostra preocupacao com pessoas/relacoes, decide pelo "feeling", confianca, historia.
- "Misto" = combina ambos, sem predominar claramente.
Em leadDecisionNotes (1-2 frases) cita evidencia da chamada que justifica.

ESTRUTURA DAS RESPOSTAS QUALITATIVAS (tom: 2a pessoa, imperativo suave, coach):

strengths (Markdown bullets, 3-5 itens):
- **[Categoria]**: [observacao concreta] — exemplo: "[citacao da chamada com [mm:ss]]"

weaknesses (Markdown bullets, 3-5 itens):
- **[Dimensao/Categoria]**: [problema concreto] — exemplo: "[citacao da chamada]" — impacto: [o que isto custou na chamada]

generalTips (Markdown bullets, 3-5 itens AC­CIONAVEIS, em 2a pessoa, paralelos 1-para-1 aos pontos fracos):
- **Procura/Evita/Substitui [verbo]**: [como aplicar] — quando: [contexto concreto]
Exemplos do tom certo: "Procura sempre definir uma data para ligares de volta"; "Evita os 'inhos' que tiram autoridade"; "Substitui 'fazer algumas perguntas' por 'vou perceber melhor o vosso contexto'"; "Quando a lead disser X, espera 2 segundos antes de responder".

focusNext (1 paragrafo curto, 2-3 frases):
"O foco principal para a proxima chamada e [X]. Concretamente: [Y]. Indicador de sucesso: [Z]."

summary (2-3 frases):
"[Tipo de chamada] entre [comercial] e [lead]. [O que aconteceu de mais relevante]. Classificacao: [classificacao] (score estimado X/100)."

REGRAS CRITICAS:
1. SEMPRE cita a chamada com aspas + [mm:ss] quando os timestamps existirem. Sem citacoes nao tem valor.
2. Mesma chamada analisada N vezes deve dar output identico (temperature 0).
3. NUNCA inventes — so refere o que aparece na transcricao.
4. Portugues de Portugal, directo. Evita "no entanto", "todavia", "fundamentalmente", "outrossim".
5. Os anti-padroes acima DEVEM aparecer em weaknesses se ocorrerem na chamada — sao prioridade.

Responde APENAS em JSON valido com esta estrutura exacta:
{
  "classification": "Muito Bom" | "Bom" | "Medio" | "Mau",
  "overallScore": <numero 0-100 estimado, sera recalculado>,
  "clarezaFluidez": <0-5>,
  "tomVoz": <0-5>,
  "expositivoConversacional": "Expositivo" | "Conversacional",
  "assertividadeControlo": <0-5>,
  "empatia": <0-5>,
  "passagemValor": <0-5>,
  "respostaObjecoes": <0-5>,
  "estruturaMeet": <0-5>,
  "leadDecisionStyle": "Racional" | "Emocional" | "Misto",
  "leadDecisionNotes": "<1-2 frases citando evidencia>",
  "strengths": "<markdown bullets com citacoes>",
  "weaknesses": "<markdown bullets com citacoes e impacto>",
  "generalTips": "<markdown bullets em 2a pessoa, paralelos a weaknesses>",
  "focusNext": "<1 paragrafo curto>",
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

  // OVERRIDE objectivo: backend recalcula o score ponderado e classification
  // a partir das dimensoes (a IA pode estimar mal). Isto garante consistencia.
  parsed.overallScore = computeWeightedScore(parsed);
  parsed.classification = classifyFromScore(parsed.overallScore);

  return parsed;
}
