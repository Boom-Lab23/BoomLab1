// Importa clientes do Notion para a DB BoomLab.
// Corre dentro do container: docker exec boomlab-app node /app/scripts/import-clients-from-notion.js
//
// Idempotente: se o cliente ja existe (match por nome case-insensitive), actualiza em vez de duplicar.

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Mapa dos 30 clientes extraidos do Notion (via Notion MCP search em 2026-04-23)
const clients = [
  {
    nomeEmpresa: "RA Creditos",
    ceo: "Raquel Silva",
    email: "raquel.silva@racreditos.pt",
    contacto: "+351 915 239 398",
    coreBusiness: "Intermediação de Crédito",
    estado: "Ativo",
    offer: ["BoomClub"],
    risco: "Baixo",
    inicioProjeto: "2026-02-20",
    fimProjeto: "2027-02-20",
    composicao: "Vamos prestar serviço para formar 2 pessoas que vão ficar com as leads da Raquel",
    consultoriaVendas: false,
    revisaoDashboard: false,
  },
  { nomeEmpresa: "Ana Vasco", ceo: "Ana Vasco", email: "titavasco@gmail.com", contacto: "963 286 188", coreBusiness: "Intermediação de Crédito", estado: "Ativo", offer: ["Consultoria", "BoomClub"], risco: "Baixo", duracaoProjeto: "2 meses", inicioProjeto: "2026-02-02", fimProjeto: "2026-04-09", ticket: 3200, faturacao: 5000000, composicao: "Estrutura - 2 pessoas (Ana + Colaboradora) Marta", dores: "Principal necessidade - Mais lead qualificadas e previsibilidade", expectativas: "Objetivos de faturação - 10M. Canais atuais de aquisição - Boca a Boca (5 a 6/ mês), 3 parcerias (pouco produtivas).", consultoriaVendas: true, revisaoDashboard: true, outrasInfo: "ticket médio - 250k" },
  { nomeEmpresa: "DSIC Jardim da Amoreira", ceo: "Bruno Sousa", email: "brunosousa@dsicredito.pt", contacto: "+351 919 220 994", estado: "Ativo", risco: "Baixo", inicioProjeto: "2026-02-19", fimProjeto: "2026-06-19", composicao: "15 pessoas mais o Bruno e o Jorge. A Sílvia vai estar presente em muitas reuniões, pois isto era a antiga loja dela", consultoriaVendas: true, revisaoDashboard: false, outrasInfo: "As formações da equipa estão divididas em 2 grupos" },
  { nomeEmpresa: "André Soares", ceo: "André Soares", email: "andresoares@century21.pt", contacto: "965 777 535", coreBusiness: "Intermediação de Crédito", estado: "Ativo", offer: ["BoomClub"], risco: "Baixo", duracaoProjeto: "1 ano", inicioProjeto: "2026-02-02", fimProjeto: "2027-02-02", ticket: 500, composicao: "Apenas ele, estão a entrar elementos novos (3 pessoas?)", dores: "Para de depender do negócio enviado pelos consultores da c21", consultoriaVendas: true, revisaoDashboard: true, outrasInfo: "Ainda não tem Miro. C21 agregada a ele é negócio da família" },
  { nomeEmpresa: "DS Sobral Monte Agraço", ceo: "Jorge", email: "jorgedias@decisoesesolucoes.com", contacto: "961 906 589", estado: "Ativo", offer: ["Consultoria"], risco: "Baixo", duracaoProjeto: "3 meses", inicioProjeto: "2026-03-11", fimProjeto: "2026-06-11", faturacao: 2700000, composicao: "2 pessoas", dores: "Estrturação de toda a empresa, principalmente canais de aquisição", consultoriaVendas: true, revisaoDashboard: false },
  { nomeEmpresa: "DR Finanças Nossa senhora da Agonia", coreBusiness: "Intermediação de Crédito", estado: "Inativo", offer: ["Consultoria"], risco: "Baixo", duracaoProjeto: "2 meses", inicioProjeto: "2026-02-26", fimProjeto: "2026-04-30", consultoriaVendas: true, revisaoDashboard: false },
  { nomeEmpresa: "DSIC Salvaterra de Magos", ceo: "Teresa Bica", email: "teresabica@dsicredito.pt", contacto: "+351934431580", coreBusiness: "Intermediação de Crédito", estado: "Ativo", offer: ["Consultoria"], risco: "Baixo", duracaoProjeto: "4 meses", inicioProjeto: "2026-01-16", fimProjeto: "2026-05-16", ticket: 6000, composicao: "-1.5M de crédito escriturado por mês; -São 8 colaboradores +2 próximo mês; -Abertura a reunir connosco: sim; Canal de Aquisição: ads", dores: "• Parcerias; • Ads; • Metrificar; • Treino Comercial; • Processo Comercial;", consultoriaVendas: true, revisaoDashboard: true, outrasInfo: "AINDA NÃO TEM MIRO" },
  { nomeEmpresa: "Diogo Cândido", ceo: "Diogo Cândido", email: "dipossolo@gmail.com", contacto: "933 153 315", estado: "Ativo", offer: ["BoomClub"], risco: "Baixo", duracaoProjeto: "12 meses", inicioProjeto: "2026-02-05", fimProjeto: "2027-02-05", faturacao: 700000, composicao: "Ele, tem o 'braço direito' dele que é uma senhora que faz a parte administrativa dele e outras pessoas da equipa (vou saber quantas são) +3 gestores de crédito", dores: "Não tem estrutura comercial, não faz vendas de forma ativa (parcerias, ads etc) e ainda não consegue sair da operação. Ele é responsável por 45% da faturação da empresa", expectativas: "2M€ todos os meses é o objetivo dele", consultoriaVendas: true, revisaoDashboard: false, outrasInfo: "A faturação dele é 700k num mês mau; 2M€ num mês bom" },
  { nomeEmpresa: "Finance21 homevintage", ceo: "Sofia Fonseca", email: "sofiafonseca@century21.pt", contacto: "926829035", coreBusiness: "Intermediação de Crédito", estado: "Ativo", offer: ["Consultoria"], risco: "Baixo", inicioProjeto: "2026-03-17", fimProjeto: "2026-06-17", faturacao: 8200000, composicao: "4 pessoas a contar com ela", consultoriaVendas: false, revisaoDashboard: false },
  { nomeEmpresa: "DS Guimarães", ceo: "Noémia Guimarães", email: "mariaguimaraes@decisoesesolucoes.com", contacto: "936 218 980", coreBusiness: "Agência Imobiliária", estado: "Ativo", offer: ["Consultoria"], risco: "Baixo", duracaoProjeto: "4", inicioProjeto: "2026-02-27", fimProjeto: "2026-06-27", ticket: 7500, composicao: "Têm Imobiliário e crédito a trabalhar connosco; 19 pessoas; 6 pessoas na IC; Maria+Liliana full time; José Mendes Seguros e ajuda no crédito; Bárbara Fernandes; Anabela parttime; Noémia - Imobiliário; Joaquim - Recursos Humanos; Albina - Crédito", dores: "Crédito: Crescimento geral e estrutura da empresa. Imobiliário: angariações de imoveis, capatação de leads, processo comercial, formação de comerciais.", consultoriaVendas: true, revisaoDashboard: true, outrasInfo: "a noémia é a coordenadora e responsavel pela parte de imobiliário da empresa" },
  { nomeEmpresa: "Finance4U", ceo: "Liliana Martins", email: "liliana.martins@wefind4u.pt", contacto: "+351969066579", coreBusiness: "Intermediação de Crédito", estado: "Ativo", offer: ["Consultoria"], risco: "Baixo", duracaoProjeto: "4 meses", inicioProjeto: "2026-02-02", fimProjeto: "2026-05-15", composicao: "Ana e Liliana Sócias (Ana - mais ligada a intermediação do Crédito) + 2 pessoas (1 ainda a ser formada)", consultoriaVendas: true, revisaoDashboard: true, outrasInfo: "Ainda não utilizam CRM. Já colocaram o projeto em pausa 2 vezes por falta de estruturação da parte delas" },
  { nomeEmpresa: "Athenas Seguros", ceo: "João Paulo", email: "jpdiniz@athenas.pt", contacto: "917 342 575", coreBusiness: "Mediação de Seguros", estado: "Projeto Finalizado", offer: ["Consultoria"], risco: "Baixo", csat: 7, duracaoProjeto: "6 meses", inicioProjeto: "2025-09-03", fimProjeto: "2026-03-03", ticket: 11000, composicao: "João Ceo; Mário; Frederico; Rosa; Sara; Ana", consultoriaVendas: false, revisaoDashboard: false },
  { nomeEmpresa: "Chanceplus", ceo: "Manuel Marçal", email: "jmamarcal@gmail.com", contacto: "+351913020205", coreBusiness: "Intermediação de Crédito", estado: "Ativo", offer: ["Consultoria"], risco: "Baixo", duracaoProjeto: "4 meses", inicioProjeto: "2026-01-27", fimProjeto: "2026-05-27", ticket: 5000, faturacao: 2000000, consultoriaVendas: true, revisaoDashboard: false, outrasInfo: "Ainda não tem Miro. O contacto Principal é a Luna que é filha do Marçal, mas não é dir.comercial" },
  { nomeEmpresa: "DSIC Castelo Branco", ceo: "Marco Campanha", email: "marcocampanha@dsseguros.pt", contacto: "+351916203957", coreBusiness: "Intermediação de Crédito", estado: "Ativo", offer: ["Consultoria"], risco: "Baixo", csat: 10, duracaoProjeto: "4 meses", inicioProjeto: "2025-12-22", fimProjeto: "2026-04-01", ticket: 5750, dores: "- Análise profunda do negócio; - Implementação de infra-estruturas de aquisição; - Desenvolvimento de infra-estrutura comercial; - Análises e planos de ação para a equipa comercial; - Implementação de dashboards; - Reuniões de acompanhamento; - Automatização de processos; - Sessões estratégicas de liderança; - Desenvolvimento de processos de integração e formação", consultoriaVendas: false, revisaoDashboard: true },
  { nomeEmpresa: "XFIN MacFin", ceo: "Ana Fernandes", email: "ana.fernandes@xfin.pt", contacto: "938311939", estado: "Ativo", offer: ["Consultoria"], risco: "Baixo", inicioProjeto: "2026-03-09", fimProjeto: "2026-06-17", composicao: "Ana é a CEO e tem mais 12 pessoas. O Eduardo é o braço direito dela", dores: "As necessidades principais são os processos comerciais e refazer tudo dos ads", consultoriaVendas: false, revisaoDashboard: false },
  { nomeEmpresa: "JCM Seguros", coreBusiness: "Mediação de Seguros", estado: "Ativo", risco: "Baixo", consultoriaVendas: false, revisaoDashboard: false },
  { nomeEmpresa: "Finitaipas", ceo: "João Marques", email: "joao@finitaipas.pt", contacto: "917 517 532", coreBusiness: "Intermediação de Crédito", estado: "Ativo", offer: ["Consultoria"], risco: "Baixo", duracaoProjeto: "3 meses", inicioProjeto: "2026-02-06", fimProjeto: "2026-05-14", composicao: "João e Gestora de Crédito que faz parte tb da empresa de seguros (Maria José)", dores: "Começar do 0, estrutura geral e trabalhar crm e base de dados dos seguros", consultoriaVendas: true, revisaoDashboard: true, outrasInfo: "Base de dados de Seguros de 17.000 leads. Ainda não em MIRO" },
  { nomeEmpresa: "Total Seguros", ceo: "Cesar Neves", email: "cesar.neves@totalseguros.pt", contacto: "962304486", estado: "Levantamento", risco: "Baixo", consultoriaVendas: false, revisaoDashboard: false },
  { nomeEmpresa: "JAF Seguros", ceo: "Vasco Nunes", email: "vasco@jafseguros.pt", contacto: "969 654 838", coreBusiness: "Mediação de Seguros", estado: "Inativo", offer: ["Consultoria"], risco: "Alto", inicioProjeto: "2025-10-28", fimProjeto: "2026-02-10", consultoriaVendas: false, revisaoDashboard: false },
  { nomeEmpresa: "DS Póvoa de Varzim", ceo: "Filipe Gonçalves", email: "filipegoncalves@decisoesesolucoes.com", contacto: "+351962609240", coreBusiness: "Intermediação de Crédito", estado: "Ativo", offer: ["Consultoria", "BoomClub"], risco: "Baixo", csat: 9, duracaoProjeto: "3 meses", inicioProjeto: "2026-01-19", fimProjeto: "2026-04-19", ticket: 4000, faturacao: 10000000, composicao: "3 pessoas e 2 escritórios (1 em cada escritório e 1 em rotação pelas duas lojas e está um pouco mal de saúde e as vezes não consegue trabalhar full-time)", consultoriaVendas: true, revisaoDashboard: true },
  { nomeEmpresa: "Doutor Finanças Maia", ceo: "Artur Mota", email: "artur.mota@rede.doutorfinancas.pt", contacto: "+351964406063", estado: "Ativo", offer: ["Consultoria"], risco: "Baixo", duracaoProjeto: "3 meses", inicioProjeto: "2026-02-03", fimProjeto: "2026-04-28", ticket: 4800, faturacao: 12000000, composicao: "5 pessoas (Artur CEO, 3 part-time e 1 full times)", dores: "Principal necessidade - Processo comercial e metrificação, Implementar parcerias, treino e acompanhamento comercial. Maia Catasol", consultoriaVendas: true, revisaoDashboard: false, outrasInfo: "Não tem Miro" },
  { nomeEmpresa: "CrediAdvisor", ceo: "Catarina", email: "catarina.correia@crediadvisor.pt", contacto: "918 663 146", coreBusiness: "Intermediação de Crédito", estado: "Ativo", offer: ["Consultoria"], risco: "Baixo", csat: 10, duracaoProjeto: "4", inicioProjeto: "2025-12-23", fimProjeto: "2026-05-07", composicao: "2 Equipas. 1. Equipa de consumo - 2M€ ao Ano = 80k€ Líquido. 2.Equipa de Habitação 27M€ - 400K€", dores: "Perde dinheiro no Consumo, desorganização em ttudo", consultoriaVendas: false, revisaoDashboard: true, outrasInfo: "Não quer trabalhar aquisição, só estruturação" },
  { nomeEmpresa: "DSIC Portalegre", ceo: "Filipa e Luciano", email: "lucianocosta@dsicredito.pt", contacto: "916 599 485", coreBusiness: "Intermediação de Crédito", estado: "Ativo", offer: ["BoomClub"], risco: "Baixo", duracaoProjeto: "1 ano", inicioProjeto: "2026-01-22", fimProjeto: "2027-01-22", consultoriaVendas: true, revisaoDashboard: true, outrasInfo: "Ainda não tem Miro? Email alternativo: filipagraca@dsicredito.pt" },
  { nomeEmpresa: "DSIC Setúbal Vitória", ceo: "Paulo Brito", email: "paulobrito@dsicredito.pt", coreBusiness: "Intermediação de Crédito", estado: "Ativo", offer: ["Consultoria"], risco: "Baixo", duracaoProjeto: "3 meses", inicioProjeto: "2026-01-05", fimProjeto: "2026-04-24", ticket: 6000, composicao: "Nova diretora comercial Armanda", consultoriaVendas: true, revisaoDashboard: true },
  { nomeEmpresa: "DS Esposende", ceo: "Carrlos Silva", estado: "Fechado", risco: "Baixo", consultoriaVendas: false, revisaoDashboard: false },
  { nomeEmpresa: "DS Private Póvoa de Varzim", ceo: "Suzete Santos", email: "suzetesantos@dsprivate.com", contacto: "961 040 618", coreBusiness: "Intermediação de Crédito", estado: "Ativo", offer: ["Consultoria"], risco: "Baixo", duracaoProjeto: "4 meses", inicioProjeto: "2025-11-04", fimProjeto: "2026-02-27", ticket: 8000, consultoriaVendas: false, revisaoDashboard: true },
  { nomeEmpresa: "MaxFinance Presidente", ceo: "Carlos Figueiredo", email: "cfigueiredo@maxfinance.pt", coreBusiness: "Intermediação de Crédito", estado: "Inativo", offer: ["Consultoria"], risco: "Baixo", duracaoProjeto: "4 meses", inicioProjeto: "2026-01-12", fimProjeto: "2026-04-07", composicao: "3 Agências. Lourinhã - Filipa (5 pessoas); Parede - Filipe (2 pessoas); Algarve - Miguel (4 pessoas)", consultoriaVendas: false, revisaoDashboard: false },
  { nomeEmpresa: "MaxFinance Invest", ceo: "Marta Antonini e Rafael", email: "marta.antonini@maxfinance.pt", contacto: "916 203 957", coreBusiness: "Intermediação de Crédito", estado: "Projeto Finalizado", offer: ["Consultoria"], risco: "Baixo", inicioProjeto: "2025-10-29", fimProjeto: "2026-01-29", composicao: "A recrutar 1 administrativa", consultoriaVendas: false, revisaoDashboard: false },
  { nomeEmpresa: "Belocrédito", ceo: "Sónia Belo", email: "sonia@casabelo.pt", contacto: "+351 910 072 598", estado: "Apresentação Timeline", offer: ["Consultoria"], risco: "Baixo", duracaoProjeto: "4 meses", inicioProjeto: "2026-04-06", fimProjeto: "2026-08-06", ticket: 6500, faturacao: 10000000, composicao: "2 Pessoas. Saíram 3 Pessoas", dores: "Mais clientes", expectativas: "Objetivo 20M", consultoriaVendas: false, revisaoDashboard: false },
  { nomeEmpresa: "DSIC São Domingos de Rana", ceo: "Joana Ferreira", email: "joanaferreira@dsicredito.pt", contacto: "912 251 773", coreBusiness: "Intermediação de Crédito", estado: "Ativo", offer: ["Consultoria"], risco: "Baixo", inicioProjeto: "2025-12-17", fimProjeto: "2026-02-10", composicao: "3 elementos: Marília, Andreia e Sheila", dores: "Organização e Processos / Recrutamento / Angariação de Leads", consultoriaVendas: false, revisaoDashboard: false },
];

