"use client";

import { useSession, signOut } from "next-auth/react";
import { Bell, Search, LogOut, Menu } from "lucide-react";

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { data: session } = useSession();

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between border-b bg-card px-4 md:px-6"
      style={{
        // Respeita a safe-area do iOS (notch, barra de status) e adiciona 56px de conteudo
        paddingTop: "env(safe-area-inset-top)",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
        minHeight: "calc(3.5rem + env(safe-area-inset-top))",
      }}
    >
      <div className="flex items-center gap-3 py-2">
        {/* Hamburger - mobile only */}
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Search */}
        <div className="hidden sm:flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Pesquisar..."
            className="w-40 md:w-60 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Mobile search icon */}
        <button className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground sm:hidden">
          <Search className="h-5 w-5" />
        </button>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1 md:gap-2 py-2">
        <button className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#2D76FC]" />
        </button>

        {session?.user ? (
          <div className="flex items-center gap-1 md:gap-2 rounded-lg border p-1 pl-1.5 md:pl-2.5">
            <div className="text-right hidden md:block">
              <p className="text-xs font-medium leading-tight">{session.user.name}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{session.user.email}</p>
            </div>
            {session.user.image ? (
              <img src={session.user.image} alt="" className="h-7 w-7 rounded-md" />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#2D76FC] text-xs font-medium text-white">
                {session.user.name?.charAt(0) ?? "U"}
              </div>
            )}
            <button
              onClick={() => signOut()}
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              title="Sair"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border px-2 md:px-3 py-1.5">
            <div className="h-6 w-6 rounded-md bg-[#2D76FC]/20" />
            <span className="text-xs text-muted-foreground hidden sm:inline">Sem sessao</span>
          </div>
        )}
      </div>
    </header>
  );
}
