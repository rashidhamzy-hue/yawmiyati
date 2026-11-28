import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarDays, CheckCircle2, Megaphone, PauseCircle, RefreshCw, Sunrise } from "lucide-react";
import type { MarketCode } from "@/lib/store/markets";
import { brainClient, type DailyBrief } from "@/lib/store/brain-client";
import { offersClient } from "@/lib/store/offers-client";

type Props = { market: MarketCode; origin: string; publicKey: string; token: string; request?: typeof fetch };
const d = (v: unknown) => "$" + (Number(v) || 0).toFixed(2);
function Block({ title, icon, children, tone = "" }: { title: string; icon?: ReactNode; children: ReactNode; tone?: string }) {
  return <section aria-label={title} className={"rounded-2xl border bg-background p-4 " + tone}><h4 className="mb-2 flex items-center gap-2 text-sm font-extrabold">{icon}{title}</h4><div className="space-y-2 text-sm">{children}</div></section>;
}
const none = (text: string) => <p className="text-muted-foreground">{text}</p>;

/**
 * The brain's morning brief for one market, in English with US dollars, and the one "Approve all" for the day:
 * price changes, products to add and to retire, and the safe offers. Nothing is approved without that click;
 * approved additions start a build, and that batch still comes back for review before it is published.
 */
