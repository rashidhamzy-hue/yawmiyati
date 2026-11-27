/**
 * Import of an owner-run Taager sync file (tools/taager/sync.js) into the private taager_catalog table.
 * The file is parsed in the owner's browser and sent in small chunks to owner-only RPCs.
 * Nothing here talks to Taager and no Taager credential is ever involved.
 */
import type { MarketCode } from "./markets";

export const TAAGER_COUNTRY: Record<MarketCode, string> = {
  sa: "SAU",
  ae: "ARE",
  om: "OMN",
  eg: "EGY",
  iq: "IRQ",
};
const NAME: Record<MarketCode, string> = {
  sa: "Saudi Arabia",
  ae: "the UAE",
  om: "Oman",
  eg: "Egypt",
  iq: "Iraq",
};

export type TaagerImportRow = {
  sku: string;
  product_id: number;
  variant_id: number | null;
  item_type: string | null;
  name: string | null;
  listing: Record<string, unknown>;
  detail: Record<string, unknown> | null;
  alternatives: unknown[] | null;
};
export type ParsedTaagerSync = {
  market: MarketCode;
  country: string;
  version: number | null;
  mode: "full" | "quick" | null;
  started_at: string | null;
  finished_at: string | null;
  rows: TaagerImportRow[];
  errors: unknown[];
  stats: {
    products: number;
    with_detail: number;
    bundles: number;
    with_alternatives: number;
    skipped: number;
  };
};
export type TaagerCatalogSummary = {
  skus: number;
  with_detail: number;
  bundles: number;
  price_changed_7d: number;
  missing_from_last_full_sync: number | null;
  last_sync: {
    id: string;
    completed_at: string;
    is_full: boolean;
    rows: number;
    listing_count: number;
    detail_count: number;
    errors: number;
  } | null;
};

const SKU = /^[A-Za-z0-9_-]{4,64}$/;
const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/** Parse and validate a sync file for one market. Throws a plain-language error the owner can act on. */
export function parseTaagerSync(text: string, market: MarketCode): ParsedTaagerSync {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw Error("This is not a Taager sync file (it is not valid JSON).");
  }
  if (!isObj(data) || data.source !== "taager-merchant-sync" || !Array.isArray(data.listing))
    throw Error(
      "This is not a Taager sync file. Use the file named taager-sync-<country>-<date>.json.",
    );
  const country = TAAGER_COUNTRY[market];
  const fileCountry = typeof data.country === "string" ? data.country : "";
  if (fileCountry !== country) {
    const other = (Object.keys(TAAGER_COUNTRY) as MarketCode[]).find(
      (m) => TAAGER_COUNTRY[m] === fileCountry,
    );
    throw Error(
      `This file is for ${other ? NAME[other] : fileCountry || "another country"}, not ${NAME[market]}. Switch the market above or pick the right file.`,
    );
  }
  const details = isObj(data.details) ? data.details : {};
  const alternatives = isObj(data.alternatives) ? data.alternatives : {};
  const bySku = new Map<string, TaagerImportRow>();
  let skipped = 0;
  for (const raw of data.listing as unknown[]) {
    if (!isObj(raw)) {
      skipped++;
      continue;
    }
    const sku = typeof raw.sku === "string" ? raw.sku.trim() : "";
    const pid =
      typeof raw.productId === "number" && Number.isSafeInteger(raw.productId) && raw.productId > 0
        ? raw.productId
        : null;
    if (!SKU.test(sku) || pid === null) {
      skipped++;
      continue;
    }
    const d = details[String(pid)];
    let detail: Record<string, unknown> | null = null;
    if (isObj(d)) {
      const { variants, ...product } = d;
      const variant = Array.isArray(variants)
        ? (variants.find((v) => isObj(v) && v.sku === sku) ?? null)
        : null;
      detail = {
        ...product,
        variant,
        variant_count: Array.isArray(variants) ? variants.length : 0,
      };
    }
    const a = alternatives[String(pid)];
    let alts: unknown[] | null = null;
    if (Array.isArray(a)) {
      const mine = a.find((x) => isObj(x) && x.sku === sku);
      alts =
        isObj(mine) && Array.isArray(mine.alternatives)
          ? mine.alternatives
          : a.every((x) => isObj(x) && "sku" in x)
            ? []
            : a;
    }
    bySku.set(sku, {
      sku,
      product_id: pid,
      variant_id:
        typeof raw.variantId === "number" && Number.isSafeInteger(raw.variantId)
          ? raw.variantId
          : null,
      item_type: typeof raw.type === "string" ? raw.type : null,
      name: typeof raw.name === "string" ? raw.name : null,
      listing: raw,
      detail,
      alternatives: alts,
    });
  }
  const rows = [...bySku.values()];
  const mode = data.mode === "full" || data.mode === "quick" ? data.mode : null;
  return {
    market,
    country,
    version: typeof data.version === "number" ? data.version : null,
    mode,
    started_at: typeof data.started_at === "string" ? data.started_at : null,
    finished_at: typeof data.finished_at === "string" ? data.finished_at : null,
    rows,
    errors: Array.isArray(data.errors) ? data.errors.slice(0, 500) : [],
    stats: {
      products: rows.length,
      with_detail: rows.filter((r) => r.detail).length,
      bundles: rows.filter((r) => r.item_type === "bundle").length,
      with_alternatives: rows.filter((r) => r.alternatives && r.alternatives.length).length,
      skipped,
    },
  };
}

