import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpenCheck, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import type { MarketCode } from "@/lib/store/markets";
import { changedLines, taagerPagesClient, type RulesOverview, type StoredRule } from "@/lib/store/taager-pages";
import { contradictions, type FactKey } from "../../../supabase/functions/_shared/brain/taager-facts";
import { MARKETS, minorToDecimal, minorToUsd } from "../../../supabase/functions/_shared/brain/markets";

type Props = { market: MarketCode; origin: string; publicKey: string; token: string; request?: typeof fetch };
const LABEL: Record<string, string> = { delivery_fee: "Delivery fee", delivery_time: "Delivery time", cod: "Cash on delivery", confirmation: "Confirmation call", refusal_fee: "Refused order charge",
  return_fee: "Return fee (charged to us)", return_window: "Return window", return_rules: "What cannot be returned", order_limits: "Order and product limits", vat: "VAT on added profit", payout: "Payout rule",
  loyalty: "Loyalty programme", other_rules: "Other merchant rules" };
const STATE: Record<StoredRule["decision"], { text: string; tone: string }> = {
  agrees: { text: "Same as our figure", tone: "bg-emerald-50 text-emerald-900 border-emerald-200" },
  pending: { text: "Waits for you", tone: "bg-amber-50 text-amber-900 border-amber-300" },
  confirmed: { text: "Confirmed: the page is used", tone: "bg-emerald-50 text-emerald-900 border-emerald-200" },
  rejected: { text: "Rejected: our figure is used", tone: "bg-background text-muted-foreground" },
};
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "date unknown");

/**
 * What Taager's own information pages say for this market, read by the last sync: each fact with the page and date it
 * came from. A fact that contradicts our figure waits here; "Use the page" makes the page win, "Keep ours" ignores it.
 * While a dearer figure waits, prices are already checked against it, so nothing can lose money in the meantime.
 */
