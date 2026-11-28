// Order lifecycle from the market's WooCommerce connector site (the Taager plugin updates order status there).
// placed → confirmed → shipped → delivered / refused / returned / unreachable (+ cancelled, unknown), with a reason.
// Pure functions plus one paged reader. No name, address or email leaves this file: an order row carries the order
// number, the items, the totals, where the visit came from and a KEYED HASH of the phone number (for the blacklist).
// UNPROVEN UNTIL G1: which status names Taager's plugin writes. Woo's own statuses are mapped exactly; custom ones
// are matched by keyword in English and Arabic; anything else stays "unknown" with the raw status kept, and G1's
// test orders tell us the real names (docs/handoff/SESSION-3.md lists what to record).
import { decimalToMinor, type Market, type MarketFacts } from "../brain/markets.ts";

export type Lifecycle = "placed" | "confirmed" | "shipped" | "delivered" | "refused" | "returned" | "unreachable" | "cancelled" | "unknown";
export const CLOSED: readonly Lifecycle[] = ["delivered", "refused", "returned", "unreachable", "cancelled"];
/** States that count against the customer for the blacklist: the parcel went out or the call failed, and no sale happened. */
export const UNDELIVERED: readonly Lifecycle[] = ["refused", "returned", "unreachable"];

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "");

const WOO_CORE: Record<string, Lifecycle> = { pending: "placed", "on-hold": "placed", processing: "placed", completed: "delivered", cancelled: "cancelled", refunded: "returned", failed: "cancelled", "checkout-draft": "unknown", trash: "unknown" };
const KEYWORDS: [Lifecycle, RegExp][] = [
  ["unreachable", /unreach|no[-_ ]?answer|not[-_ ]?answer|no[-_ ]?response|لم ي[رج]د|لا ي[رج]د|مغلق|غير متاح|تعذر الوصول/i],
  ["refused", /refus|reject|declin|رفض|مرفوض/i],
  ["returned", /return|rto|مرتجع|استرجاع|ارتجاع/i],
  ["shipped", /ship|dispatch|out[-_ ]?for|in[-_ ]?transit|with[-_ ]?courier|شحن|خرج للتوصيل|مع المندوب/i],
  // "delivered" only: "out-for-delivery" is shipped and "delivery-failed" is not a delivery.
  ["delivered", /delivered|تم التوصيل|تم التسليم|سُلّم|استلم/i],
  ["confirmed", /confirm|verified|مؤكد|تم التأكيد/i],
  ["cancelled", /cancel|ملغي|إلغاء|الغاء/i],
  ["placed", /pending|received|new|قيد|جديد/i],
];
/** Lifecycle state for a WooCommerce status string (core or custom, with or without the "wc-" prefix). */
export function lifecycleOf(status: string): Lifecycle {
  const s = status.replace(/^wc-/, "").trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(WOO_CORE, s)) return WOO_CORE[s];
  for (const [state, re] of KEYWORDS) if (re.test(s)) return state;
  return "unknown";
}

export type ReasonBucket = "unreachable" | "refused_at_door" | "changed_mind" | "price" | "wrong_address" | "duplicate" | "out_of_stock" | "delivery_delay" | "not_as_expected" | "other";
const REASONS: [ReasonBucket, RegExp][] = [
  ["unreachable", /no[-_ ]?answer|unreach|not[-_ ]?respond|phone (?:off|closed)|لم ي[رج]د|لا ي[رج]د|مغلق|خارج التغطية/i],
  ["duplicate", /duplicat|repeat|مكرر/i],
  ["wrong_address", /address|location|العنوان|عنوان خاطئ/i],
  ["price", /price|expensive|السعر|غالي|غالية/i],
  ["out_of_stock", /out of stock|unavailable|غير متوفر|نفذ|نفد/i],
  ["delivery_delay", /late|delay|تأخ[ّ]?ر/i],
  ["not_as_expected", /not as|different|quality|damaged|broken|مختلف|الجودة|تالف|مكسور/i],
  ["changed_mind", /changed? (?:his|her|their)? ?mind|no longer|doesn'?t want|لا يريد|لا تريد|غي[ّ]?رت? رأي|تراجع/i],
  ["refused_at_door", /refus|reject|رفض/i],
];
export function reasonBucket(text: string): ReasonBucket | null {
  const t = text.trim();
  if (!t) return null;
  for (const [bucket, re] of REASONS) if (re.test(t)) return bucket;
  return "other";
}

/** Digits of a phone number in international form without "+", or null when it cannot belong to the market. */
export function normalizePhone(raw: string, dialingCode: string): string | null {
  const cc = dialingCode.replace(/\D/g, "");
  let d = raw.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0)).replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith(cc)) d = d.slice(cc.length);
  d = d.replace(/^0+/, "");
  return d.length >= 7 && d.length <= 11 ? cc + d : null;
}
/** One-way keyed hash (HMAC-SHA-256, hex) of a normalised phone number. The key lives only in the server's secrets. */
export async function phoneHash(normalized: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(normalized));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type TrackedOrder = {
  store_code: Market; woo_order_id: number; order_number: string; status: Lifecycle; raw_status: string; reason: string | null; reason_bucket: ReasonBucket | null;
  placed_at: string; modified_at: string; currency: string; total_minor: number; delivery_minor: number;
  items: { sku: string; quantity: number; total_minor: number }[];
  source: { source: string | null; medium: string | null; campaign: string | null; paid_click: string | null };
  phone_hash: string | null;
};
const meta = (order: Rec, ...keys: string[]): string => {
  for (const m of Array.isArray(order.meta_data) ? order.meta_data : []) if (isRec(m) && keys.includes(str(m.key)) && str(m.value)) return str(m.value, 200);
  return "";
};
const iso = (v: unknown): string | null => { const s = str(v, 40); if (!s) return null; const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + "Z"); return Number.isNaN(t) ? null : new Date(t).toISOString(); };

