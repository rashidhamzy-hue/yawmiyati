/* eslint-disable @typescript-eslint/no-explicit-any -- brain JSON payloads are rendered defensively */
/** Owner-dashboard client for the Yawmiyati Brain (RPCs + the yawmiyati-brain edge function). */
import { markets, type MarketCode } from "./markets";

export type BrainRun = {
  id: string; stage: string; status: "running" | "paused_budget" | "awaiting_review" | "done" | "failed" | "cancelled";
  progress: { ingested?: number; woo_total_products?: number | null; researched?: number; content_written?: number };
  summary: { capability?: any; prefilter?: any; decision?: any; cost?: any; merchandising?: any }; error: string | null; created_at: string; finished_at: string | null;
};
export type BrainSettings = { autopilot_enabled: boolean; daily_budget_microusd: number; research_model: string; content_model: string; shortlist_size: number; selection_size: number; field_mapping: Record<string, unknown> };
export type BrainOverview = {
  settings: BrainSettings; spent_today_microusd: number; runs: BrainRun[]; latest_run_id: string | null;
  capability: any | null; cost: { total_microusd: number; web_searches: number; by_step: Record<string, number> } | null; counts: Record<string, number>;
};
export type BrainItem = {
  product_id: number; variation_id: number; title: string; family_key: string | null; offer_kind: string; category: string | null; stage: string;
  prefilter_score: number | null; score: number | null; economics: any; research: any | null; decision: any | null;
  content: any | null; merchandising: any | null; reasons: string[]; flags: string[]; cost_microusd: number;
  owner_decision: "approved" | "rejected" | null;
};

export function brainClient(origin: string, publicKey: string, token: string, request: typeof fetch = fetch) {
  const base = new URL(origin);
  if (base.protocol !== "https:" || base.pathname !== "/" || !publicKey || !token) throw Error("Brain configuration unavailable");
  const headers = { apikey: publicKey, authorization: "Bearer " + token, "content-type": "application/json" };
  const assertMarket = (m: MarketCode) => { if (!Object.hasOwn(markets, m)) throw Error("Invalid market"); };
  async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
    const res = await request(new URL("/rest/v1/rpc/" + fn, base), { method: "POST", headers, body: JSON.stringify(body), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw Error(res.status === 401 || res.status === 403 ? "Access denied" : "Brain request failed");
    return res.json() as Promise<T>;
  }
  async function action<T>(market: MarketCode, act: string, extra: Record<string, unknown> = {}): Promise<T> {
    assertMarket(market);
    const res = await request(new URL("/functions/v1/yawmiyati-brain", base), { method: "POST", headers, body: JSON.stringify({ store: market, action: act, ...extra }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(170000) });
    const data = await res.json().catch(() => ({ error: "Invalid brain response" }));
    if (!res.ok) throw Error(typeof data?.error === "string" ? data.error : "Brain request failed");
    return data as T;
  }
  return {
    overview: (m: MarketCode) => { assertMarket(m); return rpc<BrainOverview>("brain_dashboard", { p_store: m }); },
    items: (m: MarketCode, run: string, stage: string | null, offset = 0) => { assertMarket(m); return rpc<BrainItem[] | null>("brain_analysis_page", { p_store: m, p_run: run, p_stage: stage, p_offset: offset }).then((x) => x ?? []); },
    decide: (m: MarketCode, run: string, decision: "approved" | "rejected", items: { product_id: number; variation_id: number }[] | null) => { assertMarket(m); return rpc<number>("brain_decide", { p_store: m, p_run: run, p_decision: decision, p_items: items }); },
    updateSettings: (m: MarketCode, patch: Partial<Pick<BrainSettings, "autopilot_enabled" | "daily_budget_microusd" | "shortlist_size" | "selection_size">>) => { assertMarket(m); return rpc<BrainSettings>("brain_update_settings", { p_store: m, p_patch: patch }); },
    testWoo: (m: MarketCode) => action<{ ok: boolean; error?: string; products_total?: number | null; currency?: string | null; expected_currency?: string }>(m, "test_woo"),
    testAi: (m: MarketCode) => action<{ ok: boolean; error?: string; cost_microusd?: number }>(m, "test_ai"),
    start: (m: MarketCode) => action<{ run: BrainRun; note?: string }>(m, "start"),
    step: (m: MarketCode, run: string) => action<{ run: BrainRun; spent_today_microusd: number }>(m, "step", { run_id: run }),
    resume: (m: MarketCode, run: string) => action<{ run: BrainRun | null }>(m, "resume", { run_id: run }),
    cancel: (m: MarketCode, run: string) => action<{ run: BrainRun | null }>(m, "cancel", { run_id: run }),
  };
}

export const BRAIN_STAGES = [
  ["ingest", "Read Taager catalogue"], ["audit", "Capability audit"], ["prefilter", "Shortlist"], ["research", "Market research"],
  ["decide", "Price & pick"], ["content", "Write pages"], ["merchandise", "Merchandise"], ["review", "Your review"],
] as const;

export const usd = (micro: number | null | undefined) => "$" + ((micro ?? 0) / 1e6).toFixed((micro ?? 0) < 100000 ? 3 : 2);
export function money(minor: number | null | undefined, market: MarketCode) {
  if (minor === null || minor === undefined) return "—";
  const d = markets[market].minorDigits;
  const v = minor / 10 ** d;
  return v.toLocaleString("en-US", { maximumFractionDigits: d === 3 && markets[market].currency === "IQD" ? 0 : 2 }) + " " + markets[market].currency;
}
