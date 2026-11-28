// Minimal Anthropic Messages client for the brain: exact cost metering from
// the usage block, web search as a server tool, and JSON extraction.
// Prices: platform.claude.com/docs/en/about-claude/pricing (checked 26 Nov 2026).
// Rates are micro-USD per million tokens; web search is $10 per 1,000 searches.

type Rate = { input: number; output: number; cacheWrite: number; cacheRead: number };
const PRICES: Record<string, { base: Rate; longPrompt?: Rate; longPromptOver?: number }> = {
  "claude-haiku-5-5": {
    base: { input: 100_000, output: 500_000, cacheWrite: 125_000, cacheRead: 10_000 },
    longPrompt: { input: 500_000, output: 2_500_000, cacheWrite: 625_000, cacheRead: 50_000 }, longPromptOver: 100_000,
  },
  "claude-sonnet-5-5": { base: { input: 2_000_000, output: 10_000_000, cacheWrite: 2_500_000, cacheRead: 100_000 } },
  "claude-opus-5-5": { base: { input: 4_000_000, output: 20_000_000, cacheWrite: 5_000_000, cacheRead: 200_000 } },
};
export const WEB_SEARCH_MICROUSD = 10_000;

export type Usage = {
  input_tokens?: number; output_tokens?: number;
  cache_creation_input_tokens?: number; cache_read_input_tokens?: number;
  server_tool_use?: { web_search_requests?: number };
};
export type Metered = { model: string; input_tokens: number; output_tokens: number; cache_write_tokens: number; cache_read_tokens: number; web_searches: number; cost_microusd: number };

export function knownModel(model: string): boolean { return Object.prototype.hasOwnProperty.call(PRICES, model); }

export function costOf(model: string, u: Usage): Metered {
  const p = PRICES[model];
  if (!p) throw Error("unpriced_model:" + model);
  const input = u.input_tokens ?? 0, output = u.output_tokens ?? 0;
  const cw = u.cache_creation_input_tokens ?? 0, cr = u.cache_read_input_tokens ?? 0;
  const searches = u.server_tool_use?.web_search_requests ?? 0;
  const prompt = input + cw + cr;
  const r = p.longPrompt && p.longPromptOver && prompt > p.longPromptOver ? p.longPrompt : p.base;
  const tokenCost = (input * r.input + output * r.output + cw * r.cacheWrite + cr * r.cacheRead) / 1_000_000;
  return { model, input_tokens: input, output_tokens: output, cache_write_tokens: cw, cache_read_tokens: cr, web_searches: searches,
    cost_microusd: Math.ceil(tokenCost) + searches * WEB_SEARCH_MICROUSD };
}

export function addMetered(a: Metered, b: Metered): Metered {
  return { model: a.model, input_tokens: a.input_tokens + b.input_tokens, output_tokens: a.output_tokens + b.output_tokens,
    cache_write_tokens: a.cache_write_tokens + b.cache_write_tokens, cache_read_tokens: a.cache_read_tokens + b.cache_read_tokens,
    web_searches: a.web_searches + b.web_searches, cost_microusd: a.cost_microusd + b.cost_microusd };
}

/** Worst-case cost of one call, for the budget gate before spending. */
export function estimateMax(model: string, promptTokens: number, maxOutput: number, maxSearches: number, searchResultTokens = 9000): number {
  return costOf(model, { input_tokens: promptTokens + maxSearches * searchResultTokens, output_tokens: maxOutput,
    server_tool_use: { web_search_requests: maxSearches } }).cost_microusd;
}

type Block = { type: string; text?: string; content?: unknown; [k: string]: unknown };
export type CallResult = { text: string; blocks: Block[]; metered: Metered; stop_reason: string; searchedUrls: string[] };

export async function callClaude(opts: {
  apiKey: string; model: string; system: string; user: string; maxTokens: number;
  webSearch?: { maxUses: number; country: string }; temperature?: number; fetchImpl?: typeof fetch; timeoutMs?: number;
  /** Pictures (https URLs) placed before the text, for classification only. */
  images?: string[];
}): Promise<CallResult> {
  const f = opts.fetchImpl ?? fetch;
  const tools = opts.webSearch ? [{ type: "web_search_20250305", name: "web_search", max_uses: opts.webSearch.maxUses,
    user_location: { type: "approximate", country: opts.webSearch.country } }] : undefined;
  const first: unknown = opts.images?.length
    ? [...opts.images.map((url) => ({ type: "image", source: { type: "url", url } })), { type: "text", text: opts.user }] : opts.user;
  let messages: { role: string; content: unknown }[] = [{ role: "user", content: first }];
  let metered: Metered = costOf(opts.model, {});
  const blocks: Block[] = [];
  let stop = "";
  // Long server-tool turns may pause; continue at most twice.
  for (let turn = 0; turn < 3; turn++) {
    const res = await f("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: opts.model, max_tokens: opts.maxTokens, system: opts.system, messages,
        ...(tools ? { tools } : {}), ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}) }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 90_000),
    });
    const body = await res.json().catch(() => null) as { content?: Block[]; usage?: Usage; stop_reason?: string; error?: { message?: string } } | null;
    if (!res.ok || !body) throw Error("anthropic_http_" + res.status + (body?.error?.message ? ": " + body.error.message.slice(0, 200) : ""));
    metered = addMetered(metered, costOf(opts.model, body.usage ?? {}));
    const content = body.content ?? [];
    blocks.push(...content);
    stop = body.stop_reason ?? "";
    if (stop !== "pause_turn") break;
    messages = [...messages, { role: "assistant", content }];
  }
  const text = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  const searchedUrls = blocks.filter((b) => b.type === "web_search_tool_result" && Array.isArray(b.content))
    .flatMap((b) => (b.content as { url?: string }[]).map((r) => r.url).filter((u): u is string => typeof u === "string"));
  return { text, blocks, metered, stop_reason: stop, searchedUrls };
}

/** The last JSON object in the model's text (```json fenced or bare). */
export function extractJson(text: string): unknown {
  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  const candidates = fenced.length ? fenced.reverse() : [];
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start >= 0 && end > start) candidates.push(text.slice(start, end + 1));
  for (const c of candidates) { try { return JSON.parse(c.trim()); } catch { /* next */ } }
  throw Error("no_json_in_model_output");
}
