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
// (link OU PDF anexo). NAO inclui credenciais da plataforma.
export async function sendClientOnboardingEmail(args: {
  to: string;
  clientName: string;
  contactName: string;
  contractDocxBuffer?: Buffer;
  contractFilename?: string;
  invoicePdfBuffer?: Buffer;
  invoiceFilename?: string;
  invoiceUrl?: string; // link Invoice Ninja se preferir link
  cc?: string;
}) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333; line-height: 1.6;">
      <h1 style="color: #2563eb;">Bem-vindo(a) a BoomLab, ${args.clientName}!</h1>
      <p>Ola ${args.contactName},</p>
      <p>E com muito gosto que te damos as boas-vindas ao projecto BoomLab.</p>
      <p>Em anexo segue:</p>
      <ul>
        ${args.contractDocxBuffer ? "<li>📄 <strong>Contrato</strong> assinado / a assinar</li>" : ""}
        ${args.invoicePdfBuffer ? "<li>🧾 <strong>Fatura</strong> com os termos de pagamento</li>" : args.invoiceUrl ? `<li>🧾 <strong>Fatura</strong>: <a href="${args.invoiceUrl}">ver online</a></li>` : ""}
      </ul>
      <p>Se tiveres qualquer questao, responde a este email ou contacta-nos.</p>
      <p>Cumprimentos,<br/><strong>Equipa BoomLab</strong></p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;"/>
      <p style="font-size: 12px; color: #6b7280;">
        BoomLab Agency · servico.boomlab.cloud<br/>
        Este email foi gerado automaticamente. Para suporte, escreve para guilherme@boomlab.agency.
      </p>
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
    subject: `Bem-vindo(a) a BoomLab — Documentos do projecto ${args.clientName}`,
    html,
    attachments,
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
