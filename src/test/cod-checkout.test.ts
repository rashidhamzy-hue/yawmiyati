import {describe,it,expect} from "vitest";
import {normalizePhone,validateCod} from "../lib/store/cod-checkout";
describe("COD checkout rules",()=>{
 it("normalises local, international and Arabic-digit mobiles per market",()=>{
  expect(normalizePhone("sa","0551234567")).toBe("+966551234567");
  expect(normalizePhone("sa","+966 55 123 4567")).toBe("+966551234567");
  expect(normalizePhone("sa","٠٥٥١٢٣٤٥٦٧")).toBe("+966551234567");
  expect(normalizePhone("ae","00971501234567")).toBe("+971501234567");
  expect(normalizePhone("om","91234567")).toBe("+96891234567");
  expect(normalizePhone("eg","01012345678")).toBe("+201012345678");
  expect(normalizePhone("iq","07701234567")).toBe("+9647701234567");
 });
 it("rejects landlines, short numbers and other countries' mobiles",()=>{
  expect(normalizePhone("sa","0112345678")).toBeNull();
  expect(normalizePhone("sa","055123")).toBeNull();
  expect(normalizePhone("eg","0551234567")).toBeNull();
  expect(normalizePhone("iq","01012345678")).toBeNull();
 });
 it("asks only for what delivery needs, with Arabic messages",()=>{
  const ok={name:"نورة أحمد",phone:"0551234567",city:"الرياض",address:"حي النرجس، شارع ١٢، مبنى ٤",notes:""};
  expect(validateCod("sa",ok)).toEqual({});
  const bad=validateCod("sa",{name:"ن",phone:"123",city:"",address:"قصير",notes:""});
  expect(Object.keys(bad).sort()).toEqual(["address","city","name","phone"]);
  expect(bad.phone).toContain("05xxxxxxxx");
 });
});
