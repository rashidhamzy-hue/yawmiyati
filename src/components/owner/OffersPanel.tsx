import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgePercent, Check, Layers, RotateCcw, Truck, X } from "lucide-react";
import { markets, type MarketCode } from "@/lib/store/markets";
import { OFFER_PROBLEMS, offersClient, type OwnerOffer } from "@/lib/store/offers-client";

const usd = (v: number | null | undefined) => (v === null || v === undefined ? "—" : (v < 0 ? "−$" : "$") + Math.abs(v).toFixed(2));
const local = (minor: number | null | undefined, market: MarketCode) => (minor === null || minor === undefined ? "—" : (minor / 10 ** markets[market].minorDigits).toLocaleString("en-US") + " " + markets[market].currency);
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
  const load = useCallback(async () => { try { setOffers(await client.list(market)); } catch (e) { setOffers([]); setError(String((e as Error).message ?? e)); } }, [client, market]);
  useEffect(() => { setNote(""); setError(""); setOffers(null); void load(); }, [load]);
  async function act(fn: () => Promise<unknown>) { setBusy(true); setError(""); try { await fn(); await load(); } catch (e) { setError(String((e as Error).message ?? e)); } finally { setBusy(false); } }
  const propose = () => act(async () => {
    const p = await client.propose(market);
    setNote(`Worked out ${p.quantity.length} quantity discounts, ${p.bundles.length} sets` + (p.free_delivery ? " and a free-delivery threshold." : `. Free delivery: not offered. ${p.free_delivery_reason ?? ""}`));
  });
  const approveAllSafe = () => act(async () => { for (const o of offers ?? []) if (o.status === "proposed" && !o.problem) await client.decide(market, o.id, "approved"); });
  const groups: { kind: OwnerOffer["kind"]; title: string; hint: string; Icon: typeof Layers }[] = [
    { kind: "free_delivery", title: "Free delivery", hint: "We pay the delivery fee above this basket value. Profit shown is for the least profitable basket at the threshold.", Icon: Truck },
    { kind: "bundle", title: "Our own sets", hint: "Two published single products sold together for less. Second figure: profit if Taager ships two parcels and we pay the second fee (unproven until the first test order).", Icon: Layers },
    { kind: "quantity", title: "Quantity discounts", hint: "\"2 for X\" and \"3 for X\" on one product, counting Taager's full cost for every piece.", Icon: BadgePercent },
  ];
  const waiting = (offers ?? []).filter((o) => o.status === "proposed" && !o.problem).length;
  return <section className="space-y-4 rounded-3xl border bg-card p-5 shadow-soft" aria-label="Offers approval">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-extrabold">Bundles, discounts and offers</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Nothing here is shown to shoppers until you approve it. Profit is per delivered order, in US dollars, at Taager's current cost with the most cautious VAT reading. Taager's own bundles are products: you approve those in the product list above.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={propose} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">Work out offers</button>
        <button type="button" disabled={busy || !waiting} onClick={approveAllSafe} className="min-h-11 rounded-xl border px-4 text-sm font-bold disabled:opacity-50">Approve all safe ({waiting})</button>
      </div>
    </div>
    {note && <p className="rounded-xl bg-muted px-3 py-2 text-sm">{note}</p>}
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
                  {o.separate_minor !== null && kind !== "free_delivery" && <p className="text-xs text-muted-foreground">Bought one by one: {local(o.separate_minor, market)}</p>}
                  {kind === "free_delivery" && o.detail && <p className="text-xs text-muted-foreground" dir="auto">Thinnest margin: {o.detail}</p>}</td>
                <td className="px-3 py-2 font-semibold tabular-nums">{usd(o.price_usd)}<span className="block text-xs font-normal text-muted-foreground">{local(o.price_minor, market)}</span></td>
                <td className="px-3 py-2 tabular-nums"><span className={"font-extrabold " + ((o.profit_usd ?? 0) > 0 ? "text-emerald-700" : "text-red-700")}>{usd(o.profit_usd)}</span>
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
