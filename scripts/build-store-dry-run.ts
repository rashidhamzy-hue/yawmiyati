/**
 * "Build store" dry run on a real Taager sync file: no database, no AI, no spend.
 * Runs the real brain code (normalise → audience and kill rules → shortlist with section spread → margin-band price
 * without shop research → final pick) and prints COUNTS AND RATIOS ONLY, so the output is safe to paste into a
 * public pull request. It never prints a supplier cost or a product name.
 *
 *   bun scripts/build-store-dry-run.ts <taager-sync.json> [products=100]
 *
 * It proves the selection and pricing rules on real data: how many products are picked, the spread across store
 * sections, where margins land in the 15-50% band, and that no pick earns under the US$2 floor.
 */
import { readFileSync } from "node:fs";
import { parseTaagerFile } from "../src/lib/store/taager-import.ts";
import { normalizeTaager, TAAGER_MAPPING } from "../supabase/functions/_shared/brain/taager-normalize.ts";
import { MARKETS, minorToUsd, type Market } from "../supabase/functions/_shared/brain/markets.ts";
import { finalScore, prefilter, selectFinal } from "../supabase/functions/_shared/brain/selection.ts";
import { decidePrice, floorMinor } from "../supabase/functions/_shared/brain/economics.ts";
import { buildShortlist, plannedSuccessBps, taagerMarketSuccessBps } from "../supabase/functions/_shared/brain/runner.ts";

const [input, nArg] = process.argv.slice(2);
if (!input) throw Error("usage: bun scripts/build-store-dry-run.ts <sync.json> [products]");
const N = Number(nArg ?? 100);
const pctl = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };

for (const block of parseTaagerFile(readFileSync(input, "utf8"))) {
  const mk = block.market as Market, m = MARKETS[mk];
  const offers = block.rows.map((r) => normalizeTaager(mk, m, { market: mk, ...r, synced_at: "", price_changed_at: null }));
  const byKey = new Map(offers.map((o) => [`${o.product_id}:${o.variation_id}`, o]));
  const rows = prefilter(offers, TAAGER_MAPPING, m, buildShortlist(N));
  const base = taagerMarketSuccessBps(offers) ?? m.defaultDeliveryRateBps;
  const short = rows.filter((r) => r.stage === "shortlisted");
  const scored = short.map((r) => {
    const o = byKey.get(`${r.product_id}:${r.variation_id}`)!;
    const d = decidePrice({ inputs: r.economics as never, competitors: [], m, deliveryRateBps: plannedSuccessBps(o, base) });
    const demand = (r.economics as { demand?: { factor?: number } }).demand?.factor ?? 1;
    return { r, d, score: finalScore(d, null, o.images.length, demand) };
  });
  const chosen = selectFinal(scored.map((x) => ({ product_id: x.r.product_id, variation_id: x.r.variation_id, family_key: x.r.family_key, category: x.r.category, score: x.score, blocked: x.d.state !== "priced" })), N);
  const keys = new Set(chosen.map((c) => `${c.product_id}:${c.variation_id}`));
  const picks = scored.filter((x) => keys.has(`${x.r.product_id}:${x.r.variation_id}`));
  const margins = picks.map((x) => x.d.margin_on_price_pct ?? 0), profit = picks.map((x) => minorToUsd(x.d.profit_delivered_minor ?? 0, m));
  const sections: Record<string, number> = {};
  for (const x of picks) sections[x.r.category ?? "other"] = (sections[x.r.category ?? "other"] ?? 0) + 1;
  const reasons: Record<string, number> = {};
  for (const r of rows) for (const x of r.reasons) { const k = x.replace(/:.*$/, ""); if (!k.startsWith("spread")) reasons[k] = (reasons[k] ?? 0) + 1; }
  console.log(JSON.stringify({
    market: mk, target: N, catalogue: offers.length, shortlisted_for_research: short.length,
    excluded: Object.fromEntries(Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 8)),
    priced: scored.filter((x) => x.d.state === "priced").length, blocked: scored.filter((x) => x.d.state !== "priced").length,
    picked: picks.length, sections,
    margin_pct: { p10: pctl(margins, 0.1), median: pctl(margins, 0.5), p90: pctl(margins, 0.9), in_band: picks.filter((x) => !x.d.band_exception).length, band_exceptions: picks.filter((x) => x.d.band_exception).length },
    profit_per_delivered_usd: { min: Math.round(Math.min(...profit) * 100) / 100, median: Math.round((pctl(profit, 0.5) ?? 0) * 100) / 100 },
    under_floor: picks.filter((x) => (x.d.profit_delivered_minor ?? 0) < floorMinor(m)).length,
    planning_delivery_rate_pct: Math.round(base / 100),
    note: "No shop research in a dry run: prices sit at Taager's default selling price moved into the band. A real build researches every shortlisted product first.",
  }, null, 1));
}
