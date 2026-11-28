// The Yawmiyati assistant on WhatsApp: one number for the five stores (WhatsApp Business Cloud API).
// It answers product questions, payment, delivery and returns with the store's own published sentences, tells an
// order's status when the message comes from the phone that placed it, records the confirmation tap the order-quality
// filter asks for, and hands real exceptions to the owner. It never invents a fact, never quotes a price that is not
// the product's current price, and never uses paid AI: every answer here is rule-based and free.
// Pure functions; the endpoint (yawmiyati-whatsapp) does the I/O. Behind a flag, with no number configured.
import { detectIntent, formatMoney, latinDigits, normalize, searchProducts, type AssistantMarket, type AssistantProduct, type Intent } from "./core.ts";

export type WaMessage = { id: string; from: string; phone_number_id: string; type: string; text: string; name_ignored?: true };
type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);

/** Meta's webhook verification (GET): echo the challenge only for our own verify token. */
export function verifyChallenge(params: URLSearchParams, verifyToken: string | undefined): string | null {
  return verifyToken && verifyToken.length >= 16 && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === verifyToken ? params.get("hub.challenge") : null;
}
/** X-Hub-Signature-256 check: the body really comes from Meta (HMAC-SHA-256 with the app secret), compared in constant time. */
export async function validSignature(rawBody: string, header: string | null, appSecret: string | undefined): Promise<boolean> {
  if (!appSecret || !header || !/^sha256=[0-9a-f]{64}$/.test(header)) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const given = header.slice(7);
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= sig.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}
/** Text messages of one webhook delivery. The sender's profile name is never read. Statuses and other events are ignored. */
export function parseIncoming(payload: unknown): WaMessage[] {
  const out: WaMessage[] = [];
  if (!isRec(payload) || payload.object !== "whatsapp_business_account") return out;
  for (const entry of Array.isArray(payload.entry) ? payload.entry : []) for (const change of isRec(entry) && Array.isArray(entry.changes) ? entry.changes : []) {
    const value = isRec(change) && isRec(change.value) ? change.value : null;
    if (!value || !isRec(value.metadata)) continue;
    for (const m of Array.isArray(value.messages) ? value.messages : []) {
      if (!isRec(m) || typeof m.id !== "string" || typeof m.from !== "string" || !/^\d{8,15}$/.test(m.from)) continue;
      const text = isRec(m.text) && typeof m.text.body === "string" ? m.text.body : isRec(m.button) && typeof m.button.text === "string" ? m.button.text
        : isRec(m.interactive) && isRec(m.interactive.button_reply) && typeof m.interactive.button_reply.title === "string" ? m.interactive.button_reply.title : "";
      out.push({ id: m.id.slice(0, 200), from: m.from, phone_number_id: String(value.metadata.phone_number_id ?? ""), type: String(m.type ?? "unknown"), text: text.slice(0, 1000) });
    }
  }
  return out.slice(0, 20);
}

