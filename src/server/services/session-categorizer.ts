// Automatically categorize sessions based on title from Calendar/Fireflies

export type SessionCategory = {
  module: string;
  topic: string | null;
  sessionNumber: number | null;
  clientName: string | null;
};

export function categorizeByTitle(title: string): SessionCategory {
  const t = title.toLowerCase();
  let module = "Outros";
  let topic: string | null = null;
  let sessionNumber: number | null = null;
  let clientName: string | null = null;

  // Extract session number (S1, S2, S3, etc.)
  const sessionMatch = title.match(/S(\d+)/i);
  if (sessionMatch) {
    sessionNumber = parseInt(sessionMatch[1]);
  }

  // Extract client name (after ":" in Fireflies titles)
  const colonMatch = title.match(/:\s*(.+?)(?:\s+S\d+|\s*$)/i);
  if (colonMatch) {
    clientName = colonMatch[1].trim();
    // Remove group info like "grupo A", "grupo B"
    clientName = clientName.replace(/\s*-?\s*grupo\s+[a-z]/i, "").trim();
  }

  // Categorize by module
  if (t.includes("gestão comercial") || t.includes("gestao comercial")) {
    module = "Gestao Comercial";
  } else if (t.includes("consultoria comercial")) {
    module = "Consultoria Comercial";
  } else if (t.includes("consultoria de vendas") || t.includes("formação de vendas") || t.includes("formacao de vendas")) {
    module = "Consultoria de Vendas";
  } else if (t.includes("cold call")) {
    module = "Cold Calls";
  } else if (t.includes("parcerias") || t.includes("parceiro")) {
    module = "Parcerias";
  } else if (t.includes("ads funnel") || t.includes("funil de anúncios") || t.includes("funil de anuncios")) {
    module = "Ads Funnel";
  } else if (t.includes("linkedin") || t.includes("outreach") || t.includes("waalaxy")) {
    module = "LinkedIn Outreach";
  } else if (t.includes("boomclub") || t.includes("boom club") || t.includes("retenção") || t.includes("retencao") || t.includes("sessões ra") || t.includes("sessoes ra")) {
    module = "BoomClub";
  } else if (t.includes("levantamento")) {
    module = "Levantamento";
  } else if (t.includes("apresentação timeline") || t.includes("apresentacao timeline")) {
    module = "Apresentacao Timeline";
  } else if (t.includes("rh") || t.includes("recrutamento") || t.includes("recursos humanos") || t.includes("processo de rh")) {
    module = "RH";
  } else if (t.includes("overview") && !t.includes("serviço") && !t.includes("servico")) {
    module = "Overview";
  } else if (t.includes("end of month")) {
    module = "Gestao Comercial";
    topic = "End of Month";
  } else if (t.includes("accountability")) {
    module = "Gestao Comercial";
    topic = "Accountability";
  } else if (t.includes("acompanhamento")) {
    module = "Acompanhamento Semanal";
  } else if (t.includes("roleplay")) {
    module = "Consultoria de Vendas";
    topic = "Roleplay";
  } else if (t.includes("análise de chamadas") || t.includes("analise de chamadas")) {
    module = "Consultoria de Vendas";
    topic = "Analise de Chamadas";
  }

  // Extract topic from specific patterns
  if (!topic) {
    if (t.includes("overview")) topic = "Overview";
    if (t.includes("métricas") || t.includes("metricas") || t.includes("dashboard")) topic = "Metricas e Dashboard";
    if (t.includes("comunicação") || t.includes("comunicacao")) topic = "Comunicacao Interna";
    if (t.includes("jornada")) topic = "Jornada da Lead";
    if (t.includes("nutrição") || t.includes("nutricao")) topic = "Sistema de Nutricao";
    if (t.includes("reativação") || t.includes("reativacao")) topic = "Reativacao de Leads";
    if (t.includes("ciclo de vendas")) topic = "Ciclo de Vendas";
    if (t.includes("cold call") && t.includes("estrutura")) topic = "Estrutura Cold Call";
    if (t.includes("leadscrapping") || t.includes("lead scrapping")) topic = "Leadscrapping";
    if (t.includes("angariação") || t.includes("angariacao")) topic = "Angariacao";
  }

  return { module, topic, sessionNumber, clientName };
}

// Match client name from title to database clients
export function matchClientName(titleClientName: string, clients: { id: string; name: string }[]): string | null {
  if (!titleClientName) return null;

  const normalized = titleClientName.toLowerCase().trim();

  for (const client of clients) {
    const clientNorm = client.name.toLowerCase();

    // Exact match
    if (clientNorm === normalized) return client.id;

    // Partial match (client name contains or is contained)
    if (clientNorm.includes(normalized) || normalized.includes(clientNorm)) return client.id;

    // Common abbreviations
    if (normalized.includes("ds ") && clientNorm.includes("ds ")) {
      const titleCity = normalized.replace("ds ", "").trim();
      const clientCity = clientNorm.replace(/ds\s*/i, "").trim();
      if (clientCity.includes(titleCity) || titleCity.includes(clientCity)) return client.id;
    }

    if (normalized.includes("dsic") && clientNorm.includes("dsic")) {
      const titlePart = normalized.replace("dsic", "").trim();
      const clientPart = clientNorm.replace("dsic", "").trim();
      if (clientPart.includes(titlePart) || titlePart.includes(clientPart)) return client.id;
    }
  }

  return null;
}
