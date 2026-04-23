// Actualiza DB com dados extraidos dos contratos da Drive.
// So preenche campos que estao NULL - nao sobrepoe dados existentes.
//
// Corre: docker exec -u root boomlab-app node /app/update-clients-from-contracts.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Dados extraidos dos contratos pelo agent (23 Abril 2026)
const CONTRACTS = [
  { clientName: "JCM Seguros", projectStart: "2026-03-12", projectEnd: "2026-06-12", ticket: 3800, duracaoMeses: 3 },
  { clientName: "Total Seguros", projectStart: "2026-04-10", projectEnd: "2026-07-10", ticket: 4400, duracaoMeses: 3 },
  { clientName: "Finance21 homevintage", projectStart: "2026-03-17", projectEnd: "2026-06-17", ticket: 10000, duracaoMeses: 4, _warn: "Contrato tem ambiguidade: diz 4 meses mas datas cobrem 3. Ticket pode ser 10000 ou 12500. Usei 10000." },
  { clientName: "Finitaipas", projectStart: "2026-02-06", projectEnd: "2026-05-14", ticket: 4000, duracaoMeses: 3, _warn: "Pagamento em 3 prestacoes: 1000+1500+1500. Total 4000." },
  { clientName: "DSIC Portalegre", projectStart: "2025-07-22", projectEnd: "2025-11-22", ticket: 6500, duracaoMeses: 4, _warn: "Contrato tem placeholder XXXXX na Segunda Outorgante. Datas e valor extraidos parecem validos." },
  { clientName: "DSIC São Domingos de Rana", projectStart: "2025-07-05", projectEnd: "2025-10-05", ticket: 5000, duracaoMeses: 3, _warn: "Duas prestacoes: 1000+4000. Contraparte: COORDENADA LOUVAVEL." },
  { clientName: "Finance4U", projectStart: "2025-09-08", projectEnd: "2026-02-08", ticket: 7500, duracaoMeses: 5, _warn: "Contrato em nome WeFind4U (Vargas, Borges e Gonçalves, Lda)." },
  { clientName: "XFIN MacFin", projectStart: "2026-03-12", projectEnd: "2026-07-12", ticket: 6000, duracaoMeses: 4, _warn: "Existem 2 versoes (Google Doc + DOCX) com IBANs diferentes. Mesmos valores/datas." },
  { clientName: "CrediAdvisor", projectStart: "2025-12-23", projectEnd: "2026-05-27", ticket: 7000, duracaoMeses: 4, _warn: "Existe versao alternativa com fim 2026-05-07. Usei a com fim 2026-05-27." },
  { clientName: "DSIC Jardim da Amoreira", projectStart: "2026-02-19", projectEnd: "2026-06-19", ticket: 5500, duracaoMeses: 4 },
  { clientName: "Diogo Cândido", projectStart: "2026-02-19", projectEnd: "2027-02-19", ticket: 6000, duracaoMeses: 12, _warn: "Contrato tem erro: diz inicio=19/02/2026 e fim=19/02/2026 (mesma data). BoomClub Pro 12 meses - corrigido projectEnd para 19/02/2027. 12 prestacoes de 500€." },
];

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  console.log(`[update] A processar ${CONTRACTS.length} contratos...\n`);

  let updated = 0, unchanged = 0, notFound = 0, errors = 0;

  for (const c of CONTRACTS) {
    const client = await prisma.client.findFirst({
      where: { name: { equals: c.clientName, mode: "insensitive" } },
    });

    if (!client) {
      console.log(`  [NOT FOUND] ${c.clientName}`);
      notFound++;
      continue;
    }

    const updates = {};
    const changes = [];

    // Só actualiza projectEnd se estiver NULL
    if (!client.projectEnd && c.projectEnd) {
      const d = parseDate(c.projectEnd);
      if (d) {
        updates.projectEnd = d;
        changes.push(`projectEnd=${c.projectEnd}`);
      }
    }

    // Só actualiza projectStart se estiver NULL
    if (!client.projectStart && c.projectStart) {
      const d = parseDate(c.projectStart);
      if (d) {
        updates.projectStart = d;
        changes.push(`projectStart=${c.projectStart}`);
      }
    }

    // Só actualiza ticket se estiver NULL e contrato tiver valor
    if ((client.ticket == null || client.ticket === 0) && c.ticket) {
      updates.ticket = c.ticket;
      changes.push(`ticket=${c.ticket}€`);
    }

    // Duração projeto - só se estiver NULL
    if (!client.projectDuration && c.duracaoMeses) {
      updates.projectDuration = `${c.duracaoMeses} meses`;
      changes.push(`projectDuration=${c.duracaoMeses} meses`);
    }

    if (Object.keys(updates).length === 0) {
      console.log(`  [skip] ${c.clientName} - ja tem tudo preenchido`);
      unchanged++;
      continue;
    }

    try {
      await prisma.client.update({
        where: { id: client.id },
        data: updates,
      });
      console.log(`  [ok]   ${c.clientName} - ${changes.join(", ")}`);
      if (c._warn) console.log(`         ⚠ AVISO: ${c._warn}`);
      updated++;
    } catch (err) {
      console.error(`  [fail] ${c.clientName}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n[update] Resultado: ${updated} actualizados, ${unchanged} sem mudancas, ${notFound} nao encontrados, ${errors} erros`);
  await prisma.$disconnect();
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
