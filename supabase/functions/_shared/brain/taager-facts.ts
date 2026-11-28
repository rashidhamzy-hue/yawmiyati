// Market facts read from Taager's own information pages (sync v5: `pages[<market>] = [{path, title, text, links, api[]}]`).
// Pure functions, no I/O: the owner page runs them in the browser before the import, the daily loop and the brain use
// the stored result. Rules, not AI: the same page always gives the same fact, and every fact carries the page it came
// from, the date it was read and the sentence it was read in.
//
// What happens to a fact:
//   agrees     the page says what we already plan with ("Known commercial facts")           -> used as is
//   pending    the page contradicts what we plan with, or changed since the last sync       -> listed for the owner
//   confirmed  the owner confirmed the page                                                  -> the page wins
//   rejected   the owner says the page is wrong or does not apply                            -> ignored
// One exception keeps "never a loss" true while a contradiction waits: when the page shows a figure that would cost us
// MORE (a higher delivery fee, refusal charge or VAT), the brain already plans with the dearer figure.
import { MARKETS, decimalToMinor, minorToDecimal, worstDeliveryFee, type Market, type MarketFacts } from "./markets.ts";

export type InfoPage = { path: string; title?: string; read_at?: string; text?: string; links?: string[]; api?: { url?: string; status?: number; json?: unknown }[]; error?: string };
export type FactKey = "delivery_fee" | "delivery_time" | "cod" | "confirmation" | "refusal_fee" | "return_fee" | "return_window" | "return_rules"
  | "order_limits" | "vat" | "payout" | "loyalty" | "other_rules";
export type ExtractedFact = {
  key: FactKey; value: Record<string, unknown>; /** One English sentence for /admin and the brief. */ summary: string;
  /** The sentence on the page the fact was read from (at most 240 characters). */ quote: string;
  source_path: string; source_read_at: string | null; confidence: "high" | "low";
};
export type FactDecision = "agrees" | "pending" | "confirmed" | "rejected";
export type StoredFact = { key: string; value: Record<string, unknown>; decision: FactDecision; summary?: string; source_path?: string; source_read_at?: string | null; changed_at?: string | null; previous_value?: Record<string, unknown> | null };
export type Contradiction = { key: FactKey; known: string; page: string; source_path: string; source_read_at: string | null; costs_us_more: boolean };

