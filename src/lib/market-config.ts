// Market-specific configuration for commercial dashboards
// Each market (CREDITO, SEGUROS, IMOBILIARIO) has its own:
//   - acquisition channels (different per market)
//   - vertentes (product types)
//   - pipeline labels

export type MarketKey = "CREDITO" | "SEGUROS" | "IMOBILIARIO";

export interface ChannelConfig {
  key: string;       // stored value
  label: string;     // display label
  color: string;     // chart color
  description?: string;
}

export interface VertenteConfig {
  key: string;       // numeric N field
  vKey: string;      // numeric V (value) field
  label: string;
  short: string;
}

// =============================================================
// ACQUISITION CHANNELS per market
// =============================================================

export const MARKET_CHANNELS: Record<MarketKey, ChannelConfig[]> = {
  CREDITO: [
    { key: "cold-calling", label: "Cold Calling", color: "#2D76FC", description: "Chamadas frias para leads nao qualificadas" },
    { key: "linkedin", label: "LinkedIn Outreach", color: "#0a66c2", description: "Prospecao e mensagens via LinkedIn" },
    { key: "anuncios", label: "Anuncios (Meta/Google)", color: "#ea580c", description: "Leads geradas por campanhas pagas" },
    { key: "parcerias", label: "Parcerias", color: "#16a34a", description: "Contabilistas, imobiliarias, advogados" },
    { key: "referencias", label: "Referencias de Clientes", color: "#8b5cf6", description: "Indicacoes de clientes atuais" },
    { key: "presenciais", label: "Leads Presenciais", color: "#ec4899", description: "Networking, feiras, eventos" },
    { key: "website", label: "Website / SEO", color: "#0891b2", description: "Leads organicas via site" },
    { key: "outros", label: "Outros", color: "#6b7280" },
  ],
  SEGUROS: [
    { key: "cold-calling", label: "Cold Calling", color: "#2D76FC", description: "Chamadas frias" },
    { key: "linkedin", label: "LinkedIn Outreach", color: "#0a66c2", description: "Prospecao B2B" },
    { key: "anuncios", label: "Anuncios (Meta/Google)", color: "#ea580c", description: "Leads pagas" },
    { key: "companhia", label: "Leads da Companhia", color: "#dc2626", description: "Leads atribuidas pela companhia (Fidelidade, Allianz, Generali...)" },
    { key: "parcerias", label: "Parcerias", color: "#16a34a", description: "Bancos, contabilistas, imobiliarias" },
    { key: "presenciais", label: "Leads Presenciais", color: "#ec4899", description: "Feiras, eventos, networking" },
    { key: "cross-sell", label: "Cross-sell / Clientes", color: "#8b5cf6", description: "Venda cruzada a clientes existentes" },
    { key: "referencias", label: "Referencias", color: "#d97706", description: "Indicacoes de clientes" },
    { key: "outros", label: "Outros", color: "#6b7280" },
  ],
  IMOBILIARIO: [
    { key: "angariacao-direta", label: "Angariacao Direta", color: "#16a34a", description: "Prospecao porta-a-porta, zonas" },
    { key: "cold-calling", label: "Cold Calling", color: "#2D76FC", description: "Chamadas a proprietarios" },
    { key: "linkedin", label: "LinkedIn Outreach", color: "#0a66c2" },
    { key: "anuncios", label: "Anuncios (Idealista/Imovirtual)", color: "#ea580c", description: "Portais + Meta/Google Ads" },
    { key: "placas", label: "Placas Vende-se", color: "#f59e0b", description: "Leads de placas fisicas" },
    { key: "parcerias", label: "Parcerias", color: "#10b981", description: "Bancos, notarios, advogados" },
    { key: "presenciais", label: "Open House / Eventos", color: "#ec4899", description: "Visitas e eventos presenciais" },
    { key: "referencias", label: "Referencias", color: "#8b5cf6", description: "Indicacoes de clientes" },
    { key: "outros", label: "Outros", color: "#6b7280" },
  ],
};

