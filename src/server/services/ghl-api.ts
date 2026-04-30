/**
 * Cliente para a API v2 do GoHighLevel (LeadConnector).
 * Usa token de Private Integration (scope: location).
 */

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

function getAuth() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey) throw new Error("GHL_API_KEY nao configurado");
  if (!locationId) throw new Error("GHL_LOCATION_ID nao configurado");
  return { apiKey, locationId };
}

async function ghlFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiKey } = getAuth();
  const res = await fetch(`${GHL_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: GHL_VERSION,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL API ${res.status} ${path}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// ===== Contacts =====

export type GhlContact = {
  id: string;
  locationId: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  address1?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  dateOfBirth?: string;
  tags?: string[];
  customFields?: Array<{ id: string; value?: string | number | null; fieldValue?: unknown; fieldKey?: string }>;
};

export async function getContact(contactId: string): Promise<GhlContact> {
  const data = await ghlFetch<{ contact: GhlContact }>(`/contacts/${contactId}`);
  return data.contact;
}

// ===== Custom Fields metadata =====

export type GhlCustomFieldDef = {
  id: string;
  name: string;
  fieldKey: string;
  dataType: string; // TEXT, NUMERICAL, DATE, DROPDOWN, etc.
  placeholder?: string;
  position?: number;
  model?: string; // "contact" | "opportunity"
};

export async function listCustomFields(model: "contact" | "opportunity" = "contact"): Promise<GhlCustomFieldDef[]> {
  const { locationId } = getAuth();
  const data = await ghlFetch<{ customFields: GhlCustomFieldDef[] }>(
    `/locations/${locationId}/customFields?model=${model}`
  );
  return data.customFields ?? [];
}

// ===== Pipelines =====

export type GhlPipeline = {
  id: string;
  name: string;
  stages?: Array<{ id: string; name: string; position?: number }>;
};

export async function listPipelines(): Promise<GhlPipeline[]> {
  const { locationId } = getAuth();
  const data = await ghlFetch<{ pipelines: GhlPipeline[] }>(
    `/opportunities/pipelines?locationId=${locationId}`
  );
  return data.pipelines ?? [];
}

// ===== Opportunities =====

export type GhlOpportunity = {
  id: string;
  name?: string;
  monetaryValue?: number;
  pipelineId?: string;
  pipelineStageId?: string;
  contactId?: string;
  status?: string;
  customFields?: Array<{ id: string; fieldKey?: string; key?: string; value?: unknown; fieldValue?: unknown }>;
};

export async function getOpportunity(opportunityId: string): Promise<GhlOpportunity> {
  const data = await ghlFetch<{ opportunity: GhlOpportunity }>(`/opportunities/${opportunityId}`);
  return data.opportunity;
}

// ===== Helper: mapear custom fields para objecto plano name -> value =====

/**
 * Dado um contact e a lista de definicoes de custom fields, produz um objecto
 * { "NIF": "123456789", "Morada": "...", "IBAN": "PT50..." } usando o nome (name)
 * do campo como chave. Se o mesmo nome aparecer em dois fields, o ultimo vence.
 */
// IMPORTANTE: a API GHL devolve custom fields como { id, fieldValue } (nao
// { id, value }). Lemos ambos para tolerar formatos diferentes.
function readCfValue(cf: { value?: unknown; fieldValue?: unknown }): string | null {
  const raw = cf.fieldValue ?? cf.value;
  if (raw == null) return null;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.join(", ");
  return String(raw);
}

export function flattenCustomFields(
  contact: GhlContact,
  defs: GhlCustomFieldDef[]
): Record<string, string> {
  const byId = new Map(defs.map((d) => [d.id, d]));
  const out: Record<string, string> = {};
  for (const cf of contact.customFields ?? []) {
    const def = byId.get(cf.id);
    const key = def?.name ?? cf.fieldKey ?? cf.id;
    const val = readCfValue(cf as { value?: unknown; fieldValue?: unknown });
    if (val !== null && val !== "") out[key] = val;
  }
  return out;
}

/**
 * Usa fieldKey em vez de name (mais estavel a renames).
 */
export function flattenCustomFieldsByKey(
  contact: GhlContact,
  defs: GhlCustomFieldDef[]
): Record<string, string> {
  const byId = new Map(defs.map((d) => [d.id, d]));
  const out: Record<string, string> = {};
  for (const cf of contact.customFields ?? []) {
    const def = byId.get(cf.id);
    const key = def?.fieldKey ?? def?.name ?? cf.fieldKey ?? cf.id;
    const val = readCfValue(cf as { value?: unknown; fieldValue?: unknown });
    if (val !== null && val !== "") out[key] = val;
  }
  return out;
}
