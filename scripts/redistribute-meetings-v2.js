/**
 * Redistribui horarios das sessoes EOM/Offboard respeitando as regras do utilizador:
 * - NUNCA as 09:00
 * - NUNCA Terca ou Quinta as 10:00
 * - NUNCA 13:00 (almoco 13-14)
 * - Blocos 60min, 1 reuniao por slot (sem overlaps)
 * - Cada dia que exceda slots -> overflow para dia seguinte util
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const ALL_SLOTS = ["10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
const HOLIDAYS = new Set(["2026-05-01", "2026-06-04", "2026-06-10", "2026-08-15", "2026-10-05", "2026-11-01", "2026-12-01", "2026-12-08", "2026-12-25", "2027-01-01", "2027-03-26"]);

function slotsForDay(d) {
  const day = d.getUTCDay();
  if (day === 2 || day === 4) return ALL_SLOTS.filter((s) => s !== "10:00");
  return [...ALL_SLOTS];
}
function setTime(date, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const r = new Date(date); r.setUTCHours(h, m, 0, 0); return r;
}
function dayKey(d) { return d.toISOString().slice(0, 10); }
function isWorkday(d) {
  const w = d.getUTCDay();
  if (w === 0 || w === 6) return false;
  return !HOLIDAYS.has(dayKey(d));
}
function nextWorkday(d) {
  const r = new Date(d);
  do { r.setUTCDate(r.getUTCDate() + 1); } while (!isWorkday(r));
  return r;
}

async function main() {
  const sessions = await prisma.session.findMany({
    where: {
      module: { in: ["off-boarding", "end-of-month"] },
      date: { gte: new Date() },
    },
    include: { client: true },
  });

  // Agrupa por dia preferido (mantem o dia actual da DB)
  const byDay = {};
  for (const s of sessions) {
    const k = dayKey(s.date);
    if (!byDay[k]) byDay[k] = [];
    byDay[k].push(s);
  }

  // Processa dias por ordem, resolvendo overflow
  const sortedDays = Object.keys(byDay).sort();

  for (const k of sortedDays) {
    let list = byDay[k];
    if (!list || list.length === 0) continue;

    // Ordena: off-boarding primeiro (fixo), depois EOM por cliente
    list.sort((a, b) => {
      if (a.module !== b.module) return a.module === "off-boarding" ? -1 : 1;
      return (a.client?.name ?? "").localeCompare(b.client?.name ?? "");
    });

    const dayObj = new Date(list[0].date);
    const slots = slotsForDay(dayObj);

    if (list.length > slots.length) {
      // Separa overflow
      const overflow = list.slice(slots.length);
      byDay[k] = list.slice(0, slots.length);
      let nextDay = nextWorkday(dayObj);
      const nextK = dayKey(nextDay);
      if (!byDay[nextK]) {
        byDay[nextK] = overflow;
        sortedDays.push(nextK);
        sortedDays.sort();
      } else {
        byDay[nextK] = [...byDay[nextK], ...overflow];
      }
    }
  }

  // Segunda passagem: atribuir slots finais
  let updated = 0, unchanged = 0;

  // Re-sort tudo
  const finalDays = [...new Set(Object.keys(byDay))].sort();
  for (const k of finalDays) {
    const list = byDay[k];
    if (!list || list.length === 0) continue;
    list.sort((a, b) => {
      if (a.module !== b.module) return a.module === "off-boarding" ? -1 : 1;
      return (a.client?.name ?? "").localeCompare(b.client?.name ?? "");
    });

    const dayObj = new Date(k + "T10:00:00.000Z");
    const slots = slotsForDay(dayObj);

    for (let i = 0; i < list.length && i < slots.length; i++) {
      const s = list[i];
      const newDate = setTime(dayObj, slots[i]);
      if (s.date && Math.abs(s.date.getTime() - newDate.getTime()) < 60000) {
        unchanged++;
      } else {
        await prisma.session.update({ where: { id: s.id }, data: { date: newDate } });
        updated++;
      }
    }
  }

  console.log(`[redist-v2] ${updated} actualizadas, ${unchanged} inalteradas`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
