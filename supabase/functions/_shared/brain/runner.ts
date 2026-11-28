// The Yawmiyati Brain run engine. Each call to `step` advances one run as far as
// its time budget allows and saves where it stopped, so the dashboard can drive a
// long run in short, visible steps. Paid AI calls pass a daily budget gate first,
// and every call's exact cost is written to brain_cost_ledger.
import { loadMarket } from "./taager-facts.ts";
import { minorToDecimal, type Market, type MarketFacts } from "./markets.ts";
import { normalizeWoo, type OfferRow } from "./woo-normalize.ts";
import { normalizeTaager, TAAGER_MAPPING, type TaagerCatalogRow } from "./taager-normalize.ts";
import { capabilityReport, offerKind, type FieldMapping } from "./catalog-analysis.ts";
import { prefilter, finalScore, selectFinal, merchandise, type StoreCategory } from "./selection.ts";
import { decidePrice, freeDeliveryThreshold, marketReference, type PriceDecision } from "./economics.ts";
import { quantityOffersDual, salePlan, taagerFacts, type StockPoint } from "./taager-economics.ts";
import { orderPictures, parsePictureVerdicts, picturePrompt } from "./bundles.ts";
import { callClaude, estimateMax, extractJson, type Metered } from "./anthropic.ts";
import { contentPrompt, contentSourceText, evidenceRows, mappingPrompt, parseContent, parseMapping, parseResearch, researchPrompt } from "./prompts.ts";
import type { Db } from "./db.ts";

export type WooCreds = { origin: string; key: string; secret: string };
export type Deps = {
  db: Db; market: Market; woo: WooCreds | null; anthropicKey: string | null;
  fetchImpl?: typeof fetch; timeBudgetMs?: number; now?: () => number; concurrency?: number;
};
type Run = { id: string; store_code: string; stage: string; status: string; cursor: Record<string, unknown>; progress: Record<string, unknown>; summary: Record<string, unknown> };
type Settings = { daily_budget_microusd: number; research_model: string; content_model: string; shortlist_size: number; selection_size: number; max_searches_per_product: number; delivery_rate_bps: number | null; field_mapping: FieldMapping };
type Analysis = { product_id: number; variation_id: number; title: string; family_key: string | null; offer_kind: string; category: StoreCategory | null; stage: string;
  prefilter_score: number | null; score: number | null; economics: Record<string, unknown>; research: Record<string, unknown> | null; decision: PriceDecision | null;
  content: Record<string, unknown> | null; flags: string[]; reasons: string[]; cost_microusd: number };

const OFFER_COLS = "provider,product_id,variation_id,parent_id,product_type,status,sku,title,currency,price_minor,regular_price_minor,sale_price_minor,stock_status,stock_quantity,categories,attributes,images,videos,meta,description,short_description,raw";
const key = (a: { product_id: number; variation_id: number }) => `${a.product_id}:${a.variation_id}`;

// ---------------- WooCommerce ----------------
export async function wooGet(creds: WooCreds, path: string, f: typeof fetch = fetch) {
  const origin = new URL(creds.origin);
  if (origin.protocol !== "https:") throw Error("woo_origin_must_be_https");
  const url = new URL("/wp-json/wc/v3/" + path, origin);
  const res = await f(url, { headers: { authorization: "Basic " + btoa(creds.key + ":" + creds.secret), accept: "application/json" }, redirect: "follow", signal: AbortSignal.timeout(30_000) });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw Error(`woo_${res.status}: ${JSON.stringify(body)?.slice(0, 200)}`);
  return { body, totalPages: Number(res.headers.get("x-wp-totalpages") ?? "0") || null, total: Number(res.headers.get("x-wp-total") ?? "0") || null };
}

// ---------------- helpers ----------------
type Source = "taager_api" | "taager_woo";
const runSource = (run: Run): Source => ((run.summary as { source?: Source }).source === "taager_api" ? "taager_api" : "taager_woo");

async function loadOffers(db: Db, store: string, runId: string): Promise<OfferRow[]> {
  const out: OfferRow[] = [];
  for (let offset = 0; offset < 100_000; offset += 1000) {
    const page = await db.select<OfferRow>("supplier_offers", `select=${OFFER_COLS}&store_code=eq.${store}&last_run_id=eq.${runId}&order=product_id,variation_id&limit=1000&offset=${offset}`);
    out.push(...page.map((o) => ({ ...o, store_code: store, provider: o.provider ?? "taager_woo", revision: "" })));
    if (page.length < 1000) break;
  }
  return out;
}
async function loadOffersByKeys(db: Db, store: string, keys: { product_id: number; variation_id: number }[], provider: Source = "taager_woo") {
  if (!keys.length) return new Map<string, OfferRow>();
  const ids = [...new Set(keys.map((k) => k.product_id))].join(",");
  const rows = await db.select<OfferRow>("supplier_offers", `select=${OFFER_COLS}&store_code=eq.${store}&provider=eq.${provider}&product_id=in.(${ids})`);
  return new Map(rows.map((r) => [key(r), r]));
}
async function spentToday(db: Db, store: string) { return Number(await db.rpc<number>("brain_spent_today", { p_store: store })) || 0; }

