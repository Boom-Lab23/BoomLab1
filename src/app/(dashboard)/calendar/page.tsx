"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock,
  Video, Users, RefreshCw, Loader2, Check,
} from "lucide-react";

function getWeekDays(startDate: Date): Date[] {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0); // normaliza para inicio do dia
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }
  return days;
}

function isToday(date: Date) {
  return date.toDateString() === new Date().toDateString();
}

const MEMBER_COLORS = [
  { bg: "#2D76FC", light: "#2D76FC20", text: "#2D76FC" },
  { bg: "#16a34a", light: "#16a34a20", text: "#16a34a" },
  { bg: "#ea580c", light: "#ea580c20", text: "#ea580c" },
  { bg: "#8b5cf6", light: "#8b5cf620", text: "#8b5cf6" },
  { bg: "#ec4899", light: "#ec489920", text: "#ec4899" },
  { bg: "#0891b2", light: "#0891b220", text: "#0891b2" },
  { bg: "#ca8a04", light: "#ca8a0420", text: "#ca8a04" },
  { bg: "#dc2626", light: "#dc262620", text: "#dc2626" },
];

type TeamEvent = {
  userId: string;
  userName: string;
  color: typeof MEMBER_COLORS[number];
  event: { id: string; title: string; start: Date; end: Date; meetLink: string | null; attendees: string[] };
};

