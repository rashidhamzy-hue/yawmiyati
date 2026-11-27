import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  chunkRows,
  importTaagerSync,
  parseTaagerSync,
  taagerImportClient,
} from "@/lib/store/taager-import";
import { TaagerImport } from "@/components/owner/TaagerImport";

// Shape copied from a real taager-sync file (values shortened).
const file = (country = "IRQ", extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    source: "taager-merchant-sync",
    version: 3,
    market: "iq",
    country,
    started_at: "2026-11-27T05:00:00Z",
    finished_at: "2026-11-27T05:40:00Z",
    listing: [
      {
        productId: 8307,
        variantId: 9001,
        sku: "IQ030401KHAY99",
        name: "ماكينة خياطة",
        type: "product",
        financials: { price: 16000, profit: 2000, originalPrice: 14000 },
      },
      {
        productId: 22933,
        variantId: 27272,
        sku: "IQ030501MTTK99",
        name: "عرض مرتبة",
        type: "bundle",
        financials: { price: 70000, profit: 2000, originalPrice: 68000 },
      },
      {
        productId: 22933,
        variantId: 27272,
        sku: "IQ030501MTTK99",
        name: "duplicate line",
        type: "bundle",
        financials: {},
      },
      { productId: 5, sku: "" },
    ],
    details: {
      "8307": {
        productId: 8307,
        name: "ماكينة خياطة",
        country,
        type: "product",
        variants: [
          {
            sku: "IQ030401KHAY99",
            images: ["a.jpg"],
            financials: {
              price: 16000,
              discounts: [],
              tieredPricing: [{ quantity: 2, price: 25000, profit: 2000 }],
            },
          },
          { sku: "OTHER", images: [] },
        ],
      },
    },
    alternatives: { "8307": [{ sku: "IQ030401KHAY99", alternatives: [{ sku: "IQ999" }] }] },
    errors: [{ productId: 22933, error: "429" }],
    counts: { listing: 4, details: 1 },
    ...extra,
  });

afterEach(() => vi.unstubAllGlobals());

describe("Taager sync file parsing", () => {
  it("builds one row per SKU with that SKU's variant and alternatives", () => {
    const p = parseTaagerSync(file(), "iq");
    expect(p.rows.map((r) => r.sku)).toEqual(["IQ030401KHAY99", "IQ030501MTTK99"]);
    expect(p.stats).toMatchObject({
      products: 2,
      with_detail: 1,
      bundles: 1,
      with_alternatives: 1,
      skipped: 1,
    });
    const sewing = p.rows[0];
    expect((sewing.detail?.variant as { sku: string }).sku).toBe("IQ030401KHAY99");
    expect(sewing.detail?.variant_count).toBe(2);
    expect(sewing.detail).not.toHaveProperty("variants");
    expect(sewing.alternatives).toEqual([{ sku: "IQ999" }]);
    expect(p.rows[1].detail).toBeNull();
    expect(p.rows[1].name).toBe("duplicate line"); // last listing line for a SKU wins
    expect(p.errors).toHaveLength(1);
  });
  it("refuses another country's file and non-sync files", () => {
    expect(() => parseTaagerSync(file("SAU"), "iq")).toThrow(/for Saudi Arabia, not Iraq/);
    expect(() => parseTaagerSync("{}", "iq")).toThrow(/not a Taager sync file/);
    expect(() => parseTaagerSync("not json", "iq")).toThrow(/not valid JSON/);
  });
  it("chunks by row count and size", () => {
    const p = parseTaagerSync(file(), "iq");
    const many = Array.from({ length: 95 }, (_, i) => ({
      ...p.rows[0],
      sku: "IQ" + String(i).padStart(6, "0"),
    }));
    expect(chunkRows(many).map((c) => c.length)).toEqual([40, 40, 15]);
    expect(chunkRows(many, 100, 1).every((c) => c.length === 1)).toBe(true);
  });
});