async function recordCost(db: Db, run: Run, step: "field_mapping" | "research" | "content" | "pictures", item: string | null, m: Metered) {
  await db.insert("brain_cost_ledger", { run_id: run.id, store_code: run.store_code, step, item_ref: item, model: m.model,
    input_tokens: m.input_tokens, output_tokens: m.output_tokens, cache_read_tokens: m.cache_read_tokens, cache_write_tokens: m.cache_write_tokens,
    web_searches: m.web_searches, cost_microusd: m.cost_microusd });
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => { while (queue.length) await fn(queue.shift()!); }));
}

// ---------------- stages ----------------
// Preferred source: the owner's Taager merchant sync (exact cost / minimum / maximum, tiers, bundles).
async function stageIngestTaager(d: Deps, run: Run, m: MarketFacts, deadline: number) {
  const c = run.cursor as { offset?: number; ingested?: number };
  c.offset ??= 0; c.ingested ??= 0;
  while (Date.now() < deadline) {
    const page = await d.db.select<TaagerCatalogRow>("taager_catalog", `select=market,sku,product_id,variant_id,item_type,name,listing,detail,alternatives,synced_at,price_changed_at&market=eq.${run.store_code}&order=sku&limit=200&offset=${c.offset}`);
    if (page.length) {
      const now = Date.now();
      const rows = page.map((r) => normalizeTaager(run.store_code, m, r, now));
      await d.db.upsert("supplier_offers", rows.map((r) => ({ ...r, last_run_id: run.id, last_seen_at: new Date().toISOString() })), "store_code,provider,product_id,variation_id");
      c.ingested += rows.length;
      c.offset += page.length;
    }
    if (page.length < 200) { run.stage = "audit"; break; }
  }
  run.progress.ingested = c.ingested;
  run.progress.woo_total_products = null;
  run.progress.taager_catalog_products = c.ingested;
  run.cursor = c;
}

async function stageIngest(d: Deps, run: Run, m: MarketFacts, deadline: number) {
  if (!(run.summary as { source?: string }).source) {
    const any = await d.db.select<{ sku: string }>("taager_catalog", `select=sku&market=eq.${run.store_code}&limit=1`);
    run.summary.source = any.length ? "taager_api" : "taager_woo";
  }
  if (runSource(run) === "taager_api") return stageIngestTaager(d, run, m, deadline);
  if (!d.woo) throw Error("missing_woo_credentials");
  const f = d.fetchImpl ?? fetch;
  const c = run.cursor as { page?: number; totalPages?: number | null; pendingVariable?: number[]; ingested?: number };
  c.page ??= 1; c.pendingVariable ??= []; c.ingested ??= 0;
  while (Date.now() < deadline) {
    if (c.pendingVariable.length) {
      const pid = c.pendingVariable[0];
      const parent = (await d.db.select<{ raw: Record<string, unknown> }>("supplier_offers", `select=raw&store_code=eq.${run.store_code}&product_id=eq.${pid}&variation_id=eq.0`))[0]?.raw;
      for (let vp = 1; vp <= 20; vp++) {
        const { body, totalPages } = await wooGet(d.woo, `products/${pid}/variations?per_page=100&page=${vp}`, f);
        const rows = await Promise.all((Array.isArray(body) ? body : []).map((v) => normalizeWoo(run.store_code, m, v, parent ?? { id: pid })));
        if (rows.length) await d.db.upsert("supplier_offers", rows.map((r) => ({ ...r, last_run_id: run.id, last_seen_at: new Date().toISOString() })), "store_code,provider,product_id,variation_id");
        c.ingested += rows.length;
        if (!totalPages || vp >= totalPages) break;
      }
      c.pendingVariable.shift();
      continue;
    }
    if (c.totalPages && c.page > c.totalPages) { run.stage = "audit"; break; }
    const { body, totalPages, total } = await wooGet(d.woo, `products?per_page=100&page=${c.page}&orderby=id&order=asc`, f);
    const list = Array.isArray(body) ? body : [];
    if (!list.length) { run.stage = "audit"; break; }
    c.totalPages = totalPages ?? c.totalPages ?? null;
    run.progress.woo_total_products = total ?? run.progress.woo_total_products ?? null;
    const rows = await Promise.all(list.map((p) => normalizeWoo(run.store_code, m, p)));
    await d.db.upsert("supplier_offers", rows.map((r) => ({ ...r, last_run_id: run.id, last_seen_at: new Date().toISOString() })), "store_code,provider,product_id,variation_id");
    c.pendingVariable.push(...rows.filter((r) => r.product_type === "variable").map((r) => r.product_id));
    c.ingested += rows.length;
    c.page++;
    if (!totalPages && list.length < 100) c.totalPages = c.page - 1;
  }
  run.progress.ingested = c.ingested;
  run.progress.pages_read = (c.page ?? 1) - 1;
  run.cursor = c;
}

