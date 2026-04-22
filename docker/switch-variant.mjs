// Alterna entre variantes da app Android (platform ↔ comunicacao)
// Faz o que precisa para cada uma funcionar:
//  1. Copia capacitor.config.<variant>.ts -> capacitor.config.ts
//  2. Corre cap sync android
//  3. Gera icones e splashes correspondentes
//  4. Actualiza strings.xml (app_name)
//  5. Actualiza colors.xml (background)
//
// Usage:
//   node docker/switch-variant.mjs platform
//   node docker/switch-variant.mjs comunicacao

import { readFile, writeFile, copyFile, mkdir } from "fs/promises";
import { execSync } from "child_process";
import path from "path";

const variant = process.argv[2];
if (!variant || !["platform", "comunicacao"].includes(variant)) {
  console.error("Uso: node docker/switch-variant.mjs [platform|comunicacao]");
  process.exit(1);
}

const APP_NAMES = {
  platform: "BoomLab Platform",
  comunicacao: "BoomLab Comunicação",
};

const MAIN_ACTIVITY_TITLES = {
  platform: "BoomLab",
  comunicacao: "BoomLab",
};

async function main() {
  console.log(`\n🔄 Switching to variant: ${variant}\n`);

  // 1. Copy capacitor config
  await copyFile(`capacitor.config.${variant}.ts`, "capacitor.config.ts");
  console.log(`✓ capacitor.config.ts <- capacitor.config.${variant}.ts`);

  // 2. Sync
  console.log("→ npx cap sync android");
  execSync("npx cap sync android", { stdio: "inherit" });

  // 3. Generate icons + splashes
  console.log(`→ node docker/generate-android-assets.mjs ${variant}`);
  execSync(`node docker/generate-android-assets.mjs ${variant}`, { stdio: "inherit" });

  // 4. Update strings.xml
  const valuesDir = "android/app/src/main/res/values";
  await mkdir(valuesDir, { recursive: true });
  const stringsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${APP_NAMES[variant]}</string>
    <string name="title_activity_main">${MAIN_ACTIVITY_TITLES[variant]}</string>
    <string name="package_name">${variant === "platform" ? "agency.boomlab.platform" : "agency.boomlab.comunicacao"}</string>
    <string name="custom_url_scheme">${variant === "platform" ? "agency.boomlab.platform" : "agency.boomlab.comunicacao"}</string>
</resources>
`;
  await writeFile(path.join(valuesDir, "strings.xml"), stringsXml);
  console.log(`✓ values/strings.xml (app_name: "${APP_NAMES[variant]}")`);

  console.log(`\n✅ Ready for ${variant}. Next steps:`);
  console.log(`   npx cap open android        # abre Android Studio`);
  console.log(`   ou`);
  console.log(`   cd android && ./gradlew bundleRelease  # gera AAB`);
  console.log();
}

main().catch((err) => { console.error(err); process.exit(1); });
