"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Rocket, Mail, Lock, User, AlertCircle, CheckCircle2, Shield } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [consents, setConsents] = useState({
    privacyPolicy: false,
    terms: false,
    dpa: false,
    dataDeletion: false,
    aiAnalysis: false,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const allRequired = consents.privacyPolicy && consents.terms && consents.dpa;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("As passwords nao coincidem.");
      return;
    }
    if (form.password.length < 6) {
      setError("A password precisa de ter pelo menos 6 caracteres.");
      return;
    }
    if (!allRequired) {
      setError("Precisas de aceitar a Politica de Privacidade, Termos de Consentimento e DPA para continuar.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          consents: {
            privacyPolicy: consents.privacyPolicy,
            terms: consents.terms,
            dpa: consents.dpa,
            dataDeletion: consents.dataDeletion,
            aiAnalysis: consents.aiAnalysis,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao criar conta.");
        setLoading(false);
        return;
      }

      router.push("/login?registered=true");
    } catch {
      setError("Erro de ligacao. Tenta novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8" style={{ background: "hsl(220, 15%, 8%)" }}>
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-white/10 p-6 md:p-8" style={{ background: "hsl(220, 6%, 12%)" }}>
        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2D76FC]">
            <Rocket className="h-7 w-7 text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-white">Criar Conta</h1>
          <p className="mt-1 text-sm text-gray-400">BoomLab Platform</p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">Nome</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-[#2D76FC] focus:outline-none focus:ring-1 focus:ring-[#2D76FC]/30"
                placeholder="Nome completo" />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-[#2D76FC] focus:outline-none focus:ring-1 focus:ring-[#2D76FC]/30"
                placeholder="email@empresa.pt" />
            </div>
          </div>

          {/* Password */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-300">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-[#2D76FC] focus:outline-none focus:ring-1 focus:ring-[#2D76FC]/30"
                  placeholder="Min. 6 chars" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-300">Confirmar</label>
              <input type="password" required value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-[#2D76FC] focus:outline-none focus:ring-1 focus:ring-[#2D76FC]/30"
                placeholder="Repetir" />
            </div>
          </div>

          {/* RGPD Consents */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-[#2D76FC]" />
              <p className="text-sm font-semibold text-white">Protecao de Dados</p>
            </div>

            {/* Privacy Policy - Required */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input type="checkbox" checked={consents.privacyPolicy} onChange={(e) => setConsents({ ...consents, privacyPolicy: e.target.checked })}
                className="mt-0.5 rounded border-gray-600 bg-white/5 text-[#2D76FC] focus:ring-[#2D76FC]/30" />
              <div>
                <p className="text-sm text-gray-200 group-hover:text-white">
                  Li e aceito a <span className="text-[#2D76FC] underline">Politica de Privacidade</span>
                  <span className="ml-1 text-red-400 text-xs">*obrigatorio</span>
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">Como os seus dados pessoais sao recolhidos, tratados e protegidos.</p>
              </div>
            </label>

            {/* Terms - Required */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input type="checkbox" checked={consents.terms} onChange={(e) => setConsents({ ...consents, terms: e.target.checked })}
                className="mt-0.5 rounded border-gray-600 bg-white/5 text-[#2D76FC] focus:ring-[#2D76FC]/30" />
              <div>
                <p className="text-sm text-gray-200 group-hover:text-white">
                  Aceito os <span className="text-[#2D76FC] underline">Termos de Consentimento</span>
                  <span className="ml-1 text-red-400 text-xs">*obrigatorio</span>
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">Condicoes de utilizacao da plataforma e tratamento de dados.</p>
              </div>
            </label>

            {/* DPA - Required */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input type="checkbox" checked={consents.dpa} onChange={(e) => setConsents({ ...consents, dpa: e.target.checked })}
                className="mt-0.5 rounded border-gray-600 bg-white/5 text-[#2D76FC] focus:ring-[#2D76FC]/30" />
              <div>
                <p className="text-sm text-gray-200 group-hover:text-white">
                  Aceito o <span className="text-[#2D76FC] underline">DPA - Acordo de Processamento de Dados</span>
                  <span className="ml-1 text-red-400 text-xs">*obrigatorio</span>
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">Acordo sobre como terceiros processam os seus dados em nosso nome.</p>
              </div>
            </label>

            <div className="h-px bg-white/5 my-1" />

            {/* Data Deletion - Optional */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input type="checkbox" checked={consents.dataDeletion} onChange={(e) => setConsents({ ...consents, dataDeletion: e.target.checked })}
                className="mt-0.5 rounded border-gray-600 bg-white/5 text-[#2D76FC] focus:ring-[#2D76FC]/30" />
              <div>
                <p className="text-sm text-gray-200 group-hover:text-white">
                  Direito ao Esquecimento
                  <span className="ml-1 text-gray-500 text-xs">opcional</span>
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">Solicitar a eliminacao completa dos meus dados a qualquer momento.</p>
              </div>
            </label>

            {/* AI Analysis - Optional */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input type="checkbox" checked={consents.aiAnalysis} onChange={(e) => setConsents({ ...consents, aiAnalysis: e.target.checked })}
                className="mt-0.5 rounded border-gray-600 bg-white/5 text-[#2D76FC] focus:ring-[#2D76FC]/30" />
              <div>
                <p className="text-sm text-gray-200 group-hover:text-white">
                  Analise de chamadas com Inteligencia Artificial
                  <span className="ml-1 text-gray-500 text-xs">opcional</span>
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">Autorizo a analise das minhas chamadas e reunioes por IA para fins de melhoria.</p>
              </div>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !allRequired}
            className="w-full rounded-lg bg-[#2D76FC] py-2.5 text-sm font-medium text-white hover:bg-[#2563EB] disabled:opacity-50 transition-colors"
          >
            {loading ? "A criar conta..." : "Criar Conta"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400">
          Ja tens conta? <Link href="/login" className="text-[#2D76FC] hover:underline">Entra aqui</Link>
        </p>
      </div>
    </div>
  );
}
