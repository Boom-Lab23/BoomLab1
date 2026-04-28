import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const UPLOADS_BASE = process.env.UPLOADS_BASE ?? "/app/uploads";
const CALL_AUDIO_DIR = path.join(UPLOADS_BASE, "call-audio");

const ALLOWED_MIMES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/m4a",
  "audio/mp4",
  "audio/x-m4a",
  "audio/ogg",
  "audio/webm",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Falta o ficheiro." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `Ficheiro maior que ${MAX_BYTES / 1024 / 1024} MB.` }, { status: 400 });
    }
    if (!ALLOWED_MIMES.has(file.type)) {
      return NextResponse.json({ error: `Tipo nao suportado: ${file.type}` }, { status: 400 });
    }

    await mkdir(CALL_AUDIO_DIR, { recursive: true });

    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const cuid = randomBytes(16).toString("hex");
    const filename = `${cuid}.${ext}`;
    const filepath = path.join(CALL_AUDIO_DIR, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    // Public URL: o /api/uploads/call-audio/[filename] serve o ficheiro
    const baseUrl = process.env.NEXTAUTH_URL ?? "https://servico.boomlab.cloud";
    const publicUrl = `${baseUrl}/api/uploads/call-audio/${filename}`;

    return NextResponse.json({
      success: true,
      filename,
      publicUrl,
      sizeBytes: file.size,
      mimeType: file.type,
    });
  } catch (err) {
    console.error("[uploads/call-audio] failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
