"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { FileText, Upload, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";

const OFFERS = ["Consultoria", "IA", "Mentoria", "BoomClub"];

type Template = {
  id: string;
  offer: string;
  filename: string;
  displayName?: string | null;
  variables: string[];
  isActive: boolean;
  updatedAt: string;
};

export default function ContractTemplatesPage() {
  const { data: session } = useSession();
  const role = (session?.user as Record<string, unknown>)?.role as string | undefined;

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function loadTemplates() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/contract-templates");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTemplates(data.templates ?? []);
    } catch (err) {
      setMessage({ type: "err", text: `Erro a carregar: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  async function handleUpload(offer: string, file: File) {
    setUploadingFor(offer);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("offer", offer);
      const res = await fetch("/api/admin/contract-templates", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      setMessage({ type: "ok", text: `Template ${offer} actualizado com sucesso` });
      await loadTemplates();
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setUploadingFor(null);
    }
  }

  if (role !== "ADMIN" && role !== "MANAGER") {
    return (
      <div className="p-8 text-center">
        <p className="text-lg font-semibold">Acesso negado</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/ghl" className="rounded-lg p-2 hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> Templates de Contrato
          </h1>
          <p className="text-sm text-muted-foreground">
            Upload dos templates .docx usados para gerar contratos quando um deal fecha no GHL.
          </p>
        </div>
      </div>

      {message && (
        <div className={`rounded-lg border p-3 text-sm flex items-center gap-2 ${
          message.type === "ok"
            ? "bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-900"
            : "bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-900"
        }`}>
          {message.type === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      <div className="rounded-xl border bg-blue-50 dark:bg-blue-950/30 p-4 text-sm">
        <p className="font-medium text-blue-900 dark:text-blue-200 mb-2">Como funcionam os placeholders</p>
        <p className="text-blue-800 dark:text-blue-300">
          No teu template .docx, usa placeholders com chavetas simples. Ex:
        </p>
        <code className="mt-2 block rounded bg-card px-3 py-2 text-xs font-mono">
          O cliente {"{nome}"} com NIF {"{nif}"}, morada em {"{morada}"}, {"{cidade}"},<br />
          contrata os servicos de {"{oferta}"} no valor de {"{valor}"} EUR a partir de {"{data_inicio}"}.
        </code>
        <p className="mt-2 text-xs text-blue-700 dark:text-blue-400">
          Placeholders disponiveis: <code>nome, email, telefone, empresa, oferta, data_inicio, data_hoje, valor, morada, cidade, codigo_postal</code> +
          todos os custom fields do GHL (ex: <code>nif, iban, cc, data_nascimento</code>).
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {OFFERS.map((offer) => {
          const current = templates.find((t) => t.offer === offer);
          return (
            <div key={offer} className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{offer}</h3>
                {current ? (
                  <span className="rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-0.5 text-xs font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Configurado
                  </span>
                ) : (
                  <span className="rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 text-xs font-medium">
                    Sem template
                  </span>
                )}
              </div>

              {current && (
                <div className="mb-3 text-xs text-muted-foreground">
                  <p><strong>Ficheiro:</strong> {current.displayName || current.filename}</p>
                  <p><strong>Actualizado:</strong> {new Date(current.updatedAt).toLocaleString("pt-PT")}</p>
                  {current.variables.length > 0 && (
                    <p className="mt-1"><strong>Placeholders:</strong> {current.variables.slice(0, 10).join(", ")}{current.variables.length > 10 ? "..." : ""}</p>
                  )}
                </div>
              )}

              <label className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                <Upload className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {uploadingFor === offer ? "A carregar..." : current ? "Substituir template" : "Carregar template .docx"}
                </span>
                <input
                  type="file"
                  accept=".docx"
                  className="hidden"
                  disabled={uploadingFor === offer}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(offer, file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          );
        })}
      </div>

      {loading && <p className="text-center text-sm text-muted-foreground">A carregar...</p>}
    </div>
  );
}
