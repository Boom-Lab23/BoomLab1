"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock,
  Video, MapPin, Users, RefreshCw, ExternalLink,
} from "lucide-react";

// Generate week days starting from a given date
function getWeekDays(startDate: Date): Date[] {
  const start = new Date(startDate);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday
  start.setDate(diff);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
}

function formatDayName(date: Date) {
  return date.toLocaleDateString("pt-PT", { weekday: "short" }).replace(".", "");
}

function isToday(date: Date) {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

// Placeholder events for UI demonstration
const DEMO_HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8:00 to 19:00

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const weekDays = getWeekDays(currentDate);

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

  function goToday() {
    setCurrentDate(new Date());
  }

  const monthYear = currentDate.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calendario</h1>
          <p className="text-muted-foreground capitalize">{monthYear}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToday}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            Hoje
          </button>
          <button onClick={prevWeek} className="rounded-lg border p-1.5 hover:bg-muted">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={nextWeek} className="rounded-lg border p-1.5 hover:bg-muted">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary/90">
            <RefreshCw className="h-4 w-4" />
            Sync Google Calendar
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <p className="text-sm text-blue-800">
          <CalendarIcon className="mr-1 inline h-4 w-4" />
          Conecta a tua conta Google nas Configuracoes para sincronizar o calendario automaticamente.
          As reunioes do Google Calendar aparecerao aqui e serao associadas as sessoes.
        </p>
      </div>

      {/* Weekly Calendar Grid */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b">
          <div className="border-r p-2" />
          {weekDays.map((day, i) => (
            <div
              key={i}
              className={cn(
                "border-r p-2 text-center last:border-r-0",
                isToday(day) && "bg-primary/5"
              )}
            >
              <p className="text-xs text-muted-foreground uppercase">{formatDayName(day)}</p>
              <p
                className={cn(
                  "mt-0.5 text-lg font-semibold",
                  isToday(day) &&
                    "mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-sm"
                )}
              >
                {day.getDate()}
              </p>
            </div>
          ))}
        </div>

        {/* Time slots */}
        <div className="max-h-[600px] overflow-y-auto">
          <div className="grid grid-cols-[60px_repeat(7,1fr)]">
            {DEMO_HOURS.map((hour) => (
              <div key={hour} className="contents">
                {/* Time label */}
                <div className="border-b border-r p-1 text-right">
                  <span className="text-xs text-muted-foreground">{hour}:00</span>
                </div>
                {/* Day cells */}
                {weekDays.map((day, i) => (
                  <div
                    key={i}
                    className={cn(
                      "border-b border-r last:border-r-0 min-h-[48px] p-0.5",
                      isToday(day) && "bg-primary/[0.02]"
                    )}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upcoming events (placeholder) */}
      <div className="rounded-xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-semibold">Proximas Reunioes</h2>
        </div>
        <div className="p-6 text-center text-muted-foreground">
          <CalendarIcon className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-2 text-sm">
            Sincroniza o Google Calendar para ver as reunioes aqui.
          </p>
          <p className="mt-1 text-xs">
            As reunioes serao automaticamente associadas aos clientes e sessoes.
          </p>
        </div>
      </div>
    </div>
  );
}
