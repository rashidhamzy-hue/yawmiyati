// taager_catalog row (owner-run Taager merchant sync) -> one supplier_offers row.
// Taager states its own economics, so nothing is inferred: originalPrice is our cost,
// price is the minimum selling price, profit = price - originalPrice, pricingRange.max (when > 0)
// is the highest price Taager accepts. Bundles carry Taager-declared bundleItems (M11-safe).
// Supplier text is untrusted data: stored and shown, never executed or obeyed.
import { decimalToMinor, type MarketFacts } from "./markets.ts";
import type { FieldMapping } from "./catalog-analysis.ts";
import type { OfferRow } from "./woo-normalize.ts";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export type TaagerCatalogRow = {
  market: string; sku: string; product_id: number; variant_id: number | null; item_type: string | null; name: string | null;
  listing: Rec; detail: Rec | null; alternatives: unknown[] | null; synced_at?: string; price_changed_at?: string | null;
};

/** The economics keys normalizeTaager writes into `meta`, used as a fixed (not guessed) field mapping. */
export const TAAGER_MAPPING: FieldMapping = {
  cost_key: "taager_cost", floor_key: "taager_min_price", profit_key: "taager_min_profit", suggested_key: null,
  quantity_key: null, components_key: "taager_bundle_items", taager_sku_key: "taager_sku",
  cost_source: "meta", floor_source: "meta", confidence: "owner",
  notes: ["Economics read directly from Taager's merchant data (cost, minimum price, profit, tiers, sale windows)."],
};

