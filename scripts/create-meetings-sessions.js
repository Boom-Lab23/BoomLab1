/**
 * Cria Sessions (status=MARCADA) para todas as reunioes End-of-Month e Off-Boarding
 * para todos os clientes activos.
 *
 * Regras:
 * - End-of-Month: ultima semana util do mes (seg-sex). Reunioes distribuidas pelos 5 dias.
 * - Off-Boarding: 3 dias uteis antes de projectEnd
 * - So cria reunioes FUTURAS (>= hoje)
 * - Hora: 9-18 em blocos de 60min
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TODAY = new Date("2026-04-23");
const SLOTS = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

const HOLIDAYS = new Set([
  "2026-05-01", "2026-06-04", "2026-06-10", "2026-08-15",
  "2026-10-05", "2026-11-01", "2026-12-01", "2026-12-08", "2026-12-25",
  "2027-01-01", "2027-03-26", "2027-04-25",
]);

function fmt(d) {
  return d.toISOString().slice(0, 10);
}

function isWorkday(d) {
  const day = d.getUTCDay();
  if (day === 0 || day === 6) return false;
  return !HOLIDAYS.has(fmt(d));
}

function nWorkdaysBefore(d, n) {
  const r = new Date(d);
  let c = 0;
  while (c < n) {
    r.setUTCDate(r.getUTCDate() - 1);
    if (isWorkday(r)) c++;
  }
  return r;
}

function lastWorkdayOfMonth(year, month) {
  const lastDay = new Date(Date.UTC(year, month, 0)); // month 0-indexed in JS, +1 para ultimo dia do mes anterior
  // usamos month (1-indexed) -> day 0 do proximo mes = ultimo dia do mes actual
  const d = new Date(Date.UTC(year, month, 0));
  while (!isWorkday(d)) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

function lastWorkweekOfMonth(year, month) {
  // Ultimos 5 dias uteis do mes. Ordenados asc.
  const last = lastWorkdayOfMonth(year, month);
  const days = [last];
  const cursor = new Date(last);
  while (days.length < 5) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (isWorkday(cursor)) {
      days.unshift(new Date(cursor));
    }
    // Para nao ir para o mes anterior
    if (cursor.getUTCMonth() !== last.getUTCMonth()) break;
  }
  return days; // ordenados seg->sex
}

function monthsBetween(start, end) {
  const out = [];
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth() + 1;
  const endY = end.getUTCFullYear();
  const endM = end.getUTCMonth() + 1;
  while (y < endY || (y === endY && m <= endM)) {
    out.push([y, m]);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

function setTime(d, hhmm) {
  const [h, mm] = hhmm.split(":").map(Number);
  const r = new Date(d);
  r.setUTCHours(h, mm, 0, 0);
  return r;
}

async function main() {
  const clients = await prisma.client.findMany({
    where: { status: { in: ["ATIVO", "PRE_ARRANQUE", "LEVANTAMENTO", "APRESENTACAO_TIMELINE"] } },
    orderBy: { projectEnd: "asc" },
  });

  console.log(`[meetings] ${clients.length} clientes activos`);

  // Passo 1: calcular todas as reunioes
  const meetings = []; // { clientId, clientName, date, type, module, title }

  for (const c of clients) {
    if (!c.projectEnd) continue;
    if (c.projectEnd < TODAY) continue;

    // Off-boarding
    const offboard = nWorkdaysBefore(c.projectEnd, 3);
    if (offboard >= TODAY) {
      meetings.push({
        clientId: c.id,
        clientName: c.name,
        date: offboard,
        type: "OFFBOARDING",
        module: "off-boarding",
        title: `Off-Boarding — ${c.name}`,
      });
    }
    const offboardMonth = offboard.getUTCMonth() + 1;
    const offboardYear = offboard.getUTCFullYear();

    // End-of-Month para cada mes do contrato excepto o mes do off-boarding
    const months = monthsBetween(c.projectStart ?? TODAY, c.projectEnd);
    for (const [y, m] of months) {
      if (y === offboardYear && m === offboardMonth) continue;
      // Usamos o ultimo dia util como referencia do mes (depois distribuimos)
      const eom = lastWorkdayOfMonth(y, m);
      if (eom < TODAY) continue;
      if (eom >= c.projectEnd) continue;
      meetings.push({
        clientId: c.id,
        clientName: c.name,
        date: eom, // provisorio - depois redistribuimos
        type: "END_OF_MONTH",
        module: "end-of-month",
        title: `End-of-Month ${String(m).padStart(2, "0")}/${y} — ${c.name}`,
        _monthKey: `${y}-${String(m).padStart(2, "0")}`,
      });
    }
  }

  console.log(`[meetings] ${meetings.length} reunioes a agendar (antes redistribuicao)`);

  // Passo 2: Redistribuir EOMs pela ultima semana util do mes
  // Agrupa por mes, atribui pelos 5 dias da ultima semana
  const eomByMonth = {};
  for (const m of meetings) {
    if (m.type !== "END_OF_MONTH") continue;
    if (!eomByMonth[m._monthKey]) eomByMonth[m._monthKey] = [];
    eomByMonth[m._monthKey].push(m);
  }

  for (const [monthKey, ms] of Object.entries(eomByMonth)) {
    const [y, mth] = monthKey.split("-").map(Number);
    const week = lastWorkweekOfMonth(y, mth);
    // Ordena clientes alfabeticamente para ser deterministico
    ms.sort((a, b) => a.clientName.localeCompare(b.clientName));
    // Atribui dia + slot
    const perDay = Math.ceil(ms.length / week.length);
    for (let i = 0; i < ms.length; i++) {
      const dayIdx = Math.floor(i / SLOTS.length);
      const slotIdx = i % SLOTS.length;
      const day = week[Math.min(dayIdx, week.length - 1)];
      ms[i].date = setTime(day, SLOTS[slotIdx]);
    }
  }

  // Off-boarding: mete sempre as 10:00
  for (const m of meetings) {
    if (m.type === "OFFBOARDING") {
      m.date = setTime(m.date, "10:00");
    }
  }

  // Passo 3: Idempotencia - verifica se ja existe sessao com mesmo title+date+clientId
  let created = 0, skipped = 0, failed = 0;
  for (const mt of meetings) {
    const existing = await prisma.session.findFirst({
      where: {
        clientId: mt.clientId,
        title: mt.title,
      },
    });
    if (existing) {
      // Update date se diferente (pode reflectir mudanca no contrato)
      if (!existing.date || Math.abs(existing.date.getTime() - mt.date.getTime()) > 60000) {
        await prisma.session.update({
          where: { id: existing.id },
          data: { date: mt.date, status: "MARCADA" },
        });
        console.log(`  [updated] ${mt.clientName} · ${mt.title} -> ${mt.date.toISOString().slice(0, 16)}`);
      } else {
        skipped++;
      }
      continue;
    }
    try {
      await prisma.session.create({
        data: {
          title: mt.title,
          module: mt.module,
          date: mt.date,
          status: "MARCADA",
          clientId: mt.clientId,
        },
      });
      console.log(`  [created] ${mt.clientName} · ${mt.date.toISOString().slice(0, 16)} · ${mt.type}`);
      created++;
    } catch (e) {
      console.error(`  [fail] ${mt.clientName}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n[meetings] ${created} criadas, ${skipped} ja existiam, ${failed} falharam`);
  await prisma.$disconnect();
}

main();
