import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Store, Upload } from "lucide-react";
import { type MarketCode } from "@/lib/store/markets";
import { money, PUBLISH_REASONS, type brainClient, type PublicationStatus, type PublishResult, type RepriceProposal } from "@/lib/store/brain-client";
import { markets } from "@/lib/store/markets";

type Client = ReturnType<typeof brainClient>;
const reason = (code: string) => PUBLISH_REASONS[code] ?? code.replace(/_/g, " ");

/**
 * Owner controls for what shoppers can see: publish the approved picks of the latest run,
 * show or hide the whole market, and see why any published product is currently hidden.
 * Every action is an owner-only database call; checkout is not touched from here.
 */
export function StorePublication({ client, market, runId, approved, afterPublish }: { client: Client; market: MarketCode; runId: string | null; approved: number; /** Runs after a successful publish: works out offers, sets and free delivery for the approval queue. */ afterPublish?: () => Promise<string | null> }) {
  const [next, setNext] = useState<string | null>(null);
  const [status, setStatus] = useState<PublicationStatus | null>(null);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reprices, setReprices] = useState<RepriceProposal[]>([]);
  const loadReprices = useCallback(async () => { try { const r = await client.repriceList(market); setReprices(Array.isArray(r) ? r : []); } catch { setReprices([]); } }, [client, market]);
  useEffect(() => { void loadReprices(); }, [loadReprices]);
  const load = useCallback(async () => { try { const s = await client.publicationStatus(market); setStatus(s && typeof s.listings === "number" && typeof s.ready === "number" && Array.isArray(s.sample) ? s : null); } catch { setStatus(null); } }, [client, market]);
  useEffect(() => { setResult(null); setError(""); void load(); }, [load]);
  async function act(fn: () => Promise<unknown>) { setBusy(true); setError(""); try { await fn(); await load(); } catch (e) { setError(String((e as Error).message ?? e)); } finally { setBusy(false); } }
  const hidden = Object.entries(status?.hidden ?? {});
  const live = status?.release_enabled ? status.ready : 0;
  const syncAge = status?.last_sync_at ? Math.round((Date.now() - Date.parse(status.last_sync_at)) / 3600000) : null;

  return <div className="space-y-3 rounded-2xl border bg-background p-4" aria-label="Store publication">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="inline-flex items-center gap-2 font-extrabold"><Store className="h-4 w-4 text-primary" aria-hidden="true" />On the store</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Publishing puts your approved products on /{market} with the brain's Arabic page, price and Taager pictures. Visitors see them only while the store is shown. Ordering stays off.</p>
      </div>
      <p className={"rounded-full px-3 py-1 text-xs font-bold " + (status?.release_enabled ? "bg-emerald-50 text-emerald-800" : "bg-muted text-muted-foreground")}>{status?.release_enabled ? "Store shown to visitors" : "Store hidden from visitors"}</p>
    </div>
    {status && <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
      <div className="rounded-xl border px-3 py-2"><dt className="text-xs text-muted-foreground">Published</dt><dd className="text-lg font-extrabold">{status.listings}</dd></div>
      <div className="rounded-xl border px-3 py-2"><dt className="text-xs text-muted-foreground">Visible now</dt><dd className="text-lg font-extrabold">{live}</dd></div>
      <div className="rounded-xl border px-3 py-2"><dt className="text-xs text-muted-foreground">Hidden automatically</dt><dd className="text-lg font-extrabold">{status.listings - status.ready}</dd></div>
      <div className="rounded-xl border px-3 py-2"><dt className="text-xs text-muted-foreground">Last Taager sync</dt><dd className="text-lg font-extrabold">{syncAge === null ? "never" : syncAge < 1 ? "under 1 h ago" : `${syncAge} h ago`}</dd></div>
    </dl>}
    {status && syncAge !== null && syncAge > status.stock_max_age_hours / 2 && <p className="text-sm text-amber-800">Products hide themselves when the Taager sync is older than {status.stock_max_age_hours} hours. Run Taager sync (quick) to keep them visible.</p>}
    {hidden.length > 0 && <ul className="space-y-1 text-sm">{hidden.map(([code, n]) => <li key={code}><b>{n}</b> hidden: {reason(code)}</li>)}</ul>}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || !runId || !approved} onClick={() => act(async () => { const r = await client.publish(market, runId!); setResult(r); if (afterPublish && r.published + r.updated > 0) setNext(await afterPublish().catch(() => null)); })}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"><Upload className="h-4 w-4" aria-hidden="true" />Publish approved products ({approved})</button>
      {status && !status.release_enabled && <button type="button" disabled={busy || !status.ready} onClick={() => act(() => client.setRelease(market, true))}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold disabled:opacity-50"><Eye className="h-4 w-4" aria-hidden="true" />Show store to visitors</button>}
      {status?.release_enabled && <button type="button" disabled={busy} onClick={() => act(() => client.setRelease(market, false))}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold disabled:opacity-50"><EyeOff className="h-4 w-4" aria-hidden="true" />Hide store from visitors</button>}
      {status && status.listings > 0 && <button type="button" disabled={busy} onClick={() => act(() => client.unpublish(market, null))}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-destructive/40 px-4 text-sm font-semibold text-destructive disabled:opacity-50">Take all products off</button>}
      {status?.release_enabled && status.ready > 0 && <a href={`/${market}/search`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold">Open /{market}</a>}
    </div>
    {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
    {result && <div role="status" className="rounded-xl border px-3 py-2 text-sm">
      <p><b>{result.published}</b> new on the store, <b>{result.updated}</b> refreshed{result.skipped.length ? <>, <b>{result.skipped.length}</b> left out:</> : "."}</p>
      {result.skipped.length > 0 && <ul className="mt-1 list-disc space-y-0.5 ps-5">{result.skipped.slice(0, 30).map((s) => <li key={s.product_id + ":" + s.variation_id}><span dir="rtl">{s.title}</span> — {reason(s.reason)}</li>)}</ul>}
    </div>}
    {reprices.length > 0 && <section aria-label="Price changes to approve" className="space-y-2 rounded-xl border border-amber-300 bg-amber-50/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-extrabold">Price changes to approve ({reprices.length})</h4>
        <button type="button" disabled={busy} onClick={() => act(async () => { await client.repriceDecide(market, null, "approved"); await loadReprices(); })}
          className="inline-flex min-h-10 items-center rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-50">Approve all price changes</button>
      </div>
      <p className="text-xs text-muted-foreground">Worked out after the latest Taager sync and shop prices. Profit is per delivered order, in US dollars. A product earning under $2 is already hidden until you approve its new price.</p>
      <ul className="divide-y text-sm">{reprices.map((p) => { const d = (v: number | null) => v === null ? "—" : "$" + (v / 10 ** markets[market].minorDigits / p.per_usd).toFixed(2);
        return <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span className="min-w-0 flex-1"><span dir="rtl" className="block truncate font-semibold">{p.title ?? p.slug ?? p.listing_id}</span><span className="block text-xs text-muted-foreground">{p.action === "pause" ? "Paused. " : ""}{p.reason}</span></span>
          <span className="text-xs tabular-nums">{money(p.old_price_minor, market)} → {p.new_price_minor ? money(p.new_price_minor, market) : "no safe price"} · earns {d(p.profit_now_minor)} → {d(p.profit_new_minor)}</span>
          <span className="flex gap-1">
            <button type="button" disabled={busy || !p.new_price_minor} onClick={() => act(async () => { await client.repriceDecide(market, [p.id], "approved"); await loadReprices(); })} className="min-h-9 rounded-lg border px-2 text-xs font-bold disabled:opacity-50">Approve</button>
            <button type="button" disabled={busy} onClick={() => act(async () => { await client.repriceDecide(market, [p.id], "rejected"); await loadReprices(); })} className="min-h-9 rounded-lg border px-2 text-xs disabled:opacity-50">Keep price</button>
          </span></li>; })}</ul>
    </section>}
    {next && <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{next} <a href="#offers" className="font-bold underline">Review and approve them</a>.</p>}
    {status && status.sample.length > 0 && <details><summary className="cursor-pointer text-sm font-semibold">Published products ({status.listings})</summary>
      <ul className="mt-2 divide-y text-sm">{status.sample.map((p) => <li key={p.listing_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
        <span dir="rtl" className="min-w-0 flex-1 truncate">{p.title}</span><span className="tabular-nums">{money(p.price_minor, market)}</span>
        <span className={"text-xs " + (p.hidden_reason ? "text-amber-800" : "text-emerald-700")}>{p.hidden_reason ? "hidden: " + reason(p.hidden_reason) : "ready"}</span></li>)}</ul>
    </details>}
  </div>;
}
