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

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  try {
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error("[email] Failed to send:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
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
