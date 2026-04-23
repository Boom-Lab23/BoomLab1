// Cria user Raquel Silva + canal de mensagens R.A. Credits + envia email de convite.
//
// Corre dentro do container: docker exec boomlab-app node /app/scripts/setup-ra-credits.js

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

const RAQUEL = {
  name: "Raquel Silva",
  email: "raquel.silva@racreditos.pt",
  phone: "+351915239398",
};

function generateTempPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let pw = "";
  const cryptoRandom = require("crypto").randomBytes(12);
  for (let i = 0; i < 12; i++) {
    pw += alphabet[cryptoRandom[i] % alphabet.length];
  }
  return pw;
}

async function main() {
  // 1. Encontrar cliente R.A. Credits
  const client = await prisma.client.findFirst({
    where: { name: { equals: "RA Creditos", mode: "insensitive" } },
  });
  if (!client) {
    console.error("[setup] Cliente 'RA Creditos' NAO encontrado. Corre primeiro o import-clients.js");
    process.exit(1);
  }
  console.log(`[setup] Cliente: ${client.name} (${client.id})`);

  // 2. Encontrar/criar user Raquel
  let user = await prisma.user.findFirst({
    where: { email: { equals: RAQUEL.email, mode: "insensitive" } },
  });
  let tempPassword = null;

  if (user) {
    console.log(`[setup] User ja existe (${user.id}), actualizando...`);
    tempPassword = generateTempPassword();
    const hashed = await bcrypt.hash(tempPassword, 12);
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        role: "GUEST_CLIENT",
        isActive: true,
        mustChangePassword: true,
        password: hashed,
        assignedWorkspaceClientId: client.id,
      },
    });
    console.log(`[setup] User actualizado com nova password temporaria.`);
  } else {
    tempPassword = generateTempPassword();
    const hashed = await bcrypt.hash(tempPassword, 12);
    user = await prisma.user.create({
      data: {
        name: RAQUEL.name,
        email: RAQUEL.email,
        password: hashed,
        role: "GUEST_CLIENT",
        isActive: true,
        mustChangePassword: true,
        assignedWorkspaceClientId: client.id,
      },
    });
    console.log(`[setup] User criado: ${user.id}`);
  }

  // 3. Encontrar admin para ser owner do canal
  const admin = await prisma.user.findFirst({
    where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) {
    console.error("[setup] Nenhum admin encontrado para owner do canal");
    process.exit(1);
  }

  // 4. Encontrar/criar canal tipo CLIENT para este cliente
  let channel = await prisma.channel.findFirst({
    where: { clientId: client.id, type: "CLIENT" },
  });

  if (channel) {
    console.log(`[setup] Canal ja existe (${channel.id})`);
    // Garantir que raquel e membro
    const membership = await prisma.channelMember.findFirst({
      where: { channelId: channel.id, userId: user.id },
    });
    if (!membership) {
      await prisma.channelMember.create({
        data: { channelId: channel.id, userId: user.id, role: "MEMBER" },
      });
      console.log(`[setup] Raquel adicionada como membro`);
    }
  } else {
    channel = await prisma.channel.create({
      data: {
        name: client.name,
        type: "CLIENT",
        clientId: client.id,
        createdById: admin.id,
        isPrivate: true,
        description: `Canal de comunicacao com ${client.name}`,
        members: {
          create: [
            { userId: admin.id, role: "OWNER" },
            { userId: user.id, role: "MEMBER" },
          ],
        },
      },
    });
    console.log(`[setup] Canal criado: ${channel.id}`);
  }

  // 5. Liga o canal ao user convidado
  await prisma.user.update({
    where: { id: user.id },
    data: { assignedChannelId: channel.id },
  });

  // 6. Envia email de welcome (via service existente)
  try {
    const { sendWelcomeEmail } = require("./dist-services/email.js");
    await sendWelcomeEmail({
      to: user.email,
      name: user.name,
      tempPassword,
      loginUrl: "https://comunicacao.boomlab.cloud/login",
    });
    console.log(`[setup] Email de welcome enviado`);
  } catch (err) {
    // Fallback: usa directamente nodemailer
    try {
      const nodemailer = require("nodemailer");
      const transporter = nodemailer.createTransport({
        service: "gmail",
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
      });
      const loginUrl = "https://comunicacao.boomlab.cloud/login";
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || "BoomLab Platform <guilherme@boomlab.agency>",
        to: user.email,
        subject: "Acesso BoomLab Comunicacao - RA Creditos",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
            <h2 style="color: #2D76FC;">Bem-vinda, ${user.name}!</h2>
            <p>A tua conta na <strong>BoomLab Comunicacao</strong> foi criada.</p>
            <p>Credenciais de acesso:</p>
            <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 4px 0;"><strong>URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
              <p style="margin: 4px 0;"><strong>Email:</strong> ${user.email}</p>
              <p style="margin: 4px 0;"><strong>Password temporaria:</strong> <code style="background:#fff;padding:2px 6px;border-radius:4px;">${tempPassword}</code></p>
            </div>
            <p>No primeiro login vai ser pedido para alterares a password para uma que escolhas.</p>
            <p>Dentro da plataforma vais ter acesso ao teu workspace e ao canal de mensagens dedicado a R.A. Credits.</p>
            <p style="color: #666; font-size: 12px; margin-top: 32px;">
              Se nao conseguires aceder, responde a este email.
            </p>
          </div>
        `,
      });
      console.log(`[setup] Email de welcome enviado (via nodemailer directo)`);
    } catch (err2) {
      console.error(`[setup] ERRO ao enviar email: ${err2.message}`);
      console.log(`[setup] Password temp GERADA MAS NAO ENVIADA: ${tempPassword}`);
    }
  }

  console.log(`\n[setup] COMPLETO:`);
  console.log(`  Client ID: ${client.id}`);
  console.log(`  User ID: ${user.id}`);
  console.log(`  Channel ID: ${channel.id}`);
  console.log(`  Temp password: ${tempPassword}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