// ---- personal data never enters storage (the bookmarklet already skips account, wallet, payment and order calls) ----
const PERSONAL_PATH = /auth|token|login|logout|otp|password|wallet|payout|withdraw|payment|bank|transaction|kyc|profile|account|user|phone|email|notification|order/i;
const EMAIL = /[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, LONG_NUMBER = /\+?[0-9][0-9 ]{8,}[0-9]/g;
export const redact = (t: string) => t.replace(EMAIL, "[email]").replace(LONG_NUMBER, "[number]");
function redactJson(v: unknown, depth = 0): unknown {
  if (depth > 12) return null;
  if (typeof v === "string") return redact(v).slice(0, 4000);
  if (Array.isArray(v)) return v.slice(0, 200).map((x) => redactJson(x, depth + 1));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k]) => !PERSONAL_PATH.test(k) && !/name$/i.test(k) || /tier|level|zone|city|province|plan/i.test(k)).slice(0, 200).map(([k, x]) => [k, redactJson(x, depth + 1)]));
  return v;
}
/** The pages of one market, cleaned for storage: info paths only, text redacted again, personal API calls and keys dropped. */
export function cleanPages(market: Market, pages: unknown): InfoPage[] {
  if (!Array.isArray(pages)) return [];
  const out: InfoPage[] = [];
  for (const p of pages.slice(0, 12)) {
    if (!p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>, path = typeof o.path === "string" ? o.path : "";
    if (!new RegExp(`^/${market}/[A-Za-z0-9/_-]{1,120}$`).test(path) || PERSONAL_PATH.test(path) || typeof o.error === "string") continue;
    const text = typeof o.text === "string" ? redact(o.text).slice(0, 60_000) : "";
    if (text.trim().length < 20) continue;
    const api = (Array.isArray(o.api) ? o.api : []).filter((a): a is Record<string, unknown> => !!a && typeof a === "object" && typeof (a as { url?: unknown }).url === "string" && !PERSONAL_PATH.test(String((a as { url: string }).url).split("?")[0]))
      .slice(0, 20).map((a) => ({ url: String(a.url).split("?")[0].slice(0, 300), status: Number(a.status) || 0, json: redactJson(a.json) }));
    out.push({ path, title: typeof o.title === "string" ? redact(o.title).slice(0, 200) : "", read_at: typeof o.read_at === "string" && !Number.isNaN(Date.parse(o.read_at)) ? o.read_at : undefined, text,
      links: (Array.isArray(o.links) ? o.links : []).filter((l): l is string => typeof l === "string" && l.startsWith(`/${market}/`) && !PERSONAL_PATH.test(l)).slice(0, 40), api });
  }
  return out;
}

// ---- reading ----
const digits = (t: string) => t.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
const CURRENCY: Record<Market, string> = {
  sa: "SAR|S\\.?R\\.?|Saudi\\s+riyals?|ريال(?:\\s*سعودي)?|ر\\.س",
  ae: "AED|dirhams?|درهم(?:\\s*إماراتي)?|د\\.إ",
  om: "OMR|Omani\\s+ri[y]?als?|ريال(?:\\s*عمان[يى])?|ر\\.ع",
  eg: "EGP|L\\.?E\\.?|Egyptian\\s+pounds?|pounds?|جنيه(?:\\s*مصري)?|ج\\.م",
  iq: "IQD|Iraqi\\s+dinars?|دينار(?:\\s*عراقي)?|د\\.ع",
};
/** Every amount of this market's currency on a line, in minor units. */
function money(line: string, market: Market): number[] {
  const m = MARKETS[market], cur = CURRENCY[market], out: number[] = [];
  const re = new RegExp(`(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:${cur})(?![A-Za-z])|(?:${cur})\\s*(\\d[\\d,]*(?:\\.\\d+)?)`, "gi");
  for (const x of line.matchAll(re)) { const v = decimalToMinor((x[1] ?? x[2]).replace(/,(?=\d{3}\b)/g, ""), m.minorDigits); if (v !== null && v > 0) out.push(v); }
  return out;
}
const WORD_NUMBER: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10, "يوم": 1, "يومين": 2, "ثلاثة": 3, "ثلاث": 3, "أربعة": 4, "اربعة": 4, "خمسة": 5, "ستة": 6, "سبعة": 7 };
const NUM = "(\\d{1,3}|one|two|three|four|five|six|seven|ten|يومين|ثلاثة|ثلاث|أربعة|اربعة|خمسة|ستة|سبعة)";
const n = (s: string) => WORD_NUMBER[s.toLowerCase()] ?? Number(s);
const UNIT = "(working\\s+days?|business\\s+days?|days?|hours?|أيام\\s*عمل|يوم\\s*عمل|أيام|ايام|يوم[اً]*|ساعة|ساعات)";
/** A duration in a sentence as whole days: "2-3 days", "24 to 48 hours", "within two working days", "up to three working days", "يومين". */
function durationDays(s: string): { min: number; max: number } | null {
  const hours = (u: string) => /hour|ساع/.test(u);
  const toDays = (v: number, u: string) => (hours(u) ? Math.max(1, Math.ceil(v / 24)) : v);
  let x = new RegExp(`${NUM}\\s*(?:-|–|—|to|إلى|الى|حتى)\\s*${NUM}\\s*${UNIT}`, "i").exec(s);
  if (x) return { min: toDays(n(x[1]), x[3]), max: toDays(n(x[2]), x[3]) };
  x = new RegExp(`(up\\s+to|within|خلال|حتى)\\s+${NUM}\\s*${UNIT}`, "i").exec(s);
  if (x) { const d = toDays(n(x[2]), x[3]); return { min: /up\s+to|حتى/i.test(x[1]) ? 1 : d, max: d }; }
  if (/(خلال|في)\s+يومين/.test(s)) return { min: 2, max: 2 };
  return null;
}
const short = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 240);
const sentences = (text: string) => text.split(/\n+|(?<=[.!؟])\s+(?=[A-Z؀-ۿ])/).map((s) => s.trim()).filter((s) => s.length > 3);
const places = (s: string) => s.replace(/\(|\)/g, ",").split(/,|،|\band\b| و(?=[؀-ۿ])/).map((x) => x.trim()).filter((x) => x.length >= 3 && x.length <= 30 && !/\d/.test(x) && !/zone|deliver|region|within|takes|منطقة|التوصيل/i.test(x));

