"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock,
  Video, MapPin, Users, RefreshCw, ExternalLink, Loader2,
} from "lucide-react";

function getWeekDays(startDate: Date): Date[] {
  const start = new Date(startDate);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

function isToday(date: Date) {
  return date.toDateString() === new Date().toDateString();
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

export default function CalendarPage() {
  const { data: session } = useSession();
  const userId = (session?.user as Record<string, unknown>)?.id as string | undefined;

  const [currentDate, setCurrentDate] = useState(new Date());
  const weekDays = getWeekDays(currentDate);

  const weekStart = weekDays[0];
  const weekEnd = new Date(weekDays[6]);
  weekEnd.setHours(23, 59, 59, 999);

  const events = trpc.calendar.events.useQuery(
    { userId: userId!, from: weekStart, to: weekEnd },
    { enabled: !!userId }
  );

  const syncCalendar = trpc.calendar.sync.useMutation({
    onSuccess: () => events.refetch(),
  });

  function prevWeek() {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  }

  function nextWeek() {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  }

  const monthYear = currentDate.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });

  // Group events by day
  const eventsByDay: Record<string, typeof events.data> = {};
  for (const day of weekDays) {
    eventsByDay[day.toDateString()] = [];
  }
  if (events.data) {
    for (const event of events.data) {
      const eventDate = new Date(event.start);
      const key = eventDate.toDateString();
      if (eventsByDay[key]) {
        eventsByDay[key]!.push(event);
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Calendario</h1>
          <p className="text-muted-foreground capitalize">{monthYear}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentDate(new Date())} className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted">
            Hoje
          </button>
          <button onClick={prevWeek} className="rounded-lg border p-1.5 hover:bg-muted">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={nextWeek} className="rounded-lg border p-1.5 hover:bg-muted">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => userId && syncCalendar.mutate(userId)}
            disabled={syncCalendar.isPending || !userId}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {syncCalendar.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {syncCalendar.isPending ? "A sincronizar..." : "Sync Calendar"}
          </button>
        </div>
      </div>

      {/* Error */}
      {events.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Erro ao buscar eventos: {events.error.message}
        </div>
      )}

      {/* Week View */}
      <div className="grid gap-3 md:grid-cols-7">
        {weekDays.map((day) => {
          const dayEvents = eventsByDay[day.toDateString()] ?? [];
          const dayName = day.toLocaleDateString("pt-PT", { weekday: "short" }).replace(".", "");
          const dayNum = day.getDate();

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "rounded-xl border bg-card p-3 min-h-[140px]",
                isToday(day) && "border-primary/50 bg-primary/[0.02]"
              )}
            >
              {/* Day header */}
              <div className="mb-2 text-center">
                <p className="text-[11px] uppercase text-muted-foreground">{dayName}</p>
                <p className={cn(
                  "text-lg font-semibold",
                  isToday(day) && "mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-sm"
                )}>
                  {dayNum}
                </p>
              </div>

              {/* Events */}
              <div className="space-y-1.5">
                {dayEvents.length === 0 && (
                  <p className="text-center text-[10px] text-muted-foreground/50 mt-4">Sem eventos</p>
                )}
                {dayEvents.map((event) => {
                  const startTime = new Date(event.start).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <div
                      key={event.id}
                      className="rounded-lg bg-primary/10 border border-primary/20 p-1.5 cursor-pointer hover:bg-primary/20 transition-colors"
                    >
                      <p className="text-[10px] font-medium text-primary">{startTime}</p>
                      <p className="text-[11px] font-medium leading-tight truncate">{event.title}</p>
                      {event.meetLink && (
                        <div className="flex items-center gap-0.5 mt-0.5">
                          <Video className="h-2.5 w-2.5 text-muted-foreground" />
                          <span className="text-[9px] text-muted-foreground">Meet</span>
                        </div>
                      )}
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
          <p className="text-xs text-muted-foreground">
            {events.data?.length ?? 0} eventos
            {events.isLoading && " (a carregar...)"}
          </p>
        </div>
        <div className="divide-y">
          {events.data?.length === 0 && !events.isLoading && (
            <div className="flex flex-col items-center gap-2 p-8 text-muted-foreground">
              <CalendarIcon className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm">Sem eventos esta semana</p>
              <p className="text-xs">Clica em "Sync Calendar" para buscar eventos do Google Calendar.</p>
            </div>
          )}
          {events.isLoading && (
            <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">A buscar eventos...</span>
            </div>
          )}
          {events.data?.map((event) => (
            <div key={event.id} className="flex items-center gap-4 p-4">
              <div className="flex flex-col items-center rounded-lg bg-primary/10 px-3 py-2 text-center min-w-[56px]">
                <p className="text-[10px] uppercase text-muted-foreground">
                  {new Date(event.start).toLocaleDateString("pt-PT", { weekday: "short" }).replace(".", "")}
                </p>
                <p className="text-lg font-bold text-primary">
                  {new Date(event.start).getDate()}
                </p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{event.title}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(event.start).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                    {" - "}
                    {new Date(event.end).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {event.attendees.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {event.attendees.length}
                    </span>
                  )}
                  {event.location && (
                    <span className="flex items-center gap-1 truncate">
                      <MapPin className="h-3 w-3" />
                      {event.location}
                    </span>
                  )}
                </div>
              </div>
              {event.meetLink && (
                <a
                  href={event.meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-lg bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-200 shrink-0"
                >
                  <Video className="h-3 w-3" />
                  Meet
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