export default function CalendarPage() {
  const { data: session } = useSession();
  const userId = (session?.user as Record<string, unknown>)?.id as string | undefined;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const weekDays = getWeekDays(currentDate);
  const weekStart = new Date(weekDays[0]);
  weekStart.setHours(0, 0, 0, 0); // importante: senao a segunda corta eventos de manha
  const weekEnd = new Date(weekDays[6]);
  weekEnd.setHours(23, 59, 59, 999);

  const teamMembers = trpc.admin.listUsers.useQuery();
  const googleMembers = (teamMembers.data ?? []).filter(
    (u) => u.googleConnected && u.isActive && !u.role.startsWith("GUEST")
  );

  // Determine which user IDs to fetch
  const activeUserIds = selectedMembers.length > 0
    ? selectedMembers
    : userId ? [userId] : [];

  // Fetch team events
  const teamEvents = trpc.calendar.teamEvents.useQuery(
    { userIds: activeUserIds, from: weekStart, to: weekEnd },
    { enabled: activeUserIds.length > 0 }
  );

  const syncCalendar = trpc.calendar.sync.useMutation({
    onSuccess: () => teamEvents.refetch(),
  });

  // Build color map for members
  const memberColorMap = useMemo(() => {
    const map: Record<string, typeof MEMBER_COLORS[number]> = {};
    googleMembers.forEach((m, i) => {
      map[m.id] = MEMBER_COLORS[i % MEMBER_COLORS.length];
    });
    if (userId && !map[userId]) {
      map[userId] = MEMBER_COLORS[0];
    }
    return map;
  }, [googleMembers, userId]);

  // Flatten all events with member info and color
  const allEvents: TeamEvent[] = useMemo(() => {
    if (!teamEvents.data) return [];
    const events: TeamEvent[] = [];
    for (const member of teamEvents.data) {
      const color = memberColorMap[member.userId] ?? MEMBER_COLORS[0];
      for (const event of member.events) {
        events.push({
          userId: member.userId,
          userName: member.userName,
          color,
          event: {
            ...event,
            start: new Date(event.start),
            end: new Date(event.end),
          },
        });
      }
    }
    return events;
  }, [teamEvents.data, memberColorMap]);

  // Group events by day
  const eventsByDay: Record<string, TeamEvent[]> = {};
  for (const day of weekDays) {
    eventsByDay[day.toDateString()] = [];
  }
  for (const te of allEvents) {
    const key = te.event.start.toDateString();
    if (eventsByDay[key]) {
      eventsByDay[key].push(te);
    }
  }

  function prevWeek() { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); }
  function nextWeek() { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); }
  function toggleMember(id: string) {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const monthYear = currentDate.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Calendario</h1>
          <p className="text-muted-foreground capitalize">{monthYear}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentDate(new Date())} className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted">Hoje</button>
          <button onClick={prevWeek} className="rounded-lg border p-1.5 hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={nextWeek} className="rounded-lg border p-1.5 hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
          <button onClick={() => userId && syncCalendar.mutate(userId)} disabled={syncCalendar.isPending || !userId}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
            {syncCalendar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync
          </button>
        </div>
      </div>

      {/* Team Member Selector with colors */}
      <div className="rounded-xl border bg-card p-3">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Equipa</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedMembers([])}
            className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors",
              selectedMembers.length === 0 ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground hover:bg-muted border-border"
            )}
          >
            O meu calendario
          </button>
          {googleMembers.map((member) => {
            const isSelected = selectedMembers.includes(member.id);
            const color = memberColorMap[member.id] ?? MEMBER_COLORS[0];
            return (
              <button
                key={member.id}
                onClick={() => toggleMember(member.id)}
                className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                  isSelected ? "text-white border-transparent" : "bg-card text-muted-foreground hover:bg-muted border-border"
                )}
                style={isSelected ? { backgroundColor: color.bg, borderColor: color.bg } : undefined}
              >
                {isSelected && <Check className="h-3 w-3" />}
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: isSelected ? "white" : color.bg }} />
                {member.name}
              </button>
            );
          })}
          {googleMembers.length > 1 && (
            <button
              onClick={() => setSelectedMembers(googleMembers.map((m) => m.id))}
              className={cn("rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                selectedMembers.length === googleMembers.length ? "bg-gray-900 text-white border-gray-900" : "bg-card text-muted-foreground hover:bg-muted border-border"
              )}
            >
              Todos
            </button>
          )}
          {googleMembers.length === 0 && (
            <p className="text-xs text-muted-foreground py-1">Nenhum membro conectou o Google ainda.</p>
          )}
        </div>
      </div>

      {/* Error */}
      {teamEvents.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
          Erro: {teamEvents.error.message}
        </div>
      )}

      {/* Week View with colored events */}
      <div className="grid gap-2 md:gap-3 grid-cols-2 md:grid-cols-7">
        {weekDays.map((day) => {
          const dayEvents = eventsByDay[day.toDateString()] ?? [];
          const dayName = day.toLocaleDateString("pt-PT", { weekday: "short" }).replace(".", "");

          return (
            <div key={day.toISOString()} className={cn("rounded-xl border bg-card p-2 md:p-3 min-h-[120px]", isToday(day) && "border-primary/50 bg-primary/[0.02]")}>
              <div className="mb-2 text-center">
                <p className="text-[10px] uppercase text-muted-foreground">{dayName}</p>
                <p className={cn("text-lg font-semibold", isToday(day) && "mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white text-sm")}>
                  {day.getDate()}
                </p>
              </div>
              <div className="space-y-1">
                {dayEvents.length === 0 && <p className="text-center text-[9px] text-muted-foreground/40 mt-2">—</p>}
                {dayEvents.map((te) => {
                  const time = te.event.start.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <div key={te.event.id + te.userId} className="rounded p-1 transition-colors hover:opacity-80"
                      style={{ backgroundColor: te.color.light, borderLeft: `3px solid ${te.color.bg}` }}>
                      <p className="text-[9px] font-medium" style={{ color: te.color.text }}>{time}</p>
                      <p className="text-[10px] font-medium leading-tight truncate">{te.event.title}</p>
                      <p className="text-[8px] text-muted-foreground truncate">{te.userName}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Events List */}
      <div className="rounded-xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-semibold">Reunioes desta Semana</h2>
          <p className="text-xs text-muted-foreground">{allEvents.length} eventos {teamEvents.isLoading && "(a carregar...)"}</p>
        </div>
        <div className="divide-y">
          {allEvents.length === 0 && !teamEvents.isLoading && (
            <div className="flex flex-col items-center gap-2 p-8 text-muted-foreground">
              <CalendarIcon className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm">Sem eventos esta semana</p>
            </div>
          )}
          {teamEvents.isLoading && (
            <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">A buscar...</span>
            </div>
          )}
          {allEvents.sort((a, b) => a.event.start.getTime() - b.event.start.getTime()).map((te) => (
            <div key={te.event.id + te.userId} className="flex items-center gap-3 p-3 md:p-4">
              {/* Color bar */}
              <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: te.color.bg }} />
              <div className="flex flex-col items-center rounded-lg px-2 py-1.5 text-center min-w-[48px]" style={{ backgroundColor: te.color.light }}>
                <p className="text-[9px] uppercase text-muted-foreground">
                  {te.event.start.toLocaleDateString("pt-PT", { weekday: "short" }).replace(".", "")}
                </p>
                <p className="text-base font-bold" style={{ color: te.color.text }}>{te.event.start.getDate()}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{te.event.title}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {te.event.start.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                    {" - "}
                    {te.event.end.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="flex items-center gap-1 font-medium" style={{ color: te.color.text }}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: te.color.bg }} />
                    {te.userName}
                  </span>
                </div>
              </div>
              {te.event.meetLink && (
                <a href={te.event.meetLink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-lg bg-green-100 dark:bg-green-900/40 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-300 hover:bg-green-200 shrink-0">
                  <Video className="h-3 w-3" />Meet
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
