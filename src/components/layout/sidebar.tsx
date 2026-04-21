"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard, Users, Calendar, FileText, Rocket, Settings, Brain,
  BarChart3, UserCheck, Handshake, Megaphone, Phone, Linkedin,
  CalendarCheck, CalendarDays, MessageSquare, Moon, Sun, ChevronDown,
  ShieldCheck, X, Layers, UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useState } from "react";

const mainNav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clientes", icon: Users },
  { href: "/sessions", label: "Sessoes", icon: Calendar },
  { href: "/calendar", label: "Calendario", icon: CalendarDays },
  { href: "/workspace", label: "Workspace", icon: BarChart3 },
  { href: "/knowledge", label: "Base Conhec. IA", icon: Brain },
  { href: "/messaging", label: "Mensagens", icon: MessageSquare },
  { href: "/documents", label: "Documentos", icon: FileText },
  { href: "/timelines", label: "Timelines", icon: Layers },
  { href: "/referrals", label: "Referencias", icon: UserPlus },
  { href: "/boom-club", label: "Boom Club", icon: Rocket },
  { href: "/admin/users", label: "Admin", icon: ShieldCheck },
];

const pillarNav = [
  { id: "gestao-comercial", label: "Gestao Comercial", color: "#a78bfa" },
  { id: "consultoria-comercial", label: "Consultoria Comercial", color: "#4ade80" },
  { id: "parcerias", label: "Parcerias", color: "#fb923c" },
  { id: "ads-funnel", label: "Ads Funnel", color: "#60a5fa" },
  { id: "cold-calls", label: "Cold Calls", color: "#facc15" },
  { id: "linkedin-outreach", label: "LinkedIn Outreach", color: "#f472b6" },
  { id: "acompanhamento", label: "Acompanhamento", color: "#94a3b8" },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [pillarsOpen, setPillarsOpen] = useState(true);
  const { data: session } = useSession();
  const role = (session?.user as Record<string, unknown>)?.role as string | undefined;
  const isGuest = role === "GUEST_CLIENT" || role === "GUEST_TEAM_MEMBER";
  const assignedWorkspaceClientId = (session?.user as Record<string, unknown>)?.assignedWorkspaceClientId as string | undefined;
  const assignedChannelId = (session?.user as Record<string, unknown>)?.assignedChannelId as string | undefined;

  // Filter nav for guests: only Workspace (if assigned) + Messages (if assigned channel)
  const visibleNav = isGuest
    ? mainNav.filter((item) => {
        if (item.href === "/workspace" && assignedWorkspaceClientId) return true;
        if (item.href === "/messaging" && assignedChannelId) return true;
        return false;
      })
    : mainNav;

  function handleNav() {
    onClose?.();
  }

  return (
    <aside className="flex h-screen w-[260px] md:w-[240px] flex-col" style={{ background: "hsl(var(--sidebar-bg))" }}>
      {/* Logo + Close */}
      <div className="flex h-14 items-center justify-between px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "hsl(var(--sidebar-active))" }}>
            <Rocket className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-white tracking-wide">BoomLab</span>
            <p className="text-[10px] leading-none" style={{ color: "hsl(var(--sidebar-fg))" }}>Platform</p>
          </div>
        </div>
        {/* Close button - mobile only */}
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-white/50 hover:text-white hover:bg-white/10 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin">
        <div className="space-y-0.5">
          {visibleNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNav}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] font-medium transition-all duration-150",
                  isActive ? "text-white shadow-sm" : "hover:text-white"
                )}
                style={
                  isActive
                    ? { background: "hsl(var(--sidebar-active))", boxShadow: "0 2px 8px hsl(219 97% 58% / 0.3)" }
                    : { color: "hsl(var(--sidebar-fg))" }
                }
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "hsl(var(--sidebar-hover))"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Pillar Section - hidden for guests */}
        {!isGuest && <div className="mt-5">
          <button
            onClick={() => setPillarsOpen(!pillarsOpen)}
            className="flex w-full items-center justify-between px-3 py-1 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "hsl(var(--sidebar-fg) / 0.6)" }}
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
                  onClick={handleNav}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-[6px] text-[13px] transition-all duration-150 hover:text-white"
                  style={{ color: "hsl(var(--sidebar-fg))" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "hsl(var(--sidebar-hover))"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: pillar.color }} />
                  {pillar.label}
                </Link>
              ))}
            </div>
          )}
        </div>}
      </nav>

      {/* Bottom */}
      <div className="p-3 space-y-0.5" style={{ borderTop: "1px solid hsl(var(--sidebar-hover))" }}>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] font-medium transition-all duration-150 hover:text-white"
          style={{ color: "hsl(var(--sidebar-fg))" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "hsl(var(--sidebar-hover))"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
        </button>

        <Link
          href="/settings"
          onClick={handleNav}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] font-medium transition-all duration-150",
            pathname.startsWith("/settings") ? "text-white" : "hover:text-white"
          )}
          style={
            pathname.startsWith("/settings")
              ? { background: "hsl(var(--sidebar-active))" }
              : { color: "hsl(var(--sidebar-fg))" }
          }
          onMouseEnter={(e) => { if (!pathname.startsWith("/settings")) e.currentTarget.style.background = "hsl(var(--sidebar-hover))"; }}
          onMouseLeave={(e) => { if (!pathname.startsWith("/settings")) e.currentTarget.style.background = "transparent"; }}
        >
          <Settings className="h-[18px] w-[18px]" />
          Configuracoes
        </Link>
      </div>
    </aside>
  );
}
