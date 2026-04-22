import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor config — BoomLab Platform (equipa)
// App que aponta para https://servico.boomlab.cloud
//
// Build:
//   cp capacitor.config.platform.ts capacitor.config.ts
//   npx cap sync android
//   npx cap open android  # abre Android Studio
//
// AppId deve coincidir com o que está no Google Play Console.

const config: CapacitorConfig = {
  appId: "agency.boomlab.platform",
  appName: "BoomLab Platform",
  webDir: "public",  // dummy - usamos server.url em vez disto
  server: {
    // A app nativa carrega directamente o nosso site hosted
    url: "https://servico.boomlab.cloud",
    // allowNavigation permite navegar apenas entre estes dominios
    allowNavigation: [
      "servico.boomlab.cloud",
      "*.servico.boomlab.cloud",
      "accounts.google.com",  // OAuth
      "*.google.com",
      "*.googleusercontent.com",
    ],
    // Sem "cleartext" -> força HTTPS (mais seguro)
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    // Força tema escuro na status bar (combina com dark UI)
    backgroundColor: "#0f1419",
  },
};

export default config;
