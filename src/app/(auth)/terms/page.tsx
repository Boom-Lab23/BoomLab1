"use client";

import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        <Link href="/register" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar ao registo
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <FileText className="h-8 w-8 text-[#2D76FC]" />
          <h1 className="text-3xl font-bold">Termos e Condicoes</h1>
        </div>

        <p className="text-sm text-muted-foreground mb-8">Ultima atualizacao: 16 de Abril de 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Objeto</h2>
            <p>Os presentes Termos e Condicoes regulam o acesso e utilizacao da plataforma BoomLab Platform, disponibilizada pela BoomLab para gestao de servicos de consultoria comercial.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Acesso a Plataforma</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>O acesso e concedido mediante criacao de conta com email e password.</li>
              <li>Cada utilizador e responsavel pela confidencialidade das suas credenciais.</li>
              <li>A BoomLab reserva-se o direito de suspender ou cancelar contas que violem estes termos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. Tipos de Utilizador</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Administrador:</strong> acesso total a todas as funcionalidades e gestao de utilizadores.</li>
              <li><strong>Gestor/Consultor:</strong> acesso as funcionalidades do servico conforme o seu perfil.</li>
              <li><strong>Cliente:</strong> acesso limitado ao canal de comunicacao atribuido.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Utilizacao da Plataforma</h2>
            <p>O utilizador compromete-se a:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Utilizar a plataforma exclusivamente para fins profissionais relacionados com o servico contratado.</li>
              <li>Nao partilhar credenciais de acesso com terceiros.</li>
              <li>Nao tentar aceder a dados ou funcionalidades nao autorizadas.</li>
              <li>Respeitar a propriedade intelectual da BoomLab e dos conteudos disponibilizados.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Inteligencia Artificial</h2>
            <p>A plataforma utiliza Inteligencia Artificial (Claude AI, Anthropic) para:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Analisar transcricoes de reunioes e gerar resumos automaticos.</li>
              <li>Avaliar gravacoes de chamadas comerciais e fornecer feedback.</li>
              <li>Gerar planos de acao e sugestoes de melhoria.</li>
            </ul>
            <p>A analise por IA e opcional e requer consentimento explicito. Os resultados sao revistos pela equipa antes de serem partilhados.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Gravacoes e Transcricoes</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>As reunioes podem ser gravadas e transcritas automaticamente atraves do Fireflies.ai.</li>
              <li>Todos os participantes devem ser informados da gravacao.</li>
              <li>As gravacoes sao utilizadas exclusivamente para fins de acompanhamento do servico.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Propriedade Intelectual</h2>
            <p>Todos os documentos, frameworks, scripts e metodologias disponibilizados na plataforma sao propriedade intelectual da BoomLab. E proibida a reproducao, distribuicao ou utilizacao fora do ambito do servico contratado.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Confidencialidade</h2>
            <p>Toda a informacao partilhada na plataforma e considerada confidencial. O utilizador compromete-se a nao divulgar informacoes de outros clientes ou dados internos da BoomLab.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Limitacao de Responsabilidade</h2>
            <p>A BoomLab nao se responsabiliza por:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Interrupcoes temporarias do servico por motivos tecnicos.</li>
              <li>Resultados gerados pela Inteligencia Artificial (que sao indicativos e nao vinculativos).</li>
              <li>Perdas decorrentes do uso indevido da plataforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">10. Lei Aplicavel</h2>
            <p>Estes termos sao regidos pela lei portuguesa. Qualquer litigio sera submetido aos tribunais portugueses competentes.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">11. Contacto</h2>
            <p>Para questoes sobre estes termos: <strong>geral@boomlab.agency</strong></p>
          </section>
        </div>
      </div>
    </div>
  );
}
