import { NextResponse } from "next/server";
import { headers } from "next/headers";

// Dynamic manifest - detects hostname and returns branded manifest
// Two variants:
//   - servico.boomlab.cloud     -> "BoomLab Platform" (equipa BoomLab)
//   - comunicacao.boomlab.cloud -> "BoomLab Comunicação" (clientes)
//   - qualquer outro            -> default "BoomLab Platform"

export const dynamic = "force-dynamic";

export async function GET() {
  const hdrs = await headers();
  const host = (hdrs.get("host") || "").toLowerCase();
  // Aceita comunicacao.boomlab.cloud OU comunicacao.boomlab.agency
  const isComunicacao = host.includes("comunicacao");

  const manifest = isComunicacao
    ? {
        name: "BoomLab Comunicação",
        short_name: "BoomLab",
        description: "Comunicação e acompanhamento do teu projeto com a BoomLab Agency",
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0f1419",
        theme_color: "#2D76FC",
        lang: "pt-PT",
        scope: "/",
        categories: ["business", "communication"],
        icons: [
          { src: "/icons/comm-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/comm-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/comm-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Mensagens", short_name: "Mensagens", description: "Falar com a BoomLab", url: "/messaging" },
          { name: "Workspace", short_name: "Workspace", description: "Ver o meu projeto", url: "/workspace" },
        ],
      }
    : {
        name: "BoomLab Platform",
        short_name: "BoomLab",
        description: "Plataforma de gestão de serviço da BoomLab Agency",
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#101112",
        theme_color: "#2D76FC",
        lang: "pt-PT",
        scope: "/",
        categories: ["business", "productivity"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Workspace", short_name: "Workspace", description: "Abrir workspace", url: "/workspace" },
          { name: "Mensagens", short_name: "Mensagens", description: "Canais de mensagens", url: "/messaging" },
        ],
      };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
