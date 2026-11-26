// Yawmiyati Brain — owner-only control endpoint (verify_jwt = true).
// Actions: test_woo, test_ai, start, step, resume, cancel.
// Secrets (Supabase Edge Function secrets, never in the browser):
//   ANTHROPIC_API_KEY, WOO_<MARKET>_URL, WOO_<MARKET>_KEY, WOO_<MARKET>_SECRET (e.g. WOO_SA_URL).
import { createDb } from "../_shared/brain/db.ts";
import { isMarket, MARKETS, type Market } from "../_shared/brain/markets.ts";
import { step, wooGet, type WooCreds } from "../_shared/brain/runner.ts";
import { callClaude } from "../_shared/brain/anthropic.ts";

const ALLOWED_ORIGINS = new Set([
  "https://yawmiyati-storefront-staging.rashid-hamzy.workers.dev",
  "https://yawmiyati.shop", "https://www.yawmiyati.shop", "https://staging.yawmiyati.shop",
  ...(Deno.env.get("BRAIN_ALLOWED_ORIGINS") ?? "").split(",").map((x) => x.trim()).filter(Boolean),
]);

function cors(origin: string | null): Record<string, string> {
  return origin && ALLOWED_ORIGINS.has(origin)
    ? { "access-control-allow-origin": origin, "access-control-allow-headers": "authorization, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS", vary: "Origin" }
    : {};
}
const json = (data: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors(origin) } });

function wooCreds(market: Market): WooCreds | null {
  const p = "WOO_" + market.toUpperCase() + "_";
  const origin = Deno.env.get(p + "URL"), key = Deno.env.get(p + "KEY"), secret = Deno.env.get(p + "SECRET");
  return origin && key && secret ? { origin, key, secret } : null;
}

async function isMember(url: string, anon: string, jwt: string, store: string): Promise<boolean> {
  const res = await fetch(url.replace(/\/$/, "") + "/rest/v1/rpc/brain_is_member", {
    method: "POST", headers: { apikey: anon, authorization: jwt, "content-type": "application/json" }, body: JSON.stringify({ p_store: store }),
    signal: AbortSignal.timeout(8000),
  });
  return res.ok && (await res.json()) === true;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);
  const url = Deno.env.get("SUPABASE_URL"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !service || !anon) return json({ error: "server_not_configured" }, 500, origin);
  let body: { action?: string; store?: string; run_id?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400, origin); }
  const store = body.store;
  if (!isMarket(store)) return json({ error: "invalid_store" }, 400, origin);
  const jwt = req.headers.get("authorization") ?? "";
  if (!(await isMember(url, anon, jwt, store))) return json({ error: "forbidden" }, 403, origin);
  const db = createDb(url, service);
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") ?? null;
  const woo = wooCreds(store);
  try {
    switch (body.action) {
      case "test_woo": {
        if (!woo) return json({ ok: false, error: `missing secrets WOO_${store.toUpperCase()}_URL / _KEY / _SECRET` }, 200, origin);
        const products = await wooGet(woo, "products?per_page=1");
        const currency = await wooGet(woo, "settings/general/woocommerce_currency").catch(() => null);
        return json({ ok: true, products_total: products.total, currency: (currency?.body as { value?: string } | null)?.value ?? null,
          expected_currency: MARKETS[store].currency }, 200, origin);
      }
      case "test_ai": {
        if (!anthropicKey) return json({ ok: false, error: "missing secret ANTHROPIC_API_KEY" }, 200, origin);
        const res = await callClaude({ apiKey: anthropicKey, model: "claude-haiku-5-5", system: "Reply with the single word OK.", user: "ping", maxTokens: 5 });
        return json({ ok: /ok/i.test(res.text), cost_microusd: res.metered.cost_microusd }, 200, origin);
      }
      case "start": {
        if (!woo) return json({ error: `missing secrets WOO_${store.toUpperCase()}_URL / _KEY / _SECRET` }, 400, origin);
        if (!anthropicKey) return json({ error: "missing secret ANTHROPIC_API_KEY" }, 400, origin);
        const active = await db.select("brain_runs", `select=id,stage,status&store_code=eq.${store}&status=in.(running,paused_budget)`);
        if (active.length) return json({ run: active[0], note: "already_running" }, 200, origin);
        const b64 = (jwt.replace(/^Bearer\s+/i, "").split(".")[1] ?? "e30").replace(/-/g, "+").replace(/_/g, "/");
        const claims = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)));
        const created = await db.insert("brain_runs", { store_code: store, started_by: claims.sub ?? null }, true);
        return json({ run: created[0] }, 200, origin);
      }
      case "step": {
        if (!body.run_id) return json({ error: "run_id_required" }, 400, origin);
        const run = await step({ db, market: store, woo, anthropicKey }, body.run_id);
        return json({ run, spent_today_microusd: await db.rpc("brain_spent_today", { p_store: store }) }, 200, origin);
      }
      case "resume": {
        const rows = await db.patch("brain_runs", `id=eq.${body.run_id}&store_code=eq.${store}&status=eq.paused_budget`, { status: "running", updated_at: new Date().toISOString() });
        return json({ run: rows[0] ?? null }, 200, origin);
      }
      case "cancel": {
        const rows = await db.patch("brain_runs", `id=eq.${body.run_id}&store_code=eq.${store}&status=in.(running,paused_budget)`, { status: "cancelled", locked_until: null, finished_at: new Date().toISOString() });
        return json({ run: rows[0] ?? null }, 200, origin);
      }
      default:
        return json({ error: "unknown_action" }, 400, origin);
    }
  } catch (e) {
    return json({ error: String(e).slice(0, 400) }, 500, origin);
  }
});
