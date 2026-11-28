// Yawmiyati shopping assistant: the paid answers (v2, 29 Nov 2026). OFF for visitors until the owner switches a
// market on in /admin; three independent gates must all be open: the YAWMIYATI_ASSISTANT_AI_ENABLED secret, the
// market's policy row (enabled + a daily dollar budget), and the storefront's public flag.
//   - Answers only from verified facts: this market's published catalogue and approved offers (release-gated RPCs)
//     and the store's own published policies (/api/store-facts/<market>.json on the allow-listed storefront).
//   - Policy questions never reach the model: the browser answers them from the same published text, free and exact.
//   - Every paid call reserves its worst-case cost against the market's daily budget first and records the real cost.
//   - A reply that mentions an unknown amount, a link, a phone number or a percentage is discarded.
//   - Nothing about the visitor is stored. Rate limits live in memory only; logs carry no message text.
import { ASSISTANT_MODELS, buildPrompt, costMicroUsd, detectIntent, estimateTurnMicroUsd, looksAbusive, MAX_HISTORY, MAX_OUTPUT_TOKENS, MAX_QUESTION,
  parseModelReply, rateLimiter, searchProducts, verifyReply, type AssistantProduct, type AssistantTurn, type StoreFacts } from "../_shared/assistant/core.ts";

const MARKETS = new Set(["sa", "ae", "om", "eg", "iq"]);
const MAX_BODY = 9000;
const perMinute = rateLimiter(8, 60_000), perHour = rateLimiter(60, 3_600_000);
const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}
function output(data: unknown, status: number, origin: string | null) {
  const headers: Record<string, string> = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", vary: "Origin" };
  if (origin) headers["access-control-allow-origin"] = origin;
  return new Response(JSON.stringify(data), { status, headers });
}
const sha256 = async (text: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, "0")).join("");
const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max;