/** Taager fills empty text fields with "1", "-", "." and similar. */
export function cleanTaagerText(v: unknown, max = 20000): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\r\n/g, "\n").trim();
  if (t.length < 3 || /^[\s\d.\-_,:;*#]+$/.test(t)) return null;
  return t.slice(0, max);
}

const isVideo = (u: string) => /\.(mp4|webm|mov|m3u8)(\?|$)/i.test(u);
const httpUrl = (u: unknown): u is string => typeof u === "string" && /^https:\/\//.test(u);

/** Combined COD success rate (confirmed × delivered) in basis points, or null when Taager has no data. */
export function taagerSuccessBps(analytics: unknown): number | null {
  if (!isRec(analytics)) return null;
  const c = num(analytics.confirmationRate), d = num(analytics.deliveryRate);
  if (!c || !d || c > 1 || d > 1) return null;
  return Math.round(c * d * 10000);
}

/** The sale discount active at `now`, if any (temporary: never used as the pricing base). */
function activeSale(discounts: unknown, now: number) {
  if (!Array.isArray(discounts)) return null;
  for (const x of discounts) {
    if (!isRec(x) || x.type !== "sale") continue;
    const s = typeof x.startsAt === "string" ? Date.parse(x.startsAt + (/[zZ+]/.test(x.startsAt.slice(-6)) ? "" : "Z")) : NaN;
    const e = typeof x.expiresAt === "string" ? Date.parse(x.expiresAt + (/[zZ+]/.test(x.expiresAt.slice(-6)) ? "" : "Z")) : NaN;
    if ((Number.isNaN(s) || s <= now) && (Number.isNaN(e) || e > now)) return x;
  }
  return null;
}

export function normalizeTaager(store: string, m: MarketFacts, row: TaagerCatalogRow, now = Date.now()): OfferRow {
  const detail = isRec(row.detail) ? row.detail : {};
  const variant = isRec(detail.variant) ? detail.variant : {};
  const fin = isRec(variant.financials) ? variant.financials : isRec(row.listing.financials) ? row.listing.financials : {};
  const toMinor = (v: unknown) => (num(v) === null ? null : decimalToMinor(v, m.minorDigits));
  const minPrice = toMinor(fin.price), cost = toMinor(fin.originalPrice), profit = toMinor(fin.profit);
  const range = isRec(fin.pricingRange) ? fin.pricingRange : null;
  const maxPrice = range && (num(range.max) ?? 0) > 0 ? toMinor(range.max) : null;
  const sale = activeSale(fin.discounts, now);
  const tiers = Array.isArray(fin.tieredPricing)
    ? fin.tieredPricing.filter(isRec).map((t) => ({ quantity: num(t.quantity), price_minor: toMinor(t.price), profit_minor: toMinor(t.profit), max_price_minor: toMinor(t.maxPrice) }))
      .filter((t) => t.quantity && t.price_minor !== null)
    : [];
  const upsell = Array.isArray(fin.discounts) ? fin.discounts.filter((x) => isRec(x) && x.type !== "sale").map((x) => ({ type: (x as Rec).type, price_minor: toMinor((x as Rec).price), profit_minor: toMinor((x as Rec).profit) })) : [];
  const rawImages = (Array.isArray(variant.images) ? variant.images : []).filter(httpUrl);
  const thumb = httpUrl(variant.thumbnail) ? variant.thumbnail : httpUrl(row.listing.thumbnail) ? row.listing.thumbnail as string : null;
  const pictures = rawImages.filter((u) => !isVideo(u));
  if (!pictures.length && thumb && !isVideo(thumb)) pictures.push(thumb);
  const videoUrls = [...new Set([...rawImages.filter(isVideo), ...(Array.isArray(variant.videos) ? variant.videos.filter(httpUrl) : [])])];
  const description = cleanTaagerText(variant.description);
  const specs = cleanTaagerText(variant.specifications);
  const howTo = cleanTaagerText(variant.howToUse);
  const faq = Array.isArray(variant.faq) ? variant.faq.filter(isRec).map((f) => ({ q: cleanTaagerText(f.question, 500), a: cleanTaagerText(f.answer, 1000) ?? (typeof f.answer === "string" ? f.answer.trim().slice(0, 1000) : null) })).filter((f) => f.q && f.a) : [];
  const bundle = Array.isArray(variant.bundleItems) ? variant.bundleItems.filter(isRec).map((b) => ({ sku: typeof b.sku === "string" ? b.sku : null, product_id: num(b.productId), quantity: num(b.quantity) })).filter((b) => b.sku && b.quantity) : [];
  const orderable = !isRec(variant.merchantInfo) || variant.merchantInfo.orderable !== false;
  const available = typeof variant.availability === "string" ? variant.availability === "available" || variant.availability === "limited" || variant.availability === "available_with_low_qty" : true;
  const success = taagerSuccessBps(variant.analytics);
  const attrs = (Array.isArray(variant.attributes) ? variant.attributes : []).filter(isRec).map((a) => ({
    name: String(a.name ?? a.type ?? "").slice(0, 200), options: [String(a.value ?? a.label ?? "").slice(0, 200)].filter(Boolean), variation: true,
  }));
  const meta: Rec = {
    taager_sku: row.sku, taager_cost: cost === null ? null : cost / 10 ** m.minorDigits, taager_min_price: minPrice === null ? null : minPrice / 10 ** m.minorDigits,
    taager_min_profit: profit === null ? null : profit / 10 ** m.minorDigits,
    taager_max_price_minor: maxPrice, taager_tiers: tiers, taager_upsell_discounts: upsell,
    taager_sale: sale ? { price_minor: toMinor(sale.price), profit_minor: toMinor(sale.profit), starts_at: sale.startsAt ?? null, expires_at: sale.expiresAt ?? null } : null,
    taager_success_rate_bps: success, taager_category_id: num(detail.categoryId), taager_weight: num(variant.weight),
    taager_warranty_eligible: detail.warrantyEligible === true, taager_is_primary: variant.isPrimary !== false,
    taager_bundle_items: bundle.length ? bundle : null, taager_alternatives: Array.isArray(row.alternatives) ? row.alternatives.slice(0, 20) : [],
    taager_specifications: specs, taager_how_to_use: howTo, taager_faq: faq, taager_price_changed_at: row.price_changed_at ?? null,
  };
  return {
    store_code: store, provider: "taager_api",
    product_id: row.product_id, variation_id: row.variant_id ?? 0, parent_id: null,
    product_type: bundle.length ? "bundle" : "simple",
    status: detail.active === false ? "inactive" : "publish",
    sku: row.sku,
    title: (typeof detail.name === "string" && detail.name.trim()) || row.name || "(untitled)",
    currency: m.currency,
    price_minor: minPrice, regular_price_minor: maxPrice, sale_price_minor: sale ? toMinor(sale.price) : null,
    stock_status: orderable && available ? "instock" : "outofstock", stock_quantity: null,
    categories: [],
    attributes: attrs,
    images: pictures.slice(0, 40).map((src, i) => ({ src, alt: null, position: i })),
    videos: videoUrls.slice(0, 20).map((url) => ({ url, source: "meta" as const, host: (() => { try { return new URL(url).hostname; } catch { return ""; } })() })),
    meta,
    description: [description, specs ? "المواصفات:\n" + specs : null, howTo ? "طريقة الاستخدام:\n" + howTo : null].filter(Boolean).join("\n\n") || null,
    short_description: null,
    raw: { listing: row.listing, detail: row.detail },
    revision: String(row.synced_at ?? ""),
  };
}
