import {describe,it,expect,vi} from "vitest";
import {markets,parseMinorUnits} from "../lib/store/markets";
import {createFiveMarketFixtures,createSyntheticCatalog,syntheticShippingMinor,SIMULATION_MODE} from "../lib/store/simulation/fixtures";
import {createOfflineCommerceSandbox} from "../lib/store/simulation/offline-commerce";

const all=["sa","ae","om","eg","iq"] as const;
const readyLine=(market:typeof all[number])=>{
 const product=createSyntheticCatalog(market).find(p=>p.variants.some(v=>v.stock==="available"&&v.availableUnits>0))!;
 const variant=product.variants.find(v=>v.stock==="available"&&v.availableUnits>0)!;
 return {sku:product.sku,variantSku:variant.sku,quantity:1};
};
describe("offline five-market infrastructure",()=>{
 it("creates 30 visibly synthetic products and 60 variants per country",()=>{
  const db=createFiveMarketFixtures();
  expect(db.mode).toBe("SIMULATION_ONLY");
  const keys=new Set<string>();
  for(const market of all){
   expect(db.products[market]).toHaveLength(30);
   for(const product of db.products[market]){
    expect(product.kind).toBe("simulation_product");
    expect(product.synthetic).toBe(true);
    expect(product.mayPublish).toBe(false);
    expect(product.evidence).toBe("synthetic_fixture");
    expect(product.market).toBe(market);
    expect(product.currency).toBe(markets[market].currency);
    expect(product.title).toContain("[تجريبي]");
    expect(product.variants).toHaveLength(2);
    expect(keys.has(product.sku)).toBe(false);
    keys.add(product.sku);
   }
  }
  expect(keys.size).toBe(150);
 });
 it("uses exact minor-unit shipping arithmetic for five countries",()=>{
  expect(syntheticShippingMinor("sa")).toBe(parseMinorUnits("sa","28"));
  expect(syntheticShippingMinor("ae")).toBe(parseMinorUnits("ae","19"));
  expect(syntheticShippingMinor("om")).toBe(3000);
  expect(syntheticShippingMinor("eg")).toBe(6000); // mock amount, NOT Egypt delivery policy
  expect(syntheticShippingMinor("iq")).toBe(7000000);
 });
 it("has deterministic fixtures and no random supplier evidence",()=>{
  expect(createFiveMarketFixtures()).toEqual(createFiveMarketFixtures());
  expect(JSON.stringify(createFiveMarketFixtures())).not.toMatch(/@|\+966\d{8}|https:\/\/.*woo/);
 });
 it("quotes a valid simulated SKU with currency and no supplier permission",()=>{
  const s=createOfflineCommerceSandbox();
  for(const market of all){
   const result=s.quote(market,[readyLine(market)]);
   expect(result.synthetic).toBe(true);
   expect(result.maySubmitToSupplier).toBe(false);
   expect(result.currency).toBe(markets[market].currency);
   expect(result.totalMinor).toBe(result.subtotalMinor+result.shippingMinor);
  }
 });
 it("rejects cross-country items, invalid variants and unknown/zero-stock fixtures",()=>{
  const s=createOfflineCommerceSandbox();
  expect(()=>s.quote("eg",[readyLine("sa")])).toThrow("unknown_or_cross_market_sku");
  const x=readyLine("sa");
  expect(()=>s.quote("sa",[{...x,variantSku:"NOT-REAL"}])).toThrow("unknown_variant");
  const product=s.catalog("sa").find(p=>p.variants.some(v=>v.stock!=="available"))!;
  const variant=product.variants.find(v=>v.stock!=="available")!;
  expect(()=>s.quote("sa",[{sku:product.sku,variantSku:variant.sku,quantity:1}])).toThrow("stock_not_verified_in_fixture");
  for(const quantity of [0,-1,1.5,21]){
   expect(()=>s.quote("sa",[{...x,quantity}])).toThrow("invalid_quantity");
  }
 });
 it("never places an order unless explicit simulation capability is provided",()=>{
  const s=createOfflineCommerceSandbox();
  expect(()=>s.place({mode:"LIVE" as typeof SIMULATION_MODE,market:"sa",clientRequestId:"request-01",lines:[readyLine("sa")]})).toThrow("simulation_mode_required");
  expect(s.snapshot("sa")).toHaveLength(0);
 });
 it("is idempotent within market and rejects conflicting replays",()=>{
  const s=createOfflineCommerceSandbox();
  const input={mode:SIMULATION_MODE,market:"sa" as const,clientRequestId:"request-01",lines:[readyLine("sa")]};
  const a=s.place(input);
  const b=s.place(input);
  expect(a.id).toBe(b.id);
  expect(s.snapshot("sa")).toHaveLength(1);
  expect(()=>s.place({...input,lines:[{...readyLine("sa"),quantity:2}]})).toThrow("idempotency_payload_conflict");
  expect(s.snapshot("sa")).toHaveLength(1);
 });
 it("scopes identical idempotency keys to different markets",()=>{
  const s=createOfflineCommerceSandbox();
  const a=s.place({mode:SIMULATION_MODE,market:"sa",clientRequestId:"same-key",lines:[readyLine("sa")]});
  const b=s.place({mode:SIMULATION_MODE,market:"iq",clientRequestId:"same-key",lines:[readyLine("iq")]});
  expect(a.id).not.toBe(b.id);
  expect(s.get("sa",b.id)).toBeNull();
  expect(s.get("iq",a.id)).toBeNull();
 });
 it("keeps events synthetic, rejects duplicate/reordered states and cross-market edits",()=>{
  const s=createOfflineCommerceSandbox();
  const created=s.place({mode:SIMULATION_MODE,market:"ae",clientRequestId:"request-02",lines:[readyLine("ae")]});
  expect(()=>s.transition({mode:SIMULATION_MODE,market:"eg",orderId:created.id,to:"accepted",eventId:"event-1"})).toThrow("order_not_found_or_cross_market");
  expect(()=>s.transition({mode:SIMULATION_MODE,market:"ae",orderId:created.id,to:"delivered",eventId:"event-1"})).toThrow("invalid_transition");
  const accepted=s.transition({mode:SIMULATION_MODE,market:"ae",orderId:created.id,to:"accepted",eventId:"event-1"});
  const duplicate=s.transition({mode:SIMULATION_MODE,market:"ae",orderId:created.id,to:"accepted",eventId:"event-1"});
  expect(accepted.events).toHaveLength(2);
  expect(duplicate.events).toHaveLength(2);
  expect(()=>s.transition({mode:SIMULATION_MODE,market:"ae",orderId:created.id,to:"cancelled",eventId:"event-1"})).toThrow("event_payload_conflict");
  expect(accepted.supplierAcknowledged).toBe(false);
  expect(accepted.paymentCollected).toBe(false);
 });
 it("returns detached snapshots, so outside mutation cannot corrupt the simulator",()=>{
  const s=createOfflineCommerceSandbox();
  const a=s.place({mode:SIMULATION_MODE,market:"om",clientRequestId:"request-03",lines:[readyLine("om")]});
  (a.lines as Array<{sku:string;variantSku:string;quantity:number}>)[0].quantity=99;
  expect(s.get("om",a.id)!.lines[0].quantity).toBe(1);
 });
 it("never performs fetch or supplier calls in a complete simulated checkout",()=>{
  const network=vi.spyOn(globalThis,"fetch");
  const s=createOfflineCommerceSandbox();
  for(const market of all){
   const order=s.place({mode:SIMULATION_MODE,market,clientRequestId:"offline-"+market,lines:[readyLine(market)]});
   expect(order.id).toMatch(/^SIM-/);
   expect(order.status).toBe("pending");
  }
  expect(network).not.toHaveBeenCalled();
  network.mockRestore();
 });
});