const SHIP = /shipping (?:cost|price|fee)s?|shipping zone|delivery fees?|fee charged to customer|أسعار الشحن|رسوم (?:الشحن|التوصيل)|مصاريف الشحن|تكلفة الشحن/i;
const NOT_SHIP = /refus|reject|return|refund|withdraw|minimum|deduct|رفض|مرتجع|استرجاع|سحب|حد أدنى|خصم/i;
const RETURNS = /refund|return|replac|money[- ]back|استرجاع|استبدال|إرجاع|ارجاع/i;
const DELIVERY = /deliver(?:y|ed)?\b.*\b(?:is|takes|within|in|to)\b|\bdeliver(?:y|ed)\b|التوصيل|يوصل|التسليم/i;
const NOT_DELIVERY = /confirm|profit|withdraw|refund|return|replac|wallet|placed|register|invoice|تأكيد|ربح|سحب|استرجاع|استبدال|تسجيل|فاتورة/i;
const TIER = /(bronze|silver|gold|platinum|diamond|vip|elite|برونز\S*|فض[يّ]\S*|ذهب\S*|بلاتين\S*|ماس\S*|نخبة)/i;

/** Walk a recorded API answer for keys that look like a delivery fee (used only when the page text says nothing). */
function walkFees(v: unknown, market: Market, path: string, out: { path: string; minor: number }[], depth = 0): void {
  if (depth > 8 || v === null || typeof v !== "object") return;
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if ((typeof x === "number" || typeof x === "string") && /(shipping|delivery).*(fee|cost|price|rate)|^(shippingRate|shippingCost|deliveryFees?)$/i.test(k)) {
      const minor = decimalToMinor(x, MARKETS[market].minorDigits); if (minor !== null && minor > 0) out.push({ path: path + "." + k, minor });
    } else walkFees(x, market, path + "." + k, out, depth + 1);
  }
}

