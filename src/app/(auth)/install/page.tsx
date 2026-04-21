"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Smartphone, Monitor, Apple, Chrome, Rocket, Download,
  ArrowRight, CheckCircle2, MessageSquare, LayoutDashboard,
} from "lucide-react";

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

  useEffect(() => {
    // Detect platform
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) setPlatform("ios");
    else if (/android/.test(ua)) setPlatform("android");
    else setPlatform("desktop");

    // Detect hostname
    setIsComunicacao(window.location.hostname.includes("comunicacao"));

    // Check if already installed (standalone mode)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }

    // Listen for install prompt (Chrome/Edge/Android)
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Listen for app installed
    window.addEventListener("appinstalled", () => setInstalled(true));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
    }
  }

  const appName = isComunicacao ? "BoomLab Comunicação" : "BoomLab Platform";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1419] via-[#101112] to-[#1a1f2e] text-white">
      <div className="mx-auto max-w-2xl px-4 py-10 md:py-16">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[#2D76FC] shadow-2xl shadow-[#2D76FC]/30">
            <Rocket className="h-10 w-10 text-white" />
          </div>
          <h1 className="mt-6 text-3xl font-bold md:text-4xl">
            {appName}
          </h1>
          <p className="mt-2 text-sm text-gray-400 md:text-base">
            {isComunicacao
              ? "Instala a app para acompanhares o teu projeto e falares diretamente connosco"
              : "Instala a app para teres acesso rápido à plataforma"}
          </p>
        </div>

        {/* Already installed */}
        {installed && (
          <div className="mt-8 rounded-2xl border border-green-500/30 bg-green-500/10 p-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-400" />
            <p className="mt-3 text-lg font-semibold text-green-100">App instalada!</p>
            <p className="mt-1 text-sm text-green-200/80">Já podes abrir a partir do teu ecrã inicial.</p>
            <Link href="/login" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-[#0f1419] hover:bg-gray-100">
              Fazer login <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* Benefits */}
        {!installed && (
          <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <MessageSquare className="h-5 w-5 text-[#2D76FC]" />
              <p className="mt-2 text-sm font-medium">Mensagens diretas</p>
              <p className="text-xs text-gray-400">Falas connosco em tempo real</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <LayoutDashboard className="h-5 w-5 text-[#2D76FC]" />
              <p className="mt-2 text-sm font-medium">Workspace pessoal</p>
              <p className="text-xs text-gray-400">Dashboard + leads + análises</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <Download className="h-5 w-5 text-[#2D76FC]" />
              <p className="mt-2 text-sm font-medium">Funciona offline</p>
              <p className="text-xs text-gray-400">Acesso rápido do ecrã inicial</p>
            </div>
          </div>
        )}

        {/* Platform tabs */}
        {!installed && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            {/* Tabs */}
            <div className="grid grid-cols-3 border-b border-white/10">
              {[
                { id: "android" as const, icon: Smartphone, label: "Android" },
                { id: "ios" as const, icon: Apple, label: "iPhone / iPad" },
                { id: "desktop" as const, icon: Monitor, label: "Computador" },
              ].map((p) => {
                const Icon = p.icon;
                const isActive = platform === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlatform(p.id)}
                    className={`flex flex-col items-center gap-1 py-4 text-xs font-medium transition-colors ${
                      isActive ? "bg-[#2D76FC] text-white" : "text-gray-400 hover:bg-white/5"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Android */}
            {platform === "android" && (
              <div className="p-6">
                <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                  <Chrome className="h-5 w-5 text-[#2D76FC]" />
                  Android (Chrome, Edge, Samsung Internet)
                </h2>
                {installEvent ? (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-300">Clica no botão abaixo para instalar com 1 toque:</p>
                    <button
                      onClick={handleInstall}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2D76FC] py-4 text-base font-semibold hover:bg-[#2563EB] active:scale-95 transition-all"
                    >
                      <Download className="h-5 w-5" />
                      Instalar {appName} agora
                    </button>
                    <p className="text-xs text-center text-gray-500">
                      Vai aparecer um pop-up a pedir confirmação
                    </p>
                  </div>
                ) : (
                  <ol className="space-y-3 text-sm text-gray-200">
                    <Step num={1}>Toca no botão <strong>menu (⋮)</strong> no canto superior direito do Chrome</Step>
                    <Step num={2}>Escolhe <strong>&quot;Instalar aplicação&quot;</strong> ou <strong>&quot;Adicionar ao ecrã inicial&quot;</strong></Step>
                    <Step num={3}>Confirma tocando em <strong>&quot;Instalar&quot;</strong></Step>
                    <Step num={4}>O ícone aparece no teu ecrã inicial</Step>
                  </ol>
                )}
              </div>
            )}

            {/* iOS */}
            {platform === "ios" && (
              <div className="p-6">
                <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                  <Apple className="h-5 w-5 text-[#2D76FC]" />
                  iPhone / iPad (Safari)
                </h2>
                <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                  ⚠️ Tem de ser no <strong>Safari</strong> (não Chrome nem Firefox)
                </div>
                <ol className="space-y-3 text-sm text-gray-200">
                  <Step num={1}>No Safari, abre: <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">{isComunicacao ? "comunicacao.boomlab.cloud" : "servico.boomlab.cloud"}</code></Step>
                  <Step num={2}>
                    Toca no <strong>botão Partilhar</strong>
                    <span className="ml-1 inline-flex items-center justify-center rounded bg-white/10 px-1.5 text-base">⬆️</span>
                    <span className="text-xs text-gray-400 ml-1">(quadrado com seta para cima, na barra inferior)</span>
                  </Step>
                  <Step num={3}>Rola para baixo e escolhe <strong>&quot;Adicionar ao Ecrã Principal&quot;</strong></Step>
                  <Step num={4}>Confirma em <strong>&quot;Adicionar&quot;</strong> no canto superior direito</Step>
                  <Step num={5}>O ícone BoomLab aparece no teu ecrã inicial</Step>
                </ol>
              </div>
            )}

            {/* Desktop */}
            {platform === "desktop" && (
              <div className="p-6">
                <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                  <Chrome className="h-5 w-5 text-[#2D76FC]" />
                  Windows / Mac / Linux (Chrome, Edge)
                </h2>
                {installEvent ? (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-300">Clica no botão para instalar:</p>
                    <button
                      onClick={handleInstall}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2D76FC] py-4 text-base font-semibold hover:bg-[#2563EB] active:scale-95 transition-all"
                    >
                      <Download className="h-5 w-5" />
                      Instalar {appName}
                    </button>
                  </div>
                ) : (
                  <ol className="space-y-3 text-sm text-gray-200">
                    <Step num={1}>No Chrome/Edge, vê a barra do URL em cima</Step>
                    <Step num={2}>Do lado direito do endereço, clica no <strong>ícone de instalar</strong> (📥 ou ⊕)</Step>
                    <Step num={3}>Alternativa: menu <strong>⋮</strong> → <strong>&quot;Instalar {appName}...&quot;</strong></Step>
                    <Step num={4}>Confirma <strong>&quot;Instalar&quot;</strong></Step>
                    <Step num={5}>A app abre em janela própria, com ícone no ambiente de trabalho</Step>
                  </ol>
                )}
              </div>
            )}
          </div>
        )}

        {/* Skip install - go to login */}
        {!installed && (
          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm text-gray-400 hover:text-white underline">
              Saltar e fazer login no browser
            </Link>
          </div>
        )}

        {/* Footer */}
        <p className="mt-10 text-center text-[11px] text-gray-500">
          BoomLab Agency · Tallinn · Estonia
        </p>
      </div>
    </div>
  );
}

function Step({ num, children }: { num: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2D76FC]/20 text-xs font-bold text-[#2D76FC]">
        {num}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}
