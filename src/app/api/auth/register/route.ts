import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, consents } = body;

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

    // Check if email exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Este email ja esta registado." }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "GUEST_CLIENT", // Default role for self-registration
        consentPrivacyPolicy: consents.privacyPolicy,
        consentTerms: consents.terms,
        consentDPA: consents.dpa,
        consentDataDeletion: consents.dataDeletion ?? false,
        consentAIAnalysis: consents.aiAnalysis ?? false,
        consentsAcceptedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, userId: user.id });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Erro ao criar conta." }, { status: 500 });
  }
}