/** Every fact the rules can read from one market's pages. Later pages never overwrite a high-confidence fact from an earlier one. */
export function extractMarketFacts(market: Market, pages: InfoPage[]): ExtractedFact[] {
  const m = MARKETS[market], found = new Map<FactKey, ExtractedFact>();
  const put = (f: ExtractedFact) => { const old = found.get(f.key); if (!old || (old.confidence === "low" && f.confidence === "high")) found.set(f.key, f); };
  const amount = (minor: number) => `${minorToDecimal(minor, m.minorDigits)} ${m.currency}`;
  for (const page of pages) {
    const text = digits(page.text ?? ""), at = page.read_at ?? null, src = { source_path: page.path, source_read_at: at };
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean), all = sentences(text);

    // Delivery fee: zones (a row with places and an amount) or one flat amount under a shipping heading.
    const zones: { name: string; places: string[]; fee_minor: number }[] = []; let flat: { minor: number; quote: string } | null = null, inShip = 0;
    for (const line of lines) {
      if (SHIP.test(line)) inShip = 4; else if (inShip > 0 && !/\d/.test(line) && line.length > 60) inShip = 0;
      const amounts = money(line, market);
      if (inShip > 0 && amounts.length === 1 && !NOT_SHIP.test(line)) {
        const cells = line.split(/\t|\|/).map((c) => c.trim()).filter(Boolean), where = places(cells.length > 1 ? cells.filter((c) => !money(c, market).length).join(",") : line.replace(/\d.*$/, ""));
        if (/zone|منطقة/i.test(line) || (cells.length >= 2 && where.length >= 2)) zones.push({ name: (/(zone\s*\d+|المنطقة\s*\S+)/i.exec(line)?.[1] ?? `Zone ${zones.length + 1}`).trim(), places: where.filter((w) => !/^zone/i.test(w)), fee_minor: amounts[0] });
        else if (!flat) flat = { minor: amounts[0], quote: short(line) };
      }
      if (inShip > 0 && !SHIP.test(line)) inShip--;
    }
    if (zones.length >= 2) put({ key: "delivery_fee", value: { zones }, summary: `Delivery fee by zone: ${zones.map((z) => `${z.name} ${amount(z.fee_minor)}`).join(", ")}.`, quote: short(zones.map((z) => `${z.name}: ${z.places.slice(0, 4).join(", ")} ${amount(z.fee_minor)}`).join(" · ")), ...src, confidence: "high" });
    else if (flat) put({ key: "delivery_fee", value: { flat_minor: flat.minor }, summary: `Delivery fee ${amount(flat.minor)} per order, everywhere in ${m.countryName}.`, quote: flat.quote, ...src, confidence: "high" });
    else { const fees: { path: string; minor: number }[] = []; for (const a of page.api ?? []) walkFees(a.json, market, a.url ?? "", fees);
      if (fees.length) put({ key: "delivery_fee", value: { flat_minor: fees[0].minor }, summary: `Delivery fee ${amount(fees[0].minor)} (read from a data field, not from the page text: check it).`, quote: short(fees[0].path), ...src, confidence: "low" }); }

    // Delivery time per region.
    const regions: { label: string; places: string[]; min_days: number; max_days: number }[] = [];
    for (const s of all) { if (!DELIVERY.test(s) || NOT_DELIVERY.test(s)) continue; const d = durationDays(s); if (!d || d.max > 30) continue;
      regions.push({ label: short(s.replace(/[.:]$/, "")).slice(0, 120), places: places(s.replace(/deliver\w*|within.*$|takes.*$|is\s.*$|التوصيل|خلال.*$/gi, ",")), min_days: Math.min(d.min, d.max), max_days: Math.max(d.min, d.max) }); }
    if (regions.length) put({ key: "delivery_time", value: { regions, min_days: Math.min(...regions.map((r) => r.min_days)), max_days: Math.max(...regions.map((r) => r.max_days)) },
      summary: `Delivery takes ${Math.min(...regions.map((r) => r.min_days))}–${Math.max(...regions.map((r) => r.max_days))} days after confirmation (${regions.length} region${regions.length > 1 ? "s" : ""}).`, quote: short(regions.map((r) => r.label).join(" · ")), ...src, confidence: "high" });

    // Returns: window, who it covers, how the money comes back, what cannot be returned.
    for (const s of all) { if (!RETURNS.test(s)) continue;
      const d = /(\d{1,2})[- ]day|within\s+(\d{1,2})\s+days|خلال\s+(\d{1,2})\s+يوم/i.exec(s); if (!d) continue;
      const days = Number(d[1] ?? d[2] ?? d[3]), guarantee = /guarantee|نضمن|policy|سياسة/i.test(s);
      put({ key: "return_window", value: { days, defect_only: /defect|عيب|not match|عدم مطابق/i.test(s), refund: /bank/i.test(text) && /refund[^.]*bank/i.test(text) ? "bank_transfer" : /cash refund|cash number|نقد/i.test(text) ? "cash" : null },
        summary: `Returns within ${days} days${/defect|عيب/i.test(s) ? " (defective or not as described)" : ""}.`, quote: short(s), ...src, confidence: guarantee ? "high" : "low" }); if (guarantee) break; }
    const never = all.filter((s) => /non[- ]refundable|non[- ]replaceable|غير قابل\S* للاسترجاع|لا يمكن استرجاع/i.test(s));
    if (never.length) put({ key: "return_rules", value: { non_returnable: never.map(short) }, summary: `Not returnable: ${short(never[0])}`, quote: short(never[0]), ...src, confidence: "high" });

    // What a refusal or a return costs the merchant.
    for (const s of all) { const a = money(s, market); if (a.length && /refus|reject|رفض/i.test(s) && /merchant|deduct|التاجر|خصم/i.test(s)) { put({ key: "refusal_fee", value: { fee_minor: a[0] }, summary: `A refused order costs the merchant ${amount(a[0])}.`, quote: short(s), ...src, confidence: "high" }); break; } }
    const feeHead = lines.findIndex((l) => /return fee|رسوم (?:ال)?(?:مرتجع|إرجاع|ارجاع|استرجاع)/i.test(l));
    if (feeHead >= 0) for (const l of lines.slice(feeHead, feeHead + 6)) { const a = money(l.replace(/(\d)([A-Za-z])/g, "$1 $2"), market); if (a.length >= 2 || (a.length === 1 && !/return fee/i.test(l))) {
      put({ key: "return_fee", value: { shipped_minor: a[0], delivered_minor: a[1] ?? a[0] }, summary: `Return fee charged to the merchant: ${amount(a[0])} for a shipped order that was not received, ${amount(a[1] ?? a[0])} for a delivered order returned.`, quote: short(l), ...src, confidence: "high" }); break; } }

    // VAT on profit added above Taager's minimum.
    for (const s of all) { const v = /(\d{1,2})\s*%/.exec(s); if (v && /VAT|value added|ضريبة/i.test(s) && /profit|ربح/i.test(s)) { put({ key: "vat", value: { on_added_profit_bps: Number(v[1]) * 100 }, summary: `${v[1]}% of the profit added above Taager's minimum is deducted as VAT.`, quote: short(s), ...src, confidence: "high" }); break; } }

    // Confirmation call and cash on delivery.
    const call = all.find((s) => /confirm|\bcalls?\b|تأكيد|مكالم/i.test(s) && /(\d{1,2})(?::\d\d)?\s*(?:am|AM|صباح)/.test(s) && /(\d{1,2})(?::\d\d)?\s*(?:pm|PM|مساء)/.test(s));
    if (call) { const from = Number(/(\d{1,2})(?::\d\d)?\s*(?:am|AM|صباح)/.exec(call)![1]), to = Number(/(\d{1,2})(?::\d\d)?\s*(?:pm|PM|مساء)/.exec(call)![1]) + 12, attempts = /seven attempts|المحاولات السبع/i.test(text) ? 7 : null;
      put({ key: "confirmation", value: { call_from_hour: from, call_to_hour: to, attempts, within_hours: /within 24 hours|خلال 24 ساعة/i.test(text) ? 24 : null }, summary: `Customers are called to confirm between ${from}:00 and ${to}:00${attempts ? `, up to ${attempts} attempts over three days` : ""}.`, quote: short(call), ...src, confidence: "high" }); }
    const cod = all.find((s) => /cash on delivery|\bCOD\b|الدفع عند الاستلام/i.test(s)), sealed = all.find((s) => /not allowed to open|عدم السماح بالتجربة|بعد الدفع/i.test(s));
    if (cod || sealed) put({ key: "cod", value: { cash_on_delivery: true, open_before_paying: sealed ? false : null }, summary: `Cash on delivery${sealed ? "; the parcel may not be opened before paying" : ""}.`, quote: short(sealed ?? cod!), ...src, confidence: cod ? "high" : "low" });

    // Limits, payout and other merchant rules (kept as quotes: these are read by the owner, not by the pricing code).
    const limits = all.filter((s) => /\d/.test(s) && /(maximum|max\.|limit|حد أقصى|الحد الأقصى).*(order|piece|quantit|product|طلب|قطع|منتج)|(order|piece|quantit|طلب|قطع).*(maximum|limit|حد أقصى)/i.test(s) && !/withdraw|سحب/i.test(s)).map(short);
    if (limits.length) put({ key: "order_limits", value: { rules: limits.slice(0, 8) }, summary: `Order or product limits: ${limits[0]}`, quote: limits[0], ...src, confidence: "low" });
    const pay = all.find((s) => /withdraw|سحب/i.test(s) && /minimum|حد أدنى/i.test(s));
    if (pay) put({ key: "payout", value: { rule: short(pay) }, summary: `Payout rule: ${short(pay).slice(0, 160)}`, quote: short(pay), ...src, confidence: "low" });
    const rules = all.filter((s) => /\bmust\b|not allowed|prohibited|forbidden|يمنع|ممنوع|غير مسموح|لا يسمح|يجب/i.test(s) && s.length < 300).map(short);
    if (rules.length) put({ key: "other_rules", value: { rules: rules.slice(0, 12) }, summary: `${rules.length} other merchant rule${rules.length > 1 ? "s" : ""} on the page.`, quote: rules[0], ...src, confidence: "low" });

    // Loyalty tiers and, when the page shows it, where our account stands.
    if (/loyalty|vip|reward|tier|program|ولاء/i.test(page.path + " " + (page.title ?? "")) || TIER.test(text)) {
      const tiers: { name: string; detail: string }[] = [];
      lines.forEach((l, i) => { const t = TIER.exec(l); if (!t || l.length > 200 || /current|your (?:level|tier)|مستواك|الحالي/i.test(l)) return; const name = t[1]; if (tiers.some((x) => x.name.toLowerCase() === name.toLowerCase())) return;
        tiers.push({ name, detail: short([l, lines[i + 1] ?? "", lines[i + 2] ?? ""].filter((x, j) => j === 0 || (!TIER.test(x) && x.length < 200)).join(" · ")) }); });
      let current = /(?:your (?:current )?(?:level|tier)|current (?:level|tier)|مستواك(?: الحالي)?|المستوى الحالي)\s*[:：-]?\s*(\S+)/i.exec(text)?.[1] ?? null;
      const scan = (v: unknown, depth = 0): void => { if (current || depth > 6 || !v || typeof v !== "object") return; for (const [k, x] of Object.entries(v as Record<string, unknown>)) { if (typeof x === "string" && /current.*(tier|level)|^(tier|level)(Name)?$/i.test(k) && x.length < 40) { current = x; return; } scan(x, depth + 1); } };
      for (const a of page.api ?? []) scan(a.json);
      const rate = /(\d{1,2})\s*%/.exec(all.find((s) => /delivery rate|نسبة التسليم|نسبة التوصيل/i.test(s) && /\d{1,2}\s*%/.test(s)) ?? "");
      if (tiers.length || current) put({ key: "loyalty", value: { tiers: tiers.slice(0, 8), current, delivery_rate_needed_pct: rate ? Number(rate[1]) : null },
        summary: `Loyalty programme: ${tiers.length ? tiers.map((t) => t.name).join(", ") : "tiers not listed"}${current ? `; our account: ${current}` : "; our level is not shown"}${rate ? `; needs a delivery rate above ${rate[1]}%` : ""}.`, quote: short(tiers[0]?.detail ?? String(current)), ...src, confidence: tiers.length >= 2 ? "high" : "low" });
    }
  }
  return [...found.values()];
}

