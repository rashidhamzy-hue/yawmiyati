import { describe, expect, it } from "vitest";
import { fixtureOfferInputs, fixtureOfferVersions } from "@/fixtures/storefront-offers";
import {
  buildOfferVersion, offerInputsDigest, parseOfferVersion, parseStoredCart, priceOfferCart,
  exactUnitPrice, type ApprovedOfferVersion, type OfferCart, type OwnerOfferInput,
} from "@/lib/store/offer-version";
import type { MarketCode } from "@/lib/store/markets";

const markets: MarketCode[] = ["sa", "ae", "om", "eg", "iq"];
const input = (m: MarketCode, slug: string) => fixtureOfferInputs(m).find(i => i.slug === slug)!;
const version = (m: MarketCode, slug: string) => fixtureOfferVersions(m).versions.find(v => v.slug === slug)!;
const approve = (i: OwnerOfferInput): OwnerOfferInput => ({ ...i, approval: { revision: 1, approved_at: "2026-11-22T07:30:00Z", approved_inputs_digest: offerInputsDigest(i) } });
const zonePacks = (v: ApprovedOfferVersion, zone = "z1") => v.zones.find(z => z.zone_id === zone)!.pack_ids;

describe("M12 owner gates produce approved offer versions", () => {
  it("publishes every fixture whose approval matches and withholds the stale one", () => {
    for (const m of markets) {
      const { versions, withheld } = fixtureOfferVersions(m);
      expect(versions.every(v => v.market === m && v.currency)).toBe(true);
      if (m === "iq") expect(withheld).toEqual([{ slug: "milk-frother", reasons: ["approval_stale"] }]);
      else expect(withheld).toEqual([]);
    }
  });

  it("invalidates approval when any critical input changes", () => {
    const i = input("sa", "spice-rack");
    expect(buildOfferVersion(i).status).toBe("publishable");
    const changed = { ...i, packs: i.packs.map(p => p.pack_id === "single" ? { ...p, cost_minor: p.cost_minor! + 1 } : p) };
    const result = buildOfferVersion(changed);
    expect(result.status).toBe("blocked");
    expect(result.status === "blocked" && result.reasons).toContain("approval_stale");
    expect(buildOfferVersion({ ...i, approval: null }).status).toBe("blocked");
  });

  it("keeps one option per verified composition and diverges by market evidence", () => {
    expect(zonePacks(version("sa", "spice-rack"))).toEqual(["single", "pair-pack", "rack-hook-kit"]);
    // Oman: two-pack cost is higher, so the quantity tier holds the two-unit slot.
    expect(zonePacks(version("om", "spice-rack"))).toEqual(["single", "pair-tier", "rack-hook-kit"]);
    // Iraq: two-pack SKU out of stock.
    expect(zonePacks(version("iq", "spice-rack"))).toEqual(["single", "pair-tier", "rack-hook-kit"]);
  });

  it("offers add-ons only when margin-qualified and eligible in that zone", () => {
    expect(version("sa", "spice-rack").add_ons.map(a => [a.add_on_id, a.zone_ids])).toEqual([["hook", ["z1"]]]);
    // UAE kit lowers expected contribution versus the single rack: no add-on, kit not listed.
    const ae = version("ae", "spice-rack");
    expect(ae.add_ons).toEqual([]);
    expect(ae.packs.map(p => p.pack_id)).not.toContain("rack-hook-kit");
    // Egypt: kit priced above the matched local comparison in zone 3 only.
    expect(version("eg", "hair-brush").add_ons.map(a => a.zone_ids)).toEqual([["z1", "z2"]]);
    expect(zonePacks(version("eg", "hair-brush"), "z3")).toEqual(["single"]);
  });

  it("blocks below-floor, unverified, stale-stock and over-comparison packs", () => {
    const base = input("sa", "milk-frother");
    const pack = base.packs[0]!;
    const cases: [Partial<typeof pack>, string][] = [
      [{ price_minor: pack.floor_minor! - 1 }, "below_floor"],
      [{ components: null }, "unverified_components"],
      [{ stock_checked_at: "2026-11-20T00:00:00Z" }, "stale_stock"],
      [{ cost_minor: null }, "missing_cost"],
      [{ comparison: { ...pack.comparison!, door_minor_by_zone: { z1: 1 } } }, "above_comparable_delivered_price"],
    ];
    for (const [change, reason] of cases) {
      const r = buildOfferVersion(approve({ ...base, packs: [{ ...pack, ...change }] }));
      expect(r.status).toBe("blocked");
      expect(r.evaluation[0]!.reasons).toContain(reason);
    }
  });

  it("never exposes cost, floor or stock in the public contract", () => {
    const json = JSON.stringify(markets.flatMap(m => fixtureOfferVersions(m).versions));
    for (const key of ["cost_minor", "floor_minor", "stock", "freight_cost_minor", "comparison", "expected"]) expect(json).not.toContain('"' + key);
  });
});

