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
 *
 * Suporta:
 *  - placeholders simples: "O cliente {nome_fiscal}, com NIF {nif}..."
 *  - loops Docxtemplater: "{#prestacoes}{numero}.a: {valor}€{/prestacoes}"
 *    onde 'prestacoes' e um array de objectos {numero, valor, ...}
 */
type ContractVarPrimitive = string | number | boolean | null | undefined;
type ContractVarValue =
  | ContractVarPrimitive
  | ContractVarPrimitive[]
  | Record<string, ContractVarPrimitive>[];

export async function generateContract(
  templateFilename: string,
  variables: Record<string, ContractVarValue>
): Promise<Buffer> {
  const templateBuffer = await readTemplate(templateFilename);
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "", // se variavel nao existir, usa vazio em vez de erro
  });

  // Normaliza valores: arrays e objectos passam tal-qual (para loops);
  // primitivos viram string para evitar render errors com numeros.
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(variables)) {
    if (v == null) {
      data[k] = "";
    } else if (Array.isArray(v)) {
      // Array de primitivos ou de objectos -> Docxtemplater itera com {#k}...{/k}
      data[k] = v.map((item) => {
        if (item == null) return "";
        if (typeof item === "object") {
          // normaliza valores do objecto para string
          const out: Record<string, string> = {};
          for (const [ik, iv] of Object.entries(item as Record<string, ContractVarPrimitive>)) {
            out[ik] = iv == null ? "" : String(iv);
          }
          return out;
        }
        return String(item);
      });
    } else if (typeof v === "object") {
      // Objecto plano (raro) - passa como-is
      data[k] = v;
    } else {
      data[k] = String(v);
    }
  }

  doc.render(data);
  const buf = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
  return buf;
}