// ---- what we plan with today, and where a page disagrees ----
/** The planning figures on file ("Known commercial facts" in the tracker; customer copy mirrors the customer-facing ones). */
export const KNOWN: Record<Market, { fee_minor: number[]; refusal_minor: number; vat_bps: number; return_days: number | null; delivery_days: { min: number; max: number } | null }> = {
  sa: { fee_minor: [2800], refusal_minor: 0, vat_bps: 1500, return_days: 7, delivery_days: { min: 2, max: 5 } },
  ae: { fee_minor: [1900], refusal_minor: 0, vat_bps: 0, return_days: 7, delivery_days: { min: 1, max: 2 } },
  om: { fee_minor: [3000], refusal_minor: 0, vat_bps: 0, return_days: 15, delivery_days: null },
  eg: { fee_minor: [9500, 10000, 10500], refusal_minor: 500, vat_bps: 0, return_days: 14, delivery_days: { min: 2, max: 5 } },
  iq: { fee_minor: [7000000], refusal_minor: 0, vat_bps: 0, return_days: null, delivery_days: null },
};
const feesOf = (v: Record<string, unknown>): number[] => (Array.isArray(v.zones) ? (v.zones as { fee_minor: number }[]).map((z) => Number(z.fee_minor)) : typeof v.flat_minor === "number" ? [v.flat_minor] : []).filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
/** What a refused or undelivered order costs us according to the stored facts (the dearer of the refusal fee and the shipped-return fee). */
const refusalOf = (facts: Map<string, Record<string, unknown>>) => Math.max(Number(facts.get("refusal_fee")?.fee_minor) || 0, Number(facts.get("return_fee")?.shipped_minor) || 0);

