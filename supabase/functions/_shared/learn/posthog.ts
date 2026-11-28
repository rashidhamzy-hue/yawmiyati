// Daily aggregates from PostHog (the storefront's analytics) for the scorecards.
// The brain never reads a person or a session from PostHog: every query below groups by product slug or by traffic
// source and returns counts only. Server-side, with a personal API key kept in the edge function's secrets
// (POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID; host POSTHOG_HOST, default https://us.posthog.com).
import type { Market } from "../brain/markets.ts";

export type PosthogEnv = { host: string; projectId: string; apiKey: string };
const day = (d: string) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw Error("invalid_day"); return d; };
const next = (d: string) => new Date(Date.parse(d + "T00:00:00Z") + 86_400_000).toISOString().slice(0, 10);
const range = (d: string) => `timestamp >= toDateTime('${day(d)} 00:00:00') and timestamp < toDateTime('${next(d)} 00:00:00')`;
/** Production reads leave staging traffic out; the staging smoke test reads staging traffic only. */
let STAGING = false;
export const readStagingTraffic = (on: boolean) => { STAGING = on; };
const store = (m: Market) => `properties.market = '${m}' and properties.staging = ${STAGING ? "true" : "false"}`;

/** Per product: views, add to cart, order-form starts, clicks from listings and the 75% scroll mark. */
export const productFunnelQuery = (m: Market, d: string) => `select properties.slug as slug,
 countIf(event = 'product_viewed') as views, countIf(event = 'add_to_cart') as add_to_cart, countIf(event = 'product_clicked') as list_clicks,
 countIf(event = 'product_scroll' and toInt(properties.depth) = 75) as scroll_75
from events where ${range(d)} and ${store(m)} and event in ('product_viewed','add_to_cart','product_clicked','product_scroll') and properties.slug is not null
group by slug order by views desc limit 2000`;
/** Per product: how many times its card was really seen in a listing (one row per slug inside each products_seen event). */
export const impressionsQuery = (m: Market, d: string) => `select slug, count() as list_impressions from (
 select arrayJoin(JSONExtract(ifNull(toString(properties.slugs), '[]'), 'Array(String)')) as slug
 from events where ${range(d)} and ${store(m)} and event = 'products_seen')
group by slug order by list_impressions desc limit 2000`;
/** Per traffic source (last touch): visits, product views, add to cart, order-form starts. */
export const sourceFunnelQuery = (m: Market, d: string) => `select ifNull(toString(properties.ym_last_source), 'direct') as source, ifNull(toString(properties.ym_last_medium), '') as medium, ifNull(toString(properties.ym_last_campaign), '') as campaign,
 uniq(properties.$session_id) as visits, countIf(event = 'product_viewed') as product_views, countIf(event = 'add_to_cart') as add_to_cart, countIf(event = 'checkout_started') as checkout_starts
from events where ${range(d)} and ${store(m)} and event in ('$pageview','product_viewed','add_to_cart','checkout_started')
group by source, medium, campaign order by visits desc limit 500`;
/** Searches that found nothing: what shoppers want and the store does not sell. */
export const emptySearchQuery = (m: Market, d: string) => `select lower(trim(toString(properties.query))) as query, count() as searches
from events where ${range(d)} and ${store(m)} and event = 'search_no_results' group by query order by searches desc limit 50`;

async function hogql(env: PosthogEnv, query: string, f: typeof fetch): Promise<{ columns: string[]; results: unknown[][] }> {
  const host = new URL(env.host);
  if (host.protocol !== "https:" || !/^\d+$/.test(env.projectId)) throw Error("posthog_not_configured");
  const res = await f(new URL(`/api/projects/${env.projectId}/query/`, host), { method: "POST", redirect: "error", signal: AbortSignal.timeout(30000),
    headers: { authorization: "Bearer " + env.apiKey, "content-type": "application/json" }, body: JSON.stringify({ query: { kind: "HogQLQuery", query } }) });
  if (!res.ok) throw Error("posthog_http_" + res.status);
  const body = await res.json() as { columns?: unknown; results?: unknown };
  if (!Array.isArray(body.columns) || !Array.isArray(body.results)) throw Error("posthog_bad_payload");
  return { columns: body.columns.map(String), results: body.results as unknown[][] };
}
const rowsOf = (r: { columns: string[]; results: unknown[][] }) => r.results.map((row) => Object.fromEntries(r.columns.map((c, i) => [c, row[i]])));
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : 0);
const slugOk = (v: unknown): v is string => typeof v === "string" && /^[a-z0-9][a-z0-9-]{1,159}$/.test(v);

export type DayFunnel = {
  products: { slug: string; views: number; add_to_cart: number; list_clicks: number; scroll_75: number; list_impressions: number }[];
  sources: { source: string; medium: string; campaign: string; visits: number; product_views: number; add_to_cart: number; checkout_starts: number }[];
  empty_searches: { query: string; searches: number }[];
};
/** One market's aggregates for one UTC day. Unknown or malformed rows are dropped, never guessed. */
export async function fetchDayFunnel(env: PosthogEnv, m: Market, d: string, f: typeof fetch = fetch): Promise<DayFunnel> {
  const [funnel, seen, sources, empty] = await Promise.all([hogql(env, productFunnelQuery(m, d), f), hogql(env, impressionsQuery(m, d), f), hogql(env, sourceFunnelQuery(m, d), f), hogql(env, emptySearchQuery(m, d), f)]);
  const by = new Map<string, DayFunnel["products"][number]>();
  const at = (slug: string) => by.get(slug) ?? (by.set(slug, { slug, views: 0, add_to_cart: 0, list_clicks: 0, scroll_75: 0, list_impressions: 0 }), by.get(slug)!);
  for (const r of rowsOf(funnel)) if (slugOk(r.slug)) Object.assign(at(r.slug), { views: n(r.views), add_to_cart: n(r.add_to_cart), list_clicks: n(r.list_clicks), scroll_75: n(r.scroll_75) });
  for (const r of rowsOf(seen)) if (slugOk(r.slug)) at(r.slug).list_impressions = n(r.list_impressions);
  const clean = (v: unknown, max: number) => String(v ?? "").replace(/[^\p{L}\p{N} ._\-]/gu, "").trim().slice(0, max);
  return {
    products: [...by.values()],
    sources: rowsOf(sources).map((r) => ({ source: clean(r.source, 60) || "direct", medium: clean(r.medium, 40), campaign: clean(r.campaign, 80), visits: n(r.visits), product_views: n(r.product_views), add_to_cart: n(r.add_to_cart), checkout_starts: n(r.checkout_starts) })).filter((s) => s.visits > 0),
    empty_searches: rowsOf(empty).map((r) => ({ query: clean(r.query, 80), searches: n(r.searches) })).filter((s) => s.query.length >= 2 && s.searches > 0),
  };
}
