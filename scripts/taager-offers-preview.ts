// Offline preview of what the brain would PROPOSE from a private Taager sync file (owner's machine only):
// quantity offers with both profit figures, themed sets, sale handling, free delivery and near-duplicates.
// Prices are the brain's no-research prices, so real numbers come from the first run with market research.
// Prints totals in US dollars to the terminal. Never commit a sync file or its figures (public repository).
// usage: bun scripts/taager-offers-preview.ts <sync.json> [publishedCount=50] [proven]
import { readFileSync } from "node:fs";
import { MARKETS, minorToUsd, type Market } from "../supabase/functions/_shared/brain/markets.ts";
import { TAAGER_MAPPING, normalizeTaager } from "../supabase/functions/_shared/brain/taager-normalize.ts";
import { prefilter, selectFinal, finalScore } from "../supabase/functions/_shared/brain/selection.ts";
import { decidePrice } from "../supabase/functions/_shared/brain/economics.ts";
import { proposeOffers, type OfferListing } from "../supabase/functions/_shared/brain/offers.ts";
import { taagerFacts } from "../supabase/functions/_shared/brain/taager-economics.ts";
import { parseTaagerFile } from "../src/lib/store/taager-import.ts";
import { plannedSuccessBps, taagerMarketSuccessBps } from "../supabase/functions/_shared/brain/runner.ts";

const [input, nArg, provenArg] = process.argv.slice(2);
if (!input) throw Error("usage: bun scripts/taager-offers-preview.ts <sync.json> [publishedCount] [proven]");
const N = Number(nArg ?? 50), proven = provenArg === "proven";
for (const block of parseTaagerFile(readFileSync(input, "utf8"))) {
  const mk = block.market as Market, m = MARKETS[mk];
  const $ = (minor: number) => "$" + minorToUsd(minor, m).toFixed(2);
  const offers = block.rows.map((r) => normalizeTaager(mk, m, { market: mk, ...r, synced_at: "", price_changed_at: null }));
  const byKey = new Map(offers.map((o) => [`${o.product_id}:${o.variation_id}`, o]));
  const rows = prefilter(offers, TAAGER_MAPPING, m, 80);
  const base = taagerMarketSuccessBps(offers) ?? m.defaultDeliveryRateBps;
  const dup = rows.filter((r) => r.reasons.some((x) => x.startsWith("near_duplicate_of"))).length;
  const scored = rows.filter((r) => r.stage === "shortlisted").map((r) => {
    const o = byKey.get(`${r.product_id}:${r.variation_id}`)!;
    const d = decidePrice({ inputs: r.economics as never, competitors: [], m, deliveryRateBps: plannedSuccessBps(o, base) });
    return { r, o, d, score: finalScore(d, null, o.images.length, (r.economics as { demand?: { factor?: number } }).demand?.factor ?? 1) };
  });
  const chosen = new Set(selectFinal(scored.map((x) => ({ product_id: x.r.product_id, variation_id: x.r.variation_id, family_key: x.r.family_key, category: x.r.category, score: x.score, blocked: x.d.state !== "priced" })), N).map((c) => `${c.product_id}:${c.variation_id}`));
  const listings: OfferListing[] = scored.filter((x) => chosen.has(`${x.r.product_id}:${x.r.variation_id}`)).sort((a, b) => b.score - a.score).map((x, i) => {
    const f = taagerFacts(x.o.meta), e = x.r.economics as { cost_minor: number; floor_minor: number | null };
    return { listing_id: "l" + i, slug: "p" + i, title: x.o.title, category: x.r.category, price_minor: x.d.price_minor!, cost_minor: e.cost_minor, floor_minor: e.floor_minor, rank: i + 1,
      image: x.o.images[0]?.src ?? null, is_bundle: x.o.product_type === "bundle", tiers: f.tiers, addon_cost_minor: f.addon?.cost_minor ?? null, sale: f.sale, positioning: x.d.positioning ?? null };
  });
  const p = proposeOffers({ market: m, listings, proven });
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  console.log(`\n== ${mk.toUpperCase()} — ${offers.length} products read, ${listings.length} taken as published, Taager discounts ${proven ? "PROVEN" : "not proven"} ==`);
  console.log(`near-duplicates removed from the shortlist: ${dup}`);
  console.log(`new arrivals (30 days): ${offers.filter((o) => typeof o.meta.taager_created_at === "string" && Date.now() - Date.parse(o.meta.taager_created_at + "Z") < 30 * 86400000).length}; with a confirmation rate: ${offers.filter((o) => o.meta.taager_confirmation_rate).length}`);
  console.log(`quantity offers: ${p.quantity.length}` + (p.quantity.length ? ` | avg earns ${$(sum(p.quantity.map((q) => q.profit_if_taager_minor)) / p.quantity.length)} if Taager applies its quantity price, ${$(sum(p.quantity.map((q) => q.profit_full_minor)) / p.quantity.length)} if not` : ""));
  console.log(`sets: ${p.bundles.length} (${p.bundles.filter((b) => b.theme).length} themed)`);
  for (const b of p.bundles.slice(0, 8)) console.log(`  - ${b.theme ?? "pair"}: ${b.items.length} pieces at ${$(b.price_minor)} (singly ${$(b.separate_minor)}) | earns ${$(b.profit_if_taager_minor ?? b.profit_minor)} if add-on price applies, ${$(b.profit_full_minor ?? b.profit_minor)} if not, ${$(b.profit_if_split_minor)} as two parcels`);
  console.log(`Taager sales among published: ${p.sales.length} time-limited offers, ${p.sale_notes.length} kept at our price`);
  for (const s of p.sales.slice(0, 5)) console.log(`  - offer ${$(s.price_minor)} until ${s.ends_at.slice(0, 10)} | earns ${$(s.profit_if_taager_minor)} / ${$(s.profit_full_minor)}`);
  console.log(p.free_delivery ? `free delivery: from ${$(p.free_delivery.threshold_minor)} for products with margin >= ${p.free_delivery.min_margin_bps / 100}% | ${p.free_delivery.eligible} eligible, ${p.free_delivery.excluded.length} left out | thinnest basket earns ${$(p.free_delivery.worst_case_profit_minor)}, typical ${$(p.free_delivery.typical_profit_minor)}`
    : `free delivery: not offered. ${p.free_delivery_reason}`);
  console.log(`delivery included: ${p.delivery_included.length} products` + (p.delivery_included.length ? ` (avg profit after the fee ${$(sum(p.delivery_included.map((d) => d.profit_minor)) / p.delivery_included.length)})` : ""));
}