async function stageAudit(d: Deps, run: Run, m: MarketFacts, settings: Settings) {
  const offers = await loadOffers(d.db, run.store_code, run.id);
  if (!offers.length) throw Error("no_products_ingested");
  const report = capabilityReport(offers, m);
  const fromTaager = runSource(run) === "taager_api";
  let mapping: FieldMapping = fromTaager ? TAAGER_MAPPING : settings.field_mapping?.confidence === "owner" ? settings.field_mapping : report.field_mapping;
  if (!fromTaager && mapping.confidence !== "owner" && d.anthropicKey) {
    const est = estimateMax(settings.research_model, 6000, 600, 0);
    if ((await spentToday(d.db, run.store_code)) + est <= settings.daily_budget_microusd) {
      try {
        const prompt = mappingPrompt(report.meta_keys, offers.filter((o) => Object.keys(o.meta).length).slice(0, 3));
        const res = await callClaude({ apiKey: d.anthropicKey, model: settings.research_model, maxTokens: 600, temperature: 0, fetchImpl: d.fetchImpl, ...prompt });
        await recordCost(d.db, run, "field_mapping", null, res.metered);
        const ai = parseMapping(extractJson(res.text), new Set(Object.keys(report.key_stats)));
        if (ai && (ai.ai_confidence ?? 0) >= 0.6) {
          const numericOk = (k: string | null | undefined) => !k || (report.key_stats[k]?.numericShare ?? 0) >= 0.8;
          const merged: FieldMapping = { ...mapping, confidence: "ai", notes: [...(mapping.notes ?? []), "AI: " + (ai.explanation ?? "")] };
          for (const f of ["cost_key", "floor_key", "suggested_key", "profit_key", "quantity_key"] as const) if (ai[f] && numericOk(ai[f])) merged[f] = ai[f];
          for (const f of ["components_key", "taager_sku_key"] as const) if (ai[f]) merged[f] = ai[f];
          merged.cost_source = merged.cost_key ? "meta" : null;
          merged.floor_source = merged.floor_key ? "meta" : ai.woo_price_is === "floor" && (ai.ai_confidence ?? 0) >= 0.75 ? "woo_regular_price" : null;
          if (merged.floor_source === "woo_regular_price") merged.notes!.push("Taager minimum taken from WooCommerce regular price (AI-inferred; owner should confirm).");
          mapping = merged;
        }
      } catch (e) { mapping = { ...mapping, notes: [...(mapping.notes ?? []), "AI mapping failed: " + String(e).slice(0, 120)] }; }
    }
  }
  const { key_stats: _ks, ...publicReport } = report;
  await d.db.upsert("supplier_capability_reports", { run_id: run.id, store_code: run.store_code, report: { ...publicReport, field_mapping: mapping } }, "run_id");
  if (!fromTaager && settings.field_mapping?.confidence !== "owner") await d.db.patch("brain_settings", `store_code=eq.${run.store_code}`, { field_mapping: mapping, updated_at: new Date().toISOString() });
  run.summary.capability = { offers: report.totals.offers, products: report.totals.products, variations: report.totals.variations, offers_with_video: report.media.offers_with_video, offer_kinds: report.offer_kinds, mapping };
  run.stage = "prefilter";
}

async function stagePrefilter(d: Deps, run: Run, m: MarketFacts, settings: Settings) {
  const offers = await loadOffers(d.db, run.store_code, run.id);
  const mapping = (run.summary.capability as { mapping?: FieldMapping } | undefined)?.mapping ?? settings.field_mapping;
  const rows = prefilter(offers, mapping, m, settings.shortlist_size, { stockHistory: await loadStockHistory(d, run.store_code), now: (d.now ?? Date.now)() });
  // A build for chosen products only (the day's approved additions): everything else stays out of this run.
  const only = buildProducts(run.summary);
  if (only) for (const r of rows) if (r.stage === "shortlisted" && !only.has(r.product_id)) { r.stage = "excluded"; r.reasons.push("not_in_this_batch"); }
  for (let i = 0; i < rows.length; i += 500) {
    await d.db.upsert("brain_product_analysis", rows.slice(i, i + 500).map((r) => ({ run_id: run.id, store_code: run.store_code, ...r, updated_at: new Date().toISOString() })), "run_id,product_id,variation_id");
  }
  const by = (s: string) => rows.filter((r) => r.stage === s).length;
  run.summary.prefilter = { evaluated: rows.length, shortlisted: by("shortlisted"), excluded: by("excluded"), killed: by("killed"),
    taager_success_median_bps: taagerMarketSuccessBps(offers),
    top_exclusion_reasons: Object.entries(rows.flatMap((r) => r.stage === "excluded" ? r.reasons.filter((x) => !x.startsWith("spread")) : []).reduce((a, x) => ((a[x] = (a[x] ?? 0) + 1), a), {} as Record<string, number>)).sort((a, b) => b[1] - a[1]).slice(0, 8) };
  run.stage = by("shortlisted") ? "research" : "review";
  if (!by("shortlisted")) run.status = "awaiting_review";
}

