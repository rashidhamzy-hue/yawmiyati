// WooCommerce REST v3 product/variation JSON -> one supplier_offers row.
// Everything Woo returns is kept in `raw`; the typed columns are what the brain reasons with.
// Supplier text is untrusted data: it is stored and shown, never executed or obeyed.
import { decimalToMinor, type MarketFacts } from "./markets.ts";

export type OfferImage = { src: string; alt: string | null; position: number };
export type OfferVideo = { url: string; source: "meta" | "description"; host: string };
export type OfferRow = {
  store_code: string;
  provider: "taager_woo" | "taager_api";
  product_id: number;
  variation_id: number;
  parent_id: number | null;
  product_type: string;
  status: string | null;
  sku: string | null;
  title: string;
  currency: string;
  price_minor: number | null;
  regular_price_minor: number | null;
  sale_price_minor: number | null;
  stock_status: string | null;
  stock_quantity: number | null;
  categories: { id: number; name: string; slug: string }[];
  attributes: { name: string; options: string[]; variation: boolean }[];
  images: OfferImage[];
  videos: OfferVideo[];
  meta: Record<string, unknown>;
  description: string | null;
  short_description: string | null;
  raw: unknown;
  revision: string;
};

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max = 20000): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const int = (v: unknown): number | null => {
  const n = typeof v === "string" && /^-?\d+$/.test(v.trim()) ? Number(v) : v;
  return typeof n === "number" && Number.isSafeInteger(n) ? n : null;
};

const VIDEO_URL = /https?:\/\/[^\s"'<>]+?(?:\.(?:mp4|webm|mov|m3u8)(?:\?[^\s"'<>]*)?|youtube\.com\/(?:watch\?v=|embed\/|shorts\/)[\w-]+|youtu\.be\/[\w-]+|vimeo\.com\/(?:video\/)?\d+|tiktok\.com\/[^\s"'<>]+\/video\/\d+)/gi;

export function findVideos(meta: Rec, description: string | null): OfferVideo[] {
  const out = new Map<string, OfferVideo>();
  const add = (url: string, source: OfferVideo["source"]) => {
    const clean = url.replace(/&amp;/g, "&").replace(/[),.;]+$/, "");
    try { const host = new URL(clean).hostname.replace(/^www\./, ""); if (!out.has(clean)) out.set(clean, { url: clean, source, host }); } catch { /* not a URL */ }
  };
  for (const value of Object.values(meta)) {
    const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
    for (const m of text.matchAll(VIDEO_URL)) add(m[0], "meta");
  }
  for (const m of (description ?? "").matchAll(VIDEO_URL)) add(m[0], "description");
  return [...out.values()].slice(0, 20);
}

/** Woo meta_data [{key,value}] -> {key: value}; repeated keys become arrays. Private "_edit_lock"-style keys dropped. */
export function flattenMeta(metaData: unknown): Rec {
  const out: Rec = {};
  if (!Array.isArray(metaData)) return out;
  for (const item of metaData) {
    if (!isRec(item) || typeof item.key !== "string") continue;
    const key = item.key.slice(0, 200);
    if (/^_(edit_lock|edit_last|wp_old_slug|wp_trash_meta)/.test(key)) continue;
    const value = item.value;
    if (key in out) out[key] = Array.isArray(out[key]) ? [...(out[key] as unknown[]), value] : [out[key], value];
    else out[key] = value;
  }
  return out;
}

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function images(raw: Rec): OfferImage[] {
  const list = Array.isArray(raw.images) ? raw.images : isRec(raw.image) ? [raw.image] : [];
  return list.filter(isRec).map((img, i) => ({ src: str(img.src, 2000) ?? "", alt: str(img.alt, 300), position: i }))
    .filter((img) => /^https?:\/\//.test(img.src)).slice(0, 40);
}

export async function normalizeWoo(store: string, m: MarketFacts, raw: unknown, parent?: Rec): Promise<OfferRow> {
  if (!isRec(raw)) throw Error("woo_record_not_object");
  const id = int(raw.id);
  if (!id || id <= 0) throw Error("woo_record_without_id");
  const isVariation = !!parent;
  const meta = flattenMeta(raw.meta_data);
  const description = str(raw.description) ?? (parent ? str(parent.description) : null);
  const attrs = (Array.isArray(raw.attributes) ? raw.attributes : []).filter(isRec).map((a) => ({
    name: str(a.name, 200) ?? "",
    options: Array.isArray(a.options) ? a.options.map((o) => String(o).slice(0, 200)).slice(0, 50) : typeof a.option === "string" ? [a.option.slice(0, 200)] : [],
    variation: a.variation === true || isVariation,
  }));
  const ownImages = images(raw);
  const parentTitle = parent ? str(parent.name, 300) : null;
  const variantLabel = isVariation ? attrs.map((a) => a.options.join("/")).filter(Boolean).join(" · ") : "";
  return {
    store_code: store,
    provider: "taager_woo",
    product_id: isVariation ? (int(parent!.id) ?? id) : id,
    variation_id: isVariation ? id : 0,
    parent_id: isVariation ? int(parent!.id) : (int(raw.parent_id) || null),
    product_type: isVariation ? "variation" : (str(raw.type, 40) ?? "unknown"),
    status: str(raw.status, 40),
    sku: str(raw.sku, 200),
    title: (isVariation ? [parentTitle, variantLabel].filter(Boolean).join(" — ") : str(raw.name, 300)) || "(untitled)",
    currency: m.currency,
    price_minor: decimalToMinor(raw.price, m.minorDigits),
    regular_price_minor: decimalToMinor(raw.regular_price, m.minorDigits),
    sale_price_minor: decimalToMinor(raw.sale_price, m.minorDigits),
    stock_status: str(raw.stock_status, 40),
    stock_quantity: int(raw.stock_quantity),
    categories: (Array.isArray(raw.categories) ? raw.categories : Array.isArray(parent?.categories) ? parent!.categories as unknown[] : [])
      .filter(isRec).map((c) => ({ id: int(c.id) ?? 0, name: str(c.name, 200) ?? "", slug: str(c.slug, 200) ?? "" })),
    attributes: attrs,
    images: ownImages.length ? ownImages : parent ? images(parent) : [],
    videos: findVideos(meta, description),
    meta,
    description,
    short_description: str(raw.short_description) ?? (parent ? str(parent.short_description) : null),
    raw,
    revision: await sha256(JSON.stringify(raw)),
  };
}
