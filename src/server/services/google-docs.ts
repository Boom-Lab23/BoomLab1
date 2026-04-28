import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  );
}

async function getDriveClient(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });

  if (!account?.access_token) {
    throw new Error("Utilizador sem conta Google ligada.");
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
  });

  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await prisma.account.update({
        where: { id: account.id },
        data: {
          access_token: tokens.access_token,
          expires_at: tokens.expiry_date
            ? Math.floor(tokens.expiry_date / 1000)
            : undefined,
        },
      });
    }
  });

  return {
    drive: google.drive({ version: "v3", auth: oauth2Client }),
    docs: google.docs({ version: "v1", auth: oauth2Client }),
  };
}

type GoogleDocInfo = {
  id: string;
  title: string;
  url: string;
  modifiedTime: Date;
  thumbnailLink: string | null;
};

// List Google Docs from Drive
export async function listGoogleDocs(
  userId: string,
  query?: string
): Promise<GoogleDocInfo[]> {
  const { drive } = await getDriveClient(userId);

  let q = "mimeType='application/vnd.google-apps.document' and trashed=false";
  if (query) {
    q += ` and name contains '${query.replace(/'/g, "\\'")}'`;
  }

  const res = await drive.files.list({
    q,
    fields: "files(id,name,webViewLink,modifiedTime,thumbnailLink)",
    orderBy: "modifiedTime desc",
    pageSize: 50,
  });

  return (res.data.files ?? []).map((file) => ({
    id: file.id ?? "",
    title: file.name ?? "Sem titulo",
    url: file.webViewLink ?? `https://docs.google.com/document/d/${file.id}`,
    modifiedTime: new Date(file.modifiedTime ?? ""),
    thumbnailLink: file.thumbnailLink ?? null,
  }));
}

// Get content of a Google Doc (plain text)
export async function getDocContent(
  userId: string,
  documentId: string
): Promise<string> {
  const { docs } = await getDriveClient(userId);

  const doc = await docs.documents.get({ documentId });
  const content = doc.data.body?.content ?? [];

  let text = "";
  for (const element of content) {
    if (element.paragraph) {
      for (const elem of element.paragraph.elements ?? []) {
        text += elem.textRun?.content ?? "";
      }
    }
  }

  return text;
}

// Extrai o ID dum URL Google (Docs, Sheets, Slides, Drive file).
export function extractGoogleFileId(url: string): string | null {
  if (!url) return null;
  // /d/<ID>/  format (docs/sheets/slides) ou /file/d/<ID>/
  const m = url.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m) return m[1];
  // ?id=<ID>  format
  const q = url.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (q) return q[1];
  return null;
}

// Fetch content de qualquer Google Workspace doc (Docs/Sheets/Slides) ou
// PDF/DOCX nativo armazenado no Drive. Usa export plain-text via Drive API.
// Retorna texto + tipo detectado. Lança erro se nao acessivel.
export async function fetchDriveFileContent(
  userId: string,
  fileId: string
): Promise<{ text: string; mimeType: string; title: string; modifiedTime: Date }> {
  const { drive } = await getDriveClient(userId);

  const meta = await drive.files.get({
    fileId,
    fields: "id,name,mimeType,modifiedTime",
    supportsAllDrives: true,
  });
  const mime = meta.data.mimeType ?? "";
  const title = meta.data.name ?? "";
  const modifiedTime = new Date(meta.data.modifiedTime ?? Date.now());

  let text = "";

  if (mime.startsWith("application/vnd.google-apps.")) {
    // Google Workspace doc: Docs/Sheets/Slides — usar Drive export to text/plain
    const exportMime = mime === "application/vnd.google-apps.spreadsheet" ? "text/csv" : "text/plain";
    const res = await drive.files.export(
      { fileId, mimeType: exportMime },
      { responseType: "text" }
    );
    text = String(res.data ?? "");
  } else if (mime === "application/pdf" || mime.includes("officedocument") || mime === "text/plain") {
    // PDF/DOCX/TXT: download direct e retorna o texto best-effort.
    // Para PDF/DOCX o cliente UI normalmente passa o conteudo em texto manualmente — aqui
    // apenas retornamos meta + texto vazio para avisar que e estatico.
    text = "";
  }

  return { text, mimeType: mime, title, modifiedTime };
}

// Link a Google Doc to a client/session in the platform
export async function linkGoogleDoc(
  userId: string,
  documentId: string,
  pillar: string,
  clientId?: string,
  sessionId?: string
): Promise<void> {
  const { drive } = await getDriveClient(userId);

  const file = await drive.files.get({
    fileId: documentId,
    fields: "id,name,webViewLink,modifiedTime",
  });

  await prisma.document.upsert({
    where: { googleDocsId: documentId },
    update: {
      title: file.data.name ?? "Sem titulo",
      googleDocsUrl: file.data.webViewLink ?? null,
      lastSyncedAt: new Date(),
    },
    create: {
      title: file.data.name ?? "Sem titulo",
      pillar,
      googleDocsId: documentId,
      googleDocsUrl: file.data.webViewLink ?? null,
      clientId,
      sessionId,
      lastSyncedAt: new Date(),
    },
  });
}

// Sync all linked Google Docs (update titles and last modified)
export async function syncLinkedDocs(userId: string): Promise<{
  synced: number;
  errors: string[];
}> {
  const linkedDocs = await prisma.document.findMany({
    where: { googleDocsId: { not: null } },
  });

  const { drive } = await getDriveClient(userId);
  let synced = 0;
  const errors: string[] = [];

  for (const doc of linkedDocs) {
    try {
      const file = await drive.files.get({
        fileId: doc.googleDocsId!,
        fields: "id,name,webViewLink,modifiedTime",
      });

      await prisma.document.update({
        where: { id: doc.id },
        data: {
          title: file.data.name ?? doc.title,
          googleDocsUrl: file.data.webViewLink ?? doc.googleDocsUrl,
          lastSyncedAt: new Date(),
        },
      });
      synced++;
    } catch (err) {
      errors.push(`Doc ${doc.googleDocsId}: ${String(err)}`);
    }
  }

  return { synced, errors };
}
