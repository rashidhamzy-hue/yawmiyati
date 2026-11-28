// Yawmiyati Brain — daily loop endpoint (one market per call).
// Called every morning by the database scheduler (pg_cron → brain_daily_kick → this function, header x-cron-secret)
// or by the owner from /admin ("Run the daily loop now", owner JWT). Deployed with JWT verification off because the
// scheduler has no user; the function authenticates every request itself and answers 401 otherwise.
// Secrets (Supabase Edge Function secrets, never in the browser or the repository):
//   CRON_SECRET                         shared with the scheduler through Supabase Vault
//   WOO_<MARKET>_URL / _KEY / _SECRET   the market's WooCommerce connector (orders); absent = "not connected"
//   POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID, POSTHOG_HOST (default https://us.posthog.com)
//   BLACKLIST_HASH_KEY                  key of the one-way phone hash (32+ random characters, never changed once orders exist)
// It spends no AI money and never publishes, approves or switches a flag.
import { createDb } from "../_shared/brain/db.ts";
import { isMarket, type Market } from "../_shared/brain/markets.ts";
import { runDaily } from "../_shared/learn/daily.ts";
import { FIXTURE_WOO_ORDERS } from "../_shared/learn/fixtures/woo-orders.ts";
import { fixturesAllowed } from "../_shared/learn/fixtures/flag.ts";

const DIAL: Record<Market, string> = { sa: "+966", ae: "+971", om: "+968", eg: "+20", iq: "+964" };
const ALLOWED_ORIGINS = new Set([
  "https://yawmiyati-storefront-staging.rashid-hamzy.workers.dev",
  "https://yawmiyati.shop", "https://www.yawmiyati.shop", "https://staging.yawmiyati.shop",
  ...(Deno.env.get("BRAIN_ALLOWED_ORIGINS") ?? "").split(",").map((x) => x.trim()).filter(Boolean),
]);
const cors = (origin: string | null): Record<string, string> => (origin && ALLOWED_ORIGINS.has(origin)
  ? { "access-control-allow-origin": origin, "access-control-allow-headers": "authorization, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS", vary: "Origin" } : {});
let ORIGIN: string | null = null;
const json = (data: unknown, status: number) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors(ORIGIN) } });
/** Constant-time comparison of two secrets. */
function same(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
async function isMember(url: string, anon: string, jwt: string, store: string): Promise<boolean> {
  if (!/^Bearer\s+\S+/i.test(jwt)) return false;
  const res = await fetch(url.replace(/\/$/, "") + "/rest/v1/rpc/brain_is_member", { method: "POST", headers: { apikey: anon, authorization: jwt, "content-type": "application/json" }, body: JSON.stringify({ p_store: store }), signal: AbortSignal.timeout(8000) });
  return res.ok && (await res.json()) === true;
}
Deno.serve(async (req) => {
  ORIGIN = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(ORIGIN) });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !service || !anon) return json({ error: "server_not_configured" }, 500);
  let body: { store?: string; action?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (!isMarket(body.store)) return json({ error: "invalid_store" }, 400);
  const store = body.store;
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "", given = req.headers.get("x-cron-secret") ?? "";
  const byCron = cronSecret.length >= 24 && same(cronSecret, given);
  if (!byCron && !(await isMember(url, anon, req.headers.get("authorization") ?? "", store))) return json({ error: "unauthorized" }, 401);
  const db = createDb(url, service);
  try {
    if (byCron) {
      const on = (await db.select<{ daily_loop_enabled: boolean }>("brain_settings", `select=daily_loop_enabled&store_code=eq.${store}`))[0]?.daily_loop_enabled;
      if (on === false) return json({ skipped: "daily loop is switched off for this market" }, 200);
    }
    const p = "WOO_" + store.toUpperCase() + "_";
    const wooUrl = Deno.env.get(p + "URL"), wooKey = Deno.env.get(p + "KEY"), wooSecret = Deno.env.get(p + "SECRET");
    const phKey = Deno.env.get("POSTHOG_PERSONAL_API_KEY"), phProject = Deno.env.get("POSTHOG_PROJECT_ID");
    const result = await runDaily({
      db, market: store, dialingCode: DIAL[store],
      woo: wooUrl && wooKey && wooSecret ? { origin: wooUrl, key: wooKey, secret: wooSecret } : null,
      posthog: phKey && phProject ? { host: Deno.env.get("POSTHOG_HOST") ?? "https://us.posthog.com", projectId: phProject, apiKey: phKey } : null,
      phoneHashKey: (Deno.env.get("BLACKLIST_HASH_KEY") ?? "").length >= 32 ? Deno.env.get("BLACKLIST_HASH_KEY")! : null,
      fixtureOrders: fixturesAllowed(Deno.env.get("YAWMIYATI_FIXTURES"), req.url, Deno.env.get("DENO_DEPLOYMENT_ID")) ? FIXTURE_WOO_ORDERS : null,
    });
    return json({ day: result.day, proposals: result.proposals, steps: result.steps, to_approve: result.brief.to_approve, headline: result.brief.headline }, 200);
  } catch (e) {
    return json({ error: String(e).slice(0, 400) }, 500);
  }
});
