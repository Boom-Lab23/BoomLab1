// Generate PNG icons for Comunicação variant from SVG master
// Usage: node docker/generate-comm-icons.mjs
import sharp from "sharp";
import { readFile, writeFile } from "fs/promises";
import path from "path";

const ICONS_DIR = path.resolve("public", "icons");
const MASTER = path.join(ICONS_DIR, "comm.svg");

async function main() {
  const svg = await readFile(MASTER);

  const outputs = [
    { name: "comm-192.png", size: 192 },
    { name: "comm-512.png", size: 512 },
    { name: "comm-maskable-512.png", size: 512, padding: 0.1 },
    { name: "comm-apple-180.png", size: 180 },
  ];

  for (const o of outputs) {
    let pipeline = sharp(svg).resize(o.size, o.size);
    if (o.padding) {
      const inner = Math.round(o.size * (1 - o.padding * 2));
      pipeline = sharp(svg)
        .resize(inner, inner)
        .extend({
          top: Math.round((o.size - inner) / 2),
          bottom: Math.round((o.size - inner) / 2),
          left: Math.round((o.size - inner) / 2),
          right: Math.round((o.size - inner) / 2),
          background: "#0f1419",
        });
    }
    const buf = await pipeline.png({ quality: 90 }).toBuffer();
    await writeFile(path.join(ICONS_DIR, o.name), buf);
    console.log(`OK ${o.name} (${o.size}x${o.size})`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
