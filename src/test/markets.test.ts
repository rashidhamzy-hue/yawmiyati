import { describe, expect, it } from "vitest";
import { markets, parseMinorUnits, calculateSubtotal } from "../lib/store/markets";

describe("market money", () => {
  it("defines all five isolated market currencies", () => {
    expect(Object.values(markets).map(m => m.currency)).toEqual(["SAR", "AED", "OMR", "EGP", "IQD"]);
  });
  it("converts decimal strings exactly", () => {
    expect(parseMinorUnits("sa", "59.90")).toBe(5990);
    expect(parseMinorUnits("om", "1.005")).toBe(1005);
    expect(parseMinorUnits("iq", "25000")).toBe(25000000);
  });
  it("rejects malformed and excessive precision", () => {
    for (const value of ["-1", "1e3", "1.001", "NaN", "9007199254740992"]) {
      expect(() => parseMinorUnits("sa", value)).toThrow();
    }
  });
  it("computes integer subtotals and rejects invalid quantities", () => {
    expect(calculateSubtotal([{ unitMinor: 5990, quantity: 2 }])).toBe(11980);
    for (const quantity of [0, -1, 1.5, Infinity]) {
      expect(() => calculateSubtotal([{ unitMinor: 100, quantity }])).toThrow();
    }
    expect(() => calculateSubtotal([{ unitMinor: Number.MAX_SAFE_INTEGER, quantity: 2 }])).toThrow();
  });
});