const PHONE: [AssistantMarket, RegExp][] = [["sa", /^9665\d{8}$/], ["ae", /^9715\d{8}$/], ["om", /^968[79]\d{7}$/], ["eg", /^201[0125]\d{8}$/], ["iq", /^9647\d{9}$/]];
/** The store a WhatsApp number belongs to by its country code, or null (an expat number: the assistant asks which store). */
export const marketOfPhone = (from: string): AssistantMarket | null => PHONE.find(([, re]) => re.test(from))?.[0] ?? null;
const COUNTRY_WORDS: [AssistantMarket, RegExp][] = [["sa", /السعوديه|سعوديه|الرياض|جده|ksa|saudi/], ["ae", /الامارات|امارات|دبي|ابوظبي|uae|emirates/], ["om", /عمان|مسقط|oman/], ["eg", /مصر|القاهره|egypt/], ["iq", /العراق|عراق|بغداد|iraq/]];
/** A store named in the message ("السعودية", "مصر", ...), for numbers from another country. */
export function marketInText(text: string): AssistantMarket | null {
  const t = normalize(text);
  return COUNTRY_WORDS.find(([, re]) => re.test(t))?.[0] ?? null;
}
/** An order number in the message: 3 to 12 digits, optionally with "#" or a short prefix (e.g. "YM-1042"). */
export function orderNumberIn(text: string): string | null {
  const m = /(?:^|[\s#:،,.-])(?:ym[-\s]?)?(\d{3,12})(?!\d)/i.exec(" " + latinDigits(text));
  return m ? m[1] : null;
}

export type WaFacts = { market: AssistantMarket; currency: string; minor_digits: number; payment: string; shipping: string; delivery: string; returns: string; confirmation_call: string; tracking: string;
  help: string; sections: { slug: string; name: string }[];
  assistant: { greeting: string; which_country: string; order_ask: string; order_not_found: string; status: Record<"placed" | "confirmed" | "shipped" | "delivered" | "closed", string>;
    confirm_done: string; confirm_unknown: string; handover: string; human_word: string; confirm_word: string; text_only: string; dont_know: string; nothing_fits: string; found: string; sections_lead: string } };
/** The store facts JSON the storefront serves, checked before use. Null when a required sentence is missing. */
export function parseFacts(raw: unknown, market: AssistantMarket): WaFacts | null {
  if (!isRec(raw) || raw.market !== market || !isRec(raw.assistant) || !isRec(raw.assistant.status)) return null;
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 900) : null);
  const a = raw.assistant, st = raw.assistant.status as Rec;
  const need = { payment: s(raw.payment), shipping: s(raw.shipping), delivery: s(raw.delivery), returns: s(raw.returns), confirmation_call: s(raw.confirmation_call), tracking: s(raw.tracking), help: s(raw.help), currency: s(raw.currency) };
  const words = { greeting: s(a.greeting), which_country: s(a.which_country), order_ask: s(a.order_ask), order_not_found: s(a.order_not_found), confirm_done: s(a.confirm_done), confirm_unknown: s(a.confirm_unknown),
    handover: s(a.handover), human_word: s(a.human_word), confirm_word: s(a.confirm_word), text_only: s(a.text_only), dont_know: s(a.dont_know), nothing_fits: s(a.nothing_fits), found: s(a.found), sections_lead: s(a.sections_lead) };
  const status = { placed: s(st.placed), confirmed: s(st.confirmed), shipped: s(st.shipped), delivered: s(st.delivered), closed: s(st.closed) };
  if ([...Object.values(need), ...Object.values(words), ...Object.values(status)].some((v) => v === null) || typeof raw.minor_digits !== "number") return null;
  return { market, minor_digits: raw.minor_digits, ...(need as Record<keyof typeof need, string>), sections: (Array.isArray(raw.sections) ? raw.sections : []).filter(isRec).map((x) => ({ slug: String(x.slug), name: String(x.name) })).slice(0, 10),
    assistant: { ...(words as Record<keyof typeof words, string>), status: status as WaFacts["assistant"]["status"] } };
}

export type OrderLookup = { status: "placed" | "confirmed" | "shipped" | "delivered" | "refused" | "returned" | "unreachable" | "cancelled" | "unknown" } | null;
export type WaPlan =
  | { kind: "reply"; text: string; intent: Intent | "confirm" | "order" | "country" | "non_text" }
  | { kind: "handover"; text: string; reason: string }
  | { kind: "lookup_order"; number: string; confirm: boolean };

/**
 * First step for one message: what the adapter must do. Order questions and confirmation taps need a database lookup
 * (`lookup_order`); everything else is answered at once from the store's published sentences and released products.
 */
