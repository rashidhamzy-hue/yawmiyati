import { describe,it,expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyWooWebhook } from "../lib/store/webhook.server";
import { compareOrderSnapshots } from "../lib/store/reconciliation";
import { recordedNetMinor } from "../lib/store/finance";
describe("commerce safeguards",()=>{
 it("verifies raw bytes and rejects tampering",()=>{
  const body=Buffer.from('{"id":1}');
  const sig=createHmac("sha256","test").update(body).digest("base64");
  expect(verifyWooWebhook(body,sig,"test")).toBe(true);
  expect(verifyWooWebhook(Buffer.from('{"id":2}'),sig,"test")).toBe(false);
  expect(verifyWooWebhook(body,sig,"wrong")).toBe(false);
 });
 it("reports discrepancies without changing orders",()=>{
  expect(compareOrderSnapshots([{id:"1",status:"pending"},{id:"2",status:"pending"}],[{id:"1",status:"accepted"},{id:"3",status:"unknown"}])).toEqual([{id:"1",kind:"status_mismatch"},{id:"2",kind:"missing_remote"},{id:"3",kind:"unmapped_remote"}]);
 });
 it("uses exact signed arithmetic and rejects mixed currencies",()=>{
  expect(recordedNetMinor([{amountMinor:"10000",currency:"SAR"},{amountMinor:"-7000",currency:"SAR"}],"SAR")).toBe("3000");
  expect(()=>recordedNetMinor([{amountMinor:"1",currency:"AED"}],"SAR")).toThrow();
 });
});
