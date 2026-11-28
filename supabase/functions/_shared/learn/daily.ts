// The brain's daily loop for one market. Every step is isolated: a failed step is written into the brief's notes and
// the loop goes on. The loop spends no AI money: it re-prices from the dated shop-price cache and works on counts.
// It never publishes, never approves, never switches a flag. What it may do by itself is hide a product whose
// finished orders are mostly refused (reversible in /admin) and file proposals for the owner.
import { minorToUsd, type Market } from "../brain/markets.ts";
import type { Db } from "../brain/db.ts";
import { decidePrice, reprice, type CompetitorEvidence } from "../brain/economics.ts";
import { prefilter } from "../brain/selection.ts";
import { normalizeTaager, TAAGER_MAPPING, type TaagerCatalogRow } from "../brain/taager-normalize.ts";
import { planningBaseBps } from "../brain/runner.ts";
import { fetchWooOrders, normalizeWooOrder, type WooOrderCreds } from "./woo-orders.ts";
import { fetchDayFunnel, type PosthogEnv } from "./posthog.ts";
import { EMPTY_COUNTS, productVerdict, type ProductCounts } from "./scorecard.ts";
import { buildBrief, type Brief, type BriefInput, type BriefProduct } from "./brief.ts";
import { seasonalPlans } from "./seasonal.ts";
import { loadMarket, rulesBrief } from "../brain/taager-facts.ts";
import { refreshStaleResearch } from "./research-refresh.ts";

export type DailyDeps = {
  db: Db; market: Market; now?: () => number; fetchImpl?: typeof fetch;
  woo: WooOrderCreds | null; posthog: PosthogEnv | null; phoneHashKey: string | null; dialingCode: string;
  /** The brain's AI key, used only to refresh stale shop prices inside the daily cap. Absent = that step is skipped. */
  anthropicKey?: string | null; timeBudgetMs?: number;
  /** FIXTURE ONLY: orders to use instead of the WooCommerce connection. Set only by tests and the local fixture flag. */
  fixtureOrders?: unknown[] | null;
};
export type DailyResult = { day: string; brief: Brief; proposals: number; steps: Record<string, string> };
type Listing = { listing_id: string; sku: string; slug: string; title: string; category: string | null; image: string | null; price_minor: number; hidden_reason: string | null;
  cost_minor: number | null; floor_minor: number | null; pricing: Record<string, unknown>; has_video: boolean; synced_at: string | null };
type Window = { listing_id: string; slug: string; title: string; visible: boolean; hidden_reason: string | null; price_minor: number; cost_minor: number | null; floor_minor: number | null; cheapest_minor: number | null; median_minor: number | null; counts: ProductCounts };
const NEW_PER_DAY = 5, WINDOW_DAYS = 14;
const counts = (c: unknown): ProductCounts => ({ ...EMPTY_COUNTS, ...(c && typeof c === "object" ? c as Partial<ProductCounts> : {}) });

