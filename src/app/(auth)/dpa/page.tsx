"use client";

import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";

export default function DPAPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        <Link href="/register" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar ao registo
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <Lock className="h-8 w-8 text-[#2D76FC]" />
          <h1 className="text-3xl font-bold">DPA - Acordo de Processamento de Dados</h1>
        </div>

        <p className="text-sm text-muted-foreground mb-8">Ultima atualizacao: 16 de Abril de 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Partes</h2>
            <p>Este Acordo de Processamento de Dados (DPA) e celebrado entre:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Responsavel pelo Tratamento:</strong> O cliente/utilizador da plataforma BoomLab.</li>
              <li><strong>Subcontratante:</strong> BoomLab, responsavel pela operacao da plataforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Objeto do Tratamento</h2>
            <p>O presente DPA define as obrigacoes das partes relativamente ao tratamento de dados pessoais no ambito da utilizacao da plataforma BoomLab Platform, em conformidade com o Regulamento Geral sobre a Protecao de Dados (RGPD - Regulamento UE 2016/679).</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. Sub-processadores</h2>
            <p>A BoomLab utiliza os seguintes sub-processadores para a prestacao do servico:</p>
            <div className="rounded-lg border overflow-hidden mt-3">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 font-medium text-foreground">Servico</th>
                    <th className="text-left p-2 font-medium text-foreground">Finalidade</th>
                    <th className="text-left p-2 font-medium text-foreground">Localizacao</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr><td className="p-2">Anthropic (Claude AI)</td><td className="p-2">Analise de reunioes e chamadas</td><td className="p-2">EUA</td></tr>
                  <tr><td className="p-2">Fireflies.ai</td><td className="p-2">Transcricao de reunioes</td><td className="p-2">EUA</td></tr>
                  <tr><td className="p-2">Google Cloud</td><td className="p-2">Calendar e Docs</td><td className="p-2">UE/EUA</td></tr>
                  <tr><td className="p-2">Vercel</td><td className="p-2">Alojamento da plataforma</td><td className="p-2">Global (Edge)</td></tr>
                  <tr><td className="p-2">Neon</td><td className="p-2">Base de dados PostgreSQL</td><td className="p-2">UE (eu-west-2)</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Obrigacoes da BoomLab</h2>
            <p>A BoomLab compromete-se a:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Tratar os dados pessoais apenas conforme as instrucoes do responsavel pelo tratamento.</li>
              <li>Garantir a confidencialidade dos dados tratados.</li>
              <li>Implementar medidas tecnicas e organizativas adequadas de seguranca.</li>
              <li>Notificar o responsavel em caso de violacao de dados no prazo de 72 horas.</li>
              <li>Eliminar ou devolver os dados pessoais apos o termino do servico, mediante solicitacao.</li>
              <li>Disponibilizar informacao necessaria para demonstrar conformidade com o RGPD.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Transferencias Internacionais</h2>
            <p>Alguns sub-processadores estao localizados fora da UE (EUA). As transferencias sao realizadas com base em:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Clausulas Contratuais Tipo da Comissao Europeia.</li>
              <li>EU-US Data Privacy Framework (quando aplicavel).</li>
              <li>Medidas suplementares de seguranca conforme recomendacoes do EDPB.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Medidas de Seguranca</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Encriptacao de dados em transito (TLS 1.3) e em repouso.</li>
              <li>Autenticacao com passwords encriptadas (bcrypt, 12 rounds).</li>
              <li>Controlo de acesso baseado em funcoes (RBAC).</li>
              <li>Base de dados alojada na UE com encriptacao.</li>
              <li>Logs de auditoria para acoes criticas.</li>
              <li>Backups automaticos com encriptacao.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Duracao</h2>
            <p>Este DPA permanece em vigor durante todo o periodo de utilizacao da plataforma e enquanto a BoomLab retiver dados pessoais do utilizador.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Contacto</h2>
            <p>Para questoes sobre este DPA: <strong>geral@boomlab.agency</strong></p>
          </section>
        </div>
      </div>
    </div>
  );
}