/** Stock readings of the last 14 days per SKU (written by every Taager import). Missing table or rows = no signal. */
async function loadStockHistory(d: Deps, store: string): Promise<Map<string, StockPoint[]>> {
  const out = new Map<string, StockPoint[]>();
  try {
    const since = new Date((d.now ?? Date.now)() - 14 * 86_400_000).toISOString();
    for (let offset = 0; offset < 60000; offset += 1000) {
      const rows = await d.db.select<{ sku: string; observed_at: string; stock_low: number }>("taager_stock_history", `select=sku,observed_at,stock_low&market=eq.${store}&observed_at=gte.${since}&order=sku.asc,observed_at.asc&limit=1000&offset=${offset}`);
      for (const r of rows) out.set(r.sku, [...(out.get(r.sku) ?? []), { at: r.observed_at, low: r.stock_low }]);
      if (rows.length < 1000) break;
    }
  } catch { /* demand signals are optional */ }
  return out;
}
/** The owner's per-market switch: true only after G1 proved Taager applies its quantity / add-on prices to our orders. */
async function discountsProven(d: Deps, store: string): Promise<boolean> {
  try { return (await d.db.select<{ taager_discounts_proven: boolean }>("store_commerce_facts", `select=taager_discounts_proven&store_code=eq.${store}&limit=1`))[0]?.taager_discounts_proven === true; }
  catch { return false; }
}

async function budgetOk(d: Deps, run: Run, settings: Settings, estimate: number) {
  return (await spentToday(d.db, run.store_code)) + estimate <= settings.daily_budget_microusd;
}

/** Shop prices are reused for this long before a product is researched (and paid for) again. */
export const RESEARCH_MAX_AGE_DAYS = 14;

async function stageResearch(d: Deps, run: Run, m: MarketFacts, settings: Settings, deadline: number) {
  if (!d.anthropicKey) throw Error("missing_anthropic_key");
  const conc = d.concurrency ?? 4;
  const now = (d.now ?? Date.now)();
  while (Date.now() < deadline - 60_000) {
    const batch = await d.db.select<Analysis>("brain_product_analysis", `select=*&run_id=eq.${run.id}&stage=eq.shortlisted&order=prefilter_score.desc&limit=${conc}`);
    if (!batch.length) { run.stage = "decide"; return; }
    const offers = await loadOffersByKeys(d.db, run.store_code, batch, runSource(run));
    // Dated cache first: a product researched within 14 days costs nothing again (idempotent re-runs, cheap daily loop).
    const fresh = new Map<string, Record<string, unknown>>();
    try {
      const skus = batch.map((a) => offers.get(key(a))?.sku).filter((x): x is string => !!x);
      if (skus.length) {
        const since = new Date(now - RESEARCH_MAX_AGE_DAYS * 86_400_000).toISOString();
        const rows = await d.db.select<{ sku: string; research: Record<string, unknown> }>("market_research_cache",
          `select=sku,research&store_code=eq.${run.store_code}&sku=in.(${skus.map((x) => `"${x.replace(/"/g, "")}"`).join(",")})&researched_at=gte.${since}&limit=${skus.length}`);
        for (const r of rows) fresh.set(r.sku, r.research);
      }
    } catch { /* no cache table yet: research everything */ }
    const paid = batch.filter((a) => { const sku = offers.get(key(a))?.sku; return !(sku && fresh.has(sku)); });
    const est = estimateMax(settings.research_model, 3400, 2200, settings.max_searches_per_product) * paid.length;
    if (paid.length && !(await budgetOk(d, run, settings, est))) { run.status = "paused_budget"; return; }
    await pool(batch, conc, async (a) => {
      const o = offers.get(key(a));
      let research: Record<string, unknown>, cost = 0;
      const cached = o?.sku ? fresh.get(o.sku) : undefined;
      try {
        if (!o) throw Error("offer_missing");
        if (cached) research = { ...cached, from_cache: true, cost_microusd: 0 };
        else {
          const res = await callClaude({ apiKey: d.anthropicKey!, model: settings.research_model, maxTokens: 2200, temperature: 0,
            webSearch: { maxUses: settings.max_searches_per_product, country: m.country }, fetchImpl: d.fetchImpl, ...researchPrompt(o, m) });
          await recordCost(d.db, run, "research", key(a), res.metered);
          cost = res.metered.cost_microusd;
          const parsed = parseResearch(extractJson(res.text), m, res.searchedUrls);
          const at = new Date(now).toISOString();
          research = { ...parsed, searches: res.metered.web_searches, cost_microusd: cost, researched_at: at };
          if (o.sku) {
            try {
              const ref = marketReference(parsed.listings);
              const ev = evidenceRows(run.store_code, o.sku, parsed, at);
              if (ev.length) await d.db.upsert("market_price_evidence", ev, "store_code,sku,url");
              await d.db.upsert("market_research_cache", [{ store_code: run.store_code, sku: o.sku, research, researched_at: at, cost_microusd: cost, web_searches: res.metered.web_searches,
                basis: ref.basis, shops: ref.count, shops_ignored: ref.ignored, median_minor: ref.median_minor, cheapest_minor: ref.cheapest_minor, cheapest_retailer: ref.cheapest_retailer }], "store_code,sku");
            } catch { /* the cache is a saving, never a blocker */ }
          }
        }
      } catch (e) { research = { error: String(e).slice(0, 300), listings: [], demand_signals: [] }; }
      await d.db.patch("brain_product_analysis", `run_id=eq.${run.id}&product_id=eq.${a.product_id}&variation_id=eq.${a.variation_id}`,
        { research, stage: "researched", cost_microusd: Number(a.cost_microusd ?? 0) + cost, updated_at: new Date().toISOString() });
    });
    run.progress.researched = Number(run.progress.researched ?? 0) + batch.length;
    run.progress.research_from_cache = Number(run.progress.research_from_cache ?? 0) + (batch.length - paid.length);
  }
}

