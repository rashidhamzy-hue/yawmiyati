import type { MarketCode } from "./markets";

export interface WooConfig {
  market: MarketCode;
  origin: string;
  consumerKey: string;
  consumerSecret: string;
}

export function createWooReader(config: WooConfig, request: typeof fetch = fetch) {
  const origin = new URL(config.origin);
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("Invalid Woo origin");
  if (!config.consumerKey || !config.consumerSecret) throw new Error("Missing Woo credentials");
  // Configuration must come from trusted server secrets, never customer input.
  const authorization = "Basic " + btoa(config.consumerKey + ":" + config.consumerSecret);
  async function read(resource: "products" | "orders", page: number) {
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw new Error("Invalid page");
    const url = new URL("/wp-json/wc/v3/" + resource, origin);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", "50");
    const response = await request(url, {
      method: "GET", headers: { Authorization: authorization, Accept: "application/json" },
      redirect: "error", signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("Woo request failed: " + response.status);
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error("Invalid Woo response");
    return { market: config.market, records: data as unknown[] };
  }
  return { listProducts: (page = 1) => read("products", page), listOrders: (page = 1) => read("orders", page) };
}
