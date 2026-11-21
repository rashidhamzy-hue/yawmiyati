import {describe,it,expect} from "vitest";
import {formatObservedSupplierPrice} from "../lib/store/owner-dashboard-presentation";
describe("M6B exact supplier observation display",()=>{
 it("preserves observed prices without converting large integers to floats",()=>{
  expect(formatObservedSupplierPrice("sa","9007199254740993")).toBe("90,071,992,547,409.93 SAR");
  expect(formatObservedSupplierPrice("om","123456789012345678")).toBe("123,456,789,012,345.678 OMR");
  expect(formatObservedSupplierPrice("iq","7000000")).toBe("7,000.000 IQD");
  expect(formatObservedSupplierPrice("eg","9500")).toBe("95.00 EGP");
  expect(formatObservedSupplierPrice("ae","1900")).toBe("19.00 AED");
 });
 it("does not fabricate or crash on malformed/unknown supplier observations",()=>{
  expect(formatObservedSupplierPrice("sa",null)).toBe("Unknown");
  expect(formatObservedSupplierPrice("sa","12.50")).toBe("Unknown (invalid observation)");
  expect(formatObservedSupplierPrice("sa","-1")).toBe("Unknown (invalid observation)");
  expect(formatObservedSupplierPrice("sa","NaN")).toBe("Unknown (invalid observation)");
  expect(formatObservedSupplierPrice("sa","100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000")).toBe("Unknown (invalid observation)");
 });
});