/** Taager's measured confirmation×delivery rate is blended 50/50 with the planning rate (sample sizes are not published). */
/**
 * Market planning rate from Taager's own figures: the median of confirmed × delivered across products that have
 * data in this catalogue read. Needs at least 20 such products; otherwise null (use the owner setting or market default).
 * Confirmed × delivered is the cautious reading (delivered orders out of placed orders); G1 test orders confirm it.
 */
export function taagerMarketSuccessBps(offers: OfferRow[]): number | null {
  const rates = offers.map((o) => o.meta["taager_success_rate_bps"]).filter((r): r is number => typeof r === "number" && r > 0 && r <= 10000).sort((a, b) => a - b);
  if (rates.length < 20) return null;
  const mid = rates.length >> 1;
  return rates.length % 2 ? rates[mid] : Math.round((rates[mid - 1] + rates[mid]) / 2);
}

/** Owner setting first, then Taager's market median from this run's catalogue, then the market default. */
export function planningBaseBps(settings: { delivery_rate_bps?: number | null }, summary: Record<string, unknown>, m: MarketFacts): number {
  if (typeof settings.delivery_rate_bps === "number") return settings.delivery_rate_bps;
  const fromTaager = (summary.prefilter as { taager_success_median_bps?: unknown } | undefined)?.taager_success_median_bps;
  return typeof fromTaager === "number" && fromTaager > 0 ? fromTaager : m.defaultDeliveryRateBps;
}

/** A product's own Taager figure is blended half-and-half with the market base (Taager gives no order counts). */
export function plannedSuccessBps(o: OfferRow | undefined, base: number): number {
  const measured = o?.meta["taager_success_rate_bps"];
  if (typeof measured !== "number" || measured <= 0 || measured > 10000) return base;
  return Math.round((measured + base) / 2);
}

async function stageDecide(d: Deps, run: Run, m: MarketFacts, settings: Settings) {
  const rows = await d.db.select<Analysis>("brain_product_analysis", `select=*&run_id=eq.${run.id}&stage=eq.researched&limit=1000`);
  const offers = await loadOffersByKeys(d.db, run.store_code, rows, runSource(run));
  const proven = await discountsProven(d, run.store_code);
  const now = (d.now ?? Date.now)();
  const scored = rows.map((a) => {
    const research = (a.research ?? {}) as { listings?: { retailer: string; url: string; price_minor: number; match: "exact" | "similar"; confidence: number; delivery_minor?: number | null; credible?: boolean }[]; demand_signals?: unknown[]; risks?: string[] };
    const listings = research.listings ?? [];
    const decision = decidePrice({ inputs: a.economics as { cost_minor: number | null; floor_minor: number | null; suggested_minor: number | null; max_minor?: number | null }, competitors: listings, m,
      deliveryRateBps: plannedSuccessBps(offers.get(key(a)), planningBaseBps(settings, run.summary, m)) });
    // Taager's own quantity prices and sale: both figures on every offer; full cost rules until the market is proven.
    if (decision.state === "priced" && decision.price_minor) {
      const econ = a.economics as { cost_minor: number; floor_minor: number | null };
      const facts = taagerFacts(offers.get(key(a))?.meta);
      const dual = quantityOffersDual(decision.price_minor, { cost_minor: econ.cost_minor, floor_minor: econ.floor_minor }, facts, m, proven);
      if (dual.length) decision.quantity_offers = dual;
      const sale = salePlan({ price_minor: decision.price_minor, inputs: { cost_minor: econ.cost_minor, floor_minor: econ.floor_minor }, sale: facts.sale, positioning: decision.positioning, m, now, proven });
      if (sale) { (decision as PriceDecision & { taager_sale?: unknown }).taager_sale = sale; decision.notes.push("Taager sale running: " + sale.reason); }
    }
    const retailers = new Set(listings.filter((l) => l.confidence >= 0.5).map((l) => l.retailer)).size;
    const demand = (a.economics as { demand?: { factor?: number } }).demand?.factor;
    const score = finalScore(decision, { retailers_found: retailers, exact_matches: listings.filter((l) => l.match === "exact").length, demand_signals: (research.demand_signals ?? []).length, risks: research.risks ?? [] }, offers.get(key(a))?.images.length ?? 0, typeof demand === "number" ? demand : 1);
    return { a, decision, score };
  });
  const chosen = selectFinal(scored.map((x) => ({ product_id: x.a.product_id, variation_id: x.a.variation_id, family_key: x.a.family_key ?? key(x.a), category: x.a.category, score: x.score, blocked: x.decision.state !== "priced" })), settings.selection_size);
  const chosenKeys = new Set(chosen.map(key));
  const updates = scored.map((x) => ({ run_id: run.id, store_code: run.store_code, product_id: x.a.product_id, variation_id: x.a.variation_id, title: x.a.title, offer_kind: x.a.offer_kind,
    stage: chosenKeys.has(key(x.a)) ? "selected" : "not_selected", score: x.score, decision: x.decision,
    reasons: [...x.a.reasons, ...(x.decision.state === "blocked" ? ["blocked:" + x.decision.blocked_reason] : []), ...(x.decision.notes ?? [])], updated_at: new Date().toISOString() }));
  for (let i = 0; i < updates.length; i += 500) await d.db.upsert("brain_product_analysis", updates.slice(i, i + 500), "run_id,product_id,variation_id");
  const sel = scored.filter((x) => chosenKeys.has(key(x.a)) && x.decision.state === "priced");
  const threshold = freeDeliveryThreshold(sel.map((x) => ({ price_minor: x.decision.price_minor!, profit_delivered_minor: x.decision.profit_delivered_minor! })), m);
  run.summary.decision = {
    researched: rows.length, selected: chosen.length, blocked: scored.filter((x) => x.decision.state === "blocked").length,
    needs_owner_review: sel.filter((x) => x.decision.needs_owner_review).length,
    band_exceptions: sel.filter((x) => x.decision.band_exception).length,
    delivery_included: sel.filter((x) => x.decision.delivery_included).length,
    price_blocks_sales: sel.filter((x) => x.decision.price_blocks_sales).length,
    avg_margin_pct: sel.length ? Math.round((sel.reduce((s, x) => s + (x.decision.margin_on_price_pct ?? 0), 0) / sel.length) * 10) / 10 : null,
    positioning: sel.reduce((acc, x) => ((acc[x.decision.positioning ?? "unknown"] = (acc[x.decision.positioning ?? "unknown"] ?? 0) + 1), acc), {} as Record<string, number>),
    free_delivery: threshold ? { ...threshold, threshold: minorToDecimal(threshold.threshold_minor, m.minorDigits) + " " + m.currency } : null,
    avg_expected_profit_usd: sel.length ? Math.round((sel.reduce((s, x) => s + (x.decision.expected_profit_usd ?? 0), 0) / sel.length) * 100) / 100 : null,
  };
  run.stage = chosen.length ? "content" : "review";
  if (!chosen.length) run.status = "awaiting_review";
}

