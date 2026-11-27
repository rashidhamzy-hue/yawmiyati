/**
 * Offline preview of what the Yawmiyati Brain sees in a Taager sync file — no database, no AI, no spend.
 * Runs the real brain code (normalize → kill rules → shortlist → price at Taager's limits without market research)
 * and writes one self-contained HTML page with product thumbnails embedded.
 *
 *   bun scripts/taager-preview.ts <taager-sync.json> <out.html> [topN=60]
 *
 * The output contains supplier costs: keep it private (never commit it; this repo is public).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseTaagerFile } from "../src/lib/store/taager-import.ts";
import { normalizeTaager, TAAGER_MAPPING } from "../supabase/functions/_shared/brain/taager-normalize.ts";
import { MARKETS, minorToDecimal, minorToUsd, type Market } from "../supabase/functions/_shared/brain/markets.ts";
import { prefilter } from "../supabase/functions/_shared/brain/selection.ts";
import { decidePrice, expectedPerOrder, profitDelivered } from "../supabase/functions/_shared/brain/economics.ts";
import { plannedSuccessBps } from "../supabase/functions/_shared/brain/runner.ts";
import type { OfferRow } from "../supabase/functions/_shared/brain/woo-normalize.ts";

const [input, output, topArg] = process.argv.slice(2);
if (!input || !output) throw Error("usage: bun scripts/taager-preview.ts <sync.json> <out.html> [topN]");
const TOP = Number(topArg ?? 60);
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function thumb(url: string | undefined): Promise<string> {
  if (!url) return "";
  const small = url.replace(/^https:\/\/media\.taager\.com\/(?!\d+x\d+\/)/, "https://media.taager.com/360x360/");
  for (const u of [small, url]) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 400_000) continue;
      return `data:${r.headers.get("content-type") ?? "image/jpeg"};base64,${buf.toString("base64")}`;
    } catch { /* try next */ }
  }
  return "";
}

