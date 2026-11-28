import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { MarketCode } from "@/lib/store/markets";
import { brainClient, type OrderQuality } from "@/lib/store/brain-client";

const REASON: Record<string, string> = { invalid_name: "the name does not look real", duplicate_order: "same basket from the same number within a day",
  too_many_orders_phone: "more than 3 orders from this number in an hour", too_many_orders_browser: "more than 4 orders from this browser in an hour" };

/**
 * Orders the quality filter held before they reach the supplier, and the numbers under the blacklist rule.
 * A customer appears as a short code of a one-way hash: the store never shows or keeps the phone number here.
 */
export function OrderQualityPanel({ market, origin, publicKey, token, request }: { market: MarketCode; origin: string; publicKey: string; token: string; request?: typeof fetch }) {
  const client = useMemo(() => { try { return brainClient(origin, publicKey, token, request); } catch { return null; } }, [origin, publicKey, token, request]);
  const [data, setData] = useState<OrderQuality | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => { if (!client) return; try { setData(await client.orderQuality(market)); } catch (e) { setError(String((e as Error).message ?? e)); } }, [client, market]);
  useEffect(() => { setData(null); setError(""); void load(); }, [load]);
  if (!client) return null;
  async function act(fn: () => Promise<unknown>) { setBusy(true); setError(""); try { await fn(); await load(); } catch (e) { setError(String((e as Error).message ?? e)); } finally { setBusy(false); } }
  const queue = data?.queue ?? [], list = data?.blacklist ?? [];
  return <section id="order-quality" aria-label="Order quality and blacklist" className="scroll-mt-32 space-y-4 rounded-3xl border bg-card p-5 shadow-soft sm:p-6">
    <div>
      <h3 className="inline-flex items-center gap-2 text-lg font-extrabold"><ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />Order quality and blacklist</h3>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Before an order reaches Taager it is checked for duplicates, invalid names, wrong-country phones and too many orders in an hour. A number with 1 undelivered order in {data?.rule.window_days ?? 90} days must confirm the next order on WhatsApp; with 2 the order form politely refuses. Only a one-way code of the phone and the counts are kept.</p>
    </div>
    {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-2xl border bg-background p-4">
        <h4 className="mb-2 text-sm font-extrabold">Orders waiting for you ({queue.length})</h4>
        {queue.length === 0 ? <p className="text-sm text-muted-foreground">No order is held.</p> : <ul className="divide-y text-sm">{queue.map((q) => <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span className="min-w-0"><span className="block font-semibold">Order {q.order_ref} · customer {q.customer}</span>
            <span className="block text-xs text-muted-foreground">Held because {q.reasons.map((r) => REASON[r] ?? r.replace(/_/g, " ")).join("; ")}.{q.undelivered_90d ? ` ${q.undelivered_90d} undelivered in 90 days.` : ""}</span></span>
          <span className="flex gap-1"><button type="button" disabled={busy} onClick={() => act(() => client.orderQueueDecide(market, q.id, "released"))} className="min-h-9 rounded-lg border px-2 text-xs font-bold disabled:opacity-50">Release</button>
            <button type="button" disabled={busy} onClick={() => act(() => client.orderQueueDecide(market, q.id, "cancelled"))} className="min-h-9 rounded-lg border px-2 text-xs disabled:opacity-50">Cancel order</button></span></li>)}</ul>}
      </div>
      <div className="rounded-2xl border bg-background p-4">
        <h4 className="mb-2 text-sm font-extrabold">Numbers under the rule ({list.length})</h4>
        {list.length === 0 ? <p className="text-sm text-muted-foreground">No number has an undelivered order in the last 90 days.</p> : <ul className="divide-y text-sm">{list.map((b) => <li key={b.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span><span className="font-semibold">Customer {b.customer}</span> · {b.undelivered_90d} undelivered · {b.delivered_all_time} delivered before
            <span className={"ms-2 rounded-full px-2 py-0.5 text-[11px] font-bold " + (b.undelivered_90d >= 2 ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-900")}>{b.undelivered_90d >= 2 ? "order form refuses" : "must confirm on WhatsApp"}</span></span>
          <button type="button" disabled={busy} onClick={() => act(() => client.customerUnblock(market, b.key))} className="min-h-9 rounded-lg border px-2 text-xs font-bold disabled:opacity-50">Unblock</button></li>)}</ul>}
      </div>
    </div>
  </section>;
}
