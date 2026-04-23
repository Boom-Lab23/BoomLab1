/**
 * Resolve conflitos finais: se 2+ sessoes mesma data+hora, move uma para proximo slot livre.
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const ALL_SLOTS = ["10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
function slotsForDay(d) {
  const w = d.getUTCDay();
  if (w === 2 || w === 4) return ALL_SLOTS.filter((s) => s !== "10:00");
  return [...ALL_SLOTS];
}
function setTime(d, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const r = new Date(d); r.setUTCHours(h, m, 0, 0); return r;
}
function dayKey(d) { return d.toISOString().slice(0, 10); }

async function main() {
  const sessions = await prisma.session.findMany({
    where: { module: { in: ["off-boarding", "end-of-month"] }, date: { gte: new Date() } },
    include: { client: true },
  });

  // Agrupa por dia e resolve conflitos
  const byDay = {};
  for (const s of sessions) {
    const k = dayKey(s.date);
    if (!byDay[k]) byDay[k] = [];
    byDay[k].push(s);
  }

  let fixed = 0;
  for (const [k, list] of Object.entries(byDay)) {
    // Ordena off-boarding primeiro (fixo), depois EOM por nome
    list.sort((a, b) => {
      if (a.module !== b.module) return a.module === "off-boarding" ? -1 : 1;
      return (a.client?.name ?? "").localeCompare(b.client?.name ?? "");
    });

    const dayObj = new Date(list[0].date);
    const slots = slotsForDay(dayObj);

    // Detecta horas em uso
    const used = new Set();
    const toMove = [];

    for (const s of list) {
      const hhmm = s.date.toISOString().slice(11, 16);
      if (used.has(hhmm) || !slots.includes(hhmm)) {
        toMove.push(s);
      } else {
        used.add(hhmm);
      }
    }

    // Atribui slots livres aos que precisam mover
    for (const s of toMove) {
      const free = slots.find((sl) => !used.has(sl));
      if (!free) {
        console.warn(`[!] ${k}: sem slots livres para ${s.client?.name}`);
        continue;
      }
      const newDate = setTime(dayObj, free);
      await prisma.session.update({ where: { id: s.id }, data: { date: newDate } });
      used.add(free);
      fixed++;
    }
  }

  console.log(`[resolve] ${fixed} conflitos resolvidos`);
  await prisma.$disconnect();
}
main();
