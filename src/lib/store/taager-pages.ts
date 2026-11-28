/**
 * Taager's information pages from an owner-run sync file (v5: `pages[<market>]`), prepared in the owner's browser:
 * cleaned of anything personal, read into structured facts, then sent to owner-only RPCs. Nothing here talks to Taager.
 */
import type { MarketCode } from "./markets";
import { cleanPages, extractMarketFacts, startingDecision, type ExtractedFact, type FactDecision, type InfoPage } from "../../../supabase/functions/_shared/brain/taager-facts";

export type PreparedPages = { market: MarketCode; pages: InfoPage[]; facts: (ExtractedFact & { decision: FactDecision })[] };
export type PagesImportResult = { pages_new: number; pages_changed: number; pages_unchanged: number; facts_changed: number; waiting: number; guards: Record<string, number> };
export type StoredRule = { id: string; key: string; value: Record<string, unknown>; summary: string; quote: string; source_path: string; source_read_at: string | null; confidence: "high" | "low"; decision: FactDecision; previous_value: Record<string, unknown> | null; changed_at: string | null };
export type RulesOverview = {
  facts: StoredRule[];
  pages: { path: string; title: string; version: number; read_at: string | null; imported_at: string; last_seen_at: string; characters: number }[];
  guards: { delivery_fee_minor: number; base_delivery_fee_minor: number; vat_added_profit_bps: number; refusal_charge_minor: number; undelivered_cost_minor: number } | null;
};
const MARKETS: MarketCode[] = ["sa", "ae", "om", "eg", "iq"];

/** Every market's pages in a sync file (object or text). Files without `pages` (v4 and older, or a repeat run within 20 hours) give an empty list. */
export function preparePages(input: string | unknown): PreparedPages[] {
  let data: unknown = input;
  if (typeof input === "string") { try { data = JSON.parse(input); } catch { return []; } }
  const pages = data && typeof data === "object" ? (data as { pages?: unknown }).pages : null;
  if (!pages || typeof pages !== "object" || Array.isArray(pages)) return [];
  const out: PreparedPages[] = [];
  for (const market of MARKETS) {
    const clean = cleanPages(market, (pages as Record<string, unknown>)[market]);
    if (!clean.length) continue;
    out.push({ market, pages: clean, facts: extractMarketFacts(market, clean).map((f) => ({ ...f, decision: startingDecision(market, f) })) });
  }
  return out;
}

export function taagerPagesClient(origin: string, publicKey: string, token: string, request: typeof fetch = fetch) {
  const base = new URL(origin);
  if (base.protocol !== "https:" || base.pathname !== "/" || !publicKey || !token) throw Error("Import configuration unavailable");
  const headers = { apikey: publicKey, authorization: "Bearer " + token, "content-type": "application/json" };
  async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
    const res = await request(new URL("/rest/v1/rpc/" + fn, base), { method: "POST", headers, body: JSON.stringify(body), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(60000) });
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { message?: string } | null, msg = typeof err?.message === "string" ? err.message : "";
      throw Error(res.status === 401 || res.status === 403 || msg === "forbidden" ? "Access denied: sign in again."
        : /Could not find the function|PGRST202/.test(msg) ? "Taager rules storage is not on this database yet (migration 20261201090000 not applied)."
        : msg ? "Taager pages: " + msg : "Taager pages request failed");
    }
    return res.json() as Promise<T>;
  }
  return {
    importPages: (p: PreparedPages) => rpc<PagesImportResult>("taager_pages_import", { p_store: p.market, p_pages: p.pages, p_facts: p.facts }),
    overview: (m: MarketCode) => rpc<RulesOverview>("taager_facts_overview", { p_store: m }),
    decide: (m: MarketCode, id: string, decision: "confirmed" | "rejected") => rpc<Record<string, number>>("taager_fact_decide", { p_store: m, p_fact: id, p_decision: decision }),
    versions: (m: MarketCode, path: string) => rpc<{ version: number; title: string; read_at: string | null; imported_at: string; text: string }[]>("taager_page_versions", { p_store: m, p_path: path }),
  };
}
/** Lines that are in the newer text and not in the older one, and the other way round (enough to see what a page changed). */
export function changedLines(older: string, newer: string): { added: string[]; removed: string[] } {
  const a = new Set(older.split("\n").map((l) => l.trim()).filter(Boolean)), b = new Set(newer.split("\n").map((l) => l.trim()).filter(Boolean));
  return { added: [...b].filter((l) => !a.has(l)).slice(0, 40), removed: [...a].filter((l) => !b.has(l)).slice(0, 40) };
}
