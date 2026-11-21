import { describe, expect, it } from "vitest";
import { demoCatalog, demoDate } from "../lib/store/offer-selection-demo";
import { selectOffers } from "../lib/store/offer-selection";
import { markets, type MarketCode } from "../lib/store/markets";

describe("offline offer selection", () => {
  it("uses distinct offer families and keeps uncertain contents on hold across all five markets", () => {
    for (const market of Object.keys(markets) as MarketCode[]) {
      const {offers, reportedTotal} = demoCatalog(market);
      const result = selectOffers(market, offers, reportedTotal, demoDate);
      expect(result.selected.map(row => row.offer.sku).sort()).toEqual(["DEMO-KIT", market === "iq" ? "DEMO-R2" : "DEMO-R3"]);
      expect(result.evaluated.find(row => row.offer.sku === "DEMO-X")?.reasons).toContain("unverified_components");
      expect(result.coverage).toBe(market === "om" ? "unknown" : market === "ae" ? "partial" : "complete");
    }
  });
  it("evaluates all offers before applying a family limit", () => {
    const {offers} = demoCatalog("sa");
    const result = selectOffers("sa", [...offers].reverse(), 5, demoDate, 1);
    expect(result.selected.map(row => row.offer.sku)).toEqual(["DEMO-R3"]);
    expect(result.evaluated.length).toBe(5);
  });
  it("blocks pricing, research and stock evidence failures", () => {
    const [offer] = demoCatalog("sa").offers;
    const input = {...offer, sellerFloor: offer.economics.price! + 1, observations: [], stockVerifiedAt: undefined,
      competitor: null, economics: {...offer.economics, adCost: null}};
    expect(selectOffers("sa",[input],null,demoDate).evaluated[0].reasons).toEqual(expect.arrayContaining([
      "missing_or_unmet_price_floor","missing_local_comparison","incomplete_research","stale_or_unverified_stock","missing_adCost",
    ]));
  });
  it("rejects duplicate SKUs and cross-market input", () => {
    const [offer] = demoCatalog("sa").offers;
    expect(() => selectOffers("sa",[offer,offer],2,demoDate)).toThrow();
    expect(() => selectOffers("om",[offer],1,demoDate)).toThrow();
  });
});
