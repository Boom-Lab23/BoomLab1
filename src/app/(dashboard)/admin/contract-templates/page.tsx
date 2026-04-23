"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { FileText, Upload, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";

const OFFERS = ["Consultoria", "IA", "Mentoria", "BoomClub"];

type PaymentMode = "PRESTACOES" | "AVISTA";
type Outorgantes = 1 | 2;

const VARIANTS: { paymentMode: PaymentMode; outorgantes: Outorgantes; label: string }[] = [
  { paymentMode: "PRESTACOES", outorgantes: 1, label: "Prestacoes · 1 outorgante" },
  { paymentMode: "PRESTACOES", outorgantes: 2, label: "Prestacoes · 2 outorgantes" },
  { paymentMode: "AVISTA", outorgantes: 1, label: "A vista · 1 outorgante" },
  { paymentMode: "AVISTA", outorgantes: 2, label: "A vista · 2 outorgantes" },
];

type Template = {
  id: string;
  offer: string;
  paymentMode: PaymentMode;
  outorgantes: number;
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

  async function handleUpload(offer: string, paymentMode: PaymentMode, outorgantes: Outorgantes, file: File) {
    const key = `${offer}-${paymentMode}-${outorgantes}`;
    setUploadingFor(key);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("offer", offer);
      form.append("paymentMode", paymentMode);
      form.append("outorgantes", String(outorgantes));
      const res = await fetch("/api/admin/contract-templates", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      setMessage({ type: "ok", text: `Template ${offer} / ${paymentMode} / ${outorgantes} outorg. actualizado` });
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
            4 variantes por oferta: prestacoes vs a vista × 1 ou 2 outorgantes.
            O sistema escolhe automaticamente baseado nos custom fields do GHL.
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
        <p className="font-medium text-blue-900 dark:text-blue-200 mb-2">Logica de escolha automatica</p>
        <ul className="space-y-1 text-blue-800 dark:text-blue-300 text-xs list-disc pl-5">
          <li><code>paymentMode</code>: se custom field <code>forma_pagamento</code> contem &quot;prestacoes&quot; ou &quot;prestaç&quot; -&gt; PRESTACOES. Senao -&gt; AVISTA.</li>
          <li><code>outorgantes</code>: se custom field <code>gerente_2_nome</code> estiver preenchido -&gt; 2. Senao -&gt; 1.</li>
        </ul>
        <p className="mt-2 font-medium text-blue-900 dark:text-blue-200">Placeholders base (sempre disponiveis)</p>
        <code className="mt-1 block rounded bg-card px-3 py-2 text-xs font-mono">
          {"{nome_empresa} {sede_empresa} {nif_empresa}"}<br />
          {"{gerente_1_nome} {gerente_1_cc} {gerente_1_cc_validade}"}<br />
          {"{gerente_2_nome} {gerente_2_cc} {gerente_2_cc_validade}"}  <span className="text-muted-foreground">(so versao 2 outorg)</span><br />
          {"{data_inicio} {data_fim} {data_assinatura}"}<br />
          {"{primeira_prestacao} {restantes_prestacoes}"}  <span className="text-muted-foreground">(restantes so em prestacoes)</span>
        </code>
      </div>

      <div className="space-y-4">
        {OFFERS.map((offer) => (
          <div key={offer} className="rounded-xl border bg-card">
            <div className="border-b p-4">
              <h3 className="font-semibold text-lg">{offer}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border">
              {VARIANTS.map((v) => {
                const current = templates.find((t) => t.offer === offer && t.paymentMode === v.paymentMode && t.outorgantes === v.outorgantes);
                const key = `${offer}-${v.paymentMode}-${v.outorgantes}`;
                return (
                  <div key={key} className="bg-card p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{v.label}</p>
                      {current ? (
                        <span className="rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-0.5 text-[10px] font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> OK
                        </span>
                      ) : (
                        <span className="rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 text-[10px] font-medium">
                          Sem template
                        </span>
                      )}
                    </div>

                    {current && (
                      <div className="text-[11px] text-muted-foreground">
                        {current.displayName || current.filename} · {new Date(current.updatedAt).toLocaleDateString("pt-PT")}
                      </div>
                    )}

                    <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/30 py-2 cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">
                        {uploadingFor === key ? "A carregar..." : current ? "Substituir" : "Upload .docx"}
                      </span>
                      <input
                        type="file"
                        accept=".docx"
                        className="hidden"
                        disabled={uploadingFor === key}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(offer, v.paymentMode, v.outorgantes, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {loading && <p className="text-center text-sm text-muted-foreground">A carregar...</p>}
    </div>
  );
}
