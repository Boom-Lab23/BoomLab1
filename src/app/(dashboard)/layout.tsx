"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useEffect } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const userRole = (session?.user as Record<string, unknown>)?.role as string | undefined;
  const isGuest = userRole === "GUEST_CLIENT" || userRole === "GUEST_TEAM_MEMBER";

  // Redirect guests to their messaging channel
  useEffect(() => {
    if (isGuest && !pathname.startsWith("/messaging")) {
      // Redirect to messaging - the messaging page will handle showing only their channel
      router.replace("/messaging");
    }
  }, [isGuest, pathname, router]);

  // Guest view - no sidebar, simplified layout
  if (isGuest) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        <Header onMenuClick={() => {}} />
        <main className="flex-1 overflow-y-auto bg-background">{children}</main>
      </div>
    );
  }

  // Full view for internal users
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
