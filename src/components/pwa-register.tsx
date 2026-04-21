"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PWARegister() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Regista service worker (apenas em produção)
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const ready = async () => {
        try {
          await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        } catch (err) {
          console.warn("[pwa] SW registration failed:", err);
        }
      };
      if (document.readyState === "complete") ready();
      else window.addEventListener("load", ready);
    }

    // Intercepta evento de install prompt (Chrome/Edge)
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Se o user ja fechou o banner antes, nao mostra de novo
    if (localStorage.getItem("pwa-install-dismissed") === "1") {
      setDismissed(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstallEvent(null);
    }
  }

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem("pwa-install-dismissed", "1");
  }

  if (!installEvent || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] max-w-sm rounded-xl border bg-card p-4 shadow-lg animate-in fade-in slide-in-from-bottom-4">
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2D76FC]">
          <Download className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 pr-5">
          <p className="text-sm font-semibold">Instalar BoomLab</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Instala a aplicação no teu dispositivo para aceder mais rápido e usar offline.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleInstall}
              className="rounded-md bg-[#2D76FC] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2563EB]"
            >
              Instalar
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Depois
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