export function planMessage(msg: Pick<WaMessage, "text" | "type">, facts: WaFacts, products: readonly AssistantProduct[], storeOrigin: string): WaPlan {
  const a = facts.assistant, text = msg.text.trim();
  if (!text) return { kind: "reply", text: a.text_only, intent: "non_text" };
  const t = normalize(text);
  if (t.includes(normalize(a.human_word))) return { kind: "handover", text: a.handover, reason: "asked_for_a_person" };
  const number = orderNumberIn(text), confirm = t.startsWith(normalize(a.confirm_word));
  if (confirm) return number ? { kind: "lookup_order", number, confirm: true } : { kind: "reply", text: a.order_ask, intent: "confirm" };
  const intent = detectIntent(text);
  if (intent === "order_status" || (number && t.replace(/[\s#\d-]|ym/gi, "").length <= 12)) return number ? { kind: "lookup_order", number, confirm: false } : { kind: "reply", text: a.order_ask, intent: "order" };
  if (intent === "human") return { kind: "handover", text: a.handover, reason: "asked_for_a_person" };
  if (intent === "greeting") return { kind: "reply", text: a.greeting, intent };
  if (intent === "payment") return { kind: "reply", text: facts.payment, intent };
  if (intent === "delivery" || intent === "free_delivery") return { kind: "reply", text: facts.shipping + "\n" + facts.delivery, intent };
  if (intent === "returns") return { kind: "reply", text: facts.returns, intent };
  if (intent === "confirmation_call") return { kind: "reply", text: facts.confirmation_call, intent };
  if (intent === "sections") return { kind: "reply", text: a.sections_lead + "\n" + facts.sections.map((s) => `${s.name}: ${storeOrigin}/${facts.market}/c/${s.slug}`).join("\n"), intent };
  const hits = searchProducts(text, products, facts.minor_digits, 3);
  if (hits.length) return { kind: "reply", intent: "products", text: a.found + "\n" + hits.map((p) => `${p.title}\n${formatMoney(p.price_minor, facts)}\n${storeOrigin}/${facts.market}/p/${p.slug}`).join("\n\n") };
  // Nothing certain to say: a complaint or a special case goes to a person, an unclear question gets the honest answer.
  if (/مشكله|شكوى|تالف|مكسور|غلط|خطا|ما وصل|لم يصل|متاخر|استرجاع فلوس|refund|complain|damaged|wrong/.test(t)) return { kind: "handover", text: a.handover, reason: "possible_complaint" };
  return { kind: "reply", text: a.dont_know + "\n" + facts.help, intent: "other" };
}
/** Second step for an order question or a confirmation tap, once the database has answered. */
export function planOrderReply(facts: WaFacts, order: OrderLookup, confirm: { asked: boolean; done: boolean }): WaPlan {
  const a = facts.assistant;
  if (confirm.asked) return confirm.done ? { kind: "reply", text: a.confirm_done, intent: "confirm" } : { kind: "reply", text: a.confirm_unknown, intent: "confirm" };
  if (!order) return { kind: "reply", text: a.order_not_found, intent: "order" };
  const s = order.status;
  if (s === "unknown") return { kind: "handover", text: a.handover, reason: "order_status_unknown" };
  const line = s === "placed" || s === "confirmed" || s === "shipped" || s === "delivered" ? a.status[s] : a.status.closed;
  return { kind: "reply", text: line + (s === "shipped" ? "\n" + facts.tracking : ""), intent: "order" };
}

export type WaEnv = { token: string; phoneNumberId: string; graphVersion?: string };
/** Sends one text reply through the Cloud API. Text only, at most 1,500 characters, link previews off. */
export async function sendText(env: WaEnv, to: string, text: string, f: typeof fetch = fetch): Promise<boolean> {
  if (!/^\d{8,15}$/.test(to) || !/^\d{6,20}$/.test(env.phoneNumberId)) return false;
  const res = await f(`https://graph.facebook.com/${env.graphVersion ?? "v21.0"}/${env.phoneNumberId}/messages`, { method: "POST", signal: AbortSignal.timeout(10000),
    headers: { authorization: "Bearer " + env.token, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: text.slice(0, 1500) } }) });
  return res.ok;
}
/** The note the owner receives for a handover: the question and a tap-to-chat link, nothing stored. */
export const ownerNote = (market: AssistantMarket | null, from: string, text: string, reason: string) =>
  `Yawmiyati ${market ? market.toUpperCase() : "?"} · customer needs you (${reason.replace(/_/g, " ")})\n"${text.slice(0, 500)}"\nReply to her: https://wa.me/${from}`;
