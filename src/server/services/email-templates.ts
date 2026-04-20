// BoomLab branded email templates (HTML)
// Colors: Primary #2D76FC, Dark #101112, Card #1C1D1F, Border #272829

const baseStyles = `
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f4f5f7; color: #101112; }
    .wrapper { width: 100%; background: #f4f5f7; padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    .header { background: linear-gradient(135deg, #101112 0%, #1C1D1F 100%); padding: 36px 32px; text-align: center; }
    .logo { color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; margin: 0; }
    .logo-accent { color: #2D76FC; }
    .content { padding: 36px 32px; }
    .title { font-size: 22px; font-weight: 700; color: #101112; margin: 0 0 16px; }
    .text { font-size: 15px; line-height: 1.6; color: #4a4a4a; margin: 0 0 16px; }
    .credentials-box { background: #f7f9fc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin: 24px 0; }
    .credential-row { display: table; width: 100%; margin-bottom: 10px; }
    .credential-row:last-child { margin-bottom: 0; }
    .credential-label { display: table-cell; font-size: 13px; color: #6b7280; font-weight: 600; width: 110px; padding: 4px 0; }
    .credential-value { display: table-cell; font-size: 15px; color: #101112; font-family: "SF Mono", Monaco, Consolas, monospace; font-weight: 600; padding: 4px 0; word-break: break-all; }
    .cta-wrapper { text-align: center; margin: 32px 0; }
    .cta-button { display: inline-block; background: #2D76FC; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; letter-spacing: 0.2px; }
    .warning-box { background: #fff8e1; border-left: 3px solid #f59e0b; padding: 14px 16px; border-radius: 6px; margin: 24px 0; }
    .warning-text { font-size: 13px; color: #78350f; margin: 0; line-height: 1.5; }
    .footer { background: #f7f9fc; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb; }
    .footer-text { font-size: 12px; color: #9ca3af; margin: 0 0 6px; line-height: 1.5; }
    .footer-link { color: #2D76FC; text-decoration: none; }
    .divider { height: 1px; background: #e5e7eb; margin: 24px 0; border: 0; }
  </style>
`;

const headerHtml = `
  <div class="header">
    <h1 class="logo">Boom<span class="logo-accent">Lab</span></h1>
  </div>
`;

const footerHtml = `
  <div class="footer">
    <p class="footer-text"><strong>BoomLab Agency</strong></p>
    <p class="footer-text">Tallinn, Estonia &middot; NIF EE102949302</p>
    <p class="footer-text">
      <a href="https://boomlab.agency" class="footer-link">boomlab.agency</a>
      &nbsp;&middot;&nbsp;
      <a href="mailto:guilherme@boomlab.agency" class="footer-link">guilherme@boomlab.agency</a>
    </p>
    <p class="footer-text" style="margin-top: 12px; color: #b5b8bd;">Este e um email automatico. Se nao esperavas receber este email, ignora-o.</p>
  </div>
`;

export function welcomeEmailTemplate(args: {
  name: string;
  email: string;
  password: string;
  loginUrl: string;
  role: string;
  clientName?: string;
}): string {
  const firstName = args.name.split(" ")[0] || args.name;
  const isGuest = args.role === "GUEST_CLIENT" || args.role === "GUEST_TEAM_MEMBER";

  const welcomeMsg = isGuest
    ? `A <strong>BoomLab</strong> criou um acesso personalizado para ti na nossa plataforma de gestao. Vais poder acompanhar o teu projeto, comunicar com a equipa e consultar o teu dashboard comercial em tempo real.`
    : `O teu acesso a <strong>BoomLab Platform</strong> ja esta ativo. Usa as credenciais abaixo para fazeres o primeiro login.`;

  const featuresHtml = isGuest
    ? `
      <hr class="divider" />
      <p class="text" style="font-weight:600;color:#101112;margin-bottom:12px;">O que vais encontrar na plataforma:</p>
      <ul style="color:#4a4a4a;font-size:14px;line-height:1.7;padding-left:20px;margin:0 0 16px;">
        <li>Canal de comunicacao direto com a equipa BoomLab</li>
        <li>Dashboard comercial com KPIs do teu negocio</li>
        <li>Timeline do projeto com todas as sessoes agendadas</li>
      </ul>
    `
    : "";

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bem-vindo a BoomLab</title>
  ${baseStyles}
</head>
<body>
  <div class="wrapper">
    <div class="container">
      ${headerHtml}
      <div class="content">
        <h2 class="title">Ola, ${firstName}! 👋</h2>
        <p class="text">${welcomeMsg}</p>
        ${args.clientName ? `<p class="text">Foste adicionado(a) como membro do projeto <strong>${args.clientName}</strong>.</p>` : ""}

        <div class="credentials-box">
          <div class="credential-row">
            <div class="credential-label">Email</div>
            <div class="credential-value">${args.email}</div>
          </div>
          <div class="credential-row">
            <div class="credential-label">Password</div>
            <div class="credential-value">${args.password}</div>
          </div>
        </div>

        <div class="cta-wrapper">
          <a href="${args.loginUrl}" class="cta-button">Aceder a plataforma</a>
        </div>

        <div class="warning-box">
          <p class="warning-text">🔒 <strong>Por seguranca</strong>, vais ser convidado(a) a alterar a tua password no primeiro login.</p>
        </div>

        ${featuresHtml}

        <p class="text" style="font-size:13px;color:#6b7280;margin-top:24px;">Qualquer duvida, responde a este email ou contacta-nos em <a href="mailto:guilherme@boomlab.agency" style="color:#2D76FC;">guilherme@boomlab.agency</a>.</p>
      </div>
      ${footerHtml}
    </div>
  </div>
</body>
</html>`;
}

export function passwordResetTemplate(args: {
  name: string;
  email: string;
  password: string;
  loginUrl: string;
}): string {
  const firstName = args.name.split(" ")[0] || args.name;
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nova password BoomLab</title>
  ${baseStyles}
</head>
<body>
  <div class="wrapper">
    <div class="container">
      ${headerHtml}
      <div class="content">
        <h2 class="title">Ola, ${firstName}</h2>
        <p class="text">A tua password BoomLab Platform foi reposta. Usa as credenciais abaixo para voltares a entrar:</p>

        <div class="credentials-box">
          <div class="credential-row">
            <div class="credential-label">Email</div>
            <div class="credential-value">${args.email}</div>
          </div>
          <div class="credential-row">
            <div class="credential-label">Password</div>
            <div class="credential-value">${args.password}</div>
          </div>
        </div>

        <div class="cta-wrapper">
          <a href="${args.loginUrl}" class="cta-button">Entrar na plataforma</a>
        </div>

        <div class="warning-box">
          <p class="warning-text">⚠️ Por seguranca, vais ser convidado(a) a definir uma nova password no proximo login. Se nao foste tu que pediste esta reposicao, contacta-nos imediatamente em <a href="mailto:guilherme@boomlab.agency" style="color:#78350f;font-weight:600;">guilherme@boomlab.agency</a>.</p>
        </div>
      </div>
      ${footerHtml}
    </div>
  </div>
</body>
</html>`;
}
