import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const docs = [
  // CREDITO
  { title: "Condicoes de Parceria", pillar: "credito", googleDocsId: "1HYceAP_aQ_0GPTNf1KUJYqW9M6b2Pm1tpQYPaXwpPok", googleDocsUrl: "https://docs.google.com/document/d/1HYceAP_aQ_0GPTNf1KUJYqW9M6b2Pm1tpQYPaXwpPok/edit" },
  { title: "Metricas Medias de Mercado - Credito", pillar: "credito", googleDocsId: "15iacfBRlhg7K4fVjIWwxMVVT1E9N6ZBPOa8TZgMgslM", googleDocsUrl: "https://docs.google.com/document/d/15iacfBRlhg7K4fVjIWwxMVVT1E9N6ZBPOa8TZgMgslM/edit" },
  { title: "Processo Comercial - Credito", pillar: "credito", googleDocsId: "1jIFgeG_cCA4pLxh-9fEvL7gGVVYeX1W04PcdXrePeAc", googleDocsUrl: "https://docs.google.com/document/d/1jIFgeG_cCA4pLxh-9fEvL7gGVVYeX1W04PcdXrePeAc/edit" },
  { title: "Nutricao Credito", pillar: "credito", googleDocsId: "15OuvSN0e5mPYkO3Mi5hQ5GvHcrlxnBzT2T62rIqhfRc", googleDocsUrl: "https://docs.google.com/document/d/15OuvSN0e5mPYkO3Mi5hQ5GvHcrlxnBzT2T62rIqhfRc/edit" },
  { title: "Overview Sistema Nutricao - Credito", pillar: "credito", googleDocsId: "1UYrM2G6GMEcG7FhbwY8NqBW2Eeu5DSQ4NGy0G8649VE", googleDocsUrl: "https://docs.google.com/document/d/1UYrM2G6GMEcG7FhbwY8NqBW2Eeu5DSQ4NGy0G8649VE/edit" },
  { title: "Reativacao Credito", pillar: "credito", googleDocsId: "1FY3Y7DDxFGmevGe_FHdapaCtGQ3FZwSjWzokn6Hcm0Q", googleDocsUrl: "https://docs.google.com/document/d/1FY3Y7DDxFGmevGe_FHdapaCtGQ3FZwSjWzokn6Hcm0Q/edit" },
  { title: "Framework Gestao Comercial - Credito", pillar: "credito", googleDocsId: "1OTSFI0R2K5R5l8JnM6KY2CnNsLfTytq1eKHmCikWtzw", googleDocsUrl: "https://docs.google.com/document/d/1OTSFI0R2K5R5l8JnM6KY2CnNsLfTytq1eKHmCikWtzw/edit" },
  { title: "Guia Perguntas Reuniao Semanal - Credito", pillar: "credito", googleDocsId: "1elTDV-s6HIf6P3vDMo2KQKiKZQcJoqMWBX-LzcB7s2o", googleDocsUrl: "https://docs.google.com/document/d/1elTDV-s6HIf6P3vDMo2KQKiKZQcJoqMWBX-LzcB7s2o/edit" },
  { title: "Objetivos Comerciais Parcerias - Credito", pillar: "credito", googleDocsId: "1TTelvsos64Va7bx5jNmhdvfTwF3_7jiq57ZWA6XB-v8", googleDocsUrl: "https://docs.google.com/document/d/1TTelvsos64Va7bx5jNmhdvfTwF3_7jiq57ZWA6XB-v8/edit" },
  { title: "Templates Job Posts Credito", pillar: "credito", googleDocsId: "1uzJCMI8mZSamodUMZvqyfR5BYKiTp4cxv4KQKvrHh3U", googleDocsUrl: "https://docs.google.com/document/d/1uzJCMI8mZSamodUMZvqyfR5BYKiTp4cxv4KQKvrHh3U/edit" },
  // SEGUROS
  { title: "Metricas Medias de Mercado - Seguros", pillar: "seguros", googleDocsId: "1iK1sNX8TUW66ZD9xpqOllmBrd46I6DSEKrtV3NJ678M", googleDocsUrl: "https://docs.google.com/document/d/1iK1sNX8TUW66ZD9xpqOllmBrd46I6DSEKrtV3NJ678M/edit" },
  { title: "Nutricao Seguros", pillar: "seguros", googleDocsId: "1IW7kixqQuOCh_mrXcFOlSjYExQg75DE-itkVi-HL2vY", googleDocsUrl: "https://docs.google.com/document/d/1IW7kixqQuOCh_mrXcFOlSjYExQg75DE-itkVi-HL2vY/edit" },
  { title: "Reativacao Seguros", pillar: "seguros", googleDocsId: "1MMCBYVLve0hYd9riri6rW9kecYltz8q3v4DVkCWXOyo", googleDocsUrl: "https://docs.google.com/document/d/1MMCBYVLve0hYd9riri6rW9kecYltz8q3v4DVkCWXOyo/edit" },
  { title: "Framework Gestao Comercial - Seguros", pillar: "seguros", googleDocsId: "1Hxd_QY817utJKR05Rg5VQbWhEVtO1UzASr76Ny2FK2A", googleDocsUrl: "https://docs.google.com/document/d/1Hxd_QY817utJKR05Rg5VQbWhEVtO1UzASr76Ny2FK2A/edit" },
  { title: "Guia Perguntas Reuniao Semanal - Seguros", pillar: "seguros", googleDocsId: "16VWGwIXP3EVTvP9wij2dQVB8737jbDX_edhtpBs6NDM", googleDocsUrl: "https://docs.google.com/document/d/16VWGwIXP3EVTvP9wij2dQVB8737jbDX_edhtpBs6NDM/edit" },
  // IMOBILIARIO
  { title: "Metricas Medias de Mercado - Imobiliario", pillar: "imobiliario", googleDocsId: "1Y2PkDaHpEV2aWQniV-HVH89HWhvlnpMQI6h2wqEI0JE", googleDocsUrl: "https://docs.google.com/document/d/1Y2PkDaHpEV2aWQniV-HVH89HWhvlnpMQI6h2wqEI0JE/edit" },
  { title: "Nutricao Imobiliario", pillar: "imobiliario", googleDocsId: "1__JILmdHbxIflfV0QMEcXSACSV2xUTKVDYjsWxYaV28", googleDocsUrl: "https://docs.google.com/document/d/1__JILmdHbxIflfV0QMEcXSACSV2xUTKVDYjsWxYaV28/edit" },
  { title: "Overview Sistema Nutricao - Imobiliario", pillar: "imobiliario", googleDocsId: "1rdSuWNhpOu5F19CPYMWT1Jlc8VmMZW2emqCiwggWQJg", googleDocsUrl: "https://docs.google.com/document/d/1rdSuWNhpOu5F19CPYMWT1Jlc8VmMZW2emqCiwggWQJg/edit" },
  { title: "Reativacao Imobiliario", pillar: "imobiliario", googleDocsId: "1oPozHJWMhMLZQ8syzE27-dwk3MRdejneoAHbQzp2Grg", googleDocsUrl: "https://docs.google.com/document/d/1oPozHJWMhMLZQ8syzE27-dwk3MRdejneoAHbQzp2Grg/edit" },
  { title: "Consistencia e Sistema - Imobiliario", pillar: "imobiliario", googleDocsId: "16M8u_Vrs7amszHMTHXY9uH4aVPBJuZtevPM36wD8GaY", googleDocsUrl: "https://docs.google.com/document/d/16M8u_Vrs7amszHMTHXY9uH4aVPBJuZtevPM36wD8GaY/edit" },
  { title: "Framework Gestao Comercial - Imobiliario", pillar: "imobiliario", googleDocsId: "11NvfFmCfkXS22BYJC-sXrMsLFJYn-sZDQ3Cms_wkCA4", googleDocsUrl: "https://docs.google.com/document/d/11NvfFmCfkXS22BYJC-sXrMsLFJYn-sZDQ3Cms_wkCA4/edit" },
  { title: "Perguntas Reuniao Semanal - Imobiliario", pillar: "imobiliario", googleDocsId: "1fwW1kWlt8qyPj5FMqo84wn7LfQpTvSbbZB3I2NEinOU", googleDocsUrl: "https://docs.google.com/document/d/1fwW1kWlt8qyPj5FMqo84wn7LfQpTvSbbZB3I2NEinOU/edit" },
  { title: "Sistema Angariacao Previsivel - Imobiliario", pillar: "imobiliario", googleDocsId: "1d65P1q65FjRuSmtshhUh-ZciYWj6TGaHxWqdzhuS8xY", googleDocsUrl: "https://docs.google.com/document/d/1d65P1q65FjRuSmtshhUh-ZciYWj6TGaHxWqdzhuS8xY/edit" },
  // ADS FUNNEL
  { title: "Estrutura de uma Boa Landing Page", pillar: "ads-funnel", googleDocsId: "1LVdvbkKUChI_jkWjQyGZU0_FUW5I3v8FBIkz8Jaarrk", googleDocsUrl: "https://docs.google.com/document/d/1LVdvbkKUChI_jkWjQyGZU0_FUW5I3v8FBIkz8Jaarrk/edit" },
  { title: "Exemplos Landing Pages para IC", pillar: "ads-funnel", googleDocsId: "1nVnQldZl32oESQy66TJuSjm-jLq-YAHe_CXrL6Bf_pY", googleDocsUrl: "https://docs.google.com/document/d/1nVnQldZl32oESQy66TJuSjm-jLq-YAHe_CXrL6Bf_pY/edit" },
  { title: "Funil de Anuncios", pillar: "ads-funnel", googleDocsId: "1JtpWjyZsR_WzutLx652HZBydYQZgGuv4KOcEh6Fab8Q", googleDocsUrl: "https://docs.google.com/document/d/1JtpWjyZsR_WzutLx652HZBydYQZgGuv4KOcEh6Fab8Q/edit" },
  { title: "Scripts dos Anuncios", pillar: "ads-funnel", googleDocsId: "1Zw05Wjk0LyTN4IcvPJqutuf4mAMVnhiW-9ZITkI4b4g", googleDocsUrl: "https://docs.google.com/document/d/1Zw05Wjk0LyTN4IcvPJqutuf4mAMVnhiW-9ZITkI4b4g/edit" },
  { title: "Ads Funnel Overview", pillar: "ads-funnel", googleDocsId: "1zgUKZf-Pq8eeB400i7m9ts8MWxn-lmgteyXWdrwJecI", googleDocsUrl: "https://docs.google.com/document/d/1zgUKZf-Pq8eeB400i7m9ts8MWxn-lmgteyXWdrwJecI/edit" },
  // GERAL
  { title: "Frameworks de Reunioes de Vendas", pillar: "geral", googleDocsId: "1PvJRqabsyBMuZIJuaqFcYqmwJtmLEoy2h444gPtj1sQ", googleDocsUrl: "https://docs.google.com/document/d/1PvJRqabsyBMuZIJuaqFcYqmwJtmLEoy2h444gPtj1sQ/edit" },
  { title: "Reativacao de Leads (Geral)", pillar: "geral", googleDocsId: "1S9VsinAOVaU1ASsh3yL9xEXkBWgFsqL97R8dzwEJaMU", googleDocsUrl: "https://docs.google.com/document/d/1S9VsinAOVaU1ASsh3yL9xEXkBWgFsqL97R8dzwEJaMU/edit" },
  { title: "Template Report Default", pillar: "geral", googleDocsId: "1nawxAWpwBTI8o-7REKtDvwY3x4IbJnTZMtDNndlaeYk", googleDocsUrl: "https://docs.google.com/document/d/1nawxAWpwBTI8o-7REKtDvwY3x4IbJnTZMtDNndlaeYk/edit" },
  { title: "Gestao Comercial Overview", pillar: "geral", googleDocsId: "1ewXPDrSshgMhZubYOZyGGZvcd87VtsnnMmJo3BSTBHo", googleDocsUrl: "https://docs.google.com/document/d/1ewXPDrSshgMhZubYOZyGGZvcd87VtsnnMmJo3BSTBHo/edit" },
  { title: "Guia Perguntas Reuniao Individual", pillar: "geral", googleDocsId: "1xezpFPwOjqBOaPU5XIIiozeVKIfeSc2qH9gkobujOSQ", googleDocsUrl: "https://docs.google.com/document/d/1xezpFPwOjqBOaPU5XIIiozeVKIfeSc2qH9gkobujOSQ/edit" },
  { title: "Gestao Objetivos Empresa - Default", pillar: "geral", googleDocsId: "1BWUQ2nIymUsjhwcweeAw8iNTA1izqBzevUs-lbBCztI", googleDocsUrl: "https://docs.google.com/document/d/1BWUQ2nIymUsjhwcweeAw8iNTA1izqBzevUs-lbBCztI/edit" },
  { title: "Objetivos Individuais Colaborador - Default", pillar: "geral", googleDocsId: "17l0yl9tcVF3Jhr7dzD9IGU3DSGCQwZSfrTUPxN5DwoE", googleDocsUrl: "https://docs.google.com/document/d/17l0yl9tcVF3Jhr7dzD9IGU3DSGCQwZSfrTUPxN5DwoE/edit" },
  { title: "Comunicacao / Accountability", pillar: "geral", googleDocsId: "1YvwAdtPYd4rtYmMQ7JUmqocgmNLe-nRCZhT2_n5THgU", googleDocsUrl: "https://docs.google.com/document/d/1YvwAdtPYd4rtYmMQ7JUmqocgmNLe-nRCZhT2_n5THgU/edit" },
  { title: "Script Extracao de Referrals", pillar: "geral", googleDocsId: "1-wAXbq8daNMvy1eLL6Wg3KfHTgOfvQAzx6bGynYerus", googleDocsUrl: "https://docs.google.com/document/d/1-wAXbq8daNMvy1eLL6Wg3KfHTgOfvQAzx6bGynYerus/edit" },
  // LEVANTAMENTOS
  { title: "Levantamento - Default", pillar: "levantamentos", googleDocsId: "1vLnn-rPHdNZGaYYaZfKYRPRfTZw3qm2akrNt3MyRA3M", googleDocsUrl: "https://docs.google.com/document/d/1vLnn-rPHdNZGaYYaZfKYRPRfTZw3qm2akrNt3MyRA3M/edit" },
  { title: "Levantamento - Ana Vasco", pillar: "levantamentos", googleDocsId: "161iI9R1PP-ltO6WToLBhgJBWhaTPzPmsc-v9ZDPzMTM", googleDocsUrl: "https://docs.google.com/document/d/161iI9R1PP-ltO6WToLBhgJBWhaTPzPmsc-v9ZDPzMTM/edit" },
  { title: "Levantamento - DS Sobral Monte Agraco", pillar: "levantamentos", googleDocsId: "1aFW2xVA_n3brdIAxTOShVn-cMkuwIyrTI0Ibg2bP0U8", googleDocsUrl: "https://docs.google.com/document/d/1aFW2xVA_n3brdIAxTOShVn-cMkuwIyrTI0Ibg2bP0U8/edit" },
  { title: "Levantamento - Finance21 Home Vintage", pillar: "levantamentos", googleDocsId: "1QXC2zauhO4J6jOGNNGCeRGc9-hku5ZVt-QIjn3_pFZQ", googleDocsUrl: "https://docs.google.com/document/d/1QXC2zauhO4J6jOGNNGCeRGc9-hku5ZVt-QIjn3_pFZQ/edit" },
  { title: "Levantamento - Finitaipas", pillar: "levantamentos", googleDocsId: "1NBxAIGYPdi_RDb0kDmgZkvO5k6BA-LfVOI9_Lz7j-n0", googleDocsUrl: "https://docs.google.com/document/d/1NBxAIGYPdi_RDb0kDmgZkvO5k6BA-LfVOI9_Lz7j-n0/edit" },
  { title: "Levantamento - MCS Insurance", pillar: "levantamentos", googleDocsId: "165ScBAL8R9Q9LST5PoTRC4hAc1IT2ndTlm6YVhMKwow", googleDocsUrl: "https://docs.google.com/document/d/165ScBAL8R9Q9LST5PoTRC4hAc1IT2ndTlm6YVhMKwow/edit" },
  { title: "Levantamento - Xfin Macfin", pillar: "levantamentos", googleDocsId: "1-UPLN6dVV2I0LFcbjGtTNFj4kkhY0a9wbnwefWpFNpE", googleDocsUrl: "https://docs.google.com/document/d/1-UPLN6dVV2I0LFcbjGtTNFj4kkhY0a9wbnwefWpFNpE/edit" },
  { title: "Levantamento - Diogo Candido", pillar: "levantamentos", googleDocsId: "1IYOiS5zOPSpLYDpx1j0s8btWrWSSdmN-aKrjV7bZeXI", googleDocsUrl: "https://docs.google.com/document/d/1IYOiS5zOPSpLYDpx1j0s8btWrWSSdmN-aKrjV7bZeXI/edit" },
  { title: "Levantamento - Roleplay", pillar: "levantamentos", googleDocsId: "1Rom-kZ7eVFpgZIoa-AWLM80HSEzQnFUesnhj9XJ9w5w", googleDocsUrl: "https://docs.google.com/document/d/1Rom-kZ7eVFpgZIoa-AWLM80HSEzQnFUesnhj9XJ9w5w/edit" },
  { title: "Solucao Principal Detalhada", pillar: "levantamentos", googleDocsId: "1WmRLzj0P8ZDsIrhsdTorLR6EYNRrwgyirj7Z6IKwBeE", googleDocsUrl: "https://docs.google.com/document/d/1WmRLzj0P8ZDsIrhsdTorLR6EYNRrwgyirj7Z6IKwBeE/edit" },
  { title: "Regras Comissionais BoomLab", pillar: "levantamentos", googleDocsId: "1_Zun42q8m8Q5qZSAQfRYqV_Jn5QwEs50xqiqETyGfl0", googleDocsUrl: "https://docs.google.com/document/d/1_Zun42q8m8Q5qZSAQfRYqV_Jn5QwEs50xqiqETyGfl0/edit" },
  // RH
  { title: "Perguntas de RH", pillar: "rh", googleDocsId: "1sxuaPsqdMPQrKxE8TqJOZQhnLkVy9he2yWuriZY8EzY", googleDocsUrl: "https://docs.google.com/document/d/1sxuaPsqdMPQrKxE8TqJOZQhnLkVy9he2yWuriZY8EzY/edit" },
  { title: "Processo de Recrutamento", pillar: "rh", googleDocsId: "1MkPsj77rqPTN_B-djLvyQgPKj5a0xnyFGFZZmIi9XD4", googleDocsUrl: "https://docs.google.com/document/d/1MkPsj77rqPTN_B-djLvyQgPKj5a0xnyFGFZZmIi9XD4/edit" },
  { title: "Tipos de Perguntas RH", pillar: "rh", googleDocsId: "1xkufC01s-jwEKtH5HevMd59Sda6uhhUve6BpD41dtYw", googleDocsUrl: "https://docs.google.com/document/d/1xkufC01s-jwEKtH5HevMd59Sda6uhhUve6BpD41dtYw/edit" },
  // BOOMCLUB
  { title: "Plano Estrategico BoomClub - Default", pillar: "boom-club", googleDocsId: "1gkwbCUvo0dFd-XOePTplTOqer9GC5HdkG7TTvSXkoZs", googleDocsUrl: "https://docs.google.com/document/d/1gkwbCUvo0dFd-XOePTplTOqer9GC5HdkG7TTvSXkoZs/edit" },
  { title: "Guia Reunioes de Retencao", pillar: "boom-club", googleDocsId: "1jJLOckIGjGmVankxcQC1NPgEaf6apvr_5iTERhRTLQQ", googleDocsUrl: "https://docs.google.com/document/d/1jJLOckIGjGmVankxcQC1NPgEaf6apvr_5iTERhRTLQQ/edit" },
  { title: "OKRs - Default", pillar: "boom-club", googleDocsId: "1yhcPSfEb2mD3RbGfvfFJn-Grc96txZ-dyKFK43r4xz8", googleDocsUrl: "https://docs.google.com/document/d/1yhcPSfEb2mD3RbGfvfFJn-Grc96txZ-dyKFK43r4xz8/edit" },
  // ESTRUTURA SERVICO
  { title: "Comunicacao no Servico", pillar: "estrutura-servico", googleDocsId: "1fNgVIIX4Nu-UTc70l0kKgn2gMT2sBNJZNj8wKEFSmi0", googleDocsUrl: "https://docs.google.com/document/d/1fNgVIIX4Nu-UTc70l0kKgn2gMT2sBNJZNj8wKEFSmi0/edit" },
  { title: "Empresa Ficticia Roleplay Servico", pillar: "estrutura-servico", googleDocsId: "1eEY-J01YJsqkojysjYPtsg6w1ZLnO7rwxVUgRnP0tHo", googleDocsUrl: "https://docs.google.com/document/d/1eEY-J01YJsqkojysjYPtsg6w1ZLnO7rwxVUgRnP0tHo/edit" },
  { title: "Framework Reunioes de Servico", pillar: "estrutura-servico", googleDocsId: "1RDi7mQvlR3JCXn2bXg-LMBS6AnMxdyNlmi-72FS2zho", googleDocsUrl: "https://docs.google.com/document/d/1RDi7mQvlR3JCXn2bXg-LMBS6AnMxdyNlmi-72FS2zho/edit" },
  { title: "Operacao Interna", pillar: "estrutura-servico", googleDocsId: "1WBk5eT9kRLsNfxpQAvSomvh4w-KJVKr5FN-CoRbFud4", googleDocsUrl: "https://docs.google.com/document/d/1WBk5eT9kRLsNfxpQAvSomvh4w-KJVKr5FN-CoRbFud4/edit" },
];

async function main() {
  await prisma.document.deleteMany({});
  let created = 0;
  for (const doc of docs) {
    await prisma.document.create({ data: { ...doc, lastSyncedAt: new Date() } });
    created++;
  }
  console.log("Total documents created:", created);
  await prisma.$disconnect();
}
main();
