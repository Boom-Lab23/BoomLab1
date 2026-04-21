import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendEmail } from "@/server/services/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, consents, company, source } = body as {
      name?: string;
      email?: string;
      password?: string;
      consents?: {
        privacyPolicy?: boolean;
        terms?: boolean;
        dpa?: boolean;
        dataDeletion?: boolean;
        aiAnalysis?: boolean;
      };
      company?: string;
      source?: "comunicacao" | "servico";
    };

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Nome, email e password sao obrigatorios." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password precisa de pelo menos 6 caracteres." }, { status: 400 });
    }

    // Check required consents
    if (!consents?.privacyPolicy || !consents?.terms || !consents?.dpa) {
      return NextResponse.json({ error: "Precisas de aceitar a Politica de Privacidade, Termos e DPA." }, { status: 400 });
    }

    // Normalize email (case-insensitive lookup)
    const normalizedEmail = email.trim().toLowerCase();

    // Check if email exists (case-insensitive)
    const existing = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });
    if (existing) {
      return NextResponse.json({ error: "Este email ja esta registado." }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const isClient = source === "comunicacao";
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        // Cliente self-registo: fica INACTIVO ate admin ativar acesso
        // Equipa self-registo: fica ativa logo
        role: "GUEST_CLIENT",
        isActive: !isClient,  // clientes precisam de ativacao manual
        consentPrivacyPolicy: consents.privacyPolicy,
        consentTerms: consents.terms,
        consentDPA: consents.dpa,
        consentDataDeletion: consents.dataDeletion ?? false,
        consentAIAnalysis: consents.aiAnalysis ?? false,
        consentsAcceptedAt: new Date(),
      },
    });

    // Notify BoomLab team: novo registo pendente de ativacao (best-effort)
    if (isClient) {
      try {
        await sendEmail({
          to: "guilherme@boomlab.agency",
          subject: `🔔 Novo pedido de acesso - ${name} (${company ?? "sem empresa"})`,
          html: `<h2>Novo pedido de acesso BoomLab Comunicação</h2>
            <p><strong>Nome:</strong> ${name}</p>
            <p><strong>Email:</strong> ${normalizedEmail}</p>
            <p><strong>Empresa:</strong> ${company ?? "(não indicada)"}</p>
            <p>O utilizador está <strong>inativo</strong>. Vai ao admin (<a href="https://servico.boomlab.cloud/admin/users">servico.boomlab.cloud/admin/users</a>) para:</p>
            <ul>
              <li>Ativar o acesso</li>
              <li>Atribuir workspace do cliente</li>
              <li>Atribuir canal de mensagens</li>
            </ul>
            <p>Depois clica em "Reenviar acesso" para o cliente receber as credenciais.</p>`,
        });
      } catch (err) {
        console.error("[register] Failed to send notification email:", err);
      }
    }

    return NextResponse.json({
      success: true,
      userId: user.id,
      pendingActivation: isClient,
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Erro ao criar conta." }, { status: 500 });
  }
}