describe("Taager import client", () => {
  it("begins, sends chunks with a retry, then finishes", async () => {
    const bodies: { fn: string; body: Record<string, unknown> }[] = [];
    let failOnce = true;
    const request = vi.fn(async (url: URL | string, init?: RequestInit) => {
      const fn = new URL(String(url)).pathname.split("/").pop()!;
      const body = JSON.parse(String(init?.body));
      bodies.push({ fn, body });
      expect((init?.headers as Record<string, string>).authorization).toBe("Bearer tok");
      if (fn === "taager_import_begin") return Response.json("batch-1");
      if (fn === "taager_import_rows") {
        if (failOnce) {
          failOnce = false;
          return new Response("", { status: 503 });
        }
        return Response.json(body.p_rows.length);
      }
      return Response.json({
        skus: 2,
        with_detail: 1,
        bundles: 1,
        price_changed_7d: 0,
        missing_from_last_full_sync: 0,
        last_sync: null,
      });
    }) as unknown as typeof fetch;
    const client = taagerImportClient("https://x.supabase.co", "pk", "tok", request);
    const progress: number[] = [];
    const s = await importTaagerSync(
      client,
      parseTaagerSync(file(), "iq"),
      true,
      (d) => progress.push(d),
      async () => {},
    );
    expect(s.skus).toBe(2);
    expect(bodies.map((b) => b.fn)).toEqual([
      "taager_import_begin",
      "taager_import_rows",
      "taager_import_rows",
      "taager_import_finish",
    ]);
    expect(bodies[0].body.p_meta).toMatchObject({
      country: "IRQ",
      is_full: true,
      listing_count: 2,
      detail_count: 1,
    });
    expect(progress).toEqual([0, 2]);
  });
  it("does not retry access errors", async () => {
    const request = vi.fn(async (url: URL | string) =>
      new URL(String(url)).pathname.endsWith("begin")
        ? Response.json("b")
        : Response.json({ message: "forbidden" }, { status: 400 }),
    ) as unknown as typeof fetch;
    const client = taagerImportClient("https://x.supabase.co", "pk", "tok", request);
    await expect(
      importTaagerSync(
        client,
        parseTaagerSync(file(), "iq"),
        true,
        () => {},
        async () => {},
      ),
    ).rejects.toThrow(/Access denied/);
    expect(request).toHaveBeenCalledTimes(2);
  });
});

describe("Taager import panel", () => {
  it("shows stored counts, previews a file and imports it", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL | string, init?: RequestInit) => {
        const fn = new URL(String(url)).pathname.split("/").pop()!;
        calls.push(fn);
        if (fn === "taager_import_begin") return Response.json("b1");
        if (fn === "taager_import_rows")
          return Response.json(JSON.parse(String(init?.body)).p_rows.length);
        const done = calls.includes("taager_import_finish");
        return Response.json({
          skus: done ? 2 : 0,
          with_detail: done ? 1 : 0,
          bundles: 0,
          price_changed_7d: 0,
          missing_from_last_full_sync: null,
          last_sync: done
            ? {
                id: "b1",
                completed_at: "2026-11-27T06:00:00Z",
                is_full: true,
                rows: 2,
                listing_count: 2,
                detail_count: 1,
                errors: 1,
              }
            : null,
        });
      }),
    );
    const { container } = render(
      <TaagerImport market="iq" origin="https://x.supabase.co" publicKey="pk" token="tok" />,
    );
    await waitFor(() => expect(calls).toContain("taager_catalog_summary"));
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File([file()], "taager-sync-iq-2026-11-27.json", { type: "application/json" })],
      },
    });
    const button = await screen.findByRole("button", { name: "Import 2 products" });
    expect(screen.getByText("1 read errors in file")).toBeInTheDocument();
    fireEvent.click(button);
    expect(await screen.findByText(/Imported\. The brain will use/)).toBeInTheDocument();
    expect(screen.getByText(/2 products · full read/)).toBeInTheDocument();
  });
  it("explains a wrong-country file", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          skus: 0,
          with_detail: 0,
          bundles: 0,
          price_changed_7d: 0,
          missing_from_last_full_sync: null,
          last_sync: null,
        }),
      ),
    );
    const { container } = render(
      <TaagerImport market="sa" origin="https://x.supabase.co" publicKey="pk" token="tok" />,
    );
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([file()], "taager-sync-iq.json")] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This file is for Iraq, not Saudi Arabia",
    );
  });
});
