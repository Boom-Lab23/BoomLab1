// Gera assets para Google Play Store
// - Icone 512x512 (reuso dos ja existentes)
// - Feature graphic 1024x500 (banner Play Store)
// Usage: node docker/generate-play-store-assets.mjs

import sharp from "sharp";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const OUTPUT_DIR = "play-store-assets";

const VARIANTS = [
  {
    name: "platform",
    iconSrc: "public/icons/icon.svg",
    icon512: "public/icons/icon-512.png",
    bgColor: "#0f1419",
    accentColor: "#2D76FC",
    title: "BoomLab Platform",
    subtitle: "Gestao de servico para a equipa",
  },
  {
    name: "comunicacao",
    iconSrc: "public/icons/comm.svg",
    icon512: "public/icons/comm-512.png",
    bgColor: "#2D76FC",
    accentColor: "#ffffff",
    title: "BoomLab Comunicacao",
    subtitle: "Portal de clientes BoomLab",
  },
];

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

async function generate(variant) {
  const variantDir = path.join(OUTPUT_DIR, variant.name);
  await ensureDir(variantDir);

  // 1. Icone 512x512 - copiar do existente
  const icon512 = await readFile(variant.icon512);
  await writeFile(path.join(variantDir, "icon-512.png"), icon512);
  console.log(`  OK icon-512.png`);

  // 2. Feature graphic 1024x500
  const fgWidth = 1024;
  const fgHeight = 500;

  // SVG do feature graphic com logo + titulo + subtitulo
  const titleColor = variant.name === "comunicacao" ? "#ffffff" : "#ffffff";
  const subtitleColor = variant.name === "comunicacao" ? "#dbeafe" : "#94a3b8";
  const bg = variant.bgColor;

  // Escala o icone SVG para 200x200 e coloca centrado na zona esquerda
  const iconPng = await sharp(await readFile(variant.iconSrc))
    .resize(200, 200)
    .png()
    .toBuffer();

  const featureSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${fgWidth}" height="${fgHeight}">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bg}" />
        <stop offset="100%" stop-color="${variant.name === 'comunicacao' ? '#2563EB' : '#1e293b'}" />
      </linearGradient>
    </defs>
    <rect width="${fgWidth}" height="${fgHeight}" fill="url(#grad)" />
    <text x="400" y="220" font-family="Arial, sans-serif" font-size="60" font-weight="bold" fill="${titleColor}">
      ${variant.title}
    </text>
    <text x="400" y="280" font-family="Arial, sans-serif" font-size="28" fill="${subtitleColor}">
      ${variant.subtitle}
    </text>
    <text x="400" y="340" font-family="Arial, sans-serif" font-size="20" fill="${subtitleColor}" opacity="0.7">
      boomlab.agency
    </text>
  </svg>`;

  const featureBase = await sharp(Buffer.from(featureSvg)).png().toBuffer();

  // Compor com o icone
  const featureGraphic = await sharp(featureBase)
    .composite([{ input: iconPng, left: 140, top: 150 }])
    .png()
    .toBuffer();

  await writeFile(path.join(variantDir, "feature-graphic-1024x500.png"), featureGraphic);
  console.log(`  OK feature-graphic-1024x500.png`);

  console.log(`\n   Pasta: ${variantDir}/`);
}

async function main() {
  console.log("\n🎨 Generating Play Store assets\n");

  for (const variant of VARIANTS) {
    console.log(`📦 ${variant.title}`);
    await generate(variant);
    console.log("");
  }

  console.log("✅ Done! Assets em play-store-assets/\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