/** The latest earlier page for the same product in this store that still passes today's rules against today's facts. */
async function reusablePage(d: Deps, run: Run, a: Analysis, market: Market, sourceText: string): Promise<Record<string, unknown> | null> {
  try {
    const rows = await d.db.select<{ run_id: string; content: Record<string, unknown> | null; updated_at: string }>("brain_product_analysis",
      `select=run_id,content,updated_at&store_code=eq.${run.store_code}&product_id=eq.${a.product_id}&variation_id=eq.${a.variation_id}&stage=eq.selected&order=updated_at.desc&limit=5`);
    for (const r of rows) {
      if (r.run_id === run.id || !r.content || typeof r.content.title !== "string" || r.content.error) continue;
      const again = parseContent(r.content, { market, sourceText });
      if (again.issues.includes("needs_fix")) continue;
      return { ...r.content, issues: again.issues, reused_from_run: r.run_id };
    }
  } catch { /* nothing to reuse */ }
  return null;
}

async function stageContent(d: Deps, run: Run, m: MarketFacts, settings: Settings, deadline: number) {
  if (!d.anthropicKey) throw Error("missing_anthropic_key");
  const conc = d.concurrency ?? 4;
  while (Date.now() < deadline - 60_000) {
    const batch = await d.db.select<Analysis>("brain_product_analysis", `select=*&run_id=eq.${run.id}&stage=eq.selected&content=is.null&order=score.desc&limit=${conc}`);
    if (!batch.length) { run.stage = "merchandise"; return; }
    const est = estimateMax(settings.content_model, 4200, 2500, 0) * batch.length * 2; // one possible rewrite each
    if (!(await budgetOk(d, run, settings, est))) { run.status = "paused_budget"; return; }
    const offers = await loadOffersByKeys(d.db, run.store_code, batch, runSource(run));
    let reused = 0;
    await pool(batch, conc, async (a) => {
      const o = offers.get(key(a));
      let content: Record<string, unknown>, cost = 0;
      try {
        if (!o) throw Error("offer_missing");
        const mapping = (run.summary.capability as { mapping?: FieldMapping } | undefined)?.mapping ?? settings.field_mapping;
        const k = offerKind(o, mapping);
        const price = a.decision?.price_minor ? minorToDecimal(a.decision.price_minor, m.minorDigits) + " " + m.currency : "set by store";
        const research = a.research as { summary?: string; facts?: { kind: string; fact: string; cited?: boolean }[]; buyer_questions?: string[] } | null;
        // Only facts whose source page was really opened during research reach the writer.
        const facts = (research?.facts ?? []).filter((f) => f.cited === true).map((f) => ({ kind: f.kind, fact: f.fact }));
        const ctx = { category: a.category, piecesVerified: k.kind === "verified_multipack" ? k.pieces : null, priceText: price,
          deliveryText: `${minorToDecimal(m.shippingMinor, m.minorDigits)} ${m.currency} per order, paid on delivery`, returnsText: "per the store's returns page",
          research: research?.summary ?? "", facts, buyerQuestions: research?.buyer_questions ?? [] };
        const sourceText = contentSourceText(o, ctx);
        // Idempotent builds: a page already written for this product and still valid against today's facts is reused, not paid for again.
        const earlier = await reusablePage(d, run, a, m.code, sourceText);
        if (earlier) { content = { ...earlier, reused: true, cost_microusd: 0 }; reused++; }
        else {
        const write = async (fix?: string[]) => {
          const res = await callClaude({ apiKey: d.anthropicKey!, model: settings.content_model, maxTokens: 2500, temperature: 0.4, fetchImpl: d.fetchImpl, ...contentPrompt(o, m, { ...ctx, fix }) });
          await recordCost(d.db, run, "content", key(a), res.metered);
          cost += res.metered.cost_microusd;
          return parseContent(extractJson(res.text), { market: m.code, sourceText });
        };
        let page = await write();
        // One rewrite when the draft breaks a rule (invented number, wrong dialect, layout). A second failure stays flagged for the owner.
        if (page.issues.includes("needs_fix")) { const again = await write(page.issues.filter((i) => i !== "needs_fix")); if (!again.issues.includes("needs_fix") || again.issues.length < page.issues.length) page = again; }
        content = { ...page, model: settings.content_model, cost_microusd: cost, facts_used: facts.length };
        }
        // Picture rule (M11): clean pictures first, promo artwork never the face of the product. One small vision call.
        const pics = o.images.map((i) => /^https:\/\/media\.taager\.com\/([0-9a-f-]{36}\.(?:jpe?g|png|webp))$/.exec(i.src)?.[1]).filter((x): x is string => !!x).slice(0, 12);
        if (pics.length > 1 && !content.pictures) {
          try {
            const seen = await callClaude({ apiKey: d.anthropicKey!, model: settings.research_model, maxTokens: 600, temperature: 0, fetchImpl: d.fetchImpl,
              images: pics.map((id) => `https://media.taager.com/360x360/${id}`), ...picturePrompt(pics) });
            await recordCost(d.db, run, "pictures", key(a), seen.metered);
            cost += seen.metered.cost_microusd;
            const verdicts = parsePictureVerdicts(extractJson(seen.text), pics);
            if (verdicts) content.pictures = { ...orderPictures(verdicts), verdicts };
          } catch (e) { content.pictures = { error: String(e).slice(0, 200) }; }
        }
      } catch (e) { content = { error: String(e).slice(0, 300), issues: ["generation_failed"] }; }
      await d.db.patch("brain_product_analysis", `run_id=eq.${run.id}&product_id=eq.${a.product_id}&variation_id=eq.${a.variation_id}`,
        { content, category: (content.category as string | undefined) ?? a.category, cost_microusd: Number(a.cost_microusd ?? 0) + cost, updated_at: new Date().toISOString() });
    });
    run.progress.content_written = Number(run.progress.content_written ?? 0) + batch.length;
    run.progress.content_reused = Number(run.progress.content_reused ?? 0) + reused;
  }
}