/** Every place a page says something different from what we plan with. Empty when the pages agree with us. */
export function contradictions(market: Market, facts: Pick<ExtractedFact, "key" | "value" | "source_path" | "source_read_at">[]): Contradiction[] {
  const m = MARKETS[market], k = KNOWN[market], out: Contradiction[] = [], money$ = (x: number) => `${minorToDecimal(x, m.minorDigits)} ${m.currency}`;
  for (const f of facts) {
    const src = { source_path: f.source_path, source_read_at: f.source_read_at };
    if (f.key === "delivery_fee") { const page = feesOf(f.value); if (page.length && page.join() !== k.fee_minor.join()) out.push({ key: f.key, known: k.fee_minor.map(money$).join(" / "), page: page.map(money$).join(" / "), costs_us_more: Math.max(...page) > Math.max(...k.fee_minor), ...src }); }
    if (f.key === "refusal_fee" || f.key === "return_fee") { const page = Number(f.key === "refusal_fee" ? f.value.fee_minor : f.value.shipped_minor) || 0; if (page !== k.refusal_minor) out.push({ key: f.key, known: k.refusal_minor ? money$(k.refusal_minor) + " per refused order" : "no charge for a refused order", page: money$(page) + (f.key === "return_fee" ? " per shipped order that is not received" : " per refused order"), costs_us_more: page > k.refusal_minor, ...src }); }
    if (f.key === "vat") { const page = Number(f.value.on_added_profit_bps) || 0; if (page !== k.vat_bps) out.push({ key: f.key, known: k.vat_bps / 100 + "% of added profit", page: page / 100 + "% of added profit", costs_us_more: page > k.vat_bps, ...src }); }
    if (f.key === "return_window") { const page = Number(f.value.days) || 0; if (page && page !== k.return_days) out.push({ key: f.key, known: k.return_days ? k.return_days + " days" : "no return window in our customer copy", page: page + " days" + (f.value.defect_only ? " (defective or not as described)" : ""), costs_us_more: false, ...src }); }
    if (f.key === "delivery_time") { const lo = Number(f.value.min_days), hi = Number(f.value.max_days); if (!k.delivery_days || k.delivery_days.min !== lo || k.delivery_days.max !== hi) out.push({ key: f.key, known: k.delivery_days ? `${k.delivery_days.min}–${k.delivery_days.max} days` : "no delivery time in our customer copy", page: `${lo}–${hi} days`, costs_us_more: false, ...src }); }
  }
  return out;
}
/** The decision a newly read fact starts with: it agrees with what we plan, or it waits for the owner. */
export function startingDecision(market: Market, f: Pick<ExtractedFact, "key" | "value" | "source_path" | "source_read_at">): FactDecision {
  return contradictions(market, [f]).length ? "pending" : "agrees";
}

