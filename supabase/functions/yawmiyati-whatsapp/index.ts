// Yawmiyati assistant on WhatsApp — webhook for the WhatsApp Business Cloud API (one number for the five stores).
// OFF BY DEFAULT: it answers only when WHATSAPP_ENABLED is exactly "true" AND the number's secrets exist. Without
// them every POST is acknowledged and ignored, and nothing is sent. Deployed with JWT verification off because Meta
// calls it; every POST must carry Meta's signature (X-Hub-Signature-256, checked with the app secret).
// Secrets (Supabase Edge Function secrets):
//   WHATSAPP_ENABLED          "true" to switch the assistant on (the owner's switch)
//   WHATSAPP_VERIFY_TOKEN     any long random text; typed once into Meta's webhook setup
//   WHATSAPP_APP_SECRET       the Meta app's secret (signature check)
//   WHATSAPP_TOKEN            permanent access token of the system user
//   WHATSAPP_PHONE_NUMBER_ID  the number's id in the Cloud API
//   OWNER_WHATSAPP            the owner's own WhatsApp number, digits with country code (handover notes)
//   BLACKLIST_HASH_KEY        the same phone-hash key as the daily loop (order lookups)
//   STOREFRONT_ORIGIN         e.g. https://yawmiyati.shop (store facts and product links)
// Free and rule-based: no paid AI is called from here. It keeps no phone number and no message text.
import { createDb } from "../_shared/brain/db.ts";
import { rateLimiter, type AssistantMarket, type AssistantProduct } from "../_shared/assistant/core.ts";
import { marketInText, marketOfPhone, ownerNote, parseFacts, parseIncoming, planMessage, planOrderReply, sendText, validSignature, verifyChallenge, type OrderLookup, type WaFacts } from "../_shared/assistant/whatsapp.ts";
import { phoneHash } from "../_shared/learn/woo-orders.ts";

const ok = (body: unknown = { received: true }) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const allow = rateLimiter(15, 5 * 60_000);
const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET") {
    const challenge = verifyChallenge(url.searchParams, Deno.env.get("WHATSAPP_VERIFY_TOKEN"));
    return challenge ? new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } }) : new Response("forbidden", { status: 403 });
  }
  if (req.method !== "POST") return new Response(null, { status: 405 });
  const raw = await req.text();
  const enabled = Deno.env.get("WHATSAPP_ENABLED") === "true";
  const token = Deno.env.get("WHATSAPP_TOKEN"), phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID"), appSecret = Deno.env.get("WHATSAPP_APP_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), anon = Deno.env.get("SUPABASE_ANON_KEY");
  const origin = (Deno.env.get("STOREFRONT_ORIGIN") ?? "https://yawmiyati.shop").replace(/\/$/, "");
  if (!enabled || !token || !phoneNumberId || !appSecret || !supabaseUrl || !service || !anon) return ok({ received: true, ignored: "assistant is switched off or not configured" });
  if (!(await validSignature(raw, req.headers.get("x-hub-signature-256"), appSecret))) return new Response("bad signature", { status: 401 });
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return ok(); }
  const db = createDb(supabaseUrl, service), env = { token, phoneNumberId };
  const hashKey = (Deno.env.get("BLACKLIST_HASH_KEY") ?? "").length >= 32 ? Deno.env.get("BLACKLIST_HASH_KEY")! : null;
  const owner = Deno.env.get("OWNER_WHATSAPP") ?? "";
  for (const msg of parseIncoming(payload)) {
    try {
      if (msg.phone_number_id !== phoneNumberId) continue;
      if (!(await db.rpc<boolean>("whatsapp_seen_once", { p_message_id: msg.id }))) continue; // Meta retried a delivery we already answered
      if (!allow(msg.from)) continue;
      const market: AssistantMarket = marketOfPhone(msg.from) ?? marketInText(msg.text) ?? "sa";
      const knownMarket = marketOfPhone(msg.from) !== null || marketInText(msg.text) !== null;
      const facts = await cached<WaFacts | null>("facts:" + market, 10 * 60_000, async () => {
        const res = await fetch(`${origin}/api/store-facts/${market}.json`, { signal: AbortSignal.timeout(8000) });
        return res.ok ? parseFacts(await res.json(), market) : null;
      });
      if (!facts) continue; // never answer without the store's own published sentences
      const products = await cached<AssistantProduct[]>("products:" + market, 5 * 60_000, async () => {
        const res = await fetch(supabaseUrl.replace(/\/$/, "") + "/rest/v1/rpc/public_catalog", { method: "POST", headers: { apikey: anon, "content-type": "application/json" }, body: JSON.stringify({ p_store: market, p_limit: 100, p_offset: 0 }), signal: AbortSignal.timeout(8000) });
        const rows = res.ok ? await res.json() : [];
        return (Array.isArray(rows) ? rows : []).filter((r) => r && typeof r.slug === "string" && typeof r.title === "string")
          .map((r) => ({ slug: r.slug, title: r.title, price_minor: Number(r.price_minor), category: Array.isArray(r.approved_category_slugs) ? r.approved_category_slugs[0] ?? null : null,
            delivery_included: r.delivery_included === true, is_new: r.is_new === true })).filter((p) => Number.isSafeInteger(p.price_minor) && p.price_minor > 0);
      }).catch(() => [] as AssistantProduct[]);
      let plan = planMessage(msg, facts, products, origin);
      if (plan.kind === "lookup_order") {
        const hash = hashKey ? await phoneHash(msg.from, hashKey) : null;
        if (!hash) plan = { kind: "handover", text: facts.assistant.handover, reason: "order_lookup_not_configured" };
        else if (plan.confirm) {
          const done = await db.rpc<{ confirmed: boolean }>("order_whatsapp_confirm", { p_order_ref: plan.number, p_phone_hash: hash });
          plan = planOrderReply(facts, null, { asked: true, done: done?.confirmed === true });
        } else plan = planOrderReply(facts, await db.rpc<OrderLookup>("order_status_lookup", { p_order_number: plan.number, p_phone_hash: hash }), { asked: false, done: false });
      }
      // A number from outside the five countries that named no store: ask once which store, alongside the answer.
      const text = plan.kind === "lookup_order" ? facts.assistant.dont_know : !knownMarket && plan.kind === "reply" && plan.intent !== "order" && plan.intent !== "confirm" ? plan.text + "\n\n" + facts.assistant.which_country : plan.text;
      await sendText(env, msg.from, text);
      if (plan.kind === "handover" && /^\d{8,15}$/.test(owner)) await sendText(env, owner, ownerNote(knownMarket ? market : null, msg.from, msg.text, plan.reason));
    } catch (e) { console.error("whatsapp_message_failed", String(e).slice(0, 200)); }
  }
  return ok();
});
