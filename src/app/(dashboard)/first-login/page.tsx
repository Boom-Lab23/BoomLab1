"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";

export default function FirstLoginPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const resetPassword = trpc.admin.resetPassword.useMutation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("A password deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As passwords não coincidem.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword.mutateAsync({
        userId: session?.user?.id as string,
        newPassword: password,
      });
      // Update session to clear mustChangePassword
      await update({ mustChangePassword: false });
      router.push("/");
    } catch (err) {
      setError("Erro ao alterar password. Tenta novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0f10] px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-[#2D76FC] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">B</span>
            </div>
            <span className="text-white font-bold text-2xl tracking-tight">BoomLab</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#101112] border border-[#1e2124] rounded-xl p-8">
          <h1 className="text-xl font-semibold text-white mb-1">
            Define a tua password
          </h1>
          <p className="text-sm text-gray-400 mb-6">
            Por segurança, precisas de definir uma nova password antes de continuares.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Nova password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full bg-[#1a1d1f] border border-[#2a2d30] rounded-lg px-3.5 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#2D76FC] transition-colors"
                required
                minLength={8}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Confirmar password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repete a password"
                className="w-full bg-[#1a1d1f] border border-[#2a2d30] rounded-lg px-3.5 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#2D76FC] transition-colors"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2D76FC] hover:bg-[#2563eb] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
            >
              {loading ? "A guardar..." : "Definir password e entrar"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          BoomLab Platform &bull; Acesso seguro
        </p>
      </div>
    </div>
  );
}
