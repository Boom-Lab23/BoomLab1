import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor config — BoomLab Comunicação (clientes)
// App que aponta para https://comunicacao.boomlab.cloud
//
// Build:
//   cp capacitor.config.comunicacao.ts capacitor.config.ts
//   npx cap sync android
//   npx cap open android  # abre Android Studio

const config: CapacitorConfig = {
  appId: "agency.boomlab.comunicacao",
  appName: "BoomLab Comunicação",
  webDir: "public",
  server: {
    url: "https://comunicacao.boomlab.cloud",
    allowNavigation: [
      "comunicacao.boomlab.cloud",
      "servico.boomlab.cloud",  // uploads e links internos podem apontar para aqui
      "accounts.google.com",
      "*.google.com",
      "*.googleusercontent.com",
    ],
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#2D76FC",
  },
};

export default config;
