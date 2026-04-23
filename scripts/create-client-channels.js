// Cria canais de mensagens (tipo CLIENT) para todos os clientes activos que ainda nao tem.
// Nao cria user GUEST_CLIENT - isso sera feito manualmente por cliente.
//
// Corre: docker exec -u root boomlab-app node /app/create-client-channels.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Estados considerados "activos" - criam canal
const ACTIVE_STATUSES = ["ATIVO", "PRE_ARRANQUE", "LEVANTAMENTO", "APRESENTACAO_TIMELINE"];

async function main() {
  // 1. Encontrar admin para ser owner dos canais
  const admin = await prisma.user.findFirst({
    where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) {
    console.error("[channels] Nenhum admin encontrado");
    process.exit(1);
  }
  console.log(`[channels] Owner dos canais: ${admin.name} (${admin.email})`);

  // 2. Listar clientes activos
  const clients = await prisma.client.findMany({
    where: { status: { in: ACTIVE_STATUSES } },
    include: { channels: true },
    orderBy: { name: "asc" },
  });

  console.log(`[channels] ${clients.length} clientes activos encontrados\n`);

  let created = 0, skipped = 0, failed = 0;

  for (const client of clients) {
    const existing = client.channels.find((c) => c.type === "CLIENT");
    if (existing) {
      console.log(`  [skip] ${client.name} - ja tem canal (${existing.name})`);
      skipped++;
      continue;
    }

    try {
      const channel = await prisma.channel.create({
        data: {
          name: client.name,
          type: "CLIENT",
          clientId: client.id,
          createdById: admin.id,
          isPrivate: true,
          description: `Canal de comunicacao com ${client.name}`,
          members: {
            create: [{ userId: admin.id, role: "OWNER" }],
          },
        },
      });
      console.log(`  [ok]   ${client.name} - canal criado (${channel.id})`);
      created++;
    } catch (err) {
      console.error(`  [fail] ${client.name}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n[channels] ${created} criados, ${skipped} ja existiam, ${failed} falharam`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
