"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, AlertCircle, Smartphone } from "lucide-react";
import { BoomLabLogo } from "@/components/logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isComunicacao, setIsComunicacao] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [cameFromInstall, setCameFromInstall] = useState(false);

  useEffect(() => {
    setIsComunicacao(window.location.hostname.includes("comunicacao"));
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));
    // Se veio da pagina /install, mostra instrucoes em destaque
    setCameFromInstall(document.referrer.includes("/install"));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Email ou password incorretos.");
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "hsl(220, 15%, 8%)" }}>
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-white/10 p-6 md:p-8" style={{ background: "hsl(220, 6%, 12%)" }}>
        {/* Logo */}
        <div className="text-center">
          <BoomLabLogo size={56} className="mx-auto" />
          <h1 className="mt-4 text-2xl font-bold text-white">BoomLab</h1>
          <p className="mt-1 text-sm text-gray-400">
            {isComunicacao ? "Comunicação" : "Plataforma de Gestão de Serviço"}
          </p>
        </div>

        {/* Instrucoes iOS em destaque quando veio da pagina /install */}
        {cameFromInstall && isIOS && !isStandalone && (
          <div className="rounded-xl border-2 border-[#2D76FC] bg-[#2D76FC]/10 p-3 text-center">
            <p className="text-sm font-semibold text-white">📲 Instalar no iPhone</p>
            <p className="mt-1 text-xs text-blue-100">
              Toca no botão <strong>Partilhar ⬆️</strong> (barra de baixo) → <strong>&quot;Adicionar ao Ecrã Principal&quot;</strong>
            </p>
            <p className="mt-1 text-[11px] text-blue-200/80">
              Faz isto <strong>antes</strong> de entrar, para a app ficar no sítio certo
            </p>
          </div>
        )}

        {/* Install CTA - so aparece no dominio comunicacao quando NAO esta instalado */}
        {isComunicacao && !isStandalone && !cameFromInstall && (
          <Link
            href="/install"
            className="flex items-center justify-between gap-2 rounded-lg border border-[#2D76FC]/40 bg-[#2D76FC]/10 px-3 py-2.5 text-xs text-[#2D76FC] hover:bg-[#2D76FC]/20 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              <span>Instala a app no teu dispositivo</span>
            </span>
            <span className="text-[10px] opacity-80">→</span>
          </Link>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-[#2D76FC] focus:outline-none focus:ring-1 focus:ring-[#2D76FC]/30"
                placeholder="email@boomlab.agency"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-[#2D76FC] focus:outline-none focus:ring-1 focus:ring-[#2D76FC]/30"
                placeholder="••••••••"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#2D76FC] py-2.5 text-sm font-medium text-white hover:bg-[#2563EB] disabled:opacity-50 transition-colors"
          >
            {loading ? "A entrar..." : "Entrar"}
          </button>
        </form>

        {/* Register link - so visivel no dominio principal da equipa */}
        {!isComunicacao && (
          <p className="text-center text-sm text-gray-400">
            Nao tens conta? <a href="/register" className="text-[#2D76FC] hover:underline">Criar conta</a>
          </p>
        )}
      </div>
    </div>
  );
}
