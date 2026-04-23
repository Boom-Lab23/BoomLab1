import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as Record<string, unknown>).role as string | undefined;
  const userAssignedClientId = (session.user as Record<string, unknown>).assignedWorkspaceClientId as string | undefined;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Autorizacao: staff interno OU cliente atribuido a este documento
  const isStaff = role === "ADMIN" || role === "MANAGER" || role === "CONSULTANT";
  const isAssignedClient = role === "GUEST_CLIENT" && doc.clientId && doc.clientId === userAssignedClientId;
  if (!isStaff && !isAssignedClient) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Redireciona para o externalUrl se e externo (ex: Invoice Ninja)
  if (doc.externalUrl && !doc.filePath) {
    return NextResponse.redirect(doc.externalUrl);
  }

  if (!doc.filePath) {
    return NextResponse.json({ error: "Documento sem ficheiro local" }, { status: 404 });
  }

  try {
    const buffer = await fs.readFile(doc.filePath);
    const downloadName = (doc.title || "documento").replace(/[^a-zA-Z0-9._-]/g, "_") + (doc.filePath.endsWith(".docx") ? ".docx" : doc.filePath.endsWith(".pdf") ? ".pdf" : "");
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": doc.fileMime ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${downloadName}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err) {
    console.error(`[documents/download] failed to read ${doc.filePath}:`, err);
    return NextResponse.json({ error: "Ficheiro nao encontrado no servidor" }, { status: 404 });
  }
}