// Mapeamento Notion -> enum ClientStatus
const STATUS_MAP = {
  "Fechado": "FECHADO",
  "Cobrado": "COBRADO",
  "Pré-arranque": "PRE_ARRANQUE",
  "Pre-arranque": "PRE_ARRANQUE",
  "Levantamento": "LEVANTAMENTO",
  "Apresentação Timeline": "APRESENTACAO_TIMELINE",
  "Ativo": "ATIVO",
  "Inativo": "INATIVO",
  "Projeto Finalizado": "PROJETO_FINALIZADO",
};

const RISK_MAP = {
  "Baixo": "BAIXO",
  "Médio": "MEDIO",
  "Medio": "MEDIO",
  "Alto": "ALTO",
};

function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  console.log(`[import] A importar ${clients.length} clientes do Notion...\n`);

  let created = 0, updated = 0, failed = 0;
  const results = [];

  for (const c of clients) {
    const name = c.nomeEmpresa;
    try {
      // Match existente por nome (case-insensitive)
      const existing = await prisma.client.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
      });

      const data = {
        name: name,
        ceo: c.ceo ?? null,
        email: c.email?.toLowerCase().trim() ?? null,
        phone: c.contacto ?? null,
        coreBusiness: c.coreBusiness ?? null,
        composition: c.composicao ?? null,
        painPoints: c.dores ?? null,
        projectDuration: c.duracaoProjeto ?? null,
        projectStart: parseDate(c.inicioProjeto),
        projectEnd: parseDate(c.fimProjeto),
        status: STATUS_MAP[c.estado] || "FECHADO",
        offer: c.offer ?? [],
        risk: c.risco ? RISK_MAP[c.risco] : null,
        csat: c.csat ?? null,
        ticket: c.ticket ?? null,
        billing: c.faturacao ?? null,
        expectations: c.expectativas ?? null,
        otherInfo: c.outrasInfo ?? null,
        salesConsulting: c.consultoriaVendas ?? false,
        dashboardReview: c.revisaoDashboard ?? false,
      };

      if (existing) {
        await prisma.client.update({ where: { id: existing.id }, data });
        updated++;
        results.push({ name, action: "updated", id: existing.id });
      } else {
        const r = await prisma.client.create({ data });
        created++;
        results.push({ name, action: "created", id: r.id });
      }
    } catch (err) {
      failed++;
      results.push({ name, action: "FAILED", error: err.message });
      console.error(`[import] FALHOU ${name}: ${err.message}`);
    }
  }

  console.log(`\n[import] Resultado: ${created} criados, ${updated} actualizados, ${failed} falharam`);
  results.forEach((r) => {
    const icon = r.action === "created" ? "+" : r.action === "updated" ? "~" : "!";
    console.log(`  ${icon} ${r.name} ${r.action === "FAILED" ? "- " + r.error : ""}`);
  });

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main();