export function MorningBrief({ market, origin, publicKey, token, request }: Props) {
  const client = useMemo(() => { try { return brainClient(origin, publicKey, token, request); } catch { return null; } }, [origin, publicKey, token, request]);
  const offers = useMemo(() => { try { return offersClient(origin, publicKey, token, request); } catch { return null; } }, [origin, publicKey, token, request]);
  const [data, setData] = useState<DailyBrief | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async (day: string | null = null) => { if (!client) return; try { setData(await client.brief(market, day)); } catch (e) { setError(String((e as Error).message ?? e)); } }, [client, market]);
  useEffect(() => { setData(null); setNote(""); setError(""); void load(); }, [load]);
  if (!client) return null;
  async function act(fn: () => Promise<unknown>) { setBusy(true); setError(""); try { await fn(); await load(data?.day ?? null); } catch (e) { setError(String((e as Error).message ?? e)); } finally { setBusy(false); } }
  const b = data?.brief, open = (data?.proposals ?? []).filter((p) => p.status === "proposed");
  const waiting = open.length + (data?.price_changes_waiting ?? 0) + (data?.offers_waiting ?? 0);

  const approveAll = () => act(async () => {
    const prices = await client.repriceDecide(market, null, "approved");
    const day = await client.dailyDecide(market, null, "approved");
    let approvedOffers = 0;
    if (offers) for (const o of await offers.list(market)) if (o.status === "proposed" && !o.problem) { await offers.decide(market, o.id, "approved"); approvedOffers++; }
    let built = "";
    const ids = (day.add_product_ids ?? []).filter((x) => x > 0);
    if (ids.length) { try { await client.buildProducts(market, ids); built = ` A build has started for the ${ids.length} new products: review and publish them in Yawmiyati Brain below.`; } catch (e) { built = ` The build for the new products could not start (${String((e as Error).message ?? e)}): press Build store below.`; } }
    window.dispatchEvent(new CustomEvent("yawmiyati:offers-updated", { detail: { market } }));
    setNote(`Approved: ${prices.decided} price changes${prices.skipped_unsafe ? ` (${prices.skipped_unsafe} left out as unsafe)` : ""}, ${day.retired} products retired, ${ids.length} products to add, ${approvedOffers} offers.` + built);
  });

  return <section id="brief" aria-label="Morning brief" className="scroll-mt-32 space-y-4 rounded-3xl border bg-card p-5 shadow-soft sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="inline-flex items-center gap-2 text-lg font-extrabold"><Sunrise className="h-5 w-5 text-primary" aria-hidden="true" />Morning brief{data?.day ? ` · ${data.day}` : ""}</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{b?.headline ?? "The brain writes this every morning: what sold and earned, refusals and why, what to push in ads, prices that block sales, products to add or retire, and what waits for your approval."}</p>
        {b?.currency_note && <p className="text-xs text-muted-foreground">{b.currency_note}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(data?.days ?? []).length > 1 && <select aria-label="Brief day" value={data?.day ?? ""} onChange={(e) => void load(e.target.value)} className="h-10 rounded-xl border bg-background px-2 text-sm">{data!.days.map((x) => <option key={x} value={x}>{x}</option>)}</select>}
        <button type="button" disabled={busy} onClick={() => act(async () => { const r = await client.runDailyNow(market); setNote(`Daily loop finished: ${r.headline}`); })} className="inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold disabled:opacity-50"><RefreshCw className="h-4 w-4" aria-hidden="true" />Run the daily loop now</button>
        <button type="button" disabled={busy || waiting === 0} onClick={approveAll} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-50"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Approve all ({waiting})</button>
      </div>
    </div>
    <p className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <label className="inline-flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={data?.daily_loop_enabled ?? true} disabled={busy || !data} onChange={(e) => act(() => client.setDailyLoop(market, e.target.checked))} />Daily loop on for this market</label>
      <label className="inline-flex items-center gap-2" title="Off: every proposal waits for you. On: the daily loop approves safe price changes (up to 15% a day), proposed retirements and safe offers by itself, with the same never-a-loss checks. New products always wait for you."><input type="checkbox" className="h-4 w-4" data-autopilot-switch="" checked={data?.autopilot_enabled ?? false} disabled={busy || !data} onChange={(e) => { const on = e.target.checked;
        if (on && !window.confirm("Turn autopilot ON for this market?\n\nEvery morning the brain will approve by itself: price changes that still earn the $2 floor and move a price by at most 15%, the retirements it proposes, and offers that are safe at full Taager cost.\n\nNew products, publishing, checkout and every other switch stay with you. You can turn it off here at any time.")) return;
        void act(() => client.setAutopilot(market, on)); }} />Autopilot {data?.autopilot_enabled ? "ON: safe price changes, retirements and offers are approved for you" : "(off: every proposal waits for you)"}</label>
    </p>
    {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
    {note && <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{note}</p>}
    {!b ? <p className="rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground">No brief yet for this market. It appears after the first daily run (every morning at 06:20 Riyadh time), or press "Run the daily loop now".</p> : <div className="grid gap-3 lg:grid-cols-2">
      <Block title="What sold and what earned">
        <p><b>{b.sold.orders_placed}</b> orders · <b>{b.sold.delivered}</b> delivered · <b>{b.sold.open}</b> on the way · <b>{d(b.sold.delivered_profit_usd)}</b> profit from delivered orders</p>
        {b.sold.top.length ? <ul className="divide-y">{b.sold.top.map((t: any) => <li key={t.title} className="flex justify-between gap-2 py-1.5"><span dir="auto" className="min-w-0 truncate">{t.title}</span><span className="shrink-0 tabular-nums">{t.orders} orders · {d(t.profit_usd)}</span></li>)}</ul> : none("No orders yesterday.")}
      </Block>
      {b.taager_rules && (b.taager_rules.changes.length + b.taager_rules.contradictions.length + b.taager_rules.planning_notes.length + b.taager_rules.customer_copy.length > 0) && <Block title="Taager's fees and rules" tone="border-amber-300">
        {b.taager_rules.changes.map((c: any) => <p key={c.what} className="text-amber-900"><b>Changed since the last sync:</b> {c.what} <span className="text-xs text-muted-foreground">({c.source})</span></p>)}
        {b.taager_rules.contradictions.map((c: any) => <p key={c.what}><b className="capitalize">{c.what}:</b> we plan with {c.ours}; Taager's page says {c.page}. <span className="text-muted-foreground">{c.status}</span></p>)}
        {b.taager_rules.planning_notes.map((n: string) => <p key={n} className="text-muted-foreground">{n}</p>)}
        {b.taager_rules.customer_copy.map((n: string) => <p key={n} className="text-amber-900">{n}</p>)}
        <p className="text-xs text-muted-foreground">Decide each one in "Taager's rules for this market" above.{b.taager_rules.loyalty ? " " + b.taager_rules.loyalty : ""}</p>
      </Block>}
      {b.autopilot && <Block title="Autopilot did this by itself today" tone="border-emerald-300">
        <p><b>{b.autopilot.price_changes}</b> price changes · <b>{b.autopilot.retired}</b> products retired · <b>{b.autopilot.offers}</b> offers approved</p>
        <p className="text-muted-foreground">{b.autopilot.left_for_owner} left for you (a move above 15%, or not safe){b.autopilot.new_products_waiting ? ` · ${b.autopilot.new_products_waiting} new products wait for your approval` : ""}.</p>
      </Block>}
      <Block title="Refusals and why">
        <p><b>{b.refusals.refused}</b> refused · <b>{b.refusals.returned}</b> returned · <b>{b.refusals.unreachable}</b> unreachable · <b>{b.refusals.cancelled}</b> cancelled</p>
        {b.refusals.reasons.length ? <p className="text-muted-foreground">{b.refusals.reasons.map((r: any) => `${r.reason}: ${r.orders}`).join(" · ")}</p> : none("No refusal reasons recorded.")}
        {b.paused.map((p: any) => <p key={p.title} className="text-amber-900"><PauseCircle className="me-1 inline h-4 w-4" aria-hidden="true" /><span dir="auto">{p.title}</span> was paused: {p.reason}</p>)}
      </Block>
      <Block title="Push in ads (the brain never spends)" icon={<Megaphone className="h-4 w-4" aria-hidden="true" />}>
        {b.push_in_ads.length ? b.push_in_ads.map((a: any) => <div key={a.listing_id} className="rounded-xl border p-3"><p dir="auto" className="font-semibold">{a.title}</p>
          <p className="text-xs text-muted-foreground">{a.why}</p><p className="mt-1 text-xs"><b>Angle:</b> {a.angle} <b>Creative:</b> {a.creative} <b>Show:</b> {d(a.show_price_usd)} · {a.show_offer}. <b>Country:</b> {a.target_country}.</p></div>)
          : none("No product has enough views with a strong add-to-cart rate yet.")}
      </Block>
      <Block title="Prices that block sales">{b.price_blocks_sales.length ? b.price_blocks_sales.map((p: any) => <p key={p.title}><span dir="auto" className="font-semibold">{p.title}</span>: {p.why}</p>) : none("None found.")}
        {(b.price_changes.changes + b.price_changes.pauses) > 0 && <p className="text-amber-900">{b.price_changes.changes} price changes and {b.price_changes.pauses} pauses worked out from Taager's latest costs and shop prices: see "Price changes to approve" below.</p>}</Block>
      <Block title={`Products to add (${open.filter((p) => p.kind === "add_product").length})`}>
        {open.filter((p) => p.kind === "add_product").length ? open.filter((p) => p.kind === "add_product").map((p) => <div key={p.id} className="flex items-start justify-between gap-2"><span className="min-w-0"><span dir="auto" className="block font-semibold">{p.title}</span><span className="block text-xs text-muted-foreground">{p.why}</span></span>
          <span className="flex shrink-0 gap-1"><button type="button" disabled={busy} onClick={() => act(async () => { const r = await client.dailyDecide(market, [p.id], "approved"); const ids = (r.add_product_ids ?? []).filter((x) => x > 0); if (ids.length) await client.buildProducts(market, ids); })} className="min-h-9 rounded-lg border px-2 text-xs font-bold disabled:opacity-50">Add</button>
            <button type="button" disabled={busy} onClick={() => act(() => client.dailyDecide(market, [p.id], "rejected"))} className="min-h-9 rounded-lg border px-2 text-xs disabled:opacity-50">No</button></span></div>) : none("Nothing new worth adding today.")}
      </Block>
      <Block title={`Products to retire (${open.filter((p) => p.kind === "retire_product").length})`}>
        {open.filter((p) => p.kind === "retire_product").length ? open.filter((p) => p.kind === "retire_product").map((p) => <div key={p.id} className="flex items-start justify-between gap-2"><span className="min-w-0"><span dir="auto" className="block font-semibold">{p.title}</span><span className="block text-xs text-muted-foreground">{p.why}</span></span>
          <span className="flex shrink-0 gap-1"><button type="button" disabled={busy} onClick={() => act(() => client.dailyDecide(market, [p.id], "approved"))} className="min-h-9 rounded-lg border px-2 text-xs font-bold disabled:opacity-50">Retire</button>
            <button type="button" disabled={busy} onClick={() => act(() => client.dailyDecide(market, [p.id], "rejected"))} className="min-h-9 rounded-lg border px-2 text-xs disabled:opacity-50">Keep</button></span></div>) : none("No product needs retiring.")}
        {(data?.paused ?? []).length > 0 && <div className="border-t pt-2"><p className="text-xs font-bold">Paused now</p>{data!.paused.map((p) => <p key={p.listing_id} className="flex items-start justify-between gap-2 text-xs"><span><span dir="auto" className="font-semibold">{p.title}</span>: {p.reason}</span>
          <button type="button" disabled={busy} onClick={() => act(() => client.setPaused(market, p.listing_id, false))} className="min-h-8 shrink-0 rounded-lg border px-2 font-bold disabled:opacity-50">Resume</button></p>)}</div>}
      </Block>
      <Block title="Traffic sources (judged by delivered profit)">
        {b.sources.length ? <ul className="divide-y">{b.sources.map((s: any) => <li key={s.source} className="py-1.5"><span className="font-semibold">{s.source}</span> · {s.visits} visits · {s.orders} orders · {s.delivered} delivered · {d(s.delivered_profit_usd)}<span className="block text-xs text-muted-foreground">{s.verdict}</span></li>)}</ul> : none("No visit data yet.")}
        {b.search_gaps.length > 0 && <p className="text-xs"><b>Searched and not found:</b> <span dir="auto">{b.search_gaps.map((g: any) => `${g.query} (${g.searches})`).join(" · ")}</span></p>}
      </Block>
      <Block title="Retargeting audiences to create in Ads Manager">
        <ul className="space-y-1.5">{b.audiences.map((a: any) => <li key={a.key}><span className="font-semibold">{a.name}</span>: event <code>{a.event}</code>, URL contains <code>{a.url_contains}</code>, {a.retention_days} days{a.exclude.length ? `, exclude ${a.exclude.join(", ")}` : ""}.<span className="block text-xs text-muted-foreground">{a.use_for}</span></li>)}</ul>
      </Block>
      <Block title="Seasons ahead" icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}>
        {b.seasonal.length ? b.seasonal.map((s: any) => <div key={s.key} className="rounded-xl border p-3"><p className="font-semibold">{s.name} · {s.date} ({s.confidence}) · in {s.days_until} days</p>
          <p className="text-xs text-muted-foreground">Have the assortment approved by {s.act_by}. {s.next_step}</p>
          <ul className="mt-1 list-disc ps-5 text-xs">{s.ideas.map((x: string) => <li key={x}>{x}</li>)}</ul></div>) : none("No season within the next 5 weeks.")}
      </Block>
      <Block title="Health" tone={b.health.sync_ok ? "" : "border-amber-300"}>
        <p>Taager sync: {b.health.sync_age_hours === null ? "never imported" : `${b.health.sync_age_hours} h old`}{b.health.sync_ok ? "" : " (too old: products hide themselves)"} · Orders: {b.health.orders_connected ? "connected" : "not connected"} · Visits: {b.health.analytics_connected ? "connected" : "not connected"} · AI spend today {d(b.health.spend_today_usd)} of {d(b.health.daily_cap_usd)}</p>
        {b.hidden_now.length > 0 && <p className="text-muted-foreground">Hidden now: {b.hidden_now.map((h: any) => `${h.products} ${h.reason}`).join(" · ")}</p>}
        {b.health.notes.map((n: string) => <p key={n} className="text-amber-900">{n}</p>)}
      </Block>
    </div>}
  </section>;
}