function parseFacts(raw: unknown, market: string): StoreFacts | null {
  if (!rec(raw) || raw.market !== market) return null;
  for (const k of ["country", "currency", "dialect", "payment", "shipping", "delivery", "returns", "confirmation_call", "tracking"]) if (!str(raw[k], 1200)) return null;
  if (!Number.isInteger(raw.minor_digits) || !Array.isArray(raw.sections)) return null;
  return { market: market as StoreFacts["market"], country: raw.country as string, currency: raw.currency as string, minor_digits: raw.minor_digits as number, dialect: raw.dialect as string,
    payment: raw.payment as string, shipping: raw.shipping as string, delivery: raw.delivery as string, returns: raw.returns as string, confirmation_call: raw.confirmation_call as string, tracking: raw.tracking as string,
    free_delivery: null, human: str(raw.human, 200) && /^https:\/\/wa\.me\/\d{8,15}$/.test(raw.human as string) ? raw.human as string : null,
    sections: (raw.sections as unknown[]).filter(rec).filter((s) => str(s.slug, 40) && str(s.name, 80)).slice(0, 12).map((s) => ({ slug: s.slug as string, name: s.name as string })) };
}
function parseProducts(rows: unknown): AssistantProduct[] {
  if (!Array.isArray(rows)) return [];
  const now = Date.now();
  return rows.filter(rec).filter((r) => str(r.slug, 200) && str(r.title, 500) && typeof r.price_minor === "string" && /^\d+$/.test(r.price_minor))
    .sort((a, b) => (Number(a.rank) || 9999) - (Number(b.rank) || 9999)).map((r) => {
      const sale = Number.isSafeInteger(r.sale_price_minor) && (r.sale_price_minor as number) > 0 && typeof r.sale_ends_at === "string" && Date.parse(r.sale_ends_at) > now;
      return { slug: r.slug as string, title: r.title as string, price_minor: sale ? r.sale_price_minor as number : Number(r.price_minor),
        category: Array.isArray(r.approved_category_slugs) && typeof r.approved_category_slugs[0] === "string" ? r.approved_category_slugs[0] : null,
        offer: r.offer === true, is_bundle: r.kind === "bundle", is_new: r.is_new === true, free_delivery: r.free_delivery === true, delivery_included: r.delivery_included === true,
        sale_until: sale ? r.sale_ends_at as string : null };
    });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const allowed = (Deno.env.get("YAWMIYATI_ASSISTANT_ALLOWED_ORIGINS") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const evalToken = req.headers.get("x-yawmiyati-eval");
  // Browsers must come from an allow-listed storefront. The builder's test path has no browser origin and proves itself with a token.
  if (!evalToken && (!origin || !allowed.includes(origin))) return output({ error: "Origin not allowed" }, 403, null);
  const cors = evalToken ? null : origin;
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": origin ?? "", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type, apikey, authorization", "access-control-max-age": "600", vary: "Origin" } });
  if (req.method !== "POST") return output({ error: "Method not allowed" }, 405, cors);
  let data: Record<string, unknown>;
  try { const raw = await req.text(); if (raw.length > MAX_BODY) return output({ error: "Request too large" }, 413, cors); const body = JSON.parse(raw); if (!rec(body)) throw Error(); data = body; }
  catch { return output({ error: "Invalid JSON" }, 400, cors); }
  const { market, message, history } = data;
  if (typeof market !== "string" || !MARKETS.has(market) || typeof message !== "string" || !message.trim() || message.length > MAX_QUESTION || !Array.isArray(history) || history.length > MAX_HISTORY
    || history.some((h) => !rec(h) || (h.role !== "visitor" && h.role !== "assistant") || typeof h.text !== "string" || h.text.length > 900)) return output({ error: "Invalid message" }, 400, cors);
  const page = rec(data.page) && str(data.page.title, 300) ? { title: data.page.title as string } : null;

  // Abuse protection: per-address limits in memory (the address is never written anywhere), and no paid call for
  // injection attempts or for questions the published policies already answer word for word.
  const address = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (!perMinute(address) || !perHour(address)) return output({ fallback: true, reason: "rate_limited" }, 429, cors);
  const intent = detectIntent(message);
  if (looksAbusive(message) || !["products", "other", "free_delivery"].includes(intent)) return output({ fallback: true, reason: "answered_locally" }, 200, cors);

  const endpoint = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (Deno.env.get("YAWMIYATI_ASSISTANT_AI_ENABLED") !== "true" || !endpoint || !serviceKey || !apiKey) return output({ fallback: true, reason: "not_configured" }, 503, cors);
  const rpc = async (fn: string, body: unknown) => {
    const r = await fetch(new URL("/rest/v1/rpc/" + fn, endpoint), { method: "POST", headers: { apikey: serviceKey, authorization: "Bearer " + serviceKey, "content-type": "application/json" }, body: JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw Error("rpc_" + fn + "_" + r.status);
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  };
  let isEval = false;
  try { if (evalToken) { isEval = (await rpc("assistant_eval_allowed", { p_store: market, p_token_sha256: await sha256(evalToken) })) === true; if (!isEval) return output({ error: "Not allowed" }, 403, null); } }
  catch { return output({ fallback: true, reason: "unavailable" }, 503, cors); }

  // Verified facts. A test call may bring its own facts and products (fixtures); visitors never can.
  let facts: StoreFacts | null, products: AssistantProduct[];
  try {
    const storefront = isEval ? (str(data.eval_origin, 200) && allowed.includes(data.eval_origin as string) ? data.eval_origin as string : null) : origin;
    facts = isEval && rec(data.eval_facts) ? parseFacts(data.eval_facts, market)
      : storefront ? await cached("facts:" + storefront + ":" + market, 300_000, async () => parseFacts(await (await fetch(storefront + "/api/store-facts/" + market + ".json", { redirect: "error", signal: AbortSignal.timeout(6000) })).json(), market)) : null;
    if (!facts) return output({ fallback: true, reason: "no_store_facts" }, 503, cors);
    if (isEval && Array.isArray(data.eval_products)) products = parseProducts(data.eval_products);
    else {
      products = await cached("catalog:" + market, 120_000, async () => {
        const all: unknown[] = [];
        for (let offset = 0; offset < 300; offset += 100) { const page = await rpc("public_catalog", { p_store: market, p_limit: 100, p_offset: offset }); if (!Array.isArray(page)) break; all.push(...page); if (page.length < 100) break; }
        return parseProducts(all);
      });
      const offers = await cached("offers:" + market, 120_000, () => rpc("public_store_offers", { p_store: market }).catch(() => null));
      if (rec(offers) && rec(offers.free_delivery) && Number.isSafeInteger(offers.free_delivery.threshold_minor)) facts = { ...facts, free_delivery: { threshold_minor: offers.free_delivery.threshold_minor as number } };
    }
    if (isEval && rec(data.eval_facts) && rec(data.eval_facts.free_delivery) && Number.isSafeInteger(data.eval_facts.free_delivery.threshold_minor)) facts = { ...facts, free_delivery: { threshold_minor: data.eval_facts.free_delivery.threshold_minor as number } };
  } catch { return output({ fallback: true, reason: "facts_unavailable" }, 503, cors); }

  const shortlist = searchProducts(message + " " + (page?.title ?? ""), products, facts.minor_digits, 12);
  // Nothing published fits: the honest answer is "nothing fits", and the browser says it for free.
  if (!shortlist.length && intent === "products") return output({ fallback: true, reason: "nothing_fits" }, 200, cors);
  const prompt = buildPrompt(facts, shortlist, history as AssistantTurn[], message, page);

  // Hard daily budget: reserve the worst case first; settle with the real cost whatever happens next.
  let model = "claude-haiku-5-5", day = "";
  // Reserved at the dearest allowed model's price, so the budget holds whichever model the policy names.
  const reserved = Math.max(...Object.keys(ASSISTANT_MODELS).map((m) => estimateTurnMicroUsd(m, prompt.system.length + prompt.user.length)));
  try {
    const first = await rpc("assistant_reserve", { p_store: market, p_estimate_microusd: reserved, p_eval: isEval });
    if (!rec(first) || first.ok !== true || !str(first.model, 60) || !ASSISTANT_MODELS[first.model as string]) return output({ fallback: true, reason: rec(first) ? String(first.reason ?? "budget") : "budget" }, 200, cors);
    model = first.model as string; day = String(first.day);
  } catch { return output({ fallback: true, reason: "budget_check_failed" }, 503, cors); }
  let inputTokens = 0, outputTokens = 0, cost = 0, discarded = true;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: MAX_OUTPUT_TOKENS, temperature: 0.3, system: prompt.system, messages: [{ role: "user", content: prompt.user }] }), signal: AbortSignal.timeout(20_000) });
    const body = await res.json().catch(() => null) as { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } } | null;
    inputTokens = body?.usage?.input_tokens ?? 0; outputTokens = body?.usage?.output_tokens ?? 0; cost = costMicroUsd(model, inputTokens, outputTokens);
    if (!res.ok || !body) return output({ fallback: true, reason: "model_error" }, 200, cors);
    const parsed = parseModelReply((body.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join(""), shortlist.length);
    if (!parsed) return output({ fallback: true, reason: "unreadable_reply", ...(isEval ? { cost_microusd: cost } : {}) }, 200, cors);
    const check = verifyReply(parsed.reply, facts, shortlist);
    if (!check.ok) return output({ fallback: true, reason: "unverified_reply", ...(isEval ? { detail: check.reason, raw: parsed.reply, cost_microusd: cost } : {}) }, 200, cors);
    discarded = false;
    return output({ reply: parsed.reply, products: parsed.products.map((n) => shortlist[n - 1].slug), add_to_cart: parsed.add_to_cart ? shortlist[parsed.add_to_cart - 1].slug : null,
      handover: parsed.handover && !!facts.human, ...(isEval ? { cost_microusd: cost, input_tokens: inputTokens, output_tokens: outputTokens, model } : {}) }, 200, cors);
  } catch { return output({ fallback: true, reason: "model_unreachable" }, 200, cors); }
  finally {
    try { await rpc("assistant_settle", { p_store: market, p_day: day, p_estimate_microusd: reserved, p_input_tokens: inputTokens, p_output_tokens: outputTokens, p_cost_microusd: cost, p_discarded: discarded }); }
    catch { console.error("assistant_settle_failed", market); }
  }
});