/** Split rows into request-sized chunks (max 100 rows and ~1.2 MB each). */
export function chunkRows(
  rows: TaagerImportRow[],
  maxRows = 40,
  maxBytes = 1_200_000,
): TaagerImportRow[][] {
  const out: TaagerImportRow[][] = [];
  let cur: TaagerImportRow[] = [];
  let size = 0;
  for (const r of rows) {
    const s = JSON.stringify(r).length;
    if (cur.length && (cur.length >= Math.min(maxRows, 100) || size + s > maxBytes)) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(r);
    size += s;
  }
  if (cur.length) out.push(cur);
  return out;
}

export function taagerImportClient(
  origin: string,
  publicKey: string,
  token: string,
  request: typeof fetch = fetch,
) {
  const base = new URL(origin);
  if (base.protocol !== "https:" || base.pathname !== "/" || !publicKey || !token)
    throw Error("Import configuration unavailable");
  const headers = {
    apikey: publicKey,
    authorization: "Bearer " + token,
    "content-type": "application/json",
  };
  async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
    const res = await request(new URL("/rest/v1/rpc/" + fn, base), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { message?: string } | null;
      const msg = typeof err?.message === "string" ? err.message : "";
      throw Error(
        res.status === 401 || res.status === 403 || msg === "forbidden"
          ? "Access denied: sign in again."
          : msg
            ? "Import failed: " + msg
            : "Import request failed",
      );
    }
    return res.json() as Promise<T>;
  }
  return {
    summary: (m: MarketCode) => rpc<TaagerCatalogSummary>("taager_catalog_summary", { p_store: m }),
    begin: (m: MarketCode, meta: Record<string, unknown>) =>
      rpc<string>("taager_import_begin", { p_store: m, p_meta: meta }),
    rows: (m: MarketCode, batch: string, rows: TaagerImportRow[]) =>
      rpc<number>("taager_import_rows", { p_store: m, p_batch: batch, p_rows: rows }),
    finish: (m: MarketCode, batch: string) =>
      rpc<TaagerCatalogSummary>("taager_import_finish", { p_store: m, p_batch: batch }),
  };
}

/** Send a parsed file: begin a batch, upload chunks (each retried twice), then close the batch. */
export async function importTaagerSync(
  client: ReturnType<typeof taagerImportClient>,
  parsed: ParsedTaagerSync,
  isFull: boolean,
  onProgress: (done: number, total: number) => void = () => {},
  wait = (ms: number) => new Promise((r) => setTimeout(r, ms)),
): Promise<TaagerCatalogSummary> {
  const batch = await client.begin(parsed.market, {
    country: parsed.country,
    source: "taager-merchant-sync",
    version: parsed.version,
    is_full: isFull,
    started_at: parsed.started_at,
    finished_at: parsed.finished_at,
    listing_count: parsed.stats.products,
    detail_count: parsed.stats.with_detail,
    errors: parsed.errors,
  });
  const chunks = chunkRows(parsed.rows);
  let done = 0;
  onProgress(0, parsed.rows.length);
  for (const chunk of chunks) {
    for (let attempt = 0; ; attempt++) {
      try {
        await client.rows(parsed.market, batch, chunk);
        break;
      } catch (e) {
        if (attempt >= 2 || /Access denied|invalid_rows/.test(String((e as Error).message)))
          throw e;
        await wait(1500 * (attempt + 1));
      }
    }
    done += chunk.length;
    onProgress(done, parsed.rows.length);
  }
  return client.finish(parsed.market, batch);
}
