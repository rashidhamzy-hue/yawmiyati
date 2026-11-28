import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgePercent, Check, Clock, Layers, PackageCheck, RotateCcw, Truck, X } from "lucide-react";
import { markets, type MarketCode } from "@/lib/store/markets";
import { OFFER_PROBLEMS, offersClient, type FreeDeliveryReport, type OwnerOffer } from "@/lib/store/offers-client";

const usd = (v: number | null | undefined) => (v === null || v === undefined ? "—" : (v < 0 ? "−$" : "$") + Math.abs(v).toFixed(2));
const local = (minor: number | null | undefined, market: MarketCode) => (minor === null || minor === undefined ? "—" : (minor / 10 ** markets[market].minorDigits).toLocaleString("en-US") + " " + markets[market].currency);
const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null);
const STATUS: Record<OwnerOffer["status"], string> = { proposed: "Waiting for you", approved: "Approved", rejected: "Rejected" };

/**
 * Owner approval for every bundle, discount and offer before shoppers can see it.
 * Profit is per delivered order in US dollars at Taager's current cost (lowest case). The database refuses to
 * approve, and stops showing, anything that would lose money.
 */
export function OffersPanel({ market, origin, publicKey, token, request }: { market: MarketCode; origin: string; publicKey: string; token: string; request?: typeof fetch }) {
  const client = useMemo(() => offersClient(origin, publicKey, token, request), [origin, publicKey, token, request]);
  const [offers, setOffers] = useState<OwnerOffer[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [report, setReport] = useState<FreeDeliveryReport | null>(null);
  const [saleNotes, setSaleNotes] = useState<{ title: string; reason: string; banked_profit_usd: number; normal_profit_usd: number }[]>([]);
  const load = useCallback(async () => { try { setOffers(await client.list(market)); setReport(await client.freeDeliveryReport(market).catch(() => null)); } catch (e) { setOffers([]); setError(String((e as Error).message ?? e)); } }, [client, market]);
  useEffect(() => { setNote(""); setError(""); setOffers(null); setSaleNotes([]); void load(); }, [load]);
  // The brain panel files proposals right after "Publish approved": show them here without a reload.
  useEffect(() => { const on = () => void load(); window.addEventListener("yawmiyati:offers-updated", on); return () => window.removeEventListener("yawmiyati:offers-updated", on); }, [load]);
  const proven = (offers ?? []).some((o) => o.taager_discounts_proven === true);
  async function act(fn: () => Promise<unknown>) { setBusy(true); setError(""); try { await fn(); await load(); } catch (e) { setError(String((e as Error).message ?? e)); } finally { setBusy(false); } }
  const propose = () => act(async () => {
    const p = await client.propose(market);
    setSaleNotes(p.sale_notes);
    setNote(`Worked out ${p.quantity.length} quantity discounts, ${p.bundles.length} sets, ${p.sales.length} time-limited offers, ${p.delivery_included.length} delivery-included products` + (p.free_delivery ? ` and free delivery from a basket of eligible products (${p.free_delivery.excluded.length} thin products left out).` : `. Free delivery: not offered. ${p.free_delivery_reason ?? ""}`));
  });
  const approveAllSafe = () => act(async () => { for (const o of offers ?? []) if (o.status === "proposed" && !o.problem) await client.decide(market, o.id, "approved"); });
  const groups: { kind: OwnerOffer["kind"]; title: string; hint: string; Icon: typeof Layers }[] = [
    { kind: "free_delivery", title: "Free delivery from a basket value", hint: "We pay the delivery fee when the eligible products in the basket reach this value. A product is eligible only while its own margin is high enough, so no eligible basket can lose money; thin products are left out automatically. Profit shown is for the least profitable eligible basket at the threshold.", Icon: Truck },
    { kind: "delivery_included", title: "Delivery included in the price", hint: "Single products whose price can carry the delivery fee: the shopper pays the product price only. Profit shown is after we pay the fee.", Icon: PackageCheck },
    { kind: "sale", title: "Time-limited offers (Taager sale)", hint: "Taager lowered its cost for a while. The offer ends 3 days before Taager's sale ends (the confirmation call can take 3 days). A crossed-out price is shown to shoppers only if the product was on the store at that price before.", Icon: Clock },
    { kind: "bundle", title: "Our own sets", hint: "Two to four published single products sold together for less (themed routines and pairs). \"Two parcels\" is the profit if Taager ships two parcels and we pay the second fee.", Icon: Layers },
    { kind: "quantity", title: "Quantity discounts", hint: "\"2 for X\", \"3 for X\" on one product.", Icon: BadgePercent },
  ];
  const waiting = (offers ?? []).filter((o) => o.status === "proposed" && !o.problem).length;
  return <section id="offers" className="scroll-mt-32 space-y-4 rounded-3xl border bg-card p-5 shadow-soft" aria-label="Offers approval">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-extrabold">Bundles, discounts and offers</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Nothing here is shown to shoppers until you approve it. Each offer shows two profit figures per delivered order, in US dollars: what it earns if Taager applies its own quantity, add-on or sale price to our orders, and what it earns if it does not (full cost of every piece). Until the first test orders (G1) prove it, the second figure decides. Taager's own bundles are products: you approve those in the product list above.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={propose} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">Work out offers</button>
        <button type="button" disabled={busy || !waiting} onClick={approveAllSafe} className="min-h-11 rounded-xl border px-4 text-sm font-bold disabled:opacity-50">Approve all safe ({waiting})</button>
      </div>
    </div>
    <label className={"flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 text-sm " + (proven ? "border-emerald-300 bg-emerald-50" : "bg-muted/40")}>
      <input type="checkbox" className="h-5 w-5" checked={proven} disabled={busy || offers === null} aria-label="Taager discounts proven"
        onChange={(e) => { const on = e.target.checked; if (!on || window.confirm(`Switch on only after test orders in the ${market.toUpperCase()} store showed Taager charging its quantity and add-on prices on our WooCommerce orders. Continue?`)) void act(() => client.setDiscountsProven(market, on)); }} />
      <span><strong>Taager discounts proven</strong> in this market. {proven ? "On: offers are checked against Taager's own quantity, add-on and sale prices." : "Off: every offer must be profitable at the full cost of every piece (safe default until G1)."}</span>
    </label>
    {note && <p className="rounded-xl bg-muted px-3 py-2 text-sm">{note}</p>}
    {saleNotes.length > 0 && <div className="rounded-xl border px-3 py-2 text-sm"><p className="font-bold">Taager sales where the brain keeps our price and banks the margin</p>
      <ul className="mt-1 space-y-1 text-xs text-muted-foreground">{saleNotes.slice(0, 12).map((n, i) => <li key={i} dir="auto"><span className="font-semibold text-foreground">{n.title}</span>: {usd(n.banked_profit_usd)} per delivered order while the sale lasts if Taager applies it (normally {usd(n.normal_profit_usd)}). {n.reason}</li>)}</ul></div>}
    {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
    {offers === null ? <p className="text-sm text-muted-foreground">Loading…</p> : offers.length === 0 ? <p className="rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground">No offers yet. Publish products first, then press "Work out offers".</p>
      : groups.map(({ kind, title, hint, Icon }) => {
        const rows = offers.filter((o) => o.kind === kind);
        if (!rows.length) return null;
        return <div key={kind} className="space-y-2">
          <h3 className="inline-flex items-center gap-2 font-extrabold"><Icon className="h-4 w-4" aria-hidden="true" />{title} <span className="text-xs font-normal text-muted-foreground">({rows.length})</span></h3>
          <p className="text-xs text-muted-foreground">{hint}</p>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted text-start text-xs text-muted-foreground"><tr>
                <th className="px-3 py-2 text-start font-semibold">Offer</th><th className="px-3 py-2 text-start font-semibold">{kind === "free_delivery" ? "Basket from" : "Price"}</th>
                <th className="px-3 py-2 text-start font-semibold">Profit / delivered order</th><th className="px-3 py-2 text-start font-semibold">Status</th><th className="px-3 py-2 text-start font-semibold">Decision</th>
              </tr></thead>
              <tbody>{rows.map((o) => <tr key={o.id} className="border-t align-top" data-offer-row={o.kind}>
                <td className="px-3 py-2"><p className="font-semibold" dir="auto">{kind === "free_delivery" ? "Free delivery" : kind === "quantity" ? `${o.quantity} × ${o.title ?? ""}` : o.title}</p>
                  {o.meta?.tagline && <p className="text-xs text-muted-foreground" dir="auto">{o.meta.tagline}</p>}
                  {kind === "bundle" && Array.isArray(o.items) && <p className="text-xs text-muted-foreground">{o.items.length} products</p>}
                  {(o.starts_at || o.ends_at) && <p className="text-xs text-muted-foreground">{o.starts_at ? `from ${day(o.starts_at)} ` : ""}{o.ends_at ? `until ${day(o.ends_at)}` : ""}</p>}
                  {kind === "sale" && <p className="text-xs text-muted-foreground">{o.was_price_minor ? `Shoppers see ${local(o.was_price_minor, market)} crossed out` : "Shown as \"offer until …\" with no crossed-out price (not charged before)"}</p>}
                  {kind === "free_delivery" && o.meta?.min_margin_bps && <p className="text-xs text-muted-foreground">Counts products with a margin of at least {(o.meta.min_margin_bps / 100).toFixed(0)}%{report ? `: ${report.eligible} eligible, ${report.excluded.length} left out` : ""}</p>}
                  {o.separate_minor !== null && kind !== "free_delivery" && <p className="text-xs text-muted-foreground">Bought one by one: {local(o.separate_minor, market)}</p>}
                  {kind === "free_delivery" && o.detail && <p className="text-xs text-muted-foreground" dir="auto">Thinnest eligible product: {o.detail}</p>}
                  {kind === "free_delivery" && report && report.excluded.length > 0 && <details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer">Left out ({report.excluded.length})</summary>
                    <ul className="mt-1 space-y-0.5">{report.excluded.slice(0, 40).map((x) => <li key={x.listing_id} dir="auto">{x.title} · margin {(x.margin_bps / 100).toFixed(0)}%</li>)}</ul></details>}</td>
                <td className="px-3 py-2 font-semibold tabular-nums">{usd(o.price_usd)}<span className="block text-xs font-normal text-muted-foreground">{local(o.price_minor, market)}</span></td>
                <td className="px-3 py-2 tabular-nums"><span className={"font-extrabold " + ((o.profit_usd ?? 0) > 0 ? "text-emerald-700" : "text-red-700")}>{usd(o.profit_usd)}</span>
                  {(kind === "quantity" || kind === "bundle" || kind === "sale") && o.profit_full_usd != null && <span className="block text-xs text-muted-foreground" data-two-figures>
                    earns <strong className="text-foreground">{usd(o.profit_taager_usd)}</strong> if Taager applies its {kind === "quantity" ? "quantity" : kind === "bundle" ? "add-on" : "sale"} price, <strong className="text-foreground">{usd(o.profit_full_usd)}</strong> if not</span>}
                  {kind === "bundle" && <span className="block text-xs text-muted-foreground">two parcels: {usd(o.profit_if_split_usd)}</span>}</td>
                <td className="px-3 py-2"><span className={"rounded-full px-2.5 py-1 text-xs font-bold " + (o.status === "approved" && !o.problem ? "bg-emerald-50 text-emerald-800" : o.status === "rejected" ? "bg-muted text-muted-foreground" : "bg-amber-50 text-amber-900")}>{o.problem && o.status === "approved" ? "Approved, hidden" : STATUS[o.status]}</span>
                  {o.problem && <p className="mt-1 max-w-[16rem] text-xs text-red-700">{OFFER_PROBLEMS[o.problem] ?? o.problem}</p>}
                  {o.shown && <p className="mt-1 text-xs text-emerald-700">On the store now</p>}</td>
                <td className="px-3 py-2"><div className="flex gap-1.5">
                  {o.status !== "approved" && <button type="button" disabled={busy || !!o.problem} onClick={() => act(() => client.decide(market, o.id, "approved"))} aria-label="Approve" className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-40"><Check className="h-3.5 w-3.5" aria-hidden="true" />Approve</button>}
                  {o.status !== "rejected" && <button type="button" disabled={busy} onClick={() => act(() => client.decide(market, o.id, "rejected"))} aria-label="Reject" className="inline-flex min-h-10 items-center gap-1 rounded-lg border px-3 text-xs font-bold disabled:opacity-40"><X className="h-3.5 w-3.5" aria-hidden="true" />{o.status === "approved" ? "Take off" : "Reject"}</button>}
                  {o.status !== "proposed" && <button type="button" disabled={busy} onClick={() => act(() => client.decide(market, o.id, "proposed"))} aria-label="Undo decision" className="inline-flex min-h-10 items-center rounded-lg border px-2.5 text-xs disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /></button>}
                </div></td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>;
      })}
  </section>;
}
