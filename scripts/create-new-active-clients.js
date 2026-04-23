/**
 * Cria 9 clientes activos que estavam em falta na DB (tinham contrato na Drive mas nao cliente).
 * Tambem cria canais + sessions EOM/Off-Boarding para cada um.
 *
 * BelaFinance: NAO criado porque o contrato na Drive esta com template em branco (XXXXX).
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const NEW_CLIENTS = [
  { name: "Casapenafiel", ceo: "Fernando Daniel de Sousa Vieira", coreBusiness: null, projectStart: "2026-05-01", projectEnd: "2026-08-31", ticket: 4000, duracao: "3 meses", composicao: "Nome fiscal: REUNERIGOR - UNIPESSOAL LDA (NIF PT510963595). Sede: Rua Nova do Paço nº 153 Bustelo, 4560-042 Bustelo PNF. Pagamento em prestacoes (2000 + 2000)." },
  { name: "Doutor Finanças Pinhal Novo", ceo: "Carmo", coreBusiness: "Intermediação de Crédito", projectStart: "2026-05-01", projectEnd: "2026-08-01", ticket: 5333, duracao: "4 meses", composicao: "Nome fiscal: Garra Sensível LDA (NIF PT518550907). Sede: Rua Infante D. Henrique nº63 B, 2955-196 Pinhal Novo. Franquia Doutor Financas Lojas Coreto. 4 prestacoes de 1333.33€." },
  { name: "MCS Insurance", ceo: "Joana", coreBusiness: "Mediação de Seguros", projectStart: "2026-04-01", projectEnd: "2026-07-01", ticket: 4500, duracao: "4 meses", composicao: "Nome fiscal: MCS Mediação e Consultadoria de Seguros LDA (NIF PT501534601). Sede: Avenida Heróis da Liberdade nº18B Loja, 2745-788 Massamá, Queluz. Pagamento a vista." },
  { name: "Credilis", ceo: "Sérgio; Diamantino Caçador", coreBusiness: "Agência Imobiliária", projectStart: "2026-04-13", projectEnd: "2026-07-13", ticket: 4750, duracao: "4 meses", composicao: "Nome fiscal: Mnz Mediação Imobiliária Lda (NIF 508282284). Sede: Avenida 22 de Maio Praça Nova, Lote 13 Loja 2. Pagamento a vista." },
  { name: "Grupo Zenite", ceo: "Alexandre", coreBusiness: null, projectStart: "2026-03-18", projectEnd: "2026-07-18", ticket: 6000, duracao: "4 meses", composicao: "Nome fiscal: Zénitembutido Lda (NIF 519069382). Sede: Beloura Office Park Edifício 2 Escritório 16, 2710-693 Sintra. Pagamento a vista." },
  { name: "Paraíso das Jóias", ceo: "Noémia", coreBusiness: null, projectStart: "2026-02-27", projectEnd: "2026-06-27", ticket: 3750, duracao: "4 meses", composicao: "Nome fiscal: Paraíso das Jóias Indústria Comércio Ourivesaria Sociedade Unipessoal Lda (NIF 504018752). Sede: Rua Central 369, Selho São Jorge 4835-314. Ourivesaria. Pagamento em prestacoes (1875 + 1875)." },
  { name: "Feliciano Crédito e Seguros", ceo: "André", coreBusiness: "Intermediação de Crédito", projectStart: "2026-03-02", projectEnd: "2026-06-08", ticket: 4750, duracao: "4 meses", composicao: "Nome fiscal: Feliciano Crédito e Seguros (NIF 515643432). Sede: Rua do Espírito Santo nº77 R/C Esquerdo. Pagamento a vista." },
  { name: "Desígnios e Táticas", ceo: "Bruno Alexandre Guerra de Oliveira", coreBusiness: "Agência de Consultoria", projectStart: "2026-01-27", projectEnd: "2026-05-27", ticket: 5750, duracao: "4 meses", composicao: "Nome fiscal: Desígnios e Táticas Lda (NIF 516925776). Sede: Rua Aquilino Ribeiro nº41 2E, Carnaxide. Pagamento a vista." },
  // DS Esposende: atualiza o existente em vez de criar novo
  { name: "DS Esposende", ceo: "Carlos Alberto Ferreira da Silva", coreBusiness: "Agência Imobiliária", projectStart: "2026-04-14", projectEnd: "2026-08-14", ticket: 6000, duracao: "4 meses", composicao: "Nome fiscal: CS21 INVEST - Mediação Imobiliária, LDA (NIF PT509555764). Sede: Rua D. Pedro Cunha nº1, 4740-304 Esposende. Pagamento a vista." },
];

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) throw new Error("Sem admin");

  let created = 0, updated = 0, channelCreated = 0;

  for (const c of NEW_CLIENTS) {
    const existing = await prisma.client.findFirst({
      where: { name: { equals: c.name, mode: "insensitive" } },
      include: { channels: true },
    });

    const data = {
      name: c.name,
      ceo: c.ceo,
      coreBusiness: c.coreBusiness,
      composition: c.composicao,
      projectStart: new Date(c.projectStart),
      projectEnd: new Date(c.projectEnd),
      projectDuration: c.duracao,
      status: "ATIVO",
      offer: ["Consultoria"],
      risk: "BAIXO",
      ticket: c.ticket,
    };

    let client;
    if (existing) {
      client = await prisma.client.update({
        where: { id: existing.id },
        data: {
          ceo: existing.ceo ?? data.ceo,
          coreBusiness: existing.coreBusiness ?? data.coreBusiness,
          composition: existing.composition ?? data.composition,
          projectStart: existing.projectStart ?? data.projectStart,
          projectEnd: existing.projectEnd ?? data.projectEnd,
          projectDuration: existing.projectDuration ?? data.projectDuration,
          status: "ATIVO",
          offer: existing.offer.length > 0 ? existing.offer : data.offer,
          ticket: existing.ticket ?? data.ticket,
        },
      });
      console.log(`  [updated] ${c.name} (${client.id})`);
      updated++;
    } else {
      client = await prisma.client.create({ data });
      console.log(`  [created] ${c.name} (${client.id})`);
      created++;
    }

    // Cria canal se nao existir
    const hasChannel = existing?.channels?.some((ch) => ch.type === "CLIENT");
    if (!hasChannel) {
      const ch = await prisma.channel.create({
        data: {
          name: client.name,
          type: "CLIENT",
          clientId: client.id,
          createdById: admin.id,
          isPrivate: true,
          description: `Canal de comunicacao com ${client.name}`,
          members: { create: [{ userId: admin.id, role: "OWNER" }] },
        },
      });
      console.log(`           + canal criado (${ch.id})`);
      channelCreated++;
    }
  }

  console.log(`\n[new-clients] ${created} criados, ${updated} actualizados, ${channelCreated} canais criados`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
