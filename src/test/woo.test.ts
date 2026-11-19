import { describe, expect, it, vi } from "vitest";
import { createWooReader } from "../lib/store/woo.server";
const config = { market: "sa" as const, origin: "https://woo.example.com", consumerKey: "fake-key", consumerSecret: "fake-secret" };
describe("Woo reader", () => {
  it("uses HTTPS, headers, bounded pages and rejects redirects", async () => {
    const request = vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) => new Response("[]"));
    const reader = createWooReader(config, request);
    expect(await reader.listProducts()).toEqual({ market: "sa", records: [] });
    const [url, init] = request.mock.calls[0];
    expect(String(url)).toBe("https://woo.example.com/wp-json/wc/v3/products?page=1&per_page=50");
    expect(init?.redirect).toBe("error");
    expect(init?.method).toBe("GET");
    expect(init?.headers).toHaveProperty("Authorization");
    await expect(reader.listOrders(0)).rejects.toThrow();
  });
  it("rejects insecure origin and invalid responses", async () => {
    expect(() => createWooReader({...config, origin:"http://woo.example.com"})).toThrow();
    const reader = createWooReader(config, async () => new Response("{}"));
    await expect(reader.listOrders()).rejects.toThrow("Invalid Woo response");
  });
});
