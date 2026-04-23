// Corrige dados de contratos baseado nas correcções do utilizador + contrato DS Sobral encontrado.
// OVERRIDES os valores mesmo que ja existam (user confirmou os valores correctos).

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const FIXES = [
  { name: "Diogo Cândido", projectStart: "2026-02-19", projectEnd: "2027-02-19" },
  { name: "DSIC Portalegre", projectStart: "2026-01-14", projectEnd: "2027-01-14" },
  { name: "XFIN MacFin", projectStart: "2026-03-12", projectEnd: "2026-07-12" },
  { name: "CrediAdvisor", projectStart: "2025-12-23", projectEnd: "2026-05-07" },
  { name: "Finitaipas", projectStart: "2026-02-06", projectEnd: "2026-05-14" },
  { name: "Finance21 homevintage", projectStart: "2026-03-17", projectEnd: "2026-06-17" },
  // DS Sobral Monte Agraco: contrato com J.M.A. DIAS - MEDIACAO IMOBILIARIA, LDA
  { name: "DS Sobral Monte Agraço", projectStart: "2026-03-11", projectEnd: "2026-06-11", ticket: 4500, ceo: "Jorge", otherInfo: "Nome fiscal: J.M.A. DIAS - MEDIAÇÃO IMOBILIÁRIA, LDA (NIF PT516883291). Sede: Rua do Comércio n.º 20, Santana da Carnota, 2580-154 Carnota. IBAN LT793250067540618109. Pagamento à vista 4500€, renovação automática. Duração 4 meses." },
];

async function main() {
  console.log(`[fix] A corrigir ${FIXES.length} clientes...\n`);
  let ok = 0, skip = 0, err = 0;

  for (const f of FIXES) {
    const c = await prisma.client.findFirst({ where: { name: { equals: f.name, mode: "insensitive" } } });
    if (!c) {
      console.log(`  [NOT FOUND] ${f.name}`);
      skip++;
      continue;
    }
    try {
      const data = {};
      if (f.projectStart) data.projectStart = new Date(f.projectStart);
      if (f.projectEnd) data.projectEnd = new Date(f.projectEnd);
      if (f.ticket != null) data.ticket = f.ticket;
      if (f.ceo) data.ceo = f.ceo;
      if (f.otherInfo) data.otherInfo = f.otherInfo;

      await prisma.client.update({ where: { id: c.id }, data });
      const changes = Object.keys(data).map((k) => {
        const v = data[k];
        if (v instanceof Date) return `${k}=${v.toISOString().slice(0, 10)}`;
        return `${k}=${typeof v === 'string' ? v.slice(0, 40) + (v.length > 40 ? '...' : '') : v}`;
      }).join(", ");
      console.log(`  [ok] ${f.name} - ${changes}`);
      ok++;
    } catch (e) {
      console.error(`  [fail] ${f.name}: ${e.message}`);
      err++;
    }
  }

  console.log(`\n[fix] ${ok} corrigidos, ${skip} nao encontrados, ${err} erros`);
  await prisma.$disconnect();
  process.exit(err > 0 ? 1 : 0);
}

main();
