"use client";

import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        <Link href="/register" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar ao registo
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-8 w-8 text-[#2D76FC]" />
          <h1 className="text-3xl font-bold">Politica de Privacidade</h1>
        </div>

        <p className="text-sm text-muted-foreground mb-8">Ultima atualizacao: 22 de Abril de 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Responsavel pelo Tratamento</h2>
            <p>A BoomLab e a entidade responsavel pelo tratamento dos dados pessoais recolhidos atraves das plataformas BoomLab Platform (acessivel em servico.boomlab.agency e servico.boomlab.cloud) e BoomLab Comunicacao (acessivel em comunicacao.boomlab.agency e comunicacao.boomlab.cloud), incluindo a respetiva aplicacao Android publicada na Google Play Store.</p>
            <p>Para questoes relacionadas com protecao de dados, pode contactar-nos atraves de: <strong>geral@boomlab.agency</strong></p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Dados Pessoais Recolhidos</h2>
            <p>Recolhemos os seguintes dados pessoais:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Dados de identificacao:</strong> nome, email, telefone</li>
              <li><strong>Dados de autenticacao:</strong> password (armazenada de forma encriptada com bcrypt)</li>
              <li><strong>Dados profissionais:</strong> empresa, cargo, informacoes comerciais</li>
              <li><strong>Dados de utilizacao:</strong> registos de sessoes, reunioes, documentos partilhados</li>
              <li><strong>Gravacoes de reunioes:</strong> transcricoes e resumos de reunioes processados via Fireflies.ai</li>
              <li><strong>Gravacoes de chamadas:</strong> transcricoes de chamadas comerciais submetidas para analise</li>
              <li><strong>Dados do Google:</strong> eventos de calendario e documentos do Google Docs (quando autorizado)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. Finalidades do Tratamento</h2>
            <p>Os seus dados sao tratados para as seguintes finalidades:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Gestao da relacao contratual de consultoria comercial</li>
              <li>Registo e acompanhamento de sessoes e reunioes</li>
              <li>Analise automatizada de reunioes e chamadas com Inteligencia Artificial</li>
              <li>Geracao de resumos, planos de acao e feedback</li>
              <li>Sincronizacao de calendarios e documentos</li>
              <li>Comunicacao interna atraves do sistema de mensagens da plataforma</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Base Legal</h2>
            <p>O tratamento dos seus dados baseia-se em:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Consentimento:</strong> para analise de chamadas por IA e gravacao de reunioes</li>
              <li><strong>Execucao de contrato:</strong> para a prestacao do servico de consultoria</li>
              <li><strong>Interesse legitimo:</strong> para melhoria dos servicos e comunicacao interna</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Partilha de Dados com Terceiros</h2>
            <p>Os seus dados podem ser partilhados com os seguintes prestadores de servicos:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Anthropic (Claude AI):</strong> para analise de reunioes e chamadas. A Anthropic nao utiliza dados de API para treino de modelos.</li>
              <li><strong>Fireflies.ai:</strong> para transcricao automatica de reunioes.</li>
              <li><strong>Google:</strong> para sincronizacao de calendario e documentos.</li>
              <li><strong>Hostinger:</strong> para alojamento da plataforma (servidor na Uniao Europeia).</li>
              <li><strong>Cloudflare:</strong> para proxy e seguranca de rede.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Retencao de Dados</h2>
            <p>Os seus dados pessoais sao conservados durante o periodo necessario para a prestacao do servico contratado, e pelo periodo legalmente exigido apos o seu termino.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Direitos do Titular</h2>
            <p>Nos termos do RGPD, tem direito a:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Aceder aos seus dados pessoais</li>
              <li>Retificar dados incorretos</li>
              <li>Solicitar a eliminacao dos seus dados (direito ao esquecimento)</li>
              <li>Limitar o tratamento dos seus dados</li>
              <li>Portabilidade dos dados</li>
              <li>Opor-se ao tratamento dos dados</li>
              <li>Retirar o consentimento a qualquer momento</li>
            </ul>
            <p>Para exercer estes direitos, contacte: <strong>geral@boomlab.agency</strong></p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Seguranca</h2>
            <p>Implementamos medidas tecnicas e organizativas adequadas para proteger os seus dados, incluindo:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Encriptacao SSL/TLS em todas as comunicacoes</li>
              <li>Passwords encriptadas com bcrypt</li>
              <li>Base de dados com encriptacao em repouso e em transito</li>
              <li>Controlo de acesso baseado em funcoes (RBAC)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Contacto</h2>
            <p>Para qualquer questao sobre esta politica, contacte-nos em <strong>geral@boomlab.agency</strong> ou visite <strong>boomlab.agency</strong>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
