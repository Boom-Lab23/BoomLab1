"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc";

type NotifContext = {
  totalUnread: number;
  unreadByChannel: Record<string, number>;
  markAsRead: (channelId: string) => void;
  requestPermission: () => Promise<NotificationPermission>;
  permission: NotificationPermission | "unsupported";
};

const Ctx = createContext<NotifContext | null>(null);

export function MessagingNotificationsProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const userId = (session?.user as Record<string, unknown>)?.id as string | undefined;

  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevCountsRef = useRef<Record<string, number>>({});
  const initialLoadRef = useRef(true);

  // Poll every 15s for new messages
  const counts = trpc.messaging.unreadCounts.useQuery(
    { userId: userId ?? "" },
    {
      enabled: !!userId,
      refetchInterval: 15_000,
      refetchIntervalInBackground: true,
    }
  );
  const utils = trpc.useUtils();
  const markReadMutation = trpc.messaging.markChannelAsRead.useMutation({
    onSuccess: () => utils.messaging.unreadCounts.invalidate(),
  });

  // Detect permission state
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  // Detect new messages and trigger notification + sound
  useEffect(() => {
    const data = counts.data;
    if (!data) return;

    // Current channel being viewed - don't notify for this one
    const currentChannelMatch = pathname.match(/^\/messaging\/([^\/]+)/);
    const currentChannelId = currentChannelMatch ? currentChannelMatch[1] : null;

    // First load: just store counts, don't notify
    if (initialLoadRef.current) {
      const init: Record<string, number> = {};
      for (const [cid, info] of Object.entries(data)) init[cid] = info.count;
      prevCountsRef.current = init;
      initialLoadRef.current = false;
      return;
    }

    let shouldNotify = false;
    const newCounts: Record<string, number> = {};
    for (const [channelId, info] of Object.entries(data)) {
      newCounts[channelId] = info.count;
      if (info.muted) continue;
      if (channelId === currentChannelId) continue; // Currently viewing this channel
      const prev = prevCountsRef.current[channelId] ?? 0;
      if (info.count > prev) {
        shouldNotify = true;
      }
    }

    if (shouldNotify) {
      // Play sound
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio("/sounds/notification.wav");
          audioRef.current.volume = 0.5;
        }
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {
          // Auto-play may be blocked; silently fail
        });
      } catch {}

      // Show browser notification
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        try {
          const n = new Notification("Nova mensagem", {
            body: "Tens mensagens novas num canal.",
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            tag: "boomlab-new-message",
          });
          n.onclick = () => {
            window.focus();
            n.close();
          };
        } catch {}
      }
    }

    prevCountsRef.current = newCounts;
  }, [counts.data, pathname]);

  async function requestPermission(): Promise<NotificationPermission> {
    if (typeof window === "undefined" || !("Notification" in window)) return "denied";
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }

  function markAsRead(channelId: string) {
    if (!userId) return;
    markReadMutation.mutate({ channelId, userId });
  }

  const unreadByChannel: Record<string, number> = {};
  let totalUnread = 0;
  if (counts.data) {
    for (const [cid, info] of Object.entries(counts.data)) {
      if (info.muted) continue;
      unreadByChannel[cid] = info.count;
      totalUnread += info.count;
    }
  }

  return (
    <Ctx.Provider value={{ totalUnread, unreadByChannel, markAsRead, requestPermission, permission }}>
      {children}
    </Ctx.Provider>
  );
}

export function useMessagingNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Safe default (provider not mounted yet)
    return {
      totalUnread: 0,
      unreadByChannel: {},
      markAsRead: () => {},
      requestPermission: async (): Promise<NotificationPermission> => "default",
      permission: "default" as NotificationPermission | "unsupported",
    };
  }
  return ctx;
}
