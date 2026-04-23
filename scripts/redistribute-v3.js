/**
 * v3: distribui reunioes por 2+ dias se necessario.
 * Pega todas as sessoes do mesmo "grupo" (mes) e espalha pela semana inteira.
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

async function main() {
  const sessions = await prisma.session.findMany({
    where: { module: { in: ["off-boarding", "end-of-month"] }, date: { gte: new Date() } },
    include: { client: true },
    orderBy: { date: "asc" },
  });

  // Agrupa por (mes, tipo) e pela chave de data original
  // Para off-boarding, deixamos cada um no seu dia (nao agrupamos)
  // Para end-of-month, agrupamos por mes - todos os EOM do mes sao distribuidos juntos

  const offboards = sessions.filter((s) => s.module === "off-boarding");
  const eoms = sessions.filter((s) => s.module === "end-of-month");

  // EOMs por mes
  const eomByMonth = {};
  for (const s of eoms) {
    const k = s.date.toISOString().slice(0, 7); // YYYY-MM
    if (!eomByMonth[k]) eomByMonth[k] = [];
    eomByMonth[k].push(s);
  }

  let updated = 0;
  const updates = [];

  // Para cada grupo mensal de EOMs, distribui pela ultima semana util do mes
  for (const [monthKey, list] of Object.entries(eomByMonth)) {
    const [y, m] = monthKey.split("-").map(Number);
    // Ultima semana util do mes: 5 dias uteis terminando no ultimo dia util
    const lastDayOfMonth = new Date(Date.UTC(y, m, 0));
    const week = [];
    const cursor = new Date(lastDayOfMonth);
    while (!isWorkday(cursor)) cursor.setUTCDate(cursor.getUTCDate() - 1);
    week.unshift(new Date(cursor));
    while (week.length < 5) {
      cursor.setUTCDate(cursor.getUTCDate() - 1);
      if (isWorkday(cursor)) week.unshift(new Date(cursor));
      if (cursor.getUTCMonth() !== lastDayOfMonth.getUTCMonth()) break;
    }

    // Ordena por nome cliente
    list.sort((a, b) => (a.client?.name ?? "").localeCompare(b.client?.name ?? ""));

    // Distribui round-robin pelos dias disponiveis ate nenhum dia ter slots livres
    const assignment = week.map((d) => ({ day: d, remaining: [...slotsForDay(d)] }));
    let dayIdx = 0;
    for (const s of list) {
      // Encontra proximo dia com slots
      let tries = 0;
      while (assignment[dayIdx].remaining.length === 0) {
        dayIdx = (dayIdx + 1) % assignment.length;
        tries++;
        if (tries > assignment.length) {
          // Todos cheios - aumenta slots num dia
          break;
        }
      }
      const slot = assignment[dayIdx].remaining.shift();
      if (!slot) continue;
      const newDate = setTime(assignment[dayIdx].day, slot);
      if (!s.date || Math.abs(s.date.getTime() - newDate.getTime()) > 60000) {
        updates.push({ id: s.id, date: newDate });
      }
      dayIdx = (dayIdx + 1) % assignment.length;
    }
  }

  // Off-boarding mantem-se no dia mas ajusta hora para nao conflitar
  // Agrupa por dia
  const offByDay = {};
  for (const s of offboards) {
    const k = dayKey(s.date);
    if (!offByDay[k]) offByDay[k] = [];
    offByDay[k].push(s);
  }
  for (const [k, list] of Object.entries(offByDay)) {
    list.sort((a, b) => (a.client?.name ?? "").localeCompare(b.client?.name ?? ""));
    const dayObj = new Date(list[0].date);
    const slots = slotsForDay(dayObj);
    for (let i = 0; i < list.length && i < slots.length; i++) {
      const newDate = setTime(dayObj, slots[i]);
      if (!list[i].date || Math.abs(list[i].date.getTime() - newDate.getTime()) > 60000) {
        updates.push({ id: list[i].id, date: newDate });
      }
    }
  }

  for (const u of updates) {
    await prisma.session.update({ where: { id: u.id }, data: { date: u.date } });
    updated++;
  }

  console.log(`[redist-v3] ${updated} actualizadas`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
