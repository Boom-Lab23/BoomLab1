import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

const UPLOADS_BASE = process.env.UPLOADS_BASE ?? "/app/uploads";
const CALL_AUDIO_DIR = path.join(UPLOADS_BASE, "call-audio");

export const runtime = "nodejs";

const MIME_BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  webm: "audio/webm",
  mp4: "video/mp4",
  mov: "video/quicktime",
};

// Serve ficheiros guardados em /app/uploads/call-audio/. Endpoint publico
// (sem autenticacao) porque o Fireflies precisa de fazer fetch para
// processar a transcricao. Filenames sao CUIDs nao-adivinhaveis (16 bytes
// hex = 128 bits de entropia), por isso URLs nao listadas sao opacas.
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await context.params;
    // Sanitize: nada de path traversal
    if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(filename)) {
      return NextResponse.json({ error: "Filename invalido" }, { status: 400 });
    }
    const filepath = path.join(CALL_AUDIO_DIR, filename);
    const meta = await stat(filepath).catch(() => null);
    if (!meta || !meta.isFile()) {
      return NextResponse.json({ error: "Nao encontrado" }, { status: 404 });
    }
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
    const buffer = await readFile(filepath);
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(meta.size),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[uploads/call-audio GET] failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
