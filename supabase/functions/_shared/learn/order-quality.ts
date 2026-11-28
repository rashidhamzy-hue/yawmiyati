// Order-quality filter: what is checked BEFORE an order may reach the supplier, and the customer blacklist rule.
// Pure functions. The database (order_gate) applies the same decisions with its own counts; the order form's server
// step calls it at submit (G3). Nothing here stores or logs a name, a phone number or an address.
//
// Blacklist (owner rule, 28 Nov 2026): only a keyed one-way hash of the phone and counts of undelivered orders.
//   1 undelivered order (refused, returned, unreachable) in 90 days → the next order needs a WhatsApp confirmation tap.
//   2 or more                                                       → the order form politely refuses.
// The owner can unblock a number in /admin; counting restarts from that moment.
import type { Market } from "../brain/markets.ts";
import { normalizePhone } from "./woo-orders.ts";

export const BLACKLIST_WINDOW_DAYS = 90;
export type RiskLevel = "none" | "confirm" | "blocked";
export const riskLevel = (undeliveredIn90Days: number): RiskLevel => (undeliveredIn90Days >= 2 ? "blocked" : undeliveredIn90Days === 1 ? "confirm" : "none");

/** National mobile-number shape per market after the country code (digits only). */
const MOBILE: Record<Market, { dial: string; re: RegExp }> = {
  sa: { dial: "+966", re: /^9665\d{8}$/ },
  ae: { dial: "+971", re: /^9715\d{8}$/ },
  om: { dial: "+968", re: /^968[79]\d{7}$/ },
  eg: { dial: "+20", re: /^201[0125]\d{8}$/ },
  iq: { dial: "+964", re: /^9647\d{9}$/ },
};
/** The phone as international digits when it is a mobile number of THIS market; otherwise null (wrong country or not a mobile). */
export function marketMobile(raw: string, market: Market): string | null {
  const n = normalizePhone(raw, MOBILE[market].dial);
  return n && MOBILE[market].re.test(n) ? n : null;
}
/** Which other market a number belongs to, for the "this store delivers inside X" message; null when unknown. */
export function otherMarketOf(raw: string, market: Market): Market | null {
  const digits = raw.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660)).replace(/\D/g, "").replace(/^00/, "");
  for (const m of Object.keys(MOBILE) as Market[]) if (m !== market && MOBILE[m].re.test(digits)) return m;
  return null;
}

const letters = (s: string) => (s.match(/\p{L}/gu) ?? []).length;
const TEST_WORDS = /^(test|testing|tester|asdf+|qwer+|zxcv+|abc+|xxx+|aaa+|name|no ?name|none|null|undefined|fake|تجربه|تجربة|اختبار|تست|اسم|لا يوجد|بدون اسم|مجهول)$/i;
/** Why a recipient name cannot be a real one, or null when it looks fine. Arabic and Latin names both pass. */
export function nameProblem(raw: string): "too_short" | "not_a_name" | "test_text" | "repeated_characters" | null {
  const name = raw.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (letters(name) < 3) return "too_short";
  if (/\d{2,}|https?:|www\.|@|[<>{}[\]|\\^~_=+*#$%]/.test(name)) return "not_a_name";
  if (letters(name) / name.replace(/\s/g, "").length < 0.8) return "not_a_name";
  if (TEST_WORDS.test(name)) return "test_text";
  const compact = name.replace(/\s/g, "").toLowerCase();
  // Short pet names with two letters are real ("لولو", "Lulu", "Mimi"); six or more characters from two letters are not.
  if (/(.)\1{3,}/u.test(compact) || (compact.length >= 6 && new Set(compact).size <= 2)) return "repeated_characters";
  return null;
}

export type GateInput = {
  market: Market; phone: string; name: string;
  /** Undelivered orders of this phone hash in the last 90 days, since the owner's last unblock. */
  undelivered90: number;
  /** Earlier attempts by the same phone / the same browser in the last hour, and an identical basket in the last 24 hours. */
  phoneLastHour: number; browserLastHour: number; sameBasket24h: number;
};
export type GateDecision =
  | { action: "allow" }
  | { action: "fix_form"; field: "phone"; reason: "wrong_country_phone" | "invalid_phone"; other_market: Market | null }
  | { action: "refuse"; reason: "blacklisted" }
  | { action: "confirm_whatsapp"; reason: "one_undelivered_order" }
  | { action: "hold"; reasons: ("invalid_name" | "duplicate_order" | "too_many_orders_phone" | "too_many_orders_browser")[]; name_problem: ReturnType<typeof nameProblem> };
export const MAX_PER_PHONE_PER_HOUR = 3, MAX_PER_BROWSER_PER_HOUR = 4;

/**
 * One decision per order attempt, in this order: a phone that is not a mobile of this market is fixed in the form;
 * a blacklisted number is refused politely; an invalid name, a duplicate basket or too many attempts wait for the
 * owner in /admin; one undelivered order asks for a WhatsApp confirmation tap; everything else goes through.
 */
export function gateOrder(i: GateInput): GateDecision {
  if (!marketMobile(i.phone, i.market)) { const other = otherMarketOf(i.phone, i.market); return { action: "fix_form", field: "phone", reason: other ? "wrong_country_phone" : "invalid_phone", other_market: other }; }
  if (riskLevel(i.undelivered90) === "blocked") return { action: "refuse", reason: "blacklisted" };
  const reasons: Extract<GateDecision, { action: "hold" }>["reasons"] = [];
  const np = nameProblem(i.name);
  if (np) reasons.push("invalid_name");
  if (i.sameBasket24h > 0) reasons.push("duplicate_order");
  if (i.phoneLastHour >= MAX_PER_PHONE_PER_HOUR) reasons.push("too_many_orders_phone");
  if (i.browserLastHour >= MAX_PER_BROWSER_PER_HOUR) reasons.push("too_many_orders_browser");
  if (reasons.length) return { action: "hold", reasons, name_problem: np };
  if (riskLevel(i.undelivered90) === "confirm") return { action: "confirm_whatsapp", reason: "one_undelivered_order" };
  return { action: "allow" };
}

/** Stable fingerprint of a basket (sorted sku:quantity pairs) for duplicate detection. Not a secret, holds nothing personal. */
export async function basketHash(items: { sku: string; quantity: number }[]): Promise<string> {
  const text = items.map((i) => `${i.sku}:${i.quantity}`).sort().join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