// =============================================================
// VERTENTES (product lines) per market
// =============================================================

export const MARKET_VERTENTES: Record<MarketKey, VertenteConfig[]> = {
  CREDITO: [
    { key: "creditoHabitacaoN", vKey: "creditoHabitacaoV", label: "Credito Habitacao", short: "Hab." },
    { key: "creditoPessoalN", vKey: "creditoPessoalV", label: "Credito Pessoal", short: "Pes." },
    { key: "creditoConsumoN", vKey: "creditoConsumoV", label: "Credito Consumo", short: "Con." },
    { key: "cartoesN", vKey: "cartoesV", label: "Cartoes Credito", short: "Cart." },
    { key: "segurosCrossN", vKey: "segurosCrossV", label: "Seguros (Cross-sell)", short: "Seg." },
  ],
  SEGUROS: [
    { key: "segurosVidaN", vKey: "segurosVidaV", label: "Vida", short: "Vida" },
    { key: "segurosSaudeN", vKey: "segurosSaudeV", label: "Saude", short: "Saude" },
    { key: "segurosAutoN", vKey: "segurosAutoV", label: "Automovel", short: "Auto" },
    { key: "segurosHabitacaoN", vKey: "segurosHabitacaoV", label: "Habitacao", short: "Hab." },
    { key: "segurosMultiN", vKey: "segurosMultiV", label: "Multirriscos", short: "Multi" },
    { key: "segurosOutrosN", vKey: "segurosOutrosV", label: "Outros", short: "Outros" },
  ],
  IMOBILIARIO: [
    { key: "imoAngariacaoN", vKey: "imoAngariacaoV", label: "Angariacao", short: "Ang." },
    { key: "imoVendaN", vKey: "imoVendaV", label: "Venda", short: "Venda" },
    { key: "imoArrendamentoN", vKey: "imoArrendamentoV", label: "Arrendamento", short: "Arr." },
    { key: "imoComercialN", vKey: "imoComercialV", label: "Comercial", short: "Com." },
  ],
};

// =============================================================
// PIPELINE LABELS (standard across markets, renamed for clarity)
// =============================================================
// New pipeline naming (per user requirement):
//   1. Contactos feitos       -> callsMade
//   2. Contactos respondidos  -> callsAnswered
//   3. Reunioes efetuadas     -> reunioesEfetuadas  (what used to be agendamentos/reunioes)
//   4. Conversoes feitas      -> conversoesFeitas   (how many actually closed)

export const PIPELINE_LABELS = {
  callsMade: "Contactos Feitos",
  callsAnswered: "Contactos Respondidos",
  reunioesEfetuadas: "Reunioes Efetuadas",
  conversoesFeitas: "Conversoes Feitas",
  // legacy labels still supported
  conversions: "Conversoes Feitas",
  agendamentos: "Reunioes Efetuadas",
  reunioes: "Reunioes",
  comparecimentos: "Comparecimentos",
} as const;

export const MARKET_LABELS: Record<MarketKey, string> = {
  CREDITO: "Credito",
  SEGUROS: "Seguros",
  IMOBILIARIO: "Imobiliario",
};

export const MARKET_COLORS: Record<MarketKey, string> = {
  CREDITO: "#2D76FC",
  SEGUROS: "#16a34a",
  IMOBILIARIO: "#ea580c",
};

// =============================================================
// HELPERS
// =============================================================

export function getChannelLabel(market: MarketKey, channelKey: string): string {
  const channels = MARKET_CHANNELS[market] ?? [];
  return channels.find((c) => c.key === channelKey || c.label === channelKey)?.label ?? channelKey;
}

export function getChannelColor(market: MarketKey, channelKey: string): string {
  const channels = MARKET_CHANNELS[market] ?? [];
  return channels.find((c) => c.key === channelKey || c.label === channelKey)?.color ?? "#6b7280";
}
