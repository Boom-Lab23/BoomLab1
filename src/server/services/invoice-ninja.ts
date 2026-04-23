/**
 * Invoice Ninja v5 API client (self-hosted).
 * Docs: https://api-docs.invoiceninja.com/
 *
 * ENV:
 *   INVOICE_NINJA_URL - ex: https://invoicing.boomlab.cloud
 *   INVOICE_NINJA_TOKEN - X-API-TOKEN (criado em Settings > API Tokens)
 */

function getAuth() {
  const url = process.env.INVOICE_NINJA_URL?.replace(/\/$/, "");
  const token = process.env.INVOICE_NINJA_TOKEN;
  if (!url || !token) {
    throw new Error("INVOICE_NINJA_URL ou INVOICE_NINJA_TOKEN nao configurados no .env.production");
  }
  return { url, token };
}

async function inFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, token } = getAuth();
  const res = await fetch(`${url}/api/v1${path}`, {
    ...init,
    headers: {
      "X-API-TOKEN": token,
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`InvoiceNinja ${res.status} ${path}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// ===== Clients =====

export type InClient = {
  id: string;
  name: string;
  display_name?: string;
  number?: string;
};

export type InClientInput = {
  name: string;
  contacts?: Array<{ first_name?: string; last_name?: string; email?: string; phone?: string }>;
  address1?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country_id?: string;
  vat_number?: string; // NIF
  id_number?: string;  // CC/BI
  phone?: string;
  website?: string;
  private_notes?: string;
};

export async function upsertInvoiceNinjaClient(input: InClientInput & { email?: string }): Promise<InClient> {
  // Procura por email primeiro
  if (input.email) {
    try {
      const existing = await inFetch<{ data: InClient[] }>(
        `/clients?email=${encodeURIComponent(input.email)}&per_page=1`
      );
      if (existing.data && existing.data.length > 0) {
        return existing.data[0];
      }
    } catch (err) {
      // Se endpoint de search por email nao suporta, continua
      console.warn("[invoice-ninja] client search failed:", err);
    }
  }

  // Cria novo
  const body: Record<string, unknown> = { ...input };
  if (input.email && !body.contacts) {
    body.contacts = [{ email: input.email }];
  }
  delete (body as { email?: string }).email;

  const created = await inFetch<{ data: InClient }>("/clients", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return created.data;
}

// ===== Invoices =====

export type InInvoiceLine = {
  product_key?: string;
  notes?: string;
  cost: number;        // preco unitario
  quantity: number;
  tax_name1?: string;
  tax_rate1?: number;  // ex: 23 para IVA 23%
};

export type InInvoiceInput = {
  client_id: string;
  po_number?: string;
  date?: string;            // YYYY-MM-DD
  due_date?: string;
  terms?: string;
  public_notes?: string;
  private_notes?: string;
  line_items: InInvoiceLine[];
  discount?: number;
  is_amount_discount?: boolean;
};

export type InInvoice = {
  id: string;
  number: string;
  status_id: string;
  amount: number;
  balance: number;
};

/**
 * Cria invoice em rascunho (status_id=1 = draft).
 * Devolve objecto invoice.
 */
export async function createDraftInvoice(input: InInvoiceInput): Promise<InInvoice> {
  const created = await inFetch<{ data: InInvoice }>("/invoices", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return created.data;
}

/**
 * Helper: cria cliente + invoice em um so call flow. Devolve IDs.
 */
export async function createInvoiceForClient(args: {
  client: InClientInput & { email?: string };
  lines: InInvoiceLine[];
  date?: string;
  dueDate?: string;
  publicNotes?: string;
  privateNotes?: string;
}): Promise<{ clientId: string; invoiceId: string; invoiceNumber: string }> {
  const client = await upsertInvoiceNinjaClient(args.client);
  const invoice = await createDraftInvoice({
    client_id: client.id,
    line_items: args.lines,
    date: args.date,
    due_date: args.dueDate,
    public_notes: args.publicNotes,
    private_notes: args.privateNotes,
  });
  return { clientId: client.id, invoiceId: invoice.id, invoiceNumber: invoice.number };
}
