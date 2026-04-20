"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Rocket, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function FirstLoginPage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const userId = (session?.user as Record<string, unknown>)?.id as string | undefined;
  const mustChange = (session?.user as Record<string, unknown>)?.mustChangePassword as boolean | undefined;

  const changePassword = trpc.admin.changeOwnPassword.useMutation({
    onSuccess: async () => {
      setSuccess(true);
      await update();
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1500);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (status === "authenticated" && mustChange === false) {
      router.replace("/");
    }
  }, [status, mustChange, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("As passwords nao coincidem.");
      return;
    }
    if (newPassword.length < 8) {
      setError("A nova password deve ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("A nova password tem de ser diferente da atual.");
      return;
    }
    if (!userId) {
      setError("Sessao invalida. Faz login novamente.");
      return;
    }

    changePassword.mutate({
      userId,
      currentPassword,
      newPassword,
    });
  }

  // Password strength
  const strength = (() => {
    if (!newPassword) return 0;
    let score = 0;
    if (newPassword.length >= 8) score++;
    if (newPassword.length >= 12) score++;
    if (/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)) score++;
    if (/\d/.test(newPassword)) score++;
    if (/[^a-zA-Z0-9]/.test(newPassword)) score++;
    return score;
  })();
  const strengthLabel = ["Muito fraca", "Fraca", "Razoavel", "Boa", "Forte", "Excelente"][strength];
  const strengthColor = ["bg-red-500", "bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-green-400", "bg-green-500"][strength];

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "hsl(220, 15%, 8%)" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2D76FC] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "hsl(220, 15%, 8%)" }}>
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-white/10 p-6 md:p-8" style={{ background: "hsl(220, 6%, 12%)" }}>
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2D76FC]">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-white">Definir Nova Password</h1>
          <p className="mt-1 text-sm text-gray-400">Por seguranca, altera a tua password antes de continuar.</p>
        </div>

        {session?.user?.email && (
          <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-center">
            <p className="text-xs text-gray-400">A entrar como</p>
            <p className="text-sm font-medium text-white">{session.user.email}</p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Password atualizada com sucesso! A redirecionar...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">Password atual</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type={showCurrent ? "text" : "password"}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-gray-500 focus:border-[#2D76FC] focus:outline-none"
                placeholder="A password que recebeste por email"
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">Nova password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type={showNew ? "text" : "password"}
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-gray-500 focus:border-[#2D76FC] focus:outline-none"
                placeholder="Minimo 8 caracteres"
              />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {newPassword && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className={`h-1 flex-1 rounded ${i <= strength ? strengthColor : "bg-white/10"}`} />
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-400">Forca: {strengthLabel}</p>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">Confirmar nova password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type={showNew ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-[#2D76FC] focus:outline-none"
                placeholder="Repete a nova password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={changePassword.isPending || success}
            className="w-full rounded-lg bg-[#2D76FC] py-2.5 text-sm font-medium text-white hover:bg-[#2563EB] disabled:opacity-50 transition-colors"
          >
            {changePassword.isPending ? "A atualizar..." : "Guardar nova password"}
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs text-gray-400 hover:text-gray-200"
          >
            Cancelar e terminar sessao
          </button>
        </div>
      </div>
    </div>
  );
}
