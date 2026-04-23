/**
 * Redistribui horarios das sessoes EOM/Offboard respeitando as regras do utilizador:
 * - NUNCA as 09:00
 * - NUNCA Terca ou Quinta as 10:00
 * - NUNCA 13:00-14:00 (almoco)
 * - Blocos de 60min
 * - Evita conflitos (2+ reunioes mesma hora/dia)
 *
 * Corre: docker exec -u root boomlab-app node /app/redistribute.js
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Slots disponiveis base (sem 09h, sem 13h)
// 10, 11, 12, 14, 15, 16, 17, 18
const ALL_SLOTS = ["10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

// Para Terca (day=2) e Quinta (day=4), retira 10:00
function slotsForDay(d) {
  const day = d.getUTCDay(); // 0=Dom 1=Seg 2=Ter 3=Qua 4=Qui 5=Sex 6=Sab
  if (day === 2 || day === 4) {
    return ALL_SLOTS.filter((s) => s !== "10:00");
  }
  return [...ALL_SLOTS];
}

function setTime(date, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const r = new Date(date);
  r.setUTCHours(h, m, 0, 0);
  return r;
}

function dayKey(d) {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const sessions = await prisma.session.findMany({
    where: {
      module: { in: ["off-boarding", "end-of-month"] },
      date: { gte: new Date() },
    },
    include: { client: true },
    orderBy: [{ date: "asc" }, { module: "desc" }], // off-boarding primeiro (vem antes alfabeticamente? nao: order em id)
  });

  console.log(`[redist] ${sessions.length} sessoes a redistribuir`);

  // Agrupa por dia
  const byDay = {};
  for (const s of sessions) {
    if (!s.date) continue;
    const k = dayKey(s.date);
    if (!byDay[k]) byDay[k] = [];
    byDay[k].push(s);
  }

  let updated = 0, unchanged = 0;

  // Para cada dia, atribui slots validos em ordem (offboarding primeiro, depois EOM por nome cliente)
  for (const k of Object.keys(byDay).sort()) {
    const daySessions = byDay[k];
    // Ordena: off-boarding primeiro, depois alfabeticamente por cliente
    daySessions.sort((a, b) => {
      if (a.module !== b.module) {
        return a.module === "off-boarding" ? -1 : 1;
      }
      const an = a.client?.name ?? "";
      const bn = b.client?.name ?? "";
      return an.localeCompare(bn);
    });

    const dayObj = new Date(daySessions[0].date);
    const slots = slotsForDay(dayObj);

    if (daySessions.length > slots.length) {
      console.warn(`  [!] ${k} tem ${daySessions.length} reunioes mas so ${slots.length} slots - expandindo para o dia seguinte`);
      // Move o excedente para o proximo dia util
      const overflow = daySessions.splice(slots.length);
      const HOLIDAYS = new Set(["2026-05-01", "2026-06-04", "2026-06-10", "2026-08-15", "2026-10-05", "2026-11-01", "2026-12-01", "2026-12-08", "2026-12-25", "2027-01-01"]);
      let nextDay = new Date(dayObj);
      do {
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      } while (nextDay.getUTCDay() === 0 || nextDay.getUTCDay() === 6 || HOLIDAYS.has(dayKey(nextDay)));
      const nextKey = dayKey(nextDay);
      if (!byDay[nextKey]) byDay[nextKey] = [];
      byDay[nextKey].push(...overflow);
      // re-sort the target day
      byDay[nextKey].sort((a, b) => {
        if (a.module !== b.module) return a.module === "off-boarding" ? -1 : 1;
        return (a.client?.name ?? "").localeCompare(b.client?.name ?? "");
      });
    }

    for (let i = 0; i < daySessions.length; i++) {
      const s = daySessions[i];
      // Nao usa modulo - se nao ha slots suficientes foi ja tratado acima pelo overflow
      const slot = slots[Math.min(i, slots.length - 1)];
      const newDate = setTime(dayObj, slot);

      // Se ja esta no slot correcto, skip
      if (s.date && Math.abs(s.date.getTime() - newDate.getTime()) < 60000) {
        unchanged++;
        continue;
      }

      await prisma.session.update({
        where: { id: s.id },
        data: { date: newDate },
      });
      updated++;
    }
  }

  console.log(`\n[redist] ${updated} actualizadas, ${unchanged} mantidas`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
