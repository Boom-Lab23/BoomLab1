import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
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
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Workspace",
        short_name: "Workspace",
        description: "Abrir workspace",
        url: "/workspace",
      },
      {
        name: "Mensagens",
        short_name: "Mensagens",
        description: "Canais de mensagens",
        url: "/messaging",
      },
    ],
  };
}
