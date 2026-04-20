import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendMailWithRetry(
  options: nodemailer.SendMailOptions,
  retries = 3
): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await transporter.sendMail(options);
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

function emailTemplate(title: string, bodyHtml: string): string {
  const header = `<tr><td style="background:#101112;padding:32px 40px 24px;border-bottom:1px solid #1e2124;text-align:center;"><span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">BoomLab</span></td></tr>`;
  const footer = `<tr><td style="padding:20px 40px 32px;border-top:1px solid #1e2124;text-align:center;"><p style="margin:0;font-size:12px;color:#6b7280;">BoomLab Agency</p><p style="margin:6px 0 0;font-size:11px;color:#4b5563;">Se não solicitaste este email, podes ignorá-lo com segurança.</p></td></tr>`;
  return "<!DOCTYPE html><html lang=\"pt\"><head><meta charset=\"UTF-8\" /><title>" + title + "</title></head><body style=\"margin:0;padding:0;background:#0d0f10;font-family:Arial,sans-serif;\"><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#0d0f10;padding:40px 0;\"><tr><td align=\"center\"><table width=\"580\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#101112;border-radius:12px;overflow:hidden;border:1px solid #1e2124;\">" + header + "<tr><td style=\"padding:36px 40px;\">" + bodyHtml + "</td></tr>" + footer + "</table></td></tr></table></body></html>";
}

export interface WelcomeEmailUser {
  name: string;
  email: string;
}

export async function sendWelcomeEmail(
  user: WelcomeEmailUser,
  temporaryPassword: string
): Promise<void> {
  const loginUrl = "https://servico.boomlab.agency/login";
  const firstName = user.name.split(" ")[0];

  const credRow = (label: string, val: string, isPass = false) =>
    "<tr><td style=\"padding:6px 0;font-size:14px;color:#9ca3af;width:80px;\">" + label + "</td><td style=\"padding:6px 0;font-size:" + (isPass ? "15" : "14") + "px;color:" + (isPass ? "#2D76FC" : "#ffffff") + ";font-weight:" + (isPass ? "700;font-family:monospace" : "500") + "\">" + val + "</td></tr>";

  const bodyHtml =
    "<h2 style=\"margin:0 0 8px;font-size:24px;font-weight:700;color:#ffffff;\">Bem-vindo, " + firstName + "! 👋</h2>" +
    "<p style=\"margin:0 0 24px;font-size:15px;color:#9ca3af;line-height:1.6;\">A tua conta na <strong style=\"color:#ffffff;\">BoomLab Platform</strong> foi criada. Usa as credenciais abaixo para aceder.</p>" +
    "<div style=\"background:#1a1d1f;border:1px solid rgba(45,118,252,0.2);border-radius:8px;padding:20px 24px;margin-bottom:28px;\">" +
    "<p style=\"margin:0 0 10px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.8px;\">As tuas credenciais</p>" +
    "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">" + credRow("Email", user.email) + credRow("Password", temporaryPassword, true) + "</table></div>" +
    "<div style=\"background:#1e2a1a;border:1px solid rgba(34,197,94,0.2);border-radius:6px;padding:12px 16px;margin-bottom:28px;\">" +
    "<p style=\"margin:0;font-size:13px;color:#86efac;\">🔒 Ser-te-á pedido que alteres a password no primeiro login.</p></div>" +
    "<div style=\"text-align:center;\"><a href=\"" + loginUrl + "\" style=\"display:inline-block;background:#2D76FC;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 40px;border-radius:8px;\">Aceder à Plataforma →</a></div>";

  await sendMailWithRetry({
    from: process.env.EMAIL_FROM ?? ("BoomLab Platform <" + process.env.GMAIL_USER + ">"),
    to: user.email,
    subject: "Bem-vindo à BoomLab Platform – As tuas credenciais de acesso",
    html: emailTemplate("Bem-vindo à BoomLab Platform", bodyHtml),
  });
}

export async function sendPasswordResetEmail(
  user: WelcomeEmailUser,
  newPassword: string
): Promise<void> {
  const loginUrl = "https://servico.boomlab.agency/login";
  const firstName = user.name.split(" ")[0];

  const credRow = (label: string, val: string, isPass = false) =>
    "<tr><td style=\"padding:6px 0;font-size:14px;color:#9ca3af;width:80px;\">" + label + "</td><td style=\"padding:6px 0;font-size:" + (isPass ? "15" : "14") + "px;color:" + (isPass ? "#2D76FC" : "#ffffff") + ";font-weight:" + (isPass ? "700;font-family:monospace" : "500") + "\">" + val + "</td></tr>";

  const bodyHtml =
    "<h2 style=\"margin:0 0 8px;font-size:24px;font-weight:700;color:#ffffff;\">Nova password, " + firstName + "</h2>" +
    "<p style=\"margin:0 0 24px;font-size:15px;color:#9ca3af;line-height:1.6;\">A tua password na <strong style=\"color:#ffffff;\">BoomLab Platform</strong> foi reposta por um administrador.</p>" +
    "<div style=\"background:#1a1d1f;border:1px solid rgba(45,118,252,0.2);border-radius:8px;padding:20px 24px;margin-bottom:28px;\">" +
    "<p style=\"margin:0 0 10px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.8px;\">Nova password temporária</p>" +
    "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">" + credRow("Email", user.email) + credRow("Password", newPassword, true) + "</table></div>" +
    "<div style=\"background:#1e2a1a;border:1px solid rgba(34,197,94,0.2);border-radius:6px;padding:12px 16px;margin-bottom:28px;\">" +
    "<p style=\"margin:0;font-size:13px;color:#86efac;\">🔒 Ser-te-á pedido que alteres esta password no próximo login.</p></div>" +
    "<div style=\"text-align:center;\"><a href=\"" + loginUrl + "\" style=\"display:inline-block;background:#2D76FC;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 40px;border-radius:8px;\">Aceder à Plataforma →</a></div>";

  await sendMailWithRetry({
    from: process.env.EMAIL_FROM ?? ("BoomLab Platform <" + process.env.GMAIL_USER + ">"),
    to: user.email,
    subject: "BoomLab Platform – A tua password foi reposta",
    html: emailTemplate("Password reposta – BoomLab Platform", bodyHtml),
  });
}
