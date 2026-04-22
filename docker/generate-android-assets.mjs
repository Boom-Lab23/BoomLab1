// Gera todos os icones e splash screens Android para Capacitor
// Usage: node docker/generate-android-assets.mjs [platform|comunicacao]

import sharp from "sharp";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const variant = process.argv[2] === "comunicacao" ? "comunicacao" : "platform";
const iconSrc = variant === "comunicacao" ? "public/icons/comm.svg" : "public/icons/icon.svg";
const bgColor = variant === "comunicacao" ? "#2D76FC" : "#0f1419";

const MIPMAP_SIZES = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

const SPLASH_SIZES = {
  // Portrait
  "drawable-port-mdpi": { w: 320, h: 480 },
  "drawable-port-hdpi": { w: 480, h: 800 },
  "drawable-port-xhdpi": { w: 720, h: 1280 },
  "drawable-port-xxhdpi": { w: 960, h: 1600 },
  "drawable-port-xxxhdpi": { w: 1280, h: 1920 },
  // Landscape
  "drawable-land-mdpi": { w: 480, h: 320 },
  "drawable-land-hdpi": { w: 800, h: 480 },
  "drawable-land-xhdpi": { w: 1280, h: 720 },
  "drawable-land-xxhdpi": { w: 1600, h: 960 },
  "drawable-land-xxxhdpi": { w: 1920, h: 1280 },
};

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

async function main() {
  const svg = await readFile(iconSrc);
  const base = "android/app/src/main/res";

  console.log(`\n🔨 Generating Android assets for variant: ${variant}`);
  console.log(`   Icon source: ${iconSrc}`);
  console.log(`   Background:  ${bgColor}\n`);

  // Legacy mipmap icons (square)
  for (const [density, size] of Object.entries(MIPMAP_SIZES)) {
    const dir = path.join(base, `mipmap-${density}`);
    await ensureDir(dir);

    const icon = await sharp(svg).resize(size, size).png().toBuffer();
    await writeFile(path.join(dir, "ic_launcher.png"), icon);
    await writeFile(path.join(dir, "ic_launcher_round.png"), icon);
    await writeFile(path.join(dir, "ic_launcher_foreground.png"), icon);
    console.log(`✓ mipmap-${density}/ic_launcher*.png (${size}×${size})`);
  }

  // Adaptive icon (Android 8+): foreground layer
  // O foreground deve ter padding de ~33% (safe zone)
  const ADAPTIVE_SIZE = 432;
  const FOREGROUND_PADDING = 0.25; // 25% padding
  const innerSize = Math.round(ADAPTIVE_SIZE * (1 - FOREGROUND_PADDING * 2));

  for (const density of ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]) {
    const scale = MIPMAP_SIZES[density] / 48;  // mdpi is 1x
    const targetSize = Math.round(108 * scale);
    const targetInner = Math.round(targetSize * (1 - FOREGROUND_PADDING * 2));

    const fg = await sharp(svg)
      .resize(targetInner, targetInner)
      .extend({
        top: Math.round((targetSize - targetInner) / 2),
        bottom: Math.round((targetSize - targetInner) / 2),
        left: Math.round((targetSize - targetInner) / 2),
        right: Math.round((targetSize - targetInner) / 2),
        background: { r: 0, g: 0, b: 0, alpha: 0 },  // transparent
      })
      .png()
      .toBuffer();

    const dir = path.join(base, `mipmap-${density}`);
    await writeFile(path.join(dir, "ic_launcher_foreground.png"), fg);
  }

  // Splash screens (use o icone centrado sobre bg color)
  for (const [folder, dims] of Object.entries(SPLASH_SIZES)) {
    const dir = path.join(base, folder);
    await ensureDir(dir);

    const iconSize = Math.min(dims.w, dims.h) * 0.3;
    const iconBuf = await sharp(svg).resize(Math.round(iconSize), Math.round(iconSize)).png().toBuffer();

    const splash = await sharp({
      create: {
        width: dims.w,
        height: dims.h,
        channels: 4,
        background: bgColor,
      },
    })
      .composite([{ input: iconBuf, gravity: "center" }])
      .png()
      .toBuffer();

    await writeFile(path.join(dir, "splash.png"), splash);
    console.log(`✓ ${folder}/splash.png (${dims.w}×${dims.h})`);
  }

  // colors.xml - SEM ic_launcher_background (conflito com o ficheiro que vem
  // do template do Capacitor em values/ic_launcher_background.xml)
  const valuesDir = path.join(base, "values");
  await ensureDir(valuesDir);
  const colorsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#2D76FC</color>
    <color name="colorPrimaryDark">#2563EB</color>
    <color name="colorAccent">#2D76FC</color>
</resources>
`;
  await writeFile(path.join(valuesDir, "colors.xml"), colorsXml);
  console.log(`✓ values/colors.xml`);

  // Sobrepor o ic_launcher_background existente do Capacitor com a cor certa
  const launcherBgPath = path.join(valuesDir, "ic_launcher_background.xml");
  const launcherBgXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${bgColor}</color>
</resources>
`;
  await writeFile(launcherBgPath, launcherBgXml);
  console.log(`✓ values/ic_launcher_background.xml (bg=${bgColor})`);

  console.log(`\n✅ Android assets generated for ${variant}\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });
