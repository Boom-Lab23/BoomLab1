import nodemailer from "nodemailer";
import { welcomeEmailTemplate, passwordResetTemplate } from "./email-templates";

// Gmail SMTP transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const EMAIL_FROM = process.env.EMAIL_FROM || "BoomLab Platform <guilherme@boomlab.agency>";
const APP_URL = process.env.NEXTAUTH_URL || "https://servico.boomlab.agency";

type EmailAttachment = {
  filename: string;
  content: Buffer | string;
  contentType?: string;
};

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  cc?: string | string[];
  bcc?: string | string[];
}) {
  try {
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error("[email] Failed to send:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

// Email de onboarding ao cliente: welcome + contrato em anexo + fatura
// em anexo. NAO inclui credenciais da plataforma.
//
// Tom: formal, redigido como se fosse a equipa a escrever manualmente.
// Sem rodapes "gerado automaticamente", sem emojis, sem links de plataforma.
export async function sendClientOnboardingEmail(args: {
  to: string;
  clientName: string; // Nome da empresa (ou pessoal se nao houver empresa)
  contactName: string; // Nome do contacto/gerente
  contractDocxBuffer?: Buffer;
  contractFilename?: string;
  invoicePdfBuffer?: Buffer;
  invoiceFilename?: string;
  reuniaoPreArranque?: string; // texto livre vindo do GHL (ex: "12/05/2026 as 14:00")
  reuniaoLevantamento?: string; // texto livre vindo do GHL
  cc?: string;
}) {
  // Primeiro nome (mais natural na saudacao)
  const firstName = args.contactName.trim().split(/\s+/)[0] || args.contactName;

  // Bloco de reunioes - so aparece se pelo menos uma estiver preenchida
  const reunioesBloco = (args.reuniaoPreArranque || args.reuniaoLevantamento)
    ? `
      <p>Para que possamos avançar com a melhor preparação, ficam desde já agendadas as próximas reuniões:</p>
      <ul style="padding-left: 20px;">
        ${args.reuniaoPreArranque ? `<li><strong>Reunião de pré-arranque:</strong> ${args.reuniaoPreArranque}</li>` : ""}
        ${args.reuniaoLevantamento ? `<li><strong>Reunião de levantamento:</strong> ${args.reuniaoLevantamento}</li>` : ""}
      </ul>
    `
    : "";

  const html = `
    <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 640px; color: #1f2937; line-height: 1.65; font-size: 15px;">
      <p>Olá ${firstName},</p>

      <p>Vamos então aos próximos passos para começar o nosso onboarding.</p>

      <p>O pagamento poderá ser realizado por transferência bancária para os seguintes dados:</p>
      <p style="margin-left: 20px;">
        <strong>Nome:</strong> Boomlab Agency OÜ<br/>
        <strong>País:</strong> Lituânia<br/>
        <strong>IBAN:</strong> LT79 3250 0675 4061 8109<br/>
        <strong>BIC/SWIFT:</strong> REVOLT21
      </p>

      <p>Em anexo, seguem os documentos relativos ao início do projecto: o contrato para assinatura e a respectiva fatura.</p>

      ${reunioesBloco}

      <p>Faremos um overview destes pontos durante a reunião e ficamos disponíveis para qualquer esclarecimento adicional.</p>

      <p>Cumprimentos,<br/>
      Bem-vindo(a) à BoomLab.</p>
    </div>
  `;

  const attachments: EmailAttachment[] = [];
  if (args.contractDocxBuffer && args.contractFilename) {
    attachments.push({
      filename: args.contractFilename,
      content: args.contractDocxBuffer,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  }
  if (args.invoicePdfBuffer && args.invoiceFilename) {
    attachments.push({
      filename: args.invoiceFilename,
      content: args.invoicePdfBuffer,
      contentType: "application/pdf",
    });
  }

  return sendEmail({
    to: args.to,
    cc: args.cc,
    subject: `Próximos passos do onboarding — ${args.clientName}`,
    html,
    attachments,
  });
}

// Notificacao a contabilidade@boomlab.agency quando e criada uma nova
// fatura no Invoice Ninja para um cliente novo (via GHL onboarding).
export async function sendAccountingInvoiceNotification(args: {
  clientName: string;
  clientEmail?: string | null;
  offer: string;
  invoices: Array<{
    invoiceNumber: string;
    amount: number;
    dueDate?: string;
    prestacaoLabel?: string; // ex: "1 de 4"
    invoiceUrl?: string;
  }>;
}) {
  const fmtEur = (n: number) =>
    `${n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`;
  const totalAmount = args.invoices.reduce((s, i) => s + i.amount, 0);
  const isMultiple = args.invoices.length > 1;

  const linhasFaturas = args.invoices
    .map((inv) => {
      const partes = [
        `<strong>${inv.invoiceNumber}</strong>`,
        inv.prestacaoLabel ? `Prestação ${inv.prestacaoLabel}` : null,
        fmtEur(inv.amount),
        inv.dueDate ? `Vencimento: ${inv.dueDate}` : null,
        inv.invoiceUrl ? `<a href="${inv.invoiceUrl}">Abrir no Invoice Ninja</a>` : null,
      ].filter(Boolean);
      return `<li>${partes.join(" — ")}</li>`;
    })
    .join("");

  const html = `
    <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 640px; color: #1f2937; line-height: 1.6; font-size: 14px;">
      <p>Foi ${isMultiple ? "criadas faturas" : "criada uma nova fatura"} no Invoice Ninja para um novo cliente.</p>

      <p>
        <strong>Cliente:</strong> ${args.clientName}<br/>
        ${args.clientEmail ? `<strong>Email:</strong> ${args.clientEmail}<br/>` : ""}
        <strong>Oferta:</strong> ${args.offer}<br/>
        <strong>Total:</strong> ${fmtEur(totalAmount)}${isMultiple ? ` (${args.invoices.length} prestações)` : ""}
      </p>

      <p><strong>${isMultiple ? "Faturas criadas" : "Fatura"}:</strong></p>
      <ul>${linhasFaturas}</ul>

      <p>${isMultiple ? "Todas as faturas estão" : "A fatura está"} em rascunho no Invoice Ninja, prontas para validação e envio.</p>
    </div>
  `;

  return sendEmail({
    to: "contabilidade@boomlab.agency",
    subject: `Nova fatura — ${args.clientName} (${args.offer})`,
    html,
  });
}

export async function sendWelcomeEmail(args: {
  name: string;
  email: string;
  password: string;
  role: string;
  clientName?: string;
}) {
  const isGuest = args.role === "GUEST_CLIENT" || args.role === "GUEST_TEAM_MEMBER";
  const subject = isGuest
    ? `Bem-vindo(a) a BoomLab - Acesso a plataforma`
    : `O teu acesso a BoomLab Platform`;

  const html = welcomeEmailTemplate({
    name: args.name,
    email: args.email,
    password: args.password,
    loginUrl: `${APP_URL}/login`,
    role: args.role,
    clientName: args.clientName,
  });

  return sendEmail({
    to: args.email,
    subject,
    html,
  });
}

export async function sendPasswordResetEmail(args: {
  name: string;
  email: string;
  newPassword: string;
}) {
  const html = passwordResetTemplate({
    name: args.name,
    email: args.email,
    password: args.newPassword,
    loginUrl: `${APP_URL}/login`,
  });

  return sendEmail({
    to: args.email,
    subject: "Nova password BoomLab Platform",
    html,
  });
}

// Generate a random temporary password (12 chars, mix of letters/numbers)
export function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
