/**
 * Geracao de contrato a partir de template DOCX.
 *
 * Usamos docxtemplater: o template e um .docx onde inseres placeholders
 * tipo {nome}, {nif}, {morada}, {valor_contrato}, {data_inicio} etc.
 * O docxtemplater substitui e devolve buffer DOCX.
 *
 * Os templates ficam em /templates/contracts/ (upload via admin).
 * O ficheiro fisico e guardado em /opt/boomlab/data/contract-templates/
 * (volume Docker persistente) - configurado via env CONTRACT_TEMPLATES_DIR.
 */

import fs from "fs/promises";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

export const TEMPLATES_DIR = process.env.CONTRACT_TEMPLATES_DIR ?? "/tmp/boomlab-contract-templates";

export async function ensureTemplatesDir(): Promise<string> {
  await fs.mkdir(TEMPLATES_DIR, { recursive: true });
  return TEMPLATES_DIR;
}

export async function saveTemplate(buffer: Buffer, filename: string): Promise<string> {
  await ensureTemplatesDir();
  const dest = path.join(TEMPLATES_DIR, filename);
  await fs.writeFile(dest, buffer);
  return dest;
}

export async function readTemplate(filename: string): Promise<Buffer> {
  const src = path.join(TEMPLATES_DIR, filename);
  return fs.readFile(src);
}

export async function listTemplates(): Promise<string[]> {
  try {
    await ensureTemplatesDir();
    const files = await fs.readdir(TEMPLATES_DIR);
    return files.filter((f) => f.endsWith(".docx"));
  } catch {
    return [];
  }
}

/**
 * Gera contrato DOCX a partir de template + variaveis.
 * Exemplo no template: "O cliente {nome_fiscal}, com NIF {nif}..."
 * variables = { nome_fiscal: "BoomLab Lda", nif: "515..." }
 */
export async function generateContract(
  templateFilename: string,
  variables: Record<string, string | number | null | undefined>
): Promise<Buffer> {
  const templateBuffer = await readTemplate(templateFilename);
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "", // se variavel nao existir, usa vazio em vez de erro
  });

  // Normaliza valores para strings
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(variables)) {
    data[k] = v == null ? "" : String(v);
  }

  doc.render(data);
  const buf = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
  return buf;
}
