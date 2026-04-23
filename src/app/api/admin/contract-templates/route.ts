import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { saveTemplate, listTemplates } from "@/server/services/contract-generator";

/**
 * GET  /api/admin/contract-templates   - list
 * POST /api/admin/contract-templates   - upload (multipart form: file + offer)
 */

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as Record<string, unknown>)?.role as string | undefined;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const [dbRows, files] = await Promise.all([
    prisma.contractTemplate.findMany({ orderBy: { offer: "asc" } }),
    listTemplates(),
  ]);

  return NextResponse.json({ templates: dbRows, filesOnDisk: files });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  const offer = form.get("offer");

  if (!(file instanceof File) || typeof offer !== "string") {
    return NextResponse.json({ error: "Missing file or offer" }, { status: 400 });
  }
  if (!file.name.endsWith(".docx")) {
    return NextResponse.json({ error: "So ficheiros .docx sao suportados" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `template-${offer.toLowerCase().replace(/[^a-z0-9]/g, "-")}.docx`;
  await saveTemplate(buffer, filename);

  // Deteca placeholders {xxx} no texto raw (best-effort)
  const text = buffer.toString("utf-8");
  const variables = Array.from(new Set((text.match(/\{([a-zA-Z0-9_]+)\}/g) ?? []).map((m) => m.slice(1, -1))));

  const row = await prisma.contractTemplate.upsert({
    where: { offer },
    create: {
      offer,
      filename,
      displayName: file.name,
      variables,
    },
    update: {
      filename,
      displayName: file.name,
      variables,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true, template: row });
}
