"""
Gera plano de reunioes End-of-Month + Off-Boarding para cada cliente activo.

Regras:
- End-of-Month: ultimo dia util do mes, excepto no mes em que esta o off-boarding
- Off-Boarding: 3 dias uteis antes do projectEnd
- So marca reunioes FUTURAS (>= hoje)
- Se cair em sabado/domingo -> sexta-feira anterior
"""

from datetime import date, timedelta
import calendar

TODAY = date(2026, 4, 23)  # Hoje

# Feriados nacionais PT 2026-2027
HOLIDAYS = {
    # 2026
    date(2026, 4, 3),   # Sexta Santa
    date(2026, 4, 25),  # Liberdade (sab)
    date(2026, 5, 1),   # Trabalhador (sex)
    date(2026, 6, 4),   # Corpo de Cristo (qui)
    date(2026, 6, 10),  # Portugal (qua)
    date(2026, 8, 15),  # Assuncao (sab)
    date(2026, 10, 5),  # Republica (seg)
    date(2026, 11, 1),  # Todos os Santos (dom)
    date(2026, 12, 1),  # Restauracao (ter)
    date(2026, 12, 8),  # Imaculada (ter)
    date(2026, 12, 25), # Natal (sex)
    # 2027
    date(2027, 1, 1),   # Ano Novo (sex)
    date(2027, 3, 26),  # Sexta Santa
    date(2027, 4, 25),  # Liberdade (dom)
    date(2027, 5, 1),   # Trabalhador (sab)
}

CLIENTS = [
    ("DSIC São Domingos de Rana",  date(2025, 12, 17), date(2026, 2, 10)),
    ("DS Private Póvoa de Varzim", date(2025, 11, 4),  date(2026, 2, 27)),
    ("DSIC Castelo Branco",        date(2025, 12, 22), date(2026, 4, 1)),
    ("Ana Vasco",                  date(2026, 2, 2),   date(2026, 4, 9)),
    ("DS Póvoa de Varzim",         date(2026, 1, 19),  date(2026, 4, 19)),
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
    ("DSIC Portalegre",            date(2026, 1, 14),  date(2027, 1, 14)),
    ("André Soares",               date(2026, 2, 2),   date(2027, 2, 2)),
    ("RA Creditos",                date(2026, 2, 9),   date(2027, 2, 9)),
    ("Diogo Cândido",              date(2026, 2, 19),  date(2027, 2, 19)),
]


def is_workday(d: date) -> bool:
    return d.weekday() < 5 and d not in HOLIDAYS


def previous_workday(d: date) -> date:
    while not is_workday(d):
        d -= timedelta(days=1)
    return d


def last_workday_of_month(year: int, month: int) -> date:
    last_day = calendar.monthrange(year, month)[1]
    d = date(year, month, last_day)
    return previous_workday(d)


def n_workdays_before(d: date, n: int) -> date:
    """Devolve a data que esta N dias uteis antes de d (nao inclui d)."""
    count = 0
    while count < n:
        d -= timedelta(days=1)
        if is_workday(d):
            count += 1
    return d


def months_between(start: date, end: date):
    """Gera (year, month) para cada mes entre start e end (inclusive)."""
    y, m = start.year, start.month
    while (y, m) <= (end.year, end.month):
        yield (y, m)
        m += 1
        if m > 12:
            m = 1
            y += 1


def plan_client(name: str, start: date, end: date):
    # Off-boarding
    offboard = n_workdays_before(end, 3)

    # Determina em que mes cai o off-boarding
    offboard_month = (offboard.year, offboard.month)

    # End-of-month para cada mes do contrato EXCEPTO o mes do off-boarding
    eoms = []
    for y, m in months_between(start, end):
        if (y, m) == offboard_month:
            continue
        eom = last_workday_of_month(y, m)
        # So inclui se estiver entre start+1dia e end
        if start < eom < end:
            eoms.append(eom)

    return {
        "name": name,
        "start": start,
        "end": end,
        "offboard": offboard,
        "eoms": eoms,
    }


def format_date(d: date) -> str:
    dias = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]
    return f"{d.strftime('%d/%m/%Y')} ({dias[d.weekday()]})"


# Gera plano para todos
print("\n" + "=" * 100)
print(f"PLANO DE REUNIÕES — Hoje: {format_date(TODAY)}")
print("=" * 100)

all_meetings_to_schedule = []
ended_already = []

for name, start, end in CLIENTS:
    plan = plan_client(name, start, end)
    future_eoms = [d for d in plan["eoms"] if d >= TODAY]
    offboard_future = plan["offboard"] >= TODAY

    if end < TODAY:
        ended_already.append((name, end))
        continue

    print(f"\n[C] {name}")
    print(f"   Contrato: {format_date(start)} → {format_date(end)}")

    if offboard_future:
        print(f"   [OFF] Off-Boarding: {format_date(plan['offboard'])}")
        all_meetings_to_schedule.append({
            "client": name,
            "type": "OFFBOARDING",
            "date": plan["offboard"],
        })

    if future_eoms:
        for d in future_eoms:
            print(f"   [EOM] End-of-Month:  {format_date(d)}")
            all_meetings_to_schedule.append({
                "client": name,
                "type": "END_OF_MONTH",
                "date": d,
            })

    past_eoms = [d for d in plan["eoms"] if d < TODAY]
    if past_eoms:
        print(f"   [!]  EOMs passados (não agendar): {', '.join(d.strftime('%d/%m') for d in past_eoms)}")

if ended_already:
    print("\n" + "-" * 100)
    print("[!]  CONTRATOS JÁ TERMINADOS (não inclui reuniões):")
    for name, end in ended_already:
        print(f"   * {name} (fim: {end.strftime('%d/%m/%Y')})")

# Resumo
print("\n" + "=" * 100)
print(f"TOTAL DE REUNIÕES A AGENDAR: {len(all_meetings_to_schedule)}")
print("=" * 100)

offb = [m for m in all_meetings_to_schedule if m["type"] == "OFFBOARDING"]
eom = [m for m in all_meetings_to_schedule if m["type"] == "END_OF_MONTH"]
print(f"  * Off-Boarding: {len(offb)}")
print(f"  * End-of-Month: {len(eom)}")

# Agrupar por data para ver carga diaria
print("\n" + "-" * 100)
print("POR DATA (para ver carga da equipa):")
from collections import defaultdict
by_date = defaultdict(list)
for m in all_meetings_to_schedule:
    by_date[m["date"]].append((m["client"], m["type"]))

for d in sorted(by_date.keys()):
    print(f"\n  {format_date(d)}:")
    for client, typ in by_date[d]:
        icon = "[OFF]" if typ == "OFFBOARDING" else "[EOM]"
        print(f"    {icon} {client} — {typ}")
