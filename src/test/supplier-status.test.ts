import { describe, it, expect } from "vitest";
import { normalizeWooStatus } from "../lib/store/supplier-status";
describe("Woo order states", () => {
  it("does not infer delivery or refusal from generic Woo status", () => {
    for (const s of ["completed","failed","refunded","custom-status"]) expect(normalizeWooStatus(s)).toBe("unknown");
  });
  it("recognizes basic workflow states", () => {
    expect(normalizeWooStatus("processing")).toBe("accepted");
    expect(normalizeWooStatus("on-hold")).toBe("pending");
    expect(normalizeWooStatus("cancelled")).toBe("cancelled");
  });
});