async function stageMerchandise(d: Deps, run: Run) {
  const rows = await d.db.select<Analysis>("brain_product_analysis", `select=*&run_id=eq.${run.id}&stage=eq.selected&limit=500`);
  const offers = await loadOffersByKeys(d.db, run.store_code, rows, runSource(run));
  const plan = merchandise(rows.map((a) => ({ key: key(a), category: a.category, score: a.score ?? 0, price_minor: a.decision?.price_minor ?? 0, images: offers.get(key(a))?.images.length ?? 0 })));
  const title = new Map(rows.map((a) => [key(a), (a.content as { title?: string } | null)?.title || a.title]));
  for (const a of rows) {
    await d.db.patch("brain_product_analysis", `run_id=eq.${run.id}&product_id=eq.${a.product_id}&variation_id=eq.${a.variation_id}`, {
      merchandising: { featured: plan.featured.includes(key(a)), hero: plan.hero === key(a), cross_sell: (plan.cross_sell[key(a)] ?? []).map((k) => ({ key: k, title: title.get(k) })) },
    });
  }
  const ledger = await d.db.select<{ step: string; cost_microusd: number; web_searches: number; item_ref: string | null }>("brain_cost_ledger", `select=step,cost_microusd,web_searches,item_ref&run_id=eq.${run.id}&limit=5000`);
  const sum = (step: string) => ledger.filter((l) => l.step === step).reduce((s, l) => s + Number(l.cost_microusd), 0);
  const n = (step: string) => new Set(ledger.filter((l) => l.step === step).map((l) => l.item_ref)).size || 1;
  const perResearch = sum("research") / n("research"), perContent = sum("content") / n("content");
  const offersTotal = Number((run.summary.capability as { offers?: number } | undefined)?.offers ?? 0);
  run.summary.merchandising = { hero: plan.hero ? title.get(plan.hero) : null, featured: plan.featured.map((k) => title.get(k)), category_order: plan.category_order };
  run.summary.cost = {
    total_usd: (sum("research") + sum("content") + sum("field_mapping")) / 1e6, research_usd: sum("research") / 1e6, content_usd: sum("content") / 1e6,
    mapping_usd: sum("field_mapping") / 1e6, web_searches: ledger.reduce((s, l) => s + Number(l.web_searches), 0),
    per_researched_product_usd: Math.round(perResearch / 100) / 1e4, per_content_product_usd: Math.round(perContent / 100) / 1e4,
    projection: {
      note: "Estimates from this run's real per-product cost.",
      research_entire_catalog_this_store_usd: Math.round((perResearch * offersTotal) / 1e4) / 100,
      one_store_cycle_usd: Math.round((perResearch * 80 + perContent * 50) / 1e4) / 100,
      five_stores_cycle_usd: Math.round(((perResearch * 80 + perContent * 50) * 5) / 1e4) / 100,
      daily_autopilot_5_new_products_per_store_usd: Math.round(((perResearch * 10 + perContent * 5) * 5) / 1e4) / 100,
    },
  };
  run.stage = "review";
  run.status = "awaiting_review";
}

