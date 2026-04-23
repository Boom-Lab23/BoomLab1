"""Lista reunioes por dia com sugestao de horario."""
from datetime import date, timedelta
import calendar

TODAY = date(2026, 4, 23)

HOLIDAYS = {
    date(2026, 5, 1), date(2026, 6, 4), date(2026, 6, 10), date(2026, 8, 15),
    date(2026, 10, 5), date(2026, 11, 1), date(2026, 12, 1), date(2026, 12, 8),
    date(2026, 12, 25), date(2027, 1, 1), date(2027, 3, 26), date(2027, 4, 25),
}

CLIENTS = [
    ("DSIC Setúbal Vitória",       date(2026, 1, 5),   date(2026, 4, 24)),
    ("Doutor Finanças Maia",       date(2026, 2, 3),   date(2026, 4, 28)),
    ("CrediAdvisor",               date(2025, 12, 23), date(2026, 5, 7)),
    ("Finitaipas",                 date(2026, 2, 6),   date(2026, 5, 14)),
    ("Finance4U",                  date(2026, 2, 2),   date(2026, 5, 15)),
    ("DSIC Salvaterra de Magos",   date(2026, 1, 16),  date(2026, 5, 16)),
    ("Chanceplus",                 date(2026, 1, 27),  date(2026, 5, 27)),
    ("DS Sobral Monte Agraço",     date(2026, 3, 11),  date(2026, 6, 11)),
    ("JCM Seguros",                date(2026, 3, 12),  date(2026, 6, 12)),
    ("Finance21 homevintage",      date(2026, 3, 17),  date(2026, 6, 17)),
    ("DSIC Jardim da Amoreira",    date(2026, 2, 19),  date(2026, 6, 19)),
    ("DS Guimarães",               date(2026, 2, 27),  date(2026, 6, 27)),
    ("Total Seguros",              date(2026, 4, 10),  date(2026, 7, 10)),
    ("XFIN MacFin",                date(2026, 3, 12),  date(2026, 7, 12)),
    ("Belocrédito",                date(2026, 4, 6),   date(2026, 8, 6)),
    ("Orbiscrédito",               date(2026, 3, 31),  date(2026, 6, 30)),
    ("DSIC Portalegre",            date(2026, 1, 14),  date(2027, 1, 14)),
    ("André Soares",               date(2026, 2, 2),   date(2027, 2, 2)),
    ("RA Creditos",                date(2026, 2, 9),   date(2027, 2, 9)),
    ("Diogo Cândido",              date(2026, 2, 19),  date(2027, 2, 19)),
]


def is_workday(d):
    return d.weekday() < 5 and d not in HOLIDAYS


def prev_workday(d):
    while not is_workday(d):
        d -= timedelta(days=1)
    return d


def last_workday_of_month(y, m):
    last = calendar.monthrange(y, m)[1]
    return prev_workday(date(y, m, last))


def n_workdays_before(d, n):
    c = 0
    while c < n:
        d -= timedelta(days=1)
        if is_workday(d):
            c += 1
    return d


def months_between(start, end):
    y, m = start.year, start.month
    while (y, m) <= (end.year, end.month):
        yield (y, m)
        m += 1
        if m > 12:
            m = 1; y += 1


from collections import defaultdict
by_day = defaultdict(list)

for name, start, end in CLIENTS:
    if end < TODAY:
        continue
    offboard = n_workdays_before(end, 3)
    offboard_month = (offboard.year, offboard.month)

    if offboard >= TODAY:
        by_day[offboard].append((name, "OFFBOARDING"))

    for y, m in months_between(start, end):
        if (y, m) == offboard_month: continue
        eom = last_workday_of_month(y, m)
        if start < eom < end and eom >= TODAY:
            by_day[eom].append((name, "END_OF_MONTH"))

# Slots sugeridos: 09:00, 10:00, 11:00, 14:00, 15:00, 16:00 (6 por dia)
SLOTS = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"]
dias_semana = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"]

total = 0
for day in sorted(by_day.keys()):
    meetings = by_day[day]
    total += len(meetings)
    print(f"\n{'='*70}")
    print(f"📅 {day.strftime('%d/%m/%Y')} ({dias_semana[day.weekday()]}) — {len(meetings)} reunioes")
    print("="*70)
    for i, (client, typ) in enumerate(meetings):
        slot = SLOTS[i] if i < len(SLOTS) else f"{17 + i - len(SLOTS)}:00"
        icon = "🔴" if typ == "OFFBOARDING" else "🟡"
        print(f"  {slot}  {icon} {typ:14} — {client}")
    if len(meetings) > len(SLOTS):
        print(f"  ⚠️  Mais que {len(SLOTS)} reunioes neste dia - considerar distribuir")

print(f"\n{'='*70}")
print(f"TOTAL: {total} reunioes em {len(by_day)} dias")
print(f"{'='*70}")