type Card = { o: OfferRow; score: number; kind: string; flags: string[]; price: ReturnType<typeof decidePrice>; rate: number };
const sections: string[] = [];
const summaries: string[] = [];
for (const block of parseTaagerFile(readFileSync(input, "utf8"))) {
  const mk = block.market as Market;
  const m = MARKETS[mk];
  const money = (minor: number | null | undefined) => (minor === null || minor === undefined ? "—" : `${Number(minorToDecimal(minor, m.minorDigits)).toLocaleString("en-US")} ${m.currency}`);
  const offers = block.rows.map((r) => normalizeTaager(mk, m, { market: mk, ...r, synced_at: "", price_changed_at: null }));
  const byKey = new Map(offers.map((o) => [`${o.product_id}:${o.variation_id}`, o]));
  const rows = prefilter(offers, TAAGER_MAPPING, m, 80);
  const count = (s: string) => rows.filter((r) => r.stage === s).length;
  const reasons: Record<string, number> = {};
  for (const r of rows) for (const x of r.reasons) if (!x.startsWith("spread")) reasons[x] = (reasons[x] ?? 0) + 1;
  const cards: Card[] = rows.filter((r) => r.stage === "shortlisted").sort((a, b) => b.prefilter_score - a.prefilter_score).slice(0, TOP).map((r) => {
    const o = byKey.get(`${r.product_id}:${r.variation_id}`)!;
    const rate = plannedSuccessBps(o, m.defaultDeliveryRateBps);
    const price = decidePrice({ inputs: r.economics as never, competitors: [], m, deliveryRateBps: rate });
    return { o, score: r.prefilter_score, kind: r.offer_kind, flags: r.flags, price, rate };
  });
  const thumbs = await Promise.all(cards.map((c) => thumb(c.o.images[0]?.src)));
  const zeroMin = offers.filter((o) => o.meta.taager_min_price !== null && o.meta.taager_min_price === o.meta.taager_cost).length;
  const withTiers = offers.filter((o) => (o.meta.taager_tiers as unknown[]).length > 1).length;
  const onSale = offers.filter((o) => o.meta.taager_sale).length;
  const withRate = offers.filter((o) => o.meta.taager_success_rate_bps).length;
  const withVideo = offers.filter((o) => o.videos.length).length;
  summaries.push(`<a href="#${mk}">${esc(m.countryName)} · ${offers.length}</a>`);
  const stat = (label: string, value: number | string) => `<div class="stat"><b>${esc(value)}</b><span>${esc(label)}</span></div>`;
  sections.push(`<section class="band" id="${mk}">
  <h2>${esc(m.countryName)}: ${count("shortlisted")} products worth researching out of ${offers.length}</h2>
  <p class="lead">Read ${esc(block.finished_at?.slice(0, 16).replace("T", " ") ?? "")} UTC · ${block.mode ?? "full"} read. Prices below are Taager-limit prices before any market research, so they are a floor, not the final store price.</p>
  <div class="stats">${stat("products", offers.length)}${stat("Taager bundles", offers.filter((o) => o.product_type === "bundle").length)}${stat("quantity offers", withTiers)}${stat("on sale now", onSale)}${stat("with delivery data", withRate)}${stat("with video", withVideo)}${stat("minimum profit 0", zeroMin)}${stat("blocked by rules", count("killed"))}</div>
  <details><summary>Why products were left out (${count("excluded") + count("killed")})</summary><ul class="reasons">${Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<li><span>${esc(k.replace("kill:", "blocked: ").replace(/_/g, " "))}</span><b>${v}</b></li>`).join("")}</ul></details>
  <h3>Top ${cards.length} by the brain's free first pass</h3>
  <div class="grid">${cards.map((c, i) => {
    const o = c.o; const p = c.price;
    const tiers = (o.meta.taager_tiers as { quantity: number; price_minor: number }[]).filter((t) => t.quantity > 1).map((t) => `${t.quantity} for ${money(t.price_minor)}`).join(" · ");
    const sale = o.meta.taager_sale as { price_minor: number; expires_at: string } | null;
    const priced = p.state === "priced";
    return `<article class="card">${thumbs[i] ? `<img src="${thumbs[i]}" alt="" loading="lazy">` : `<div class="noimg">no image</div>`}
    <div class="body"><h4 dir="rtl">${esc(o.title)}</h4>
    <p class="tags">${c.kind === "verified_bundle" ? '<em class="b">Taager bundle</em>' : ""}${o.videos.length ? "<em>video</em>" : ""}${c.flags.map((f) => `<em class="f">${esc(f.replace(/_/g, " "))}</em>`).join("")}</p>
    <dl><dt>Our cost</dt><dd>${money(o.meta.taager_cost === null ? null : Math.round(Number(o.meta.taager_cost) * 10 ** m.minorDigits))}</dd>
    <dt>Taager minimum</dt><dd>${money(o.price_minor)}</dd>
    ${o.regular_price_minor ? `<dt>Taager maximum</dt><dd>${money(o.regular_price_minor)}</dd>` : ""}
    <dt>Price now</dt><dd>${priced ? money(p.price_minor) : '<span class="warn">needs research</span>'}</dd>
    <dt>Profit if delivered</dt><dd>${priced ? `${money(p.profit_delivered_minor)} <small>≈$${minorToUsd(p.profit_delivered_minor!, m).toFixed(2)}</small>` : "—"}</dd>
    <dt>Per order placed</dt><dd>${priced ? money(expectedPerOrder(p.profit_delivered_minor!, c.rate, m)) : "—"} <small>at ${(c.rate / 100).toFixed(0)}% success${o.meta.taager_success_rate_bps ? " (Taager data)" : " (planning)"}</small></dd></dl>
    ${tiers ? `<p class="small">Quantity offers: ${esc(tiers)}</p>` : ""}${sale ? `<p class="small">Taager sale ${money(sale.price_minor)} until ${esc(String(sale.expires_at ?? "").slice(0, 10))}</p>` : ""}
    <p class="sku">${esc(o.sku)}</p></div></article>`;
  }).join("")}</div></section>`);
  void profitDelivered;
}

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Taager catalogue preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600&family=Inter+Tight:wght@600;700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
/* VOICE: owner's working board, calm and exact. IDEA: a merchant's stock ledger with product photos.
   PICTURE: the product grid itself. COLOUR and TYPE: transit card — deep green ground, white, lime-white, coral for warnings; Inter Tight / Inter / Plex Arabic.
   LAYOUT: finding first, country jump row, figures, then the product grid. */
:root{color-scheme:light dark;--bg:light-dark(#ffffff,#0f1513);--ink:light-dark(#10201c,#e8f0ec);--muted:light-dark(#53625d,#9fb0a9);--line:light-dark(#dfe7e3,#24302c);--card:light-dark(#f6f9f7,#16201d);--green:#00463c;--lime:#e6f5c8;--coral:#ff6f59}
:root[data-theme=light]{color-scheme:light}:root[data-theme=dark]{color-scheme:dark}
*{box-sizing:border-box;min-width:0}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 Inter,system-ui,sans-serif;overflow-x:clip}
.band{padding:clamp(24px,4vw,56px) max(5vw,16px);max-width:1340px;margin:0 auto}
header{background:var(--green);color:#fff}header .band{padding-bottom:28px}
h1{font:700 clamp(30px,4.4vw,48px)/1.05 "Inter Tight",Inter,sans-serif;margin:0 0 12px;text-wrap:balance}
h2{font:700 clamp(22px,3vw,32px)/1.1 "Inter Tight",Inter,sans-serif;margin:0 0 8px;text-wrap:balance}
h3{font:600 18px/1.3 Inter,sans-serif;margin:28px 0 12px}
header p{max-width:70ch;color:var(--lime);margin:0 0 16px}
.jump{display:flex;flex-wrap:wrap;gap:8px}.jump a{color:#fff;border:1px solid #ffffff55;border-radius:999px;padding:10px 16px;text-decoration:none;min-height:44px}
.lead{color:var(--muted);max-width:75ch;margin:0 0 16px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.stat{background:var(--bg);padding:12px 14px}.stat b{display:block;font:700 24px/1.1 "Inter Tight",sans-serif}.stat span{font-size:13px;color:var(--muted)}
details{margin-top:14px}summary{cursor:pointer;font-weight:600;min-height:44px;display:flex;align-items:center}
.reasons{columns:2 260px;padding:0;margin:0;list-style:none}.reasons li{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid var(--line);break-inside:avoid}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr));gap:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
.card img,.noimg{width:100%;aspect-ratio:1;object-fit:cover;background:#fff;display:grid;place-items:center;color:var(--muted)}
.body{padding:12px 14px 14px}h4{font:600 15px/1.45 "IBM Plex Sans Arabic",Inter,sans-serif;margin:0 0 6px;text-align:right}
.tags{margin:0 0 8px;display:flex;flex-wrap:wrap;gap:6px}.tags em{font-style:normal;font-size:12px;border:1px solid var(--line);border-radius:999px;padding:2px 8px}.tags .b{background:var(--lime);color:#10201c;border-color:transparent}.tags .f{color:var(--muted)}
dl{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;margin:0;font-size:14px}dt{color:var(--muted)}dd{margin:0;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}dd small{color:var(--muted)}
.warn{color:var(--coral);font-weight:600}.small{font-size:13px;color:var(--muted);margin:8px 0 0}.sku{font-size:12px;color:var(--muted);margin:8px 0 0}
footer{color:var(--muted);font-size:13px}
</style></head><body>
<header><div class="band"><h1>What the brain sees in Taager, before any AI is spent</h1>
<p>Real Taager data from your sync file, run through the brain's own rules: blocked categories, duplicates, stock, and Taager's cost, minimum and maximum prices. Market research and Arabic writing come next, on the shortlist only.</p>
<nav class="jump">${summaries.join("")}</nav></div></header>
${sections.join("")}
<footer class="band">Private: contains supplier costs. Generated by scripts/taager-preview.ts. "Needs research" means Taager's minimum profit is 0, so the brain only prices it after it sees what other shops charge.</footer>
</body></html>`;
writeFileSync(output, html);
console.log(`wrote ${output} (${(html.length / 1e6).toFixed(2)} MB)`);
