import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import type { MarketCode } from "@/lib/store/markets";
import { brainClient, type AssistantStatus } from "@/lib/store/brain-client";

const usd = (n: number) => "$" + (n < 1 ? n.toFixed(n === 0 ? 0 : 3) : n.toFixed(2));

/**
 * The shopper assistant's paid AI for one store: the switch, the daily cap in dollars and what was spent.
 * With the switch off the assistant still answers from the store's published facts, which costs nothing.
 * Only the owner changes the switch; the server refuses "on" without a cap and refuses a cap above $20 a day.
 */
export function AssistantPanel({ market, origin, publicKey, token, request }: { market: MarketCode; origin: string; publicKey: string; token: string; request?: typeof fetch }) {
  const client = useMemo(() => { try { return brainClient(origin, publicKey, token, request); } catch { return null; } }, [origin, publicKey, token, request]);
  const [data, setData] = useState<AssistantStatus | null>(null);
  const [cap, setCap] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const show = useCallback((s: AssistantStatus) => { setData(s); setCap(String(s.daily_budget_usd)); }, []);
  const load = useCallback(async () => { if (!client) return; try { show(await client.assistantStatus(market)); } catch (e) { setError(String((e as Error).message ?? e)); } }, [client, market, show]);
  useEffect(() => { setData(null); setError(""); setSaved(""); void load(); }, [load]);
  if (!client) return null;
  async function save(enabled: boolean) {
    const value = Number(cap);
    setBusy(true); setError(""); setSaved("");
    try { show(await client!.assistantSet(market, enabled, value)); setSaved(enabled ? "The assistant's AI is on for visitors." : "Saved. The assistant's AI is off; it answers from the store's published facts only."); }
    catch (e) { setError(String((e as Error).message ?? e)); } finally { setBusy(false); }
  }
  const days = data?.days ?? [], today = new Date().toISOString().slice(0, 10);
  const spentToday = days.find((d) => d.day === today)?.cost_usd ?? 0, weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10), spent7 = days.filter((d) => d.day >= weekAgo).reduce((n, d) => n + d.cost_usd, 0), spent30 = days.reduce((n, d) => n + d.cost_usd, 0);
  const calls30 = days.reduce((n, d) => n + d.calls, 0), dropped30 = days.reduce((n, d) => n + d.discarded, 0);
  return <section id="assistant" aria-label="Shopper assistant" className="scroll-mt-32 space-y-4 rounded-3xl border bg-card p-5 shadow-soft sm:p-6">
    <div>
      <h3 className="inline-flex items-center gap-2 text-lg font-extrabold"><MessageCircle className="h-5 w-5 text-primary" aria-hidden="true" />Shopper assistant
        {data && <span className={"rounded-full px-2 py-0.5 text-[11px] font-bold " + (data.enabled ? "bg-emerald-50 text-emerald-800" : "bg-muted text-muted-foreground")}>{data.enabled ? "AI on for visitors" : "AI off"}</span>}</h3>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">The chat helper on the store. Off, it answers from the store's published facts (delivery, payment, returns) and costs nothing. On, it also uses paid AI for product questions, up to the daily cap; when the cap is reached it falls back to the free answers until the next day.</p>
    </div>
    {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
    {saved && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{saved}</p>}
    {!data ? !error && <p className="text-sm text-muted-foreground">Loading…</p> : <div className="grid gap-3 lg:grid-cols-2">
      <div className="space-y-3 rounded-2xl border bg-background p-4">
        <label className="block text-sm font-bold" htmlFor={"assistant-cap-" + market}>Daily cap for this store (US dollars, $0 to $20)</label>
        <input id={"assistant-cap-" + market} type="number" inputMode="decimal" min={0} max={20} step={0.5} value={cap} onChange={(e) => setCap(e.target.value)} className="min-h-11 w-32 rounded-xl border bg-background px-3 text-sm" />
        <p className="text-xs text-muted-foreground">At this cap: at most {data.daily_request_cap.toLocaleString("en-US")} questions a day and {data.minute_request_cap} a minute{data.model ? ", model " + data.model : ""}.</p>
        <div className="flex flex-wrap gap-2">
          {data.enabled
            ? <><button type="button" disabled={busy} onClick={() => save(true)} className="min-h-11 rounded-xl border px-4 text-sm font-bold disabled:opacity-50">Save cap</button>
                <button type="button" disabled={busy} onClick={() => save(false)} className="min-h-11 rounded-xl bg-foreground px-4 text-sm font-bold text-background disabled:opacity-50">Switch AI off</button></>
            : <><button type="button" disabled={busy} onClick={() => save(false)} className="min-h-11 rounded-xl border px-4 text-sm font-bold disabled:opacity-50">Save cap, keep off</button>
                <button type="button" disabled={busy || !(Number(cap) > 0)} onClick={() => save(true)} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">Switch AI on for visitors</button></>}
        </div>
      </div>
      <div className="rounded-2xl border bg-background p-4">
        <h4 className="mb-2 text-sm font-extrabold">Spend</h4>
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <div><dt className="text-xs text-muted-foreground">Today</dt><dd className="font-extrabold">{usd(spentToday)}<span className="font-normal text-muted-foreground"> of {usd(data.daily_budget_usd)}</span></dd></div>
          <div><dt className="text-xs text-muted-foreground">Last 7 days</dt><dd className="font-extrabold">{usd(spent7)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Last 30 days</dt><dd className="font-extrabold">{usd(spent30)}</dd></div>
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">{calls30.toLocaleString("en-US")} AI answers in 30 days{dropped30 ? `, ${dropped30} thrown away by the safety check and replaced with the free answer` : ""}.</p>
        {days.length > 0 && <table className="mt-3 w-full text-left text-xs"><thead className="text-muted-foreground"><tr><th className="py-1 font-semibold">Day</th><th className="font-semibold">Answers</th><th className="font-semibold">Cost</th></tr></thead>
          <tbody>{days.slice(0, 7).map((d) => <tr key={d.day} className="border-t"><td className="py-1">{d.day}</td><td>{d.calls}</td><td>{usd(d.cost_usd)}</td></tr>)}</tbody></table>}
      </div>
    </div>}
  </section>;
}
