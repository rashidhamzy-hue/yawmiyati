import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { CheckCircle2, FileUp, Loader2, PackageOpen } from "lucide-react";
import {
  importTaagerSync,
  parseTaagerSync,
  taagerImportClient,
  type ParsedTaagerSync,
  type TaagerCatalogSummary,
} from "@/lib/store/taager-import";
import type { MarketCode } from "@/lib/store/markets";

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

type Props = { market: MarketCode; origin: string; publicKey: string; token: string };

/** Owner drops the taager-sync-<country>-<date>.json file here; it is parsed locally and stored privately for the brain. */
export function TaagerImport({ market, origin, publicKey, token }: Props) {
  const client = useMemo(() => {
    try {
      return taagerImportClient(origin, publicKey, token);
    } catch {
      return null;
    }
  }, [origin, publicKey, token]);
  const [summary, setSummary] = useState<TaagerCatalogSummary | null>(null);
  const [parsed, setParsed] = useState<ParsedTaagerSync | null>(null);
  const [fileName, setFileName] = useState("");
  const [isFull, setIsFull] = useState(true);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const alive = useRef(true);
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
  useEffect(() => {
    setSummary(null);
    setParsed(null);
    setFileName("");
    setError("");
    setDone(false);
    setProgress(null);
    void load();
  }, [load]);

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    setParsed(null);
    setError("");
    setDone(false);
    if (!file) return;
    setFileName(file.name);
    try {
      const p = parseTaagerSync(await readText(file), market);
      if (!p.rows.length) throw Error("The file has no products in it.");
      setParsed(p);
      setIsFull(p.mode !== "quick");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function run() {
    if (!client || !parsed) return;
    setError("");
    setDone(false);
    try {
      const s = await importTaagerSync(client, parsed, isFull, (d, t) => {
        if (alive.current) setProgress({ done: d, total: t });
      });
      if (!alive.current) return;
      setSummary(s);
      setDone(true);
      setParsed(null);
    } catch (err) {
      if (alive.current) setError((err as Error).message);
    } finally {
      if (alive.current) setProgress(null);
    }
  }

  if (!client) return null;
  const busy = progress !== null;
  const last = summary?.last_sync;
  return (
    <section
      id="taager-import"
      aria-label="Taager catalogue import"
      className="scroll-mt-32 space-y-4 rounded-3xl border bg-card p-5 shadow-soft sm:p-6"
    >
      <div>
        <h2 className="inline-flex items-center gap-2 text-lg font-extrabold">
          <PackageOpen className="h-5 w-5 text-primary" aria-hidden="true" />
          Taager catalogue
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Upload the file the Taager sync button downloaded (taager-sync-{market}-….json). It is
          read in this browser and stored privately for the brain. Shoppers never see it.
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
          Last import {new Date(last.completed_at).toLocaleString("en-GB")} · {last.rows} products ·{" "}
          {last.is_full ? "full read" : "partial read"}
          {summary?.missing_from_last_full_sync
            ? ` · ${summary.missing_from_last_full_sync} stored products were not in the last full read (possibly removed by Taager)`
            : ""}
        </p>
      )}

      <label
        className={
          "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-5 text-sm font-semibold " +
          (busy ? "pointer-events-none opacity-50" : "")
        }
      >
        <FileUp className="h-4 w-4" aria-hidden="true" />
        Choose Taager file
        <input
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={(e) => void pick(e)}
          disabled={busy}
        />
      </label>

      {parsed && (
        <div className="space-y-3 rounded-2xl border bg-background p-4 text-sm">
          <p className="font-semibold break-all">{fileName}</p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <li>{parsed.stats.products} products</li>
            <li>{parsed.stats.with_detail} with full detail</li>
            <li>{parsed.stats.bundles} bundles</li>
            <li>{parsed.errors.length} read errors in file</li>
          </ul>
          {parsed.stats.skipped > 0 && (
            <p className="text-xs text-muted-foreground">
              {parsed.stats.skipped} lines without a SKU were skipped.
            </p>
          )}
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={isFull}
              onChange={(e) => setIsFull(e.target.checked)}
              disabled={busy}
              className="mt-1"
            />
            <span>
              This file read <b>every</b> Taager product for this country (untick if you limited the
              number).
            </span>
          </label>
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileUp className="h-4 w-4" aria-hidden="true" />
            )}
            {busy
              ? `Importing ${progress.done} / ${progress.total}`
              : `Import ${parsed.stats.products} products`}
          </button>
          {busy && (
            <progress
              className="h-2 w-full"
              max={progress.total}
              value={progress.done}
              aria-label="Import progress"
            />
          )}
        </div>
      )}
      {done && (
        <p
          role="status"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Imported. The brain will use these numbers on its next run.
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
