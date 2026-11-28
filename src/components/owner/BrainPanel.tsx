/* eslint-disable @typescript-eslint/no-explicit-any -- brain JSON payloads are rendered defensively */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BrainCircuit, CheckCircle2, ChevronDown, CircleAlert, ExternalLink, Loader2, Play, PauseCircle, PlugZap, RotateCw, Sparkles, XCircle } from "lucide-react";
import { offersClient } from "@/lib/store/offers-client";
import { brainClient, BRAIN_STAGES, money, usd, type BrainItem, type BrainOverview, type BrainRun } from "@/lib/store/brain-client";
import type { MarketCode } from "@/lib/store/markets";
import { StorePublication } from "./StorePublication";

type Props = { market: MarketCode; origin: string; publicKey: string; token: string };

export function BrainPanel({ market, origin, publicKey, token }: Props) {
  const client = useMemo(() => { try { return brainClient(origin, publicKey, token); } catch { return null; } }, [origin, publicKey, token]);
  const [overview, setOverview] = useState<BrainOverview | null>(null);
  const [items, setItems] = useState<BrainItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [driving, setDriving] = useState(false);
  const [tests, setTests] = useState<{ woo?: string; ai?: string }>({});
  const [buildCount, setBuildCount] = useState(100);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const run: BrainRun | null = overview?.runs[0] ?? null;
  const load = useCallback(async () => {
    if (!client) return;
    try {
      const o = await client.overview(market);
      if (!alive.current) return;
      setOverview(o);
      const latest = o.runs[0];
      if (latest && (latest.status === "awaiting_review" || latest.status === "done")) setItems(await client.items(market, latest.id, "selected"));
      else setItems([]);
    } catch (e) { setError(String((e as Error).message ?? e)); }
  }, [client, market]);
  useEffect(() => { setOverview(null); setItems([]); setError(""); setDriving(false); void load(); }, [load]);

  // Drive a running run forward in short server steps while this page is open.
  const drive = useCallback(async (runId: string) => {
    if (!client) return;
    setDriving(true); setError("");
    try {
      for (let i = 0; i < 400 && alive.current; i++) {
        const { run: r } = await client.step(market, runId);
        await load();
        if (r.status !== "running") break;
      }
    } catch (e) { setError(String((e as Error).message ?? e)); }
    finally { if (alive.current) { setDriving(false); void load(); } }
  }, [client, market, load]);

  async function act(fn: () => Promise<unknown>) { setBusy(true); setError(""); try { await fn(); await load(); } catch (e) { setError(String((e as Error).message ?? e)); } finally { setBusy(false); } }

  if (!client) return null;
  const cap = overview?.settings.daily_budget_microusd ?? 0, spent = overview?.spent_today_microusd ?? 0;
  const active = run && (run.status === "running" || run.status === "paused_budget");
  const stageIndex = run ? BRAIN_STAGES.findIndex(([s]) => s === run.stage) : -1;

  return <section id="brain" aria-label="Yawmiyati Brain" className="scroll-mt-32 space-y-4 rounded-3xl border bg-card p-5 shadow-soft sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="inline-flex items-center gap-2 text-lg font-extrabold"><BrainCircuit className="h-5 w-5 text-primary" aria-hidden="true" />Yawmiyati Brain</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Reads the whole Taager catalogue, researches the market, prices each product for profit, writes the Arabic pages and proposes the store. Nothing goes live without your approval.</p>
      </div>
      <div className="min-w-48 text-right text-xs">
        <p className="font-semibold">AI spend today {usd(spent)} / {usd(cap)}</p>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: Math.min(100, cap ? (spent / cap) * 100 : 0) + "%" }} /></div>
      </div>
    </div>

    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={() => act(async () => { const r = await client.testWoo(market); setTests((t) => ({ ...t, woo: r.ok ? `Connected · ${r.products_total ?? "?"} products · ${r.currency ?? "?"}${r.currency && r.currency !== r.expected_currency ? " (expected " + r.expected_currency + ")" : ""}` : "Not connected: " + r.error })); })}
        className="inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"><PlugZap className="h-4 w-4" aria-hidden="true" />Test WooCommerce</button>
      <button type="button" disabled={busy} onClick={() => act(async () => { const r = await client.testAi(market); setTests((t) => ({ ...t, ai: r.ok ? `AI ready · test cost ${usd(r.cost_microusd)}` : "AI not ready: " + r.error })); })}
        className="inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"><Sparkles className="h-4 w-4" aria-hidden="true" />Test AI</button>
      {!active && <span className="inline-flex items-center gap-2 rounded-full border bg-background py-1 pe-1 ps-4" data-build-store="">
        <label htmlFor="build-count" className="text-sm font-semibold">Build store →</label>
        <input id="build-count" type="number" min={1} max={200} step={1} value={buildCount} onChange={(e) => setBuildCount(Math.max(1, Math.min(200, Math.round(Number(e.target.value) || 1))))} className="h-9 w-20 rounded-lg border px-2 text-sm tabular-nums" aria-label="Number of products to build" />
        <span className="text-sm text-muted-foreground">products</span>
        <button type="button" disabled={busy || driving} onClick={() => act(async () => { const r = await client.buildStore(market, buildCount); void drive(r.run.id); })}
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-50"><Play className="h-4 w-4" aria-hidden="true" />Build store</button>
      </span>}
      {run?.status === "running" && !driving && <button type="button" onClick={() => void drive(run.id)} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"><RotateCw className="h-4 w-4" aria-hidden="true" />Continue run</button>}
      {run?.status === "paused_budget" && <button type="button" disabled={busy} onClick={() => act(async () => { await client.resume(market, run.id); void drive(run.id); })} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"><RotateCw className="h-4 w-4" aria-hidden="true" />Resume (budget allows)</button>}
      {active && <button type="button" disabled={busy} onClick={() => act(() => client.cancel(market, run!.id))} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-destructive/40 px-4 text-sm font-semibold text-destructive"><PauseCircle className="h-4 w-4" aria-hidden="true" />Stop run</button>}
      <label className="ml-auto inline-flex items-center gap-2 text-xs text-muted-foreground" title="Daily automatic updates arrive after the first approved run">
        <input type="checkbox" disabled checked={!!overview?.settings.autopilot_enabled} className="h-4 w-4" />Autopilot (switch it in the morning brief)
      </label>
    </div>
    {(tests.woo || tests.ai) && <ul className="space-y-1 text-sm">{[tests.woo, tests.ai].filter(Boolean).map((t) => <li key={t} className="flex items-center gap-2">{/^(Connected|AI ready)/.test(t!) ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <CircleAlert className="h-4 w-4 text-amber-600" aria-hidden="true" />}{t}</li>)}</ul>}
    {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}

    {run && <div className="rounded-2xl border bg-background p-4">
      <ol className="grid grid-cols-4 gap-2 text-[11px] font-semibold sm:grid-cols-8" aria-label="Run stages">
        {BRAIN_STAGES.map(([s, label], i) => <li key={s} className={"rounded-lg px-2 py-1.5 text-center " + (i < stageIndex || run.status === "done" ? "bg-emerald-50 text-emerald-800" : i === stageIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{label}</li>)}
      </ol>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {driving && <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />}
        <b className="capitalize">{run.status.replace("_", " ")}</b>
        {run.progress.ingested !== undefined && <span>· {String(run.progress.ingested)} offers read{run.progress.woo_total_products ? ` of ${run.progress.woo_total_products} products` : ""}</span>}
        {run.progress.researched !== undefined && <span>· {String(run.progress.researched)} researched</span>}
        {run.progress.content_written !== undefined && <span>· {String(run.progress.content_written)}{run.progress.target ? ` of ${String(run.progress.target)}` : ""} pages written</span>}
        {Number(run.progress.research_from_cache ?? 0) + Number(run.progress.content_reused ?? 0) > 0 && <span>· {Number(run.progress.research_from_cache ?? 0) + Number(run.progress.content_reused ?? 0)} reused at no cost</span>}
        {run.progress.cost_microusd !== undefined && <span className="font-semibold" data-run-cost="">· this build so far {usd(Number(run.progress.cost_microusd))}</span>}
      </p>
      {run.progress.target !== undefined && <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Build progress" aria-valuemin={0} aria-valuemax={Number(run.progress.target)} aria-valuenow={Number(run.progress.content_written ?? 0)}>
        <span className="block h-full rounded-full bg-primary" style={{ width: Math.min(100, (Number(run.progress.content_written ?? 0) / Math.max(1, Number(run.progress.target))) * 100) + "%" }} /></div>}
      {run.status === "paused_budget" && <p className="mt-2 text-sm text-amber-800">Paused: today's AI budget is used up. It can resume tomorrow, or after you raise the daily cap.</p>}
      {run.status === "running" && !driving && <p className="mt-2 text-sm text-muted-foreground">The run moves forward while this page is open. Press Continue run.</p>}
      {run.error && <p className="mt-2 text-sm text-destructive">Error: {run.error}</p>}
    </div>}

    {overview?.capability && <CapabilityReport report={overview.capability} market={market} />}
    {run?.summary?.decision && <DecisionSummary run={run} market={market} />}
    {run?.summary?.cost && <CostSummary cost={run.summary.cost} />}
    {items.length > 0 && run && <SelectedList items={items} market={market} busy={busy} fromTaager={(run.summary as { source?: string }).source === "taager_api"}
      decide={(decision, list) => act(() => client.decide(market, run.id, decision, list))} />}
    <StorePublication client={client} market={market} runId={run?.id ?? null} approved={items.filter((i) => i.owner_decision === "approved").length}
      afterPublish={async () => {
        // One queue: as soon as products are on the store, the brain works out quantity offers, sets, delivery-included
        // and the free-delivery rule and files them as proposals. Nothing shows to shoppers until each is approved.
        const p = await offersClient(origin, publicKey, token).propose(market);
        window.dispatchEvent(new CustomEvent("yawmiyati:offers-updated", { detail: { market } }));
        const n = p.quantity.length + p.bundles.length + p.sales.length + p.delivery_included.length + (p.free_delivery ? 1 : 0);
        return n ? `${n} offers worked out for these products (${p.quantity.length} quantity, ${p.bundles.length} sets, ${p.delivery_included.length} delivery included${p.free_delivery ? ", a free-delivery rule" : ""}).` : "No safe offer could be built from these products yet.";
      }} />
  </section>;
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return <div className="rounded-xl bg-background p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-bold">{value}</p></div>;
}

function CapabilityReport({ report, market }: { report: any; market: MarketCode }) {
  const t = report.totals ?? {}, media = report.media ?? {}, mapping = report.field_mapping ?? {};
  return <details className="rounded-2xl border bg-background p-4" open>
    <summary className="flex cursor-pointer list-none items-center justify-between font-extrabold">What Taager gives us <ChevronDown className="h-4 w-4" aria-hidden="true" /></summary>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Stat label="Products" value={t.products} /><Stat label="Variations" value={t.variations} />
      <Stat label="With video" value={media.offers_with_video} /><Stat label="Most images on one product" value={media.max_images} />
      <Stat label="Duplicate SKUs" value={report.sku?.duplicate_skus} /><Stat label="Possible duplicate families" value={report.duplicates?.potential_family_groups} />
      <Stat label="On sale in Woo" value={report.prices?.on_sale} /><Stat label="Empty descriptions" value={(report.content?.empty_description_pct ?? 0) + "%"} />
    </div>
    <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
      <div><p className="font-bold">Images per product</p><p className="text-muted-foreground">{Object.entries(media.images_per_offer ?? {}).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
        <p className="mt-2 font-bold">Offer types</p><p className="text-muted-foreground">{Object.entries(report.offer_kinds ?? {}).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(" · ")}</p>
        <p className="mt-2 font-bold">Bundle-like categories</p><p className="text-muted-foreground">{(report.bundles_and_packs?.bundle_like_categories ?? []).join(", ") || "none found"}</p></div>
      <div><p className="font-bold">Where cost and minimum price come from</p>
        <ul className="text-muted-foreground">
          <li>Taager cost: {mapping.cost_key ? <code>{mapping.cost_key}</code> : <b className="text-amber-800">not found</b>}</li>
          <li>Minimum selling price: {mapping.floor_key ? <code>{mapping.floor_key}</code> : mapping.floor_source ? mapping.floor_source : <b className="text-amber-800">not found</b>}</li>
          <li>Suggested price: {mapping.suggested_key ? <code>{mapping.suggested_key}</code> : "—"} · Pieces: {mapping.quantity_key ? <code>{mapping.quantity_key}</code> : "—"} · Bundle parts: {mapping.components_key ? <code>{mapping.components_key}</code> : "—"}</li>
          <li>Mapped by: {mapping.confidence ?? "—"}</li>
          {(mapping.notes ?? []).map((n: string) => <li key={n} className="text-xs">{n}</li>)}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Prices in Woo: median {money(report.prices?.median_minor, market)} (min {money(report.prices?.min_minor, market)}, max {money(report.prices?.max_minor, market)})</p></div>
    </div>
    <details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold text-primary">All data fields Taager sends ({(report.meta_keys ?? []).length})</summary>
      <div className="mt-2 max-h-72 overflow-auto"><table className="w-full text-left"><thead><tr><th className="py-1">Field</th><th>Products</th><th>Numeric</th><th>Examples</th></tr></thead>
        <tbody>{(report.meta_keys ?? []).map((k: any) => <tr key={k.key} className="border-t align-top"><td className="py-1 pr-2"><code>{k.key}</code></td><td>{k.count}</td><td>{Math.round(k.numeric_share * 100)}%</td><td className="break-all text-muted-foreground">{(k.samples ?? []).join(" | ")}</td></tr>)}</tbody></table></div>
    </details>
  </details>;
}

function DecisionSummary({ run, market }: { run: BrainRun; market: MarketCode }) {
  const d = run.summary.decision, p = run.summary.prefilter ?? {}, m = run.summary.merchandising;
  return <div className="rounded-2xl border bg-background p-4 text-sm">
    <p className="font-extrabold">The brain's proposal</p>
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Stat label="Products evaluated" value={p.evaluated} /><Stat label="Shortlisted for research" value={p.shortlisted} />
      <Stat label="Selected" value={d.selected} /><Stat label="Need your look" value={d.needs_owner_review} />
      <Stat label="Avg expected profit / order" value={d.avg_expected_profit_usd !== null && d.avg_expected_profit_usd !== undefined ? "$" + Number(d.avg_expected_profit_usd).toFixed(2) : "—"} />
      <Stat label="Killed (banned items)" value={p.killed} />
      <Stat label="Cheaper / matched / dearer" value={`${d.positioning?.cheaper ?? 0} / ${d.positioning?.matched ?? 0} / ${d.positioning?.dearer ?? 0}`} />
      <Stat label="Free delivery from" value={d.free_delivery ? d.free_delivery.threshold : "not enough data"} />
    </div>
    {d.free_delivery && <p className="mt-2 text-xs text-muted-foreground">{d.free_delivery.reasoning}</p>}
    {m && <p className="mt-2 text-xs"><b>Homepage hero:</b> {m.hero ?? "—"} · <b>Featured:</b> {(m.featured ?? []).join(" · ")} · <b>Category order:</b> {(m.category_order ?? []).join(" → ")}</p>}
    {(p.top_exclusion_reasons ?? []).length > 0 && <p className="mt-2 text-xs text-muted-foreground">Main reasons products were left out: {p.top_exclusion_reasons.map(([r, n]: [string, number]) => `${r.replace(/_/g, " ")} (${n})`).join(", ")}</p>}
    <p className="mt-1 text-xs text-muted-foreground">Prices are product prices; the customer also pays the {market.toUpperCase()} delivery fee at checkout.</p>
  </div>;
}

function CostSummary({ cost }: { cost: any }) {
  const p = cost.projection ?? {};
  return <div className="rounded-2xl border bg-background p-4 text-sm">
    <p className="font-extrabold">What this run cost (real API usage)</p>
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Stat label="Total" value={"$" + Number(cost.total_usd ?? 0).toFixed(3)} /><Stat label="Research (incl. web search)" value={"$" + Number(cost.research_usd ?? 0).toFixed(3)} />
      <Stat label="Arabic pages" value={"$" + Number(cost.content_usd ?? 0).toFixed(3)} /><Stat label="Web searches" value={cost.web_searches} />
      <Stat label="Per researched product" value={"$" + cost.per_researched_product_usd} /><Stat label="Per written page" value={"$" + cost.per_content_product_usd} />
      <Stat label="One store, full cycle" value={"$" + p.one_store_cycle_usd} /><Stat label="All five stores" value={"$" + p.five_stores_cycle_usd} />
    </div>
    <p className="mt-2 text-xs text-muted-foreground">Researching every product in this store would cost about ${p.research_entire_catalog_this_store_usd}. Daily autopilot (5 new products per store, all five stores) about ${p.daily_autopilot_5_new_products_per_store_usd}/day. {p.note}</p>
  </div>;
}

/** Pick list for the Taager add button: approved products (Taager product ids), for one country. */
export function pickList(items: BrainItem[], market: MarketCode) {
  const ids = [...new Set(items.filter((i) => i.owner_decision === "approved").map((i) => i.product_id))];
  return ids.length ? `ym:${market}:${ids.join(",")}` : "";
}

function SelectedList({ items, market, busy, decide, fromTaager }: { items: BrainItem[]; market: MarketCode; busy: boolean; decide: (d: "approved" | "rejected", list: { product_id: number; variation_id: number }[] | null) => void; fromTaager: boolean }) {
  const pending = items.filter((i) => !i.owner_decision).length;
  const picks = fromTaager ? pickList(items, market) : "";
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(picks); setCopied(true); } catch { window.prompt("Copy this pick list:", picks); }
  }
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="font-extrabold">Selected products ({items.length}) · {pending} waiting for you</p>
      <div className="flex gap-2">
        <button type="button" disabled={busy || !pending} onClick={() => decide("approved", null)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Approve all</button>
        <button type="button" disabled={busy || !pending} onClick={() => decide("rejected", null)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold disabled:opacity-50"><XCircle className="h-4 w-4" aria-hidden="true" />Reject all</button>
      </div>
    </div>
    <p className="text-xs text-muted-foreground">Approving records your decision for these products. Publishing to the storefront is a separate, later step.</p>
    {fromTaager && <div className="flex flex-wrap items-center gap-2 text-xs">
      <button type="button" disabled={!picks} onClick={() => void copy()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 font-bold disabled:opacity-50">{copied ? "Copied" : `Copy pick list for the Taager add button (${picks ? picks.split(":")[2].split(",").length : 0})`}</button>
      <span className="text-muted-foreground">On Taager (this country, all products page) run <b>Taager add all</b> and paste it. Only approved products are included.</span>
    </div>}
    <ul className="space-y-3">{items.map((it) => <ProductCard key={it.product_id + ":" + it.variation_id} it={it} market={market} busy={busy} decide={decide} />)}</ul>
  </div>;
}

function ProductCard({ it, market, busy, decide }: { it: BrainItem; market: MarketCode; busy: boolean; decide: (d: "approved" | "rejected", list: { product_id: number; variation_id: number }[] | null) => void }) {
  const d = it.decision ?? {}, c = it.content ?? {}, r = it.research ?? {}, e = it.economics ?? {};
  const listings: any[] = r.listings ?? [];
  return <li className="rounded-2xl border bg-background p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <p dir="auto" className="font-bold leading-7">{c.title || it.title}</p>
        {c.title && <p dir="auto" className="text-xs text-muted-foreground">Taager: {it.title}</p>}
        <p className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
          <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">{it.category ?? "uncategorised"}</span>
          <span className="rounded-full bg-muted px-2 py-0.5">{it.offer_kind.replace(/_/g, " ")}</span>
          {d.needs_owner_review && <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-semibold text-amber-900">needs your look</span>}
          {d.band_exception && <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-semibold text-amber-900">outside the 15–50% band</span>}
          {d.delivery_included && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">delivery included in price</span>}
          {d.price_blocks_sales && <span className="rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 font-semibold text-rose-800">price blocks sales</span>}
          {it.flags.map((f) => <span key={f} className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-amber-900">{f.replace(/_/g, " ")}</span>)}
          {it.owner_decision && <span className={"rounded-full px-2 py-0.5 font-bold " + (it.owner_decision === "approved" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800")}>{it.owner_decision}</span>}
        </p>
      </div>
      <div className="text-right text-sm">
        <p className="text-lg font-extrabold">{money(d.price_minor, market)}</p>
        <p className="text-xs text-muted-foreground">customer pays {money(d.customer_total_minor, market)} {d.delivery_included ? "delivered (we pay the fee)" : "with delivery"}</p>
      </div>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
      <Stat label="Taager cost / minimum" value={`${money(e.cost_minor, market)} / ${money(e.floor_minor, market)}`} />
      <Stat label="Profit per delivered order · margin" value={`${money(d.profit_delivered_minor, market)}${d.margin_on_price_pct !== undefined ? ` · ${d.margin_on_price_pct}%` : ""}`} />
      <Stat label="Expected per order" value={d.expected_profit_usd !== undefined ? "$" + Number(d.expected_profit_usd).toFixed(2) : "—"} />
      <Stat label="Other shops: cheapest / typical" value={d.competitor_reference_minor ? `${money(d.competitor_cheapest_minor ?? d.competitor_reference_minor, market)} / ${money(d.competitor_reference_minor, market)} (${d.competitor_basis}, ${d.competitor_count})` : "none found"} />
      <Stat label="Score · AI cost" value={`${Number(it.score ?? 0).toFixed(2)} · ${usd(it.cost_microusd)}`} />
    </div>
    {d.band_exception?.reason && <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">Why this is outside the band: {d.band_exception.reason}</p>}
    {d.below_band_option && <p className="mt-2 text-xs text-muted-foreground">Cheaper option: {money(d.below_band_option.price_minor, market)} ({d.below_band_option.margin_on_price_pct}% margin). {d.below_band_option.reason}</p>}
    {(d.notes ?? []).length > 0 && <p className="mt-2 text-xs text-amber-800">{d.notes.join(" ")}</p>}
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-xs font-semibold text-primary">Research, page draft and cross-sell</summary>
      {r.summary && <p className="mt-2 text-xs text-muted-foreground">{r.summary}</p>}
      {listings.length > 0 && <ul className="mt-2 space-y-1 text-xs">{listings.map((l, i) => <li key={i}><a href={l.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-primary underline">{l.retailer}<ExternalLink className="h-3 w-3" aria-hidden="true" /></a> · {money(l.price_minor, market)} · {l.match}{l.cited ? "" : " · unverified"}</li>)}</ul>}
      {(r.demand_signals ?? []).length > 0 && <p className="mt-1 text-xs">Demand: {r.demand_signals.map((s: any) => s.signal).join(" · ")}</p>}
      {r.error && <p className="mt-1 text-xs text-destructive">Research error: {r.error}</p>}
      {c.description && <div dir="rtl" className="mt-3 rounded-xl border bg-card p-3 text-right">
        {c.subtitle && <p className="text-sm font-semibold">{c.subtitle}</p>}
        <p className="mt-1 whitespace-pre-line text-sm leading-7">{c.description}</p>
        {(c.bullets ?? []).length > 0 && <ul className="mt-2 list-disc pr-5 text-sm">{c.bullets.map((b: string) => <li key={b}>{b}</li>)}</ul>}
        <p className="mt-2 text-xs text-muted-foreground" dir="auto">SEO: {c.seo?.title} — {c.seo?.meta_description} · /{c.seo?.slug}</p>
        <p className="text-xs text-muted-foreground" dir="auto">Keywords: {(c.seo?.keywords ?? []).join("، ")}</p>
        {(c.issues ?? []).length > 0 && <p className="mt-1 text-xs text-amber-800" dir="ltr">Checks: {c.issues.join(", ")}</p>}
      </div>}
      {(it.merchandising?.cross_sell ?? []).length > 0 && <p className="mt-2 text-xs">Pairs well with: {it.merchandising!.cross_sell.map((x: any) => x.title).join(" · ")}</p>}
    </details>
    {!it.owner_decision && <div className="mt-3 flex gap-2">
      <button type="button" disabled={busy} onClick={() => decide("approved", [{ product_id: it.product_id, variation_id: it.variation_id }])} className="min-h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-50">Approve</button>
      <button type="button" disabled={busy} onClick={() => decide("rejected", [{ product_id: it.product_id, variation_id: it.variation_id }])} className="min-h-10 rounded-xl border px-4 text-xs font-bold disabled:opacity-50">Reject</button>
    </div>}
  </li>;
}