export async function runDaily(d: DailyDeps): Promise<DailyResult> {
  const now = (d.now ?? Date.now)(), f = d.fetchImpl ?? fetch;
  // Market figures after Taager's own information pages; falls back to the figures on file when none are stored.
  const { m, stored: pageFacts } = await loadMarket(d.db, d.market);
  const today = new Date(now).toISOString().slice(0, 10), yesterday = new Date(now - 86_400_000).toISOString().slice(0, 10);
  const steps: Record<string, string> = {}, notes: string[] = [];
  notes.push(...m.factsNotes);
  const attempt = async <T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { const v = await fn(); steps[name] ??= "ok"; return v; } catch (e) { steps[name] = "failed: " + String(e).slice(0, 160); notes.push(`${name} failed (${String(e).slice(0, 120)}); the rest of the brief is unaffected.`); return fallback; }
  };
  const settings = (await d.db.select<{ daily_budget_microusd: number; delivery_rate_bps: number | null; stock_max_age_hours: number; autopilot_enabled?: boolean; research_model?: string; max_searches_per_product?: number }>("brain_settings", `select=daily_budget_microusd,delivery_rate_bps,stock_max_age_hours,autopilot_enabled,research_model,max_searches_per_product&store_code=eq.${d.market}`))[0]
    ?? { daily_budget_microusd: 0, delivery_rate_bps: null, stock_max_age_hours: 72 };
  const lastRun = await attempt("planning_rate", async () => (await d.db.select<{ summary: Record<string, unknown> }>("brain_runs", `select=summary&store_code=eq.${d.market}&order=created_at.desc&limit=1`))[0]?.summary ?? {}, {});
  const planning = planningBaseBps(settings, lastRun, m);

  // 1. Taager sync freshness (listings hide themselves after the limit; the brief says so before it happens).
  const lastSync = await attempt("sync_freshness", async () => (await d.db.select<{ synced_at: string }>("taager_catalog", `select=synced_at&market=eq.${d.market}&order=synced_at.desc&limit=1`))[0]?.synced_at ?? null, null);
  if (!lastSync) notes.push("No Taager catalogue has been imported for this market yet.");
  else if (now - Date.parse(lastSync) > settings.stock_max_age_hours * 3_600_000) notes.push(`The Taager sync is older than ${settings.stock_max_age_hours} hours: every product is hidden until a quick sync is run.`);
  else if (now - Date.parse(lastSync) > settings.stock_max_age_hours * 3_600_000 * 0.66) notes.push("The Taager sync is getting old: run a quick sync today to keep products visible.");

  // 2. Orders from the market's WooCommerce connector (placed, confirmed, shipped, delivered, refused, returned, unreachable).
  let ordersConnected = false, orderError: string | null = null;
  await attempt("orders", async () => {
    const state = (await d.db.select<{ synced_through: string }>("order_sync_state", `select=synced_through&store_code=eq.${d.market}`))[0];
    let raw: unknown[] | null = null, complete = true;
    if (d.fixtureOrders) { raw = d.fixtureOrders; steps.orders = "fixture"; }
    else if (d.woo) { const r = await fetchWooOrders(d.woo, state?.synced_through ?? "2026-01-01T00:00:00Z", f); raw = r.orders; complete = r.complete; }
    if (raw === null) { steps.orders = "not connected"; return; }
    ordersConnected = true;
    const rows = (await Promise.all(raw.map((o) => normalizeWooOrder(o, m, d.dialingCode, d.phoneHashKey)))).filter((x): x is NonNullable<typeof x> => !!x);
    for (let i = 0; i < rows.length; i += 200) await d.db.rpc("order_tracking_upsert", { p_store: d.market, p_rows: rows.slice(i, i + 200) });
    const through = rows.reduce((t, r) => (r.modified_at > t ? r.modified_at : t), state?.synced_through ?? "2026-01-01T00:00:00Z");
    await d.db.patch("order_sync_state", `store_code=eq.${d.market}`, { synced_through: through, last_run_at: new Date(now).toISOString(), last_error: null });
    const unknown = rows.filter((r) => r.status === "unknown").length;
    if (unknown) notes.push(`${unknown} orders carry a status name the brain does not know yet (kept as "unknown"): tell Claude the names so they can be mapped.`);
    if (!complete) notes.push("More orders changed than one run reads: the next run continues from where this one stopped.");
    if (!d.phoneHashKey) notes.push("BLACKLIST_HASH_KEY is not set: orders are stored without the phone hash, so the blacklist cannot count them.");
  }, undefined).then(() => { if (steps.orders?.startsWith("failed")) orderError = steps.orders; });
  if (orderError) await attempt("orders_error", () => d.db.patch("order_sync_state", `store_code=eq.${d.market}`, { last_run_at: new Date(now).toISOString(), last_error: orderError }), []);

  // 3. Yesterday's visits and funnel from PostHog (counts per product and per source only), then the order roll-up.
  let searchGaps: { query: string; searches: number }[] = [];
  await attempt("analytics", async () => {
    if (!d.posthog) { steps.analytics = "not connected"; return; }
    const day = await fetchDayFunnel(d.posthog, d.market, yesterday, f);
    await d.db.rpc("scorecard_write_funnel", { p_store: d.market, p_day: yesterday, p_products: day.products, p_sources: day.sources, p_searches: day.empty_searches });
    searchGaps = day.empty_searches;
  }, undefined);
  await attempt("rollup", () => d.db.rpc("scorecard_rollup_orders", { p_store: d.market, p_from: new Date(now - 30 * 86_400_000).toISOString().slice(0, 10) }), null);

  // 4. Listings, their window counts and yesterday's.
  const listings = await attempt("listings", async () => ((await d.db.rpc<Listing[]>("brain_daily_listings", { p_store: d.market })) ?? []), [] as Listing[]);
  const win = await attempt("scorecards", async () => ((await d.db.rpc<Window[]>("scorecard_window", { p_store: d.market, p_days: WINDOW_DAYS })) ?? []).map((w) => ({ ...w, counts: counts(w.counts) })), [] as Window[]);
  const day1 = await attempt("yesterday", async () => ((await d.db.rpc<Window[]>("scorecard_window", { p_store: d.market, p_days: 1 })) ?? []).map((w) => ({ ...w, counts: counts(w.counts) })), [] as Window[]);
  const byId = new Map(listings.map((l) => [l.listing_id, l]));

  // 4b. Shop prices older than 14 days are refreshed first (oldest first, inside the daily cap), so the re-pricing below never works from old prices.
  const startedAt = Date.now();
  await attempt("research_refresh", async () => {
    const r = await refreshStaleResearch({ db: d.db, market: d.market, m, anthropicKey: d.anthropicKey ?? null, fetchImpl: f, now, deadline: startedAt + Math.floor((d.timeBudgetMs ?? 100_000) * 0.6),
      settings, listings: listings.map((l) => ({ sku: l.sku, hidden_reason: l.hidden_reason })) });
    steps.research_refresh = r.stopped === "done" || r.stopped === "nothing_stale" ? "ok" : r.stopped;
    if (r.note) notes.push(r.note);
  }, undefined);

  // 5. Re-price from Taager's current cost and the dated shop prices. Proposals only; the floor itself is enforced by the database.
  const repriceOut = { changes: 0, pauses: 0, examples: [] as { title: string; reason: string }[] };
  await attempt("reprice", async () => {
    const live = listings.filter((l) => l.hidden_reason === null || l.hidden_reason === "margin_below_floor" || l.hidden_reason === "below_supplier_cost");
    if (!live.length) return;
    const evidence = new Map<string, CompetitorEvidence[]>();
    for (let i = 0; i < live.length; i += 80) {
      const skus = live.slice(i, i + 80).map((l) => `"${l.sku.replace(/"/g, "")}"`).join(",");
      const rows = await d.db.select<CompetitorEvidence & { sku: string }>("market_price_evidence", `select=sku,retailer,url,price_minor,delivery_minor,match,confidence,credible&store_code=eq.${d.market}&sku=in.(${skus})&limit=2000`);
      for (const r of rows) evidence.set(r.sku, [...(evidence.get(r.sku) ?? []), { ...r, confidence: Number(r.confidence) }]);
    }
    const out: Record<string, unknown>[] = [];
    for (const l of live) {
      const r = reprice({ inputs: { cost_minor: l.cost_minor, floor_minor: l.floor_minor, suggested_minor: null }, competitors: evidence.get(l.sku) ?? [], m, deliveryRateBps: planning,
        current_price_minor: l.price_minor, current_delivery_included: l.pricing.delivery_included === true, exception_approved: !!l.pricing.band_exception });
      // No shop evidence for this product: keep a price that still earns the floor rather than drift to Taager's default.
      if (r.action === "change" && !(evidence.get(l.sku)?.length)) continue;
      if (r.action === "keep") continue;
      out.push({ listing_id: l.listing_id, action: r.action, new_price_minor: r.new_price_minor ?? null, reason: r.reason, pricing: r.decision.state === "priced" ? r.decision : {} });
      if (r.action === "pause") repriceOut.pauses++; else repriceOut.changes++;
      if (repriceOut.examples.length < 6) repriceOut.examples.push({ title: l.title, reason: r.reason });
    }
    for (let i = 0; i < out.length; i += 200) await d.db.rpc("brain_reprice_save", { p_store: d.market, p_rows: out.slice(i, i + 200) });
  }, undefined);

  // 6. Products whose finished orders are mostly refused: hidden now (protects the delivery rate), shown in the brief.
  const pausedToday: { title: string; reason: string }[] = [];
  await attempt("pause_refused", async () => {
    for (const w of win) {
      const l = byId.get(w.listing_id);
      if (!l || !w.visible) continue;
      const v = productVerdict(w.counts, m, { planningDeliveryBps: planning, marginPct: null, doorTotalMinor: null, cheapestMinor: null, medianMinor: null });
      if (v.verdict !== "pause_high_refusal") continue;
      if (await d.db.rpc<boolean>("brain_pause_listing", { p_store: d.market, p_listing: w.listing_id, p_reason: v.why })) pausedToday.push({ title: w.title, reason: v.why });
    }
  }, undefined);

  // 7. Three to five new products: newest and fastest-moving catalogue rows through the same shortlist rules, priced in the band.
  const add: BriefInput["add"] = [];
  await attempt("new_products", async () => {
    const rows = (await d.db.rpc<(TaagerCatalogRow & { stock_per_day?: number })[]>("brain_daily_candidates", { p_store: d.market, p_limit: 60 })) ?? [];
    if (!rows.length) return;
    const offers = rows.map((r) => normalizeTaager(d.market, m, r, now));
    const short = prefilter(offers, TAAGER_MAPPING, m, 20, { now }).filter((r) => r.stage === "shortlisted").sort((a, b) => b.prefilter_score - a.prefilter_score);
    const seenCat: Record<string, number> = {};
    for (const r of short) {
      if (add.length >= NEW_PER_DAY) break;
      const cat = r.category ?? "other";
      if ((seenCat[cat] ?? 0) >= 2) continue; // at most two per section a day: a spread, not five of one thing
      const o = offers.find((x) => x.product_id === r.product_id && x.variation_id === r.variation_id)!;
      const price = decidePrice({ inputs: r.economics as never, competitors: [], m, deliveryRateBps: planning });
      if (price.state !== "priced" || !o.sku) continue;
      seenCat[cat] = (seenCat[cat] ?? 0) + 1;
      const fresh = typeof o.meta["taager_created_at"] === "string" && now - Date.parse(String(o.meta["taager_created_at"])) < 30 * 86_400_000;
      const src = rows.find((x) => x.sku === o.sku);
      const moving = Number(src?.stock_per_day ?? 0);
      add.push({ sku: o.sku, product_id: o.product_id, title: o.title, margin_pct: price.margin_on_price_pct ?? null, profit_usd: Math.round(minorToUsd(price.profit_delivered_minor ?? 0, m) * 100) / 100,
        why: [fresh ? "new at Taager this month" : null, moving >= 3 ? `about ${Math.round(moving)} pieces a day leaving Taager's stock` : null, `section: ${cat}`, `${o.images.length} pictures${o.videos.length ? " and a video" : ""}`,
          `about ${price.margin_on_price_pct}% margin before shop research`].filter(Boolean).join("; ") + "." });
    }
  }, undefined);

  // 8. The brief.
  const spent = await attempt("spend", async () => Number(await d.db.rpc<number>("brain_spent_today", { p_store: d.market })) || 0, 0);
  const offersWaiting = await attempt("offers_waiting", async () => (await d.db.select<{ id: string }>("store_offers", `select=id&store_code=eq.${d.market}&status=eq.proposed&limit=500`)).length, 0);
  const sources = await attempt("sources", async () => (await d.db.select<{ source: string; medium: string; campaign: string; visits: number; product_views: number; add_to_cart: number; checkout_starts: number; orders: number; delivered: number; profit_delivered_minor: number }>(
    "source_scorecard_daily", `select=source,medium,campaign,visits,product_views,add_to_cart,checkout_starts,orders,delivered,profit_delivered_minor&store_code=eq.${d.market}&day=gte.${new Date(now - WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)}&limit=3000`)), []);
  const merged = new Map<string, BriefInput["sources"][number]>();
  for (const s of sources) { const k = [s.source, s.medium, s.campaign].join("|"); const a = merged.get(k) ?? { source: s.source, medium: s.medium, campaign: s.campaign, visits: 0, product_views: 0, add_to_cart: 0, checkout_starts: 0, orders: 0, delivered: 0, profit_delivered_minor: 0 };
    for (const key of ["visits", "product_views", "add_to_cart", "checkout_starts", "orders", "delivered", "profit_delivered_minor"] as const) a[key] += Number(s[key]) || 0; merged.set(k, a); }
  const orderRows = await attempt("orders_total", async () => await d.db.select<{ status: string; profit_minor: number | null }>("order_tracking", `select=status,profit_minor&store_code=eq.${d.market}&placed_at=gte.${new Date(now - WINDOW_DAYS * 86_400_000).toISOString()}&limit=5000`), []);
  const n = (s: string) => orderRows.filter((o) => o.status === s).length;
  const toBrief = (w: Window): BriefProduct => { const l = byId.get(w.listing_id); return { ...w, delivery_included: l?.pricing.delivery_included === true, has_video: l?.has_video ?? false, image: l?.image ?? null }; };
  const onStore: Record<string, number> = {};
  for (const l of listings) if (l.hidden_reason === null && l.category) onStore[l.category] = (onStore[l.category] ?? 0) + 1;
  const brief = buildBrief({
    market: d.market, m, day: today, window_days: WINDOW_DAYS, planningDeliveryBps: planning, products: win.map(toBrief), yesterday: day1.map(toBrief), sources: [...merged.values()],
    orders: { placed: orderRows.length, delivered: n("delivered"), refused: n("refused"), returned: n("returned"), unreachable: n("unreachable"), cancelled: n("cancelled"), open: n("placed") + n("confirmed") + n("shipped"),
      unknown_status: n("unknown"), profit_delivered_minor: orderRows.filter((o) => o.status === "delivered").reduce((s, o) => s + (Number(o.profit_minor) || 0), 0) },
    sync: { last_sync_at: lastSync, max_age_hours: settings.stock_max_age_hours, orders_connected: ordersConnected, analytics_connected: !!d.posthog && steps.analytics === "ok", order_sync_error: orderError },
    reprice: repriceOut, paused_today: pausedToday, add, search_gaps: searchGaps, offers_waiting: offersWaiting,
    taager_rules: rulesBrief(d.market, pageFacts, new Date(now - 7 * 86_400_000).toISOString()),
    seasonal: seasonalPlans(now, d.market, onStore), spend_today_usd: Math.round(spent / 1e4) / 100, daily_cap_usd: Math.round(settings.daily_budget_microusd / 1e4) / 100, notes,
  });
  const proposals = [
    ...add.map((a) => ({ kind: "add_product", ref: a.sku, title: a.title, why: a.why, data: { product_id: a.product_id, margin_pct: a.margin_pct, profit_usd: a.profit_usd } })),
    ...brief.retire.map((r) => ({ kind: "retire_product", ref: r.listing_id, title: r.title, why: r.why, data: {} })),
  ];
  await d.db.rpc("brain_daily_save", { p_store: d.market, p_day: today, p_brief: brief, p_proposals: proposals });
  // 9. Autopilot, only when the owner switched it on for this market: the database approves what passes the same
  // never-a-loss checks as the owner's buttons, and the brief says exactly what it did. Product additions stay with the owner.
  if (settings.autopilot_enabled === true) await attempt("autopilot", async () => {
    const done = await d.db.rpc<Record<string, unknown>>("brain_autopilot_apply", { p_store: d.market });
    if (done && done.enabled === true) { brief.autopilot = { price_changes: Number(done.price_changes) || 0, retired: Number(done.retired) || 0, offers: Number(done.offers) || 0, left_for_owner: Number(done.left_for_owner) || 0, new_products_waiting: Number(done.new_products_waiting) || 0 };
      await d.db.rpc("brain_brief_merge", { p_store: d.market, p_day: today, p_patch: { autopilot: brief.autopilot } }); }
  }, undefined);
  return { day: today, brief, proposals: proposals.length, steps };
}
