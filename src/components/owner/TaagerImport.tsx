import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { CheckCircle2, FileUp, Link2, Loader2, PackageOpen } from "lucide-react";
import {
  importTaagerSync,
  parseTaagerFile,
  taagerImportClient,
  type ParsedTaagerSync,
  type TaagerCatalogSummary,
} from "@/lib/store/taager-import";
import type { MarketCode } from "@/lib/store/markets";
import { preparePages, taagerPagesClient, type PreparedPages } from "@/lib/store/taager-pages";

/** Blob.text with a FileReader fallback for older browsers. */
function readText(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(Error("Could not read the file."));
    r.readAsText(file);
  });
}

/** Origins allowed to post sync results (the owner's Taager tab running tools/taager/sync.js). */
export const TAAGER_ORIGINS = new Set(["https://taager.com", "https://www.taager.com"]);
const NAMES: Record<MarketCode, string> = { sa: "Saudi Arabia", ae: "UAE", om: "Oman", eg: "Egypt", iq: "Iraq" };
/** A read that lists every product counts as a full read; v4 marks stopped or broken reads incomplete. */
const fullRead = (p: ParsedTaagerSync) => p.complete !== false;

type Props = { market: MarketCode; origin: string; publicKey: string; token: string };

/** Owner imports Taager sync results: a downloaded file, or live from the Taager tab. Stored privately for the brain. */
export function TaagerImport({ market, origin, publicKey, token }: Props) {
  const client = useMemo(() => {
    try {
      return taagerImportClient(origin, publicKey, token);
    } catch {
      return null;
    }
  }, [origin, publicKey, token]);
  const pagesClient = useMemo(() => {
    try {
      return taagerPagesClient(origin, publicKey, token);
    } catch {
      return null;
    }
  }, [origin, publicKey, token]);
  const [pagesReady, setPagesReady] = useState<PreparedPages[]>([]);
  const [pagesNote, setPagesNote] = useState("");
  const [summary, setSummary] = useState<TaagerCatalogSummary | null>(null);
  const [blocks, setBlocks] = useState<ParsedTaagerSync[]>([]);
  const [fileName, setFileName] = useState("");
  const [isFull, setIsFull] = useState(true);
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [live, setLive] = useState(() => typeof window !== "undefined" && window.location.hash === "#taager-link");
  const [liveLog, setLiveLog] = useState<string[]>([]);
  const alive = useRef(true);
  const busyRef = useRef(false);
  const seen = useRef(new Set<string>());
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const load = useCallback(async () => {
    if (!client) return;
    try {
      const s = await client.summary(market);
      if (alive.current) setSummary(s);
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    }
  }, [client, market]);
  // A market switch clears the panel; a renewed sign-in (new token) only reloads the counts.
  useEffect(() => {
    setSummary(null);
    setBlocks([]);
    setFileName("");
    setError("");
    setDone("");
    setPagesReady([]);
    setPagesNote("");
  }, [market]);
  useEffect(() => {
    void load();
  }, [load]);

  /** Store Taager's information pages and the facts read from them. Never fails the catalogue import: a problem becomes a note. */
  const importPages = useCallback(
    async (list: PreparedPages[]) => {
      if (!pagesClient || !list.length) return "";
      const lines: string[] = [];
      for (const p of list) {
        try {
          const r = await pagesClient.importPages(p);
          lines.push(`${NAMES[p.market]}: ${p.pages.length} pages (${r.pages_new} new, ${r.pages_changed} changed), ${p.facts.length} rules read${r.waiting ? `, ${r.waiting} waiting for you` : ""}`);
        } catch (e) {
          lines.push(`${NAMES[p.market]}: pages not stored (${(e as Error).message})`);
        }
      }
      window.dispatchEvent(new CustomEvent("yawmiyati:taager-pages-updated"));
      return "Information pages: " + lines.join(" · ");
    },
    [pagesClient],
  );

  /** Import blocks one country at a time; returns a short result line per country. */
  const importBlocks = useCallback(
    async (list: ParsedTaagerSync[], full: (p: ParsedTaagerSync) => boolean) => {
      if (!client) throw Error("Import configuration unavailable");
      busyRef.current = true;
      const lines: string[] = [];
      try {
        for (const p of list) {
          if (!p.rows.length) continue;
          const s = await importTaagerSync(client, p, full(p), (d, t) => {
            if (alive.current) setProgress({ label: NAMES[p.market], done: d, total: t });
          });
          lines.push(`${NAMES[p.market]}: ${p.rows.length} products (${s.skus} stored, ${s.price_changed_7d} price changes this week)`);
        }
      } finally {
        busyRef.current = false;
        if (alive.current) setProgress(null);
      }
      await load();
      return lines;
    },
    [client, load],
  );

  // Live link: the Taager tab posts its results here; this page (signed in) imports them.
  useEffect(() => {
    if (!live || !client) return;
    const onMessage = async (e: MessageEvent) => {
      if (!TAAGER_ORIGINS.has(e.origin)) return;
      const data = e.data as { type?: string; file?: { created_at?: string } } | null;
      if (!data || data.type !== "ym-taager-sync" || !data.file) return;
      const reply = (msg: Record<string, unknown>) => {
        try {
          (e.source as Window | null)?.postMessage({ type: "ym-taager-ack", ...msg }, e.origin);
        } catch {
          /* tab closed */
        }
      };
      const id = String(data.file.created_at ?? "");
      if (busyRef.current) return; // the tab retries; it gets an answer once the current import ends
      if (id && seen.current.has(id)) return reply({ ok: true, message: "already imported" });
      try {
        const list = parseTaagerFile(data.file);
        const lines = await importBlocks(list, fullRead);
        const pages = await importPages(preparePages(data.file));
        if (pages) lines.push(pages);
        if (id) seen.current.add(id);
        const at = new Date().toLocaleTimeString("en-GB");
        if (alive.current) setLiveLog((l) => [`${at} · ${lines.join(" · ") || "no products"}`, ...l].slice(0, 20));
        reply({ ok: true, message: lines.join("; ") });
      } catch (err) {
        const msg = (err as Error).message;
        if (alive.current) setError(msg);
        reply({ ok: false, error: msg });
      }
    };
    const handler = (e: MessageEvent) => void onMessage(e);
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [live, client, importBlocks, importPages]);

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    setBlocks([]);
    setError("");
    setDone("");
    if (!file) return;
    setFileName(file.name);
    setPagesReady([]);
    setPagesNote("");
    try {
      const text = await readText(file);
      const list = parseTaagerFile(text);
      setPagesReady(preparePages(text));
      if (!list.some((p) => p.rows.length)) throw Error("The file has no products in it.");
      if (list.length === 1 && list[0].market !== market)
        throw Error(`This file is for ${NAMES[list[0].market]}, not ${NAMES[market]}. Switch the market above or pick the right file.`);
      setBlocks(list);
      setIsFull(list.every(fullRead));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function run(list: ParsedTaagerSync[]) {
    setError("");
    setDone("");
    try {
      const lines = await importBlocks(list, () => isFull);
      const pages = await importPages(pagesReady.filter((p) => list.some((b) => b.market === p.market)));
      if (!alive.current) return;
      setPagesNote(pages);
      setDone(lines.join(" · "));
      setBlocks([]);
    } catch (err) {
      if (alive.current) setError((err as Error).message);
    }
  }

  if (!client) return null;
  const busy = progress !== null;
  const last = summary?.last_sync;
  const mine = blocks.find((b) => b.market === market);
  return (
    <section id="taager-import" aria-label="Taager catalogue import" className="scroll-mt-32 space-y-4 rounded-3xl border bg-card p-5 shadow-soft sm:p-6">
      <div>
        <h2 className="inline-flex items-center gap-2 text-lg font-extrabold">
          <PackageOpen className="h-5 w-5 text-primary" aria-hidden="true" />
          Taager catalogue
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Upload the file the Taager sync button downloaded, or turn on Live link and let the Taager tab send it here. It is read in this browser and stored privately for the brain. Shoppers never see it.
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["Products stored", summary?.skus],
            ["With full detail", summary?.with_detail],
            ["Taager bundles", summary?.bundles],
            ["Price changed (7 days)", summary?.price_changed_7d],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-xl bg-background p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-bold">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
      {last && (
        <p className="text-xs text-muted-foreground">
          Last import {new Date(last.completed_at).toLocaleString("en-GB")} · {last.rows} products · {last.is_full ? "full read" : "partial read"}
          {summary?.missing_from_last_full_sync ? ` · ${summary.missing_from_last_full_sync} stored products were not in the last full read (possibly removed by Taager)` : ""}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className={"inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-5 text-sm font-semibold " + (busy ? "pointer-events-none opacity-50" : "")}>
          <FileUp className="h-4 w-4" aria-hidden="true" />
          Choose Taager file
          <input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => void pick(e)} disabled={busy} />
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
          <Link2 className="h-4 w-4" aria-hidden="true" />
          Live link with the Taager tab (keep this page open and signed in)
        </label>
      </div>
      {live && (
        <div className="rounded-2xl border border-dashed p-3 text-xs text-muted-foreground" role="status">
          {liveLog.length ? (
            <ul className="space-y-1">
              {liveLog.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          ) : (
            "Waiting for the Taager tab. Results for every country in the run are imported automatically."
          )}
        </div>
      )}

      {blocks.length > 0 && (
        <div className="space-y-3 rounded-2xl border bg-background p-4 text-sm">
          <p className="break-all font-semibold">{fileName}</p>
          <ul className="space-y-1">
            {blocks.map((p) => (
              <li key={p.market}>
                <b>{NAMES[p.market]}</b>: {p.stats.products} products · {p.stats.with_detail} with full detail · {p.stats.bundles} bundles · {p.errors.length} read errors in file
                {p.mode ? ` · ${p.mode} read` : ""}
              </li>
            ))}
          </ul>
          {pagesReady.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Taager information pages in this file: {pagesReady.map((p) => `${NAMES[p.market]} ${p.pages.length} pages, ${p.facts.length} rules read${p.facts.some((f) => f.decision === "pending") ? " (some differ from our figures)" : ""}`).join(" · ")}. They are stored with the import.
            </p>
          )}
          {blocks.some((p) => p.stats.skipped > 0) && <p className="text-xs text-muted-foreground">Lines without a SKU were skipped.</p>}
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={isFull} onChange={(e) => setIsFull(e.target.checked)} disabled={busy} className="mt-1" />
            <span>
              This file listed <b>every</b> Taager product for these countries (untick if you limited the number or stopped early).
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {mine && (
              <button type="button" onClick={() => void run([mine])} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileUp className="h-4 w-4" aria-hidden="true" />}
                {`Import ${mine.stats.products} products`}
              </button>
            )}
            {blocks.length > 1 && (
              <button type="button" onClick={() => void run(blocks)} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-full border px-5 font-semibold disabled:opacity-60">
                {`Import all ${blocks.length} countries`}
              </button>
            )}
          </div>
        </div>
      )}
      {busy && (
        <div className="space-y-1 text-sm">
          <p>
            Importing {progress.label}: {progress.done} / {progress.total}
          </p>
          <progress className="h-2 w-full" max={progress.total} value={progress.done} aria-label="Import progress" />
        </div>
      )}
      {done && (
        <p role="status" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Imported ({done}). The brain will use these numbers on its next run.
        </p>
      )}
      {pagesNote && (
        <p role="status" className="text-sm text-muted-foreground">
          {pagesNote} See "Taager's rules for this market" below.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
