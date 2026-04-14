"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Calendar, Mic, FileText, Rocket, Settings,
  BarChart3, UserCheck, Handshake, Megaphone, Phone, Linkedin,
  CalendarCheck, CalendarDays, MessageSquare, Moon, Sun, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useState } from "react";

const mainNav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clientes", icon: Users },
  { href: "/sessions", label: "Sessoes", icon: Calendar },
  { href: "/calendar", label: "Calendario", icon: CalendarDays },
  { href: "/recordings", label: "Gravacoes & IA", icon: Mic },
  { href: "/messaging", label: "Mensagens", icon: MessageSquare },
  { href: "/documents", label: "Documentos", icon: FileText },
  { href: "/boom-club", label: "Boom Club", icon: Rocket },
];

const pillarNav = [
  { id: "gestao-comercial", label: "Gestao Comercial", icon: BarChart3, color: "#a78bfa" },
  { id: "consultoria-comercial", label: "Consultoria Comercial", icon: UserCheck, color: "#4ade80" },
  { id: "parcerias", label: "Parcerias", icon: Handshake, color: "#fb923c" },
  { id: "ads-funnel", label: "Ads Funnel", icon: Megaphone, color: "#60a5fa" },
  { id: "cold-calls", label: "Cold Calls", icon: Phone, color: "#facc15" },
  { id: "linkedin-outreach", label: "LinkedIn Outreach", icon: Linkedin, color: "#f472b6" },
  { id: "acompanhamento", label: "Acompanhamento", icon: CalendarCheck, color: "#94a3b8" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [pillarsOpen, setPillarsOpen] = useState(true);

  return (
    <aside className="flex h-screen w-[240px] flex-col bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))]">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--sidebar-active))]">
          <Rocket className="h-4 w-4 text-white" />
        </div>
        <div>
          <span className="text-sm font-bold text-white tracking-wide">BoomLab</span>
          <p className="text-[10px] leading-none text-[hsl(var(--sidebar-fg))]">Platform</p>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin">
        <div className="space-y-0.5">
          {mainNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] font-medium transition-all duration-150",
                  isActive
                    ? "bg-[hsl(var(--sidebar-active))] text-white shadow-sm shadow-blue-500/20"
                    : "text-[hsl(var(--sidebar-fg))] hover:white/[0.06] hover:text-white"
                )}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Pillar Section */}
        <div className="mt-5">
          <button
            onClick={() => setPillarsOpen(!pillarsOpen)}
            className="flex w-full items-center justify-between px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--sidebar-fg))]/60 hover:text-[hsl(var(--sidebar-fg))]"
          >
            Pilares
            <ChevronDown className={cn("h-3 w-3 transition-transform", !pillarsOpen && "-rotate-90")} />
          </button>
          {pillarsOpen && (
            <div className="mt-1 space-y-0.5 animate-fade-in">
              {pillarNav.map((pillar) => (
                <Link
                  key={pillar.id}
                  href={`/sessions?module=${pillar.id}`}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-[6px] text-[13px] text-[hsl(var(--sidebar-fg))] transition-all duration-150 hover:white/[0.06] hover:text-white"
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: pillar.color }} />
                  {pillar.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Bottom */}
      <div className="border-t border-white/[0.06] p-3 space-y-0.5">
        {/* Dark mode toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] font-medium text-[hsl(var(--sidebar-fg))] transition-all duration-150 hover:white/[0.06] hover:text-white"
        >
          {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
        </button>

        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] font-medium transition-all duration-150",
            pathname.startsWith("/settings")
              ? "bg-[hsl(var(--sidebar-active))] text-white"
              : "text-[hsl(var(--sidebar-fg))] hover:white/[0.06] hover:text-white"
          )}
        >
          <Settings className="h-[18px] w-[18px]" />
          Configuracoes
        </Link>
      </div>
    </aside>
  );
}
