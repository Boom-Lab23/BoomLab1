"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Smartphone, Monitor, Apple, Chrome, Download,
  ArrowRight, CheckCircle2, MessageSquare, LayoutDashboard,
  Share2, MoreVertical, X,
} from "lucide-react";
import { BoomLabLogo } from "@/components/logo";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "ios" | "android" | "desktop" | "unknown";

export default function InstallPage() {
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isComunicacao, setIsComunicacao] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [browserName, setBrowserName] = useState("");

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();

    // Detect platform
    let p: Platform = "desktop";
    if (/iphone|ipad|ipod/.test(ua)) p = "ios";
    else if (/android/.test(ua)) p = "android";
    setPlatform(p);

    // Detect browser (rough heuristic)
    if (/edg\//.test(ua)) setBrowserName("Edge");
    else if (/chrome\//.test(ua) && !/crios/.test(ua)) setBrowserName("Chrome");
    else if (/crios/.test(ua)) setBrowserName("Chrome iOS (não suporta instalar)");
    else if (/firefox|fxios/.test(ua)) setBrowserName("Firefox");
    else if (/samsungbrowser/.test(ua)) setBrowserName("Samsung Internet");
    else if (/safari/.test(ua)) setBrowserName("Safari");
    else setBrowserName("browser atual");

    setIsComunicacao(window.location.hostname.includes("comunicacao"));

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstallClick() {
    // Se o browser suporta, chama o prompt nativo
    if (installEvent) {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
      }
      return;
    }
    // Caso contrário, mostra instruções manuais
    setShowInstructions(true);
  }

  const appName = isComunicacao ? "BoomLab Comunicação" : "BoomLab Platform";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1419] via-[#101112] to-[#1a1f2e] text-white">
      <div className="mx-auto max-w-xl px-4 py-10 md:py-16">
        {/* Logo */}
        <div className="text-center">
          <BoomLabLogo size={88} className="mx-auto" />
          <h1 className="mt-5 text-3xl font-bold md:text-4xl">{appName}</h1>
          <p className="mt-2 text-sm text-gray-400 md:text-base">
            {isComunicacao
              ? "Acompanha o teu projeto e fala connosco diretamente"
              : "Plataforma interna BoomLab"}
          </p>
        </div>

        {/* JÁ INSTALADA */}
        {installed && (
          <div className="mt-10 rounded-2xl border border-green-500/30 bg-green-500/10 p-6 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-green-400" />
            <p className="mt-3 text-lg font-semibold text-green-100">App instalada!</p>
            <p className="mt-1 text-sm text-green-200/80">Podes abrir a partir do ecrã inicial.</p>
            <Link href="/login" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-[#0f1419] hover:bg-gray-100">
              Fazer login <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* BOTÃO GRANDE INSTALAR (sempre visível) */}
        {!installed && (
          <>
            <button
              onClick={handleInstallClick}
              className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-[#2D76FC] px-6 py-5 text-base font-semibold shadow-2xl shadow-[#2D76FC]/40 hover:bg-[#2563EB] active:scale-[0.98] transition-all md:text-lg"
            >
              <Download className="h-6 w-6" />
              Instalar {appName}
            </button>

            <p className="mt-3 text-center text-xs text-gray-500">
              {installEvent
                ? "Clica para instalar com 1 toque"
                : platform === "ios"
                  ? "Clica para ver como instalar no iPhone"
                  : "Clica para ver as instruções do teu dispositivo"}
            </p>

            {/* BENEFÍCIOS */}
            <div className="mt-8 grid grid-cols-3 gap-3">
              <BenefitCard icon={MessageSquare} title="Mensagens" desc="Fala connosco" />
              <BenefitCard icon={LayoutDashboard} title="Workspace" desc="Dashboard próprio" />
              <BenefitCard icon={Download} title="Offline" desc="Sempre acessível" />
            </div>

            {/* DEVICE TAB hint */}
            <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
              <p className="flex items-center gap-2">
                {platform === "ios" && <Apple className="h-4 w-4" />}
                {platform === "android" && <Smartphone className="h-4 w-4" />}
                {platform === "desktop" && <Monitor className="h-4 w-4" />}
                <span>
                  Detectámos: <strong className="text-white">
                    {platform === "ios" && "iPhone / iPad"}
                    {platform === "android" && "Android"}
                    {platform === "desktop" && "Computador"}
                  </strong>
                  {browserName && <> • {browserName}</>}
                </span>
              </p>
              <button
                onClick={() => setShowInstructions(true)}
                className="mt-2 text-xs text-[#2D76FC] hover:underline"
              >
                Ver instruções detalhadas →
              </button>
            </div>
          </>
        )}

        {/* POPUP COM INSTRUÇÕES POR PLATAFORMA */}
        {showInstructions && !installed && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 md:items-center" onClick={() => setShowInstructions(false)}>
            <div
              className="w-full max-w-md rounded-t-3xl bg-[#1a1f2e] p-6 md:rounded-3xl md:m-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle for mobile */}
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20 md:hidden" />

              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">Como instalar</h2>
                <button onClick={() => setShowInstructions(false)} className="rounded-lg p-1 hover:bg-white/10">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Platform tabs */}
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/40 p-1">
                {(["android", "ios", "desktop"] as const).map((p) => {
                  const Icon = p === "android" ? Smartphone : p === "ios" ? Apple : Monitor;
                  const label = p === "android" ? "Android" : p === "ios" ? "iPhone" : "Computador";
                  return (
                    <button
                      key={p}
                      onClick={() => setPlatform(p)}
                      className={`flex flex-col items-center gap-1 rounded-lg py-2.5 text-xs font-medium transition-colors ${
                        platform === p ? "bg-[#2D76FC] text-white" : "text-gray-400 hover:bg-white/5"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Instructions content */}
              <div className="mt-5">
                {platform === "android" && (
                  <ol className="space-y-3 text-sm text-gray-200">
                    <Step num={1} icon={MoreVertical}>
                      Toca no <strong>menu ⋮</strong> (3 pontos) no canto superior direito
                    </Step>
                    <Step num={2} icon={Download}>
                      Escolhe <strong>&quot;Instalar aplicação&quot;</strong> ou <strong>&quot;Adicionar ao ecrã inicial&quot;</strong>
                    </Step>
                    <Step num={3} icon={CheckCircle2}>
                      Confirma em <strong>&quot;Instalar&quot;</strong>
                    </Step>
                  </ol>
                )}

                {platform === "ios" && (
                  <>
                    <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                      ⚠️ Tem de ser no <strong>Safari</strong>. Chrome e Firefox no iPhone não suportam instalação.
                    </div>
                    <ol className="space-y-3 text-sm text-gray-200">
                      <Step num={1} icon={Share2}>
                        Na barra de <strong>baixo</strong> do Safari, toca no botão <strong>Partilhar</strong> (⬆️ quadrado com seta)
                      </Step>
                      <Step num={2} icon={MoreVertical}>
                        Rola para baixo e escolhe <strong>&quot;Adicionar ao Ecrã Principal&quot;</strong>
                      </Step>
                      <Step num={3} icon={CheckCircle2}>
                        Confirma em <strong>&quot;Adicionar&quot;</strong> (canto superior direito)
                      </Step>
                    </ol>
                  </>
                )}

                {platform === "desktop" && (
                  <ol className="space-y-3 text-sm text-gray-200">
                    <Step num={1} icon={Download}>
                      Vê a <strong>barra do URL</strong> em cima, do lado direito do endereço
                    </Step>
                    <Step num={2} icon={Chrome}>
                      Clica no ícone <strong>📥 Instalar</strong> (ou menu ⋮ → <strong>&quot;Instalar {appName}...&quot;</strong>)
                    </Step>
                    <Step num={3} icon={CheckCircle2}>
                      Confirma em <strong>&quot;Instalar&quot;</strong>
                    </Step>
                  </ol>
                )}
              </div>

              <button
                onClick={() => setShowInstructions(false)}
                className="mt-6 w-full rounded-lg border border-white/10 bg-white/5 py-2.5 text-sm font-medium hover:bg-white/10"
              >
                Percebi
              </button>
            </div>
          </div>
        )}

        {/* Skip */}
        {!installed && (
          <div className="mt-8 text-center">
            <Link href="/login" className="text-sm text-gray-400 hover:text-white underline underline-offset-4">
              Saltar e usar no browser
            </Link>
          </div>
        )}

        {/* Footer */}
        <p className="mt-10 text-center text-[11px] text-gray-600">
          BoomLab Agency · Tallinn · Estonia
        </p>
      </div>
    </div>
  );
}

function BenefitCard({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
      <Icon className="mx-auto h-5 w-5 text-[#2D76FC]" />
      <p className="mt-1.5 text-xs font-semibold">{title}</p>
      <p className="text-[10px] text-gray-400">{desc}</p>
    </div>
  );
}

function Step({ num, icon: Icon, children }: { num: number; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2D76FC]/20 text-sm font-bold text-[#2D76FC]">
        {num}
      </span>
      <div className="flex-1 pt-0.5">
        <span className="inline-flex items-center gap-1.5">
          {Icon && <Icon className="h-4 w-4 text-[#2D76FC]" />}
          <span>{children}</span>
        </span>
      </div>
    </li>
  );
}