/**
 * One WooCommerce REST order (wc/v3) → the row we keep. Returns null for anything that is not a real order of this
 * market (wrong currency, no id, no date). The customer's name, address and email are never read.
 */
export async function normalizeWooOrder(raw: unknown, m: MarketFacts, dialingCode: string, hashKey: string | null): Promise<TrackedOrder | null> {
  if (!isRec(raw)) return null;
  const id = typeof raw.id === "number" && Number.isSafeInteger(raw.id) ? raw.id : null;
  const placed = iso(raw.date_created_gmt ?? raw.date_created), modified = iso(raw.date_modified_gmt ?? raw.date_modified) ?? placed;
  if (id === null || !placed || !modified || (str(raw.currency) && str(raw.currency).toUpperCase() !== m.currency)) return null;
  const rawStatus = str(raw.status, 80), status = lifecycleOf(rawStatus);
  // Reason: Taager's plugin may write it to an order meta key or the customer note; names are confirmed at G1.
  const reason = meta(raw, "taager_status_reason", "_taager_status_reason", "taager_cancel_reason", "_cancel_reason", "cancellation_reason", "rejection_reason") || (CLOSED.includes(status) && status !== "delivered" ? str(raw.customer_note, 200) : "");
  const items = (Array.isArray(raw.line_items) ? raw.line_items : []).filter(isRec).map((l) => ({ sku: str(l.sku, 120), quantity: typeof l.quantity === "number" ? l.quantity : 0, total_minor: decimalToMinor(str(l.total, 40), m.minorDigits) ?? 0 }))
    .filter((l) => l.sku && l.quantity > 0 && l.quantity <= 100);
  const billing = isRec(raw.billing) ? raw.billing : {};
  const phone = normalizePhone(str(billing.phone, 40), dialingCode);
  const paid = meta(raw, "ym_paid_click") || (meta(raw, "_wc_order_attribution_utm_source").match(/facebook|instagram|meta/i) && meta(raw, "_wc_order_attribution_utm_medium").match(/cpc|paid/i) ? "fbclid" : "");
  return {
    store_code: m.code, woo_order_id: id, order_number: str(raw.number, 40) || String(id), status, raw_status: rawStatus,
    reason: reason || null, reason_bucket: status === "unreachable" ? "unreachable" : reason ? reasonBucket(reason) : status === "refused" ? "refused_at_door" : null,
    placed_at: placed, modified_at: modified, currency: m.currency,
    total_minor: decimalToMinor(str(raw.total, 40), m.minorDigits) ?? 0, delivery_minor: decimalToMinor(str(raw.shipping_total, 40), m.minorDigits) ?? 0,
    items,
    source: { source: meta(raw, "ym_last_source", "_wc_order_attribution_utm_source") || null, medium: meta(raw, "ym_last_medium", "_wc_order_attribution_utm_medium") || null,
      campaign: meta(raw, "ym_last_campaign", "_wc_order_attribution_utm_campaign") || null, paid_click: paid || null },
    phone_hash: phone && hashKey ? await phoneHash(phone, hashKey) : null,
  };
}

export type WooOrderCreds = { origin: string; key: string; secret: string };
/** Orders changed since `since` (ISO), oldest first, 100 per page, at most `maxPages` pages per call (resumable by date). */
export async function fetchWooOrders(creds: WooOrderCreds, since: string, f: typeof fetch = fetch, maxPages = 10): Promise<{ orders: unknown[]; complete: boolean }> {
  const base = new URL(creds.origin);
  if (base.protocol !== "https:") throw Error("woo_origin_must_be_https");
  const out: unknown[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = new URL("/wp-json/wc/v3/orders", base);
    url.search = new URLSearchParams({ per_page: "100", page: String(page), orderby: "modified", order: "asc", modified_after: since, dates_are_gmt: "true", status: "any" }).toString();
    const res = await f(url, { headers: { authorization: "Basic " + btoa(creds.key + ":" + creds.secret), accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw Error("woo_orders_http_" + res.status);
    const rows = await res.json();
    if (!Array.isArray(rows)) throw Error("woo_orders_bad_payload");
    out.push(...rows);
    const pages = Number(res.headers.get("x-wp-totalpages") ?? "1");
    if (rows.length < 100 || page >= pages) return { orders: out, complete: true };
  }
  return { orders: out, complete: false };
}