/** Products a "Build store" run must deliver (1-200), or null for an ordinary run. */
export function buildTarget(summary: Record<string, unknown>): number | null {
  const n = (summary.build as { target?: unknown } | undefined)?.target;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 200 ? n : null;
}
/** Taager product ids a build is restricted to (the owner's approved daily additions), or null. */
export function buildProducts(summary: Record<string, unknown>): Set<number> | null {
  const ids = (summary.build as { product_ids?: unknown } | undefined)?.product_ids;
  if (!Array.isArray(ids)) return null;
  const clean = ids.filter((x): x is number => typeof x === "number" && Number.isSafeInteger(x) && x > 0).slice(0, 50);
  return clean.length ? new Set(clean) : null;
}
/** Research half as many again as the target (blocked prices, weak research and near-duplicates fall out), at most 400. */
export const buildShortlist = (target: number) => Math.min(400, Math.max(target + 10, Math.ceil(target * 1.5)));

/** Advance a run as far as the time budget allows. Returns the saved run. */
export async function step(d: Deps, runId: string): Promise<Run> {
  const started = (d.now ?? Date.now)();
  const deadline = started + (d.timeBudgetMs ?? 110_000);
  const lockUntil = new Date(started + (d.timeBudgetMs ?? 110_000) + 30_000).toISOString();
  const claimed = await d.db.patch<Run>("brain_runs", `id=eq.${runId}&status=eq.running&or=(locked_until.is.null,locked_until.lt.${new Date(started).toISOString()})`, { locked_until: lockUntil });
  if (!claimed.length) {
    const current = (await d.db.select<Run>("brain_runs", `select=*&id=eq.${runId}`))[0];
    if (!current) throw Error("run_not_found");
    return current; // busy, paused, finished or cancelled: nothing to do
  }
  const run = claimed[0];
  // Market figures after Taager's own information pages (fees, zones, charges): never cheaper than the database's price guards.
  const m = (await loadMarket(d.db, d.market)).m;
  const settings = (await d.db.select<Settings>("brain_settings", `select=*&store_code=eq.${run.store_code}`))[0];
  // "Build store → N products": the run carries its own target; the shortlist is sized so N survive pricing and review.
  const target = buildTarget(run.summary);
  if (target) { settings.selection_size = target; settings.shortlist_size = buildShortlist(target); }
  try {
    let guard = 0;
    while (run.status === "running" && Date.now() < deadline && guard++ < 10) {
      const before = run.stage;
      if (run.stage === "ingest") await stageIngest(d, run, m, deadline);
      else if (run.stage === "audit") await stageAudit(d, run, m, settings);
      else if (run.stage === "prefilter") await stagePrefilter(d, run, m, settings);
      else if (run.stage === "research") await stageResearch(d, run, m, settings, deadline);
      else if (run.stage === "decide") await stageDecide(d, run, m, settings);
      else if (run.stage === "content") await stageContent(d, run, m, settings, deadline);
      else if (run.stage === "merchandise") await stageMerchandise(d, run);
      else break;
      if (run.stage === before && run.status === "running") break; // stage needs another call
    }
  } catch (e) {
    run.status = "failed";
    (run as Run & { error?: string }).error = String(e).slice(0, 500);
  }
  // Live cost of this run in micro-dollars, and how far the build is, for the progress line in /admin.
  try {
    const ledger = await d.db.select<{ cost_microusd: number }>("brain_cost_ledger", `select=cost_microusd&run_id=eq.${run.id}&limit=5000`);
    run.progress.cost_microusd = ledger.reduce((s, l) => s + Number(l.cost_microusd), 0);
    if (target) run.progress.target = target;
  } catch { /* progress only */ }
  const saved = await d.db.patch<Run>("brain_runs", `id=eq.${run.id}`, {
    stage: run.stage, status: run.status, cursor: run.cursor, progress: run.progress, summary: run.summary,
    error: (run as Run & { error?: string }).error ?? null, locked_until: null, updated_at: new Date().toISOString(),
    ...(run.status === "awaiting_review" || run.status === "failed" ? { finished_at: new Date().toISOString() } : {}),
  });
  return saved[0] ?? run;
}