/**
 * The market figures the brain plans with, after the stored page facts:
 * confirmed (or agreeing) facts replace ours; a pending fact is used only where it would cost us more.
 */
export function effectiveMarket(base: MarketFacts, stored: StoredFact[]): MarketFacts & { factsNotes: string[] } {
  const out = { ...base, factsNotes: [] as string[] }, use = new Map<string, Record<string, unknown>>(), cautious = new Map<string, Record<string, unknown>>();
  for (const f of stored) { if (f.decision === "confirmed" || f.decision === "agrees") use.set(f.key, f.value); else if (f.decision === "pending") cautious.set(f.key, f.value); }
  const money$ = (x: number) => `${minorToDecimal(x, base.minorDigits)} ${base.currency}`;
  const fees = feesOf(use.get("delivery_fee") ?? {});
  if (fees.length) { out.shippingZonesMinor = fees; out.shippingMinor = fees[Math.floor((fees.length - 1) / 2)]; }
  const waitingFees = feesOf(cautious.get("delivery_fee") ?? {});
  if (waitingFees.length && Math.max(...waitingFees) > worstDeliveryFee(out)) { out.shippingZonesMinor = [...(out.shippingZonesMinor ?? [out.shippingMinor]), Math.max(...waitingFees)].sort((a, b) => a - b);
    out.factsNotes.push(`Taager's page shows a delivery fee up to ${money$(Math.max(...waitingFees))}, above what we plan with. Until you confirm or reject it, free delivery and delivery-included prices are worked out with the higher fee.`); }
  if (use.has("refusal_fee") || use.has("return_fee")) out.refusalChargeMinor = refusalOf(use);
  const waitingRefusal = refusalOf(cautious);
  if (waitingRefusal > out.refusalChargeMinor) { out.refusalChargeMinor = waitingRefusal; out.factsNotes.push(`Taager's page shows ${money$(waitingRefusal)} charged for an order that is not received, above what we plan with. Until you decide, prices are checked against the higher charge.`); }
  const vat = use.get("vat"); if (vat && typeof vat.on_added_profit_bps === "number") out.vatOnAddedProfitBps = vat.on_added_profit_bps;
  const waitingVat = Number(cautious.get("vat")?.on_added_profit_bps) || 0;
  if (waitingVat > out.vatOnAddedProfitBps) { out.vatOnAddedProfitBps = waitingVat; out.factsNotes.push(`Taager's page shows ${waitingVat / 100}% VAT on added profit, above what we plan with. Until you decide, prices are checked against the higher rate.`); }
  return out;
}

/** The customer-facing part of the facts: only what is true for the shopper, never who the supplier is. */
export type CustomerFacts = { delivery_fee_minor: number[] | null; delivery_zones: { places: string[]; fee_minor: number }[] | null; delivery_days: { min: number; max: number } | null; return_days: number | null; return_defect_only: boolean; cash_on_delivery: true; open_before_paying: boolean | null };
export function customerFacts(stored: StoredFact[]): CustomerFacts {
  const use = new Map(stored.filter((f) => f.decision === "confirmed" || f.decision === "agrees").map((f) => [f.key, f.value]));
  const fee = use.get("delivery_fee"), time = use.get("delivery_time"), ret = use.get("return_window"), cod = use.get("cod");
  return {
    delivery_fee_minor: fee ? feesOf(fee) : null,
    delivery_zones: fee && Array.isArray(fee.zones) ? (fee.zones as { places: string[]; fee_minor: number }[]).map((z) => ({ places: z.places, fee_minor: z.fee_minor })) : null,
    delivery_days: time && Number(time.max_days) > 0 ? { min: Number(time.min_days), max: Number(time.max_days) } : null,
    return_days: ret && Number(ret.days) > 0 ? Number(ret.days) : null, return_defect_only: !!ret?.defect_only,
    cash_on_delivery: true, open_before_paying: cod && typeof cod.open_before_paying === "boolean" ? cod.open_before_paying : null,
  };
}