describe("M12 public parser and five-country isolation", () => {
  it("rejects another market's version, currency or slug", () => {
    const sa = version("sa", "spice-rack");
    expect(() => parseOfferVersion(sa, "ae")).toThrow(/market_or_currency/);
    expect(() => parseOfferVersion({ ...sa, currency: "AED" }, "sa")).toThrow();
    expect(() => parseOfferVersion(sa, "sa", "milk-frother")).toThrow(/slug/);
    expect(() => parseOfferVersion({ ...sa, packs: sa.packs.map(p => ({ ...p, price_minor: "12.5" })) }, "sa")).toThrow(/pack_price/);
    expect(() => parseOfferVersion({ ...sa, add_ons: [{ ...sa.add_ons[0]!, zone_ids: ["z9"] }] }, "sa")).toThrow();
  });

  it("discards a stored cart from another market", () => {
    const stored = { market: "sa", zone_id: "z1", lines: [{ listing_id: "fx-sa-spice-rack", slug: "spice-rack", version_id: "x@r1", revision: 1, pack_id: "single", add_on_id: null }] };
    expect(parseStoredCart(stored, "ae").lines).toEqual([]);
    expect(parseStoredCart(stored, "sa").lines).toHaveLength(1);
    expect(() => priceOfferCart({ market: "ae", zone_id: null, lines: [] }, [version("sa", "spice-rack")])).toThrow(/Cross-market/);
  });
});

describe("M12 exact total at the door", () => {
  const line = (v: ApprovedOfferVersion, pack_id: string, add_on_id: string | null = null) =>
    ({ listing_id: v.listing_id, slug: v.slug, version_id: v.version_id, revision: v.revision, pack_id, add_on_id });

  it("adds each line's price and its own delivery in integer minor units", () => {
    const rack = version("sa", "spice-rack"), frother = version("sa", "milk-frother");
    const cart: OfferCart = { market: "sa", zone_id: "z1", lines: [line(rack, "rack-hook-kit", "hook"), line(frother, "single")] };
    const priced = priceOfferCart(cart, [rack, frother]);
    expect(priced.lines.map(l => l.door_minor)).toEqual([10905n, 7850n]);
    expect(priced.total_door_minor).toBe(18755n);
    expect(priced.checkoutReady).toBe(true);
  });

  it("handles three-decimal currencies exactly", () => {
    const rack = version("iq", "spice-rack");
    const priced = priceOfferCart({ market: "iq", zone_id: null, lines: [line(rack, "pair-tier")] }, [rack]);
    expect(priced.total_door_minor).toBe(38_940_000n + 5_000_000n);
    expect(exactUnitPrice(rack.packs.find(p => p.pack_id === "pair-tier")!)).toBe(19_470_000n);
    const om = version("om", "spice-rack");
    expect(priceOfferCart({ market: "om", zone_id: "z1", lines: [line(om, "single")] }, [om]).total_door_minor).toBe(8000n);
  });

  it("re-prices by zone and blocks lines that are stale or unavailable there", () => {
    const brush = version("eg", "hair-brush");
    const kit = line(brush, "brush-clip-kit", "clip");
    expect(priceOfferCart({ market: "eg", zone_id: "z2", lines: [kit] }, [brush]).total_door_minor).toBe(81500n);
    const z3 = priceOfferCart({ market: "eg", zone_id: "z3", lines: [kit] }, [brush]);
    expect(z3.lines[0]!.status).toBe("unavailable_in_zone");
    expect(z3.checkoutReady).toBe(false);
    expect(priceOfferCart({ market: "eg", zone_id: null, lines: [kit] }, [brush]).checkoutReady).toBe(false);
    const stale = priceOfferCart({ market: "eg", zone_id: "z1", lines: [{ ...kit, revision: 2 }] }, [brush]);
    expect(stale.lines[0]!.status).toBe("changed");
    expect(stale.total_door_minor).toBe(0n);
    // A kit reachable only via an add-on cannot be put in the cart without it.
    expect(priceOfferCart({ market: "eg", zone_id: "z1", lines: [{ ...kit, add_on_id: null }] }, [brush]).lines[0]!.status).toBe("changed");
  });
});
