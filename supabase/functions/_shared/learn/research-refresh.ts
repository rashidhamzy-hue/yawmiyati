// Stale shop-price research, refreshed by the daily loop itself (session 4).
// A product on the store whose shop prices are older than 14 days (or were never researched) is researched again,
// oldest first, so re-pricing never works from old competitor prices. This is the only step of the daily loop that
// spends AI money, and it is fenced three ways: the market's daily cap (brain_settings.daily_budget_microusd), a share
// of that cap reserved for it (a quarter, so a build the owner starts the same day is never starved), and a count per day.
// No key, no budget or no stale product: it does nothing and says so in the brief.
import type { Db } from "../brain/db.ts";
import type { Market, MarketFacts } from "../brain/markets.ts";
import { callClaude, estimateMax, extractJson } from "../brain/anthropic.ts";
import { evidenceRows, parseResearch, researchPrompt } from "../brain/prompts.ts";
import { marketReference } from "../brain/economics.ts";
import { normalizeTaager, type TaagerCatalogRow } from "../brain/taager-normalize.ts";

export const RESEARCH_STALE_DAYS = 14, REFRESH_SHARE_BPS = 2500, REFRESH_MAX_PER_DAY = 12;
export type RefreshResult = { stale: number; refreshed: number; failed: number; cost_microusd: number; stopped: "done" | "no_key" | "budget" | "time" | "daily_count" | "nothing_stale"; note: string | null };
export type RefreshDeps = {
  db: Db; market: Market; m: MarketFacts; anthropicKey: string | null; fetchImpl?: typeof fetch; now: number; deadline: number;
  settings: { daily_budget_microusd: number; research_model?: string | null; max_searches_per_product?: number | null };
  /** Products on the store right now (visible ones are refreshed first). */
  listings: { sku: string; hidden_reason: string | null }[];
};

export async function refreshStaleResearch(d: RefreshDeps): Promise<RefreshResult> {
  const out: RefreshResult = { stale: 0, refreshed: 0, failed: 0, cost_microusd: 0, stopped: "done", note: null };
  const skus = [...new Set(d.listings.filter((l) => l.sku).sort((a, b) => Number(!!a.hidden_reason) - Number(!!b.hidden_reason)).map((l) => l.sku))];
  if (!skus.length) { out.stopped = "nothing_stale"; return out; }
  const seen = new Map<string, string>();
  for (let i = 0; i < skus.length; i += 80) {
    const rows = await d.db.select<{ sku: string; researched_at: string }>("market_research_cache",
      `select=sku,researched_at&store_code=eq.${d.market}&sku=in.(${skus.slice(i, i + 80).map((x) => `"${x.replace(/"/g, "")}"`).join(",")})&limit=200`);
    for (const r of rows) seen.set(r.sku, r.researched_at);
  }
  const cutoff = d.now - RESEARCH_STALE_DAYS * 86_400_000;
  // Never researched first, then the oldest.
  const stale = skus.filter((s) => !seen.has(s) || Date.parse(seen.get(s)!) < cutoff).sort((a, b) => (seen.has(a) ? Date.parse(seen.get(a)!) : 0) - (seen.has(b) ? Date.parse(seen.get(b)!) : 0));
  out.stale = stale.length;
  if (!stale.length) { out.stopped = "nothing_stale"; return out; }
  if (!d.anthropicKey) { out.stopped = "no_key"; out.note = `${stale.length} products have shop prices older than ${RESEARCH_STALE_DAYS} days; they were not refreshed because the brain's AI key is not set.`; return out; }
  const model = d.settings.research_model || "claude-haiku-5-5", searches = Math.min(5, Math.max(1, d.settings.max_searches_per_product ?? 3));
  const estimate = estimateMax(model, 3400, 2200, searches), cap = d.settings.daily_budget_microusd;
  const spentAtStart = Number(await d.db.rpc<number>("brain_spent_today", { p_store: d.market })) || 0;
  const ceiling = Math.min(cap, spentAtStart + Math.floor((cap * REFRESH_SHARE_BPS) / 10000));
  for (const sku of stale) {
    if (out.refreshed + out.failed >= REFRESH_MAX_PER_DAY) { out.stopped = "daily_count"; break; }
    if (Date.now() > d.deadline) { out.stopped = "time"; break; }
    if (spentAtStart + out.cost_microusd + estimate > ceiling) { out.stopped = "budget"; break; }
    try {
      const row = (await d.db.select<TaagerCatalogRow>("taager_catalog", `select=*&market=eq.${d.market}&sku=eq.${encodeURIComponent(sku)}&limit=1`))[0];
      if (!row) continue;
      const offer = normalizeTaager(d.market, d.m, row, d.now);
      const res = await callClaude({ apiKey: d.anthropicKey, model, maxTokens: 2200, temperature: 0, webSearch: { maxUses: searches, country: d.m.country }, fetchImpl: d.fetchImpl, ...researchPrompt(offer, d.m) });
      out.cost_microusd += res.metered.cost_microusd;
      await d.db.insert("brain_cost_ledger", { run_id: null, store_code: d.market, step: "research", item_ref: "daily:" + sku, model: res.metered.model, input_tokens: res.metered.input_tokens, output_tokens: res.metered.output_tokens,
        cache_read_tokens: res.metered.cache_read_tokens, cache_write_tokens: res.metered.cache_write_tokens, web_searches: res.metered.web_searches, cost_microusd: res.metered.cost_microusd });
      const parsed = parseResearch(extractJson(res.text), d.m, res.searchedUrls), at = new Date(d.now).toISOString(), ref = marketReference(parsed.listings);
      const ev = evidenceRows(d.market, sku, parsed, at);
      if (ev.length) await d.db.upsert("market_price_evidence", ev, "store_code,sku,url");
      await d.db.upsert("market_research_cache", [{ store_code: d.market, sku, research: { ...parsed, searches: res.metered.web_searches, cost_microusd: res.metered.cost_microusd, researched_at: at },
        researched_at: at, cost_microusd: res.metered.cost_microusd, web_searches: res.metered.web_searches, basis: ref.basis, shops: ref.count, shops_ignored: ref.ignored,
        median_minor: ref.median_minor, cheapest_minor: ref.cheapest_minor, cheapest_retailer: ref.cheapest_retailer }], "store_code,sku");
      out.refreshed++;
    } catch { out.failed++; }
  }
  const usd = (out.cost_microusd / 1e6).toFixed(2), left = out.stale - out.refreshed;
  out.note = out.refreshed || out.failed
    ? `Shop prices refreshed for ${out.refreshed} products ($${usd})${out.failed ? `, ${out.failed} failed` : ""}${left > 0 ? `; ${left} more are due and will follow on the next days (${out.stopped === "budget" ? "today's AI budget share is used" : out.stopped === "time" ? "out of time for this run" : "daily limit of " + REFRESH_MAX_PER_DAY})` : ""}.`
    : out.stopped === "budget" ? `${out.stale} products are due for a shop-price refresh, but today's AI budget is already used.` : null;
  return out;
}