/** The "Taager rules" block of the morning brief: what changed since the last sync and what still contradicts our figures. */
export type RulesBrief = { pages_read_at: string | null; customer_copy: string[]; changes: { what: string; source: string; when: string | null }[]; contradictions: { what: string; ours: string; page: string; source: string; status: string }[]; planning_notes: string[]; loyalty: string | null };
export function rulesBrief(market: Market, stored: StoredFact[], sinceIso: string | null): RulesBrief {
  const label = (k: string) => k.replace(/_/g, " ");
  const changes = stored.filter((f) => f.changed_at && f.previous_value && (!sinceIso || f.changed_at >= sinceIso)).map((f) => ({ what: `${label(f.key)} changed: ${f.summary ?? ""}`.trim(), source: f.source_path ?? "", when: f.changed_at ?? null }));
  const open = stored.filter((f) => f.decision === "pending" || f.decision === "confirmed");
  const cons = contradictions(market, open.map((f) => ({ key: f.key as FactKey, value: f.value, source_path: f.source_path ?? "", source_read_at: f.source_read_at ?? null })));
  return {
    pages_read_at: stored.reduce<string | null>((t, f) => (f.source_read_at && (!t || f.source_read_at > t) ? f.source_read_at : t), null), changes,
    contradictions: cons.map((c) => ({ what: label(c.key), ours: c.known, page: c.page, source: c.source_path, status: stored.find((f) => f.key === c.key)?.decision === "confirmed" ? "confirmed: the page is used" : c.costs_us_more ? "waiting for you; the dearer figure is already used for safety" : "waiting for you" })),
    // A confirmed page fact the shopper reads about: our written customer pages must say the same.
    customer_copy: cons.filter((c) => (c.key === "delivery_fee" || c.key === "delivery_time" || c.key === "return_window") && stored.find((f) => f.key === c.key)?.decision === "confirmed")
      .map((c) => `Customer pages say ${c.known} for ${label(c.key)}; the confirmed page says ${c.page}. The store's facts feed already uses the page; the written ${market.toUpperCase()} pages need the same change.`),
    planning_notes: effectiveMarket(MARKETS[market], stored).factsNotes, loyalty: stored.find((f) => f.key === "loyalty")?.summary ?? null,
  };
}

// ---- loading (service role; the daily loop and the brain) ----
type Reader = { select: <T = Record<string, unknown>>(table: string, query: string) => Promise<T[]> };
type Guards = { delivery_fee_minor: number; vat_added_profit_bps: number; refusal_charge_minor?: number | null };
/** The market figures after the stored facts, tied to the database's own price guards (the dearer of the two always wins). */
export function marketFromGuards(base: MarketFacts, stored: StoredFact[], guards: Guards | null): MarketFacts & { factsNotes: string[] } {
  const m = effectiveMarket(base, stored);
  if (!guards) return m;
  const fee = Number(guards.delivery_fee_minor) || 0;
  if (fee > worstDeliveryFee(m)) m.shippingZonesMinor = [...(m.shippingZonesMinor ?? [m.shippingMinor]), fee].sort((a, b) => a - b);
  m.vatOnAddedProfitBps = Math.max(m.vatOnAddedProfitBps, Number(guards.vat_added_profit_bps) || 0);
  m.refusalChargeMinor = Math.max(m.refusalChargeMinor, Number(guards.refusal_charge_minor) || 0);
  return m;
}
/** Read the stored facts for a market. Any failure (for example the tables do not exist yet) falls back to the planning figures on file. */
export async function loadMarket(db: Reader, market: Market): Promise<{ m: MarketFacts & { factsNotes: string[] }; stored: StoredFact[] }> {
  try {
    const rows = await db.select<{ fact_key: string; value: Record<string, unknown>; decision: FactDecision; summary: string; source_path: string; source_read_at: string | null; changed_at: string | null; previous_value: Record<string, unknown> | null }>(
      "taager_market_facts", `select=fact_key,value,decision,summary,source_path,source_read_at,changed_at,previous_value&market=eq.${market}&is_current=eq.true&limit=40`);
    const stored: StoredFact[] = rows.map((r) => ({ key: r.fact_key, value: r.value, decision: r.decision, summary: r.summary, source_path: r.source_path, source_read_at: r.source_read_at, changed_at: r.changed_at, previous_value: r.previous_value }));
    const guards = (await db.select<Guards>("store_commerce_facts", `select=delivery_fee_minor,vat_added_profit_bps,refusal_charge_minor&store_code=eq.${market}`))[0] ?? null;
    return { m: marketFromGuards(MARKETS[market], stored, guards), stored };
  } catch { return { m: { ...MARKETS[market], factsNotes: [] }, stored: [] }; }
}
