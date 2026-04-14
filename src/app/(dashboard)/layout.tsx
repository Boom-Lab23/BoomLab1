"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const userRole = (session?.user as Record<string, unknown>)?.role as string | undefined;
  const isGuest = userRole === "GUEST_CLIENT" || userRole === "GUEST_TEAM_MEMBER";

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  // Redirect guests to messaging only
  useEffect(() => {
    if (isGuest && !pathname.startsWith("/messaging")) {
      router.replace("/messaging");
    }
  }, [isGuest, pathname, router]);

  // Show nothing while checking auth
  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">A carregar...</p>
        </div>
      </div>
    );
  }

  // Not logged in - show nothing (redirect happening)
  if (status === "unauthenticated") {
    return null;
  }

  // Guest view
  if (isGuest) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        <Header onMenuClick={() => {}} />
        <main className="flex-1 overflow-y-auto bg-background">{children}</main>
      </div>
    );
  }

  // Full view
  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className={`
        fixed inset-y-0 left-0 z-50 lg:relative lg:z-auto
        transform transition-transform duration-200 ease-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6 scrollbar-thin">{children}</main>
      </div>
    </div>
  );
}