export function TaagerRules({ market, origin, publicKey, token, request }: Props) {
  const client = useMemo(() => { try { return taagerPagesClient(origin, publicKey, token, request); } catch { return null; } }, [origin, publicKey, token, request]);
  const [data, setData] = useState<RulesOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [diff, setDiff] = useState<{ path: string; added: string[]; removed: string[] } | null>(null);
  const load = useCallback(async () => { if (!client) return; try { setData(await client.overview(market)); setError(""); } catch (e) { setError(String((e as Error).message ?? e)); } }, [client, market]);
  useEffect(() => { setData(null); setDiff(null); void load(); }, [load]);
  useEffect(() => { const again = () => void load(); window.addEventListener("yawmiyati:taager-pages-updated", again); return () => window.removeEventListener("yawmiyati:taager-pages-updated", again); }, [load]);
  if (!client) return null;
  const m = MARKETS[market], money = (minor: number) => `${minorToDecimal(minor, m.minorDigits)} ${m.currency} ($${minorToUsd(minor, m).toFixed(2)})`;
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); await load(); } catch (e) { setError(String((e as Error).message ?? e)); } finally { setBusy(false); } };
  const facts = data?.facts ?? [], waiting = facts.filter((f) => f.decision === "pending");
  const clash = new Map(contradictions(market, facts.map((f) => ({ key: f.key as FactKey, value: f.value, source_path: f.source_path, source_read_at: f.source_read_at }))).map((c) => [c.key as string, c]));
  const showDiff = (path: string) => act(async () => { const v = await client.versions(market, path); setDiff(v.length < 2 ? { path, added: [], removed: [] } : { path, ...changedLines(v[1]!.text, v[0]!.text) }); });
  return <section id="taager-rules" aria-label="Taager rules" className="scroll-mt-32 space-y-4 rounded-3xl border bg-card p-5 shadow-soft sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="inline-flex items-center gap-2 text-lg font-extrabold"><BookOpenCheck className="h-5 w-5 text-primary" aria-hidden="true" />Taager's rules for this market</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Read from Taager's information pages by the sync button (fees, zones, delivery times, returns, loyalty). {waiting.length ? <b className="text-amber-900">{waiting.length} waiting for your decision.</b> : facts.length ? "Nothing waits for you." : "No pages imported yet: run Taager Sync v5 and import the file."}</p>
      </div>
      <button type="button" disabled={busy} onClick={() => void load()} className="inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold disabled:opacity-50"><RefreshCw className="h-4 w-4" aria-hidden="true" />Refresh</button>
    </div>
    {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
    {data?.guards && <p className="text-xs text-muted-foreground">Prices are checked today against: delivery fee up to <b>{money(data.guards.delivery_fee_minor)}</b>{data.guards.delivery_fee_minor !== data.guards.base_delivery_fee_minor ? ` (our figure was ${money(data.guards.base_delivery_fee_minor)})` : ""}
      {data.guards.vat_added_profit_bps ? <> · VAT {data.guards.vat_added_profit_bps / 100}% of added profit</> : null}{data.guards.refusal_charge_minor ? <> · {money(data.guards.refusal_charge_minor)} per order that is not received</> : null}.</p>}
    {facts.length > 0 && <ul className="grid gap-3 lg:grid-cols-2">{facts.map((f) => { const c = clash.get(f.key); return <li key={f.id} className={"rounded-2xl border p-4 text-sm " + (f.decision === "pending" ? "border-amber-300" : "")} data-rule={f.key} data-decision={f.decision}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-extrabold">{LABEL[f.key] ?? f.key}</h4><span className={"rounded-full border px-2.5 py-0.5 text-xs font-semibold " + STATE[f.decision].tone}>{STATE[f.decision].text}</span></div>
      <p className="mt-1">{f.summary}</p>
      {c && <p className="mt-1 text-amber-900">Our figure: <b>{c.known}</b>. The page: <b>{c.page}</b>.{c.costs_us_more && f.decision === "pending" ? " The page's figure costs us more, so prices are already checked against it." : ""}</p>}
      {f.changed_at && f.previous_value && <p className="mt-1 text-amber-900">Changed on {day(f.changed_at)} (it was different at the sync before).</p>}
      {f.quote && <blockquote dir="auto" className="mt-2 border-s-2 ps-3 text-xs text-muted-foreground">{f.quote}</blockquote>}
      <p className="mt-2 text-xs text-muted-foreground">Source: {f.source_path} · read {day(f.source_read_at)}{f.confidence === "low" ? " · read with low certainty: check the page" : ""}</p>
      {f.decision !== "agrees" && <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy || f.decision === "confirmed"} onClick={() => act(() => client.decide(market, f.id, "confirmed"))} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-40"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Use the page</button>
        <button type="button" disabled={busy || f.decision === "rejected"} onClick={() => act(() => client.decide(market, f.id, "rejected"))} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-xs font-bold disabled:opacity-40"><XCircle className="h-4 w-4" aria-hidden="true" />Keep ours</button>
      </div>}
    </li>; })}</ul>}
    {(data?.pages.length ?? 0) > 0 && <details className="rounded-2xl border bg-background p-4 text-sm"><summary className="cursor-pointer font-semibold">Pages stored ({data!.pages.length})</summary>
      <ul className="mt-3 divide-y">{data!.pages.map((p) => <li key={p.path} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><b>{p.path}</b> <span className="text-muted-foreground">· version {p.version} · read {day(p.read_at ?? p.imported_at)} · {p.characters} characters</span></span>
        {p.version > 1 && <button type="button" disabled={busy} onClick={() => void showDiff(p.path)} className="rounded-full border px-3 py-1 text-xs font-semibold">What changed</button>}</li>)}</ul>
      {diff && <div className="mt-3 rounded-xl border p-3 text-xs" role="status"><p className="font-semibold">{diff.path}: {diff.added.length + diff.removed.length ? "changes since the version before" : "no line changed"}</p>
        {diff.added.map((l) => <p key={"a" + l} dir="auto" className="text-emerald-800">+ {l}</p>)}{diff.removed.map((l) => <p key={"r" + l} dir="auto" className="text-destructive">− {l}</p>)}</div>}
    </details>}
  </section>;
}
