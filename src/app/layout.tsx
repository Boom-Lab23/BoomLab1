import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { PWARegister } from "@/components/pwa-register";

const inter = Inter({ subsets: ["latin"] });

// Dynamic metadata based on hostname - branding diferente para clientes
export async function generateMetadata(): Promise<Metadata> {
  const hdrs = await headers();
  const host = (hdrs.get("host") || "").toLowerCase();
  const isComunicacao = host.includes("comunicacao");

  return {
    title: isComunicacao ? "BoomLab Comunicação" : "BoomLab Platform",
    description: isComunicacao
      ? "Comunicação e acompanhamento do teu projeto com a BoomLab Agency"
      : "Plataforma de gestão de serviço da BoomLab Agency",
    applicationName: isComunicacao ? "BoomLab Comunicação" : "BoomLab Platform",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: isComunicacao ? "BoomLab" : "BoomLab",
    },
    icons: {
      icon: isComunicacao
        ? [
            { url: "/icons/comm-192.png", sizes: "192x192", type: "image/png" },
          ]
        : [
            { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
            { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
            { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          ],
      apple: [
        {
          url: isComunicacao ? "/icons/comm-apple-180.png" : "/icons/apple-icon-180.png",
          sizes: "180x180",
          type: "image/png",
        },
      ],
    },
    // Pointer para o manifest dinâmico (mesma URL em ambos os casos — o route handler trata)
    manifest: "/manifest.webmanifest",
    formatDetection: {
      telephone: false,
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#101112" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
        <PWARegister />
      </body>
    </html>
  );
}
