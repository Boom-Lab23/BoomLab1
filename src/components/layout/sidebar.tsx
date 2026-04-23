"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard, Users, Calendar, FileText, Rocket, Settings, Brain,
  BarChart3, UserCheck, Handshake, Megaphone, Phone, Linkedin,
  CalendarCheck, CalendarDays, MessageSquare, Moon, Sun, ChevronDown,
  ShieldCheck, X, Layers, UserPlus, ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useState } from "react";
import { BoomLabLogo } from "@/components/logo";
import { useMessagingNotifications } from "@/hooks/use-messaging-notifications";

const mainNav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clientes", icon: Users },
  { href: "/sessions", label: "Sessoes", icon: Calendar },
  { href: "/calendar", label: "Calendario", icon: CalendarDays },
  { href: "/workspace", label: "Workspace", icon: BarChart3 },
  { href: "/knowledge", label: "Base Conhec. IA", icon: Brain },
  { href: "/messaging", label: "Mensagens", icon: MessageSquare },
  { href: "/tracker", label: "Tracker", icon: ListChecks },
  { href: "/documents", label: "Documentos", icon: FileText },
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
  const { totalUnread } = useMessagingNotifications();
  const [pillarsOpen, setPillarsOpen] = useState(true);
  const { data: session } = useSession();
  const role = (session?.user as Record<string, unknown>)?.role as string | undefined;
  const isGuest = role === "GUEST_CLIENT" || role === "GUEST_TEAM_MEMBER";
  const assignedWorkspaceClientId = (session?.user as Record<string, unknown>)?.assignedWorkspaceClientId as string | undefined;
  const assignedChannelId = (session?.user as Record<string, unknown>)?.assignedChannelId as string | undefined;

  // Filter nav for guests:
  // - Workspace SEMPRE visivel (pagina trata do caso "sem workspace atribuido")
  // - Messaging SEMPRE visivel (mesma logica)
  // - Outras rotas escondidas
  // Assim o cliente ve os items mesmo que a sessao ainda nao tenha atualizado
  // o campo assignedWorkspaceClientId apos o admin atribuir.
  const guestAllowed = new Set(["/workspace", "/messaging", "/tracker", "/settings"]);
  const adminOnly = new Set(["/admin/users"]);
  const isAdminOrManager = role === "ADMIN" || role === "MANAGER";

  const visibleNav = isGuest
    ? mainNav.filter((item) => guestAllowed.has(item.href))
    : mainNav.filter((item) => {
        if (adminOnly.has(item.href) && !isAdminOrManager) return false;
        return true;
      });

  // unused-but-informative: assignedChannelId / assignedWorkspaceClientId
  void assignedChannelId; void assignedWorkspaceClientId;

  function handleNav() {
    onClose?.();
  }

  return (
    <aside
      className="flex h-screen w-[260px] md:w-[240px] flex-col"
      style={{
        background: "hsl(var(--sidebar-bg))",
        // Safe-area para iPhone com notch (sidebar que desliza da esquerda)
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
      }}
    >
      {/* Logo + Close */}
      <div className="flex h-14 items-center justify-between px-5">
        <div className="flex items-center gap-2.5">
          <BoomLabLogo size={32} />
          <div>
            <span className="text-sm font-bold text-white tracking-wide">BoomLab</span>
            <p className="text-[10px] leading-none" style={{ color: "hsl(var(--sidebar-fg))" }}>
              {isGuest ? "Comunicação" : "Platform"}
            </p>
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
                <span className="flex-1">{item.label}</span>
                {item.href === "/messaging" && totalUnread > 0 && (
                  <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white min-w-[18px] text-center">
                    {totalUnread > 99 ? "99+" : totalUnread}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

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
