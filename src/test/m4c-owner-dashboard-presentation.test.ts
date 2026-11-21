import {describe,it,expect} from "vitest";
import {formatRecordedMinor,summarizeOwnerMarket} from "../lib/store/owner-dashboard-presentation";
import {markets,type MarketCode} from "../lib/store/markets";
import type {DashboardSummary,MarketPerformance,AiPolicy,CatalogRow,Recommendation} from "../lib/store/dashboard-client";
const codes=["sa","ae","om","eg","iq"] as const;
const policy:AiPolicy={enabled:false,daily_budget_microusd:0,auto_pricing_enabled:false,auto_publish_enabled:false};
const summary=(market:MarketCode):DashboardSummary=>({store:market,currency:markets[market].currency,orders:0,customers:0,recorded_net_minor:"0",order_statuses:{}});
const performance=(market:MarketCode):MarketPerformance=>({
 store:market,currency:markets[market].currency,window_days:30,
 orders:{recorded:0,delivered:0,failed:0,cancelled:0,returned:0,unknown:0,booked_total_minor:"0"},
 ledger:{entries:0,recorded_net_minor:"0"},
 marketing_observations:{records:0,impressions:"0",clicks:"0",submitted_orders:"0",delivered_orders:"0",spend_minor:"0"},
 warnings:[],
});
describe("M4C owner dashboard presentation",()=>{
 it.each(codes)("%s: precise minor-unit rendering and market-specific zero",market=>{
  const digits=markets[market].minorDigits;
  expect(formatRecordedMinor(market,"0")).toBe("0."+("0".repeat(digits))+" "+markets[market].currency);
  expect(formatRecordedMinor(market,"1")).toBe("0."+("0".repeat(digits-1))+"1 "+markets[market].currency);
  expect(formatRecordedMinor(market,"-1234").endsWith(" "+markets[market].currency)).toBe(true);
  const current=summarizeOwnerMarket(market,summary(market),performance(market),[],[],policy);
  expect(current.recordedNet).toBe(formatRecordedMinor(market,"0"));
  expect(current.observedOrders).toBe(0);
  expect(current.catalogCount).toBe(0);
  expect(current.pendingRecommendations).toBe(0);
  expect(current.activeAutomation).toBe(false);
  expect(current.releaseStatus).toBe("not_verified");
  expect(current.alerts.some(a=>a.code==="launch_blocked")).toBe(true);
 });
 it("does not round large financial records through float conversion",()=>{
  expect(formatRecordedMinor("om","900719925474099312345")).toBe("900,719,925,474,099,312.345 OMR");
  expect(formatRecordedMinor("sa","-101")).toBe("-1.01 SAR");
  expect(()=>formatRecordedMinor("eg","1.2")).toThrow("invalid_minor_units");
  expect(()=>formatRecordedMinor("ae","NaN")).toThrow("invalid_minor_units");
  expect(()=>formatRecordedMinor("sa","")).toThrow("invalid_minor_units");
 });
 it("keeps unloaded data unknown and never claims commerce authorization",()=>{
  const item=summarizeOwnerMarket("eg",null,null,null,null,null);
  expect(item.recordedNet).toBeNull();
  expect(item.observedOrders).toBeNull();
  expect(item.catalogCount).toBeNull();
  expect(item.pendingRecommendations).toBeNull();
  expect(item.activeAutomation).toBeNull();
  expect(item.releaseStatus).toBe("not_verified");
  expect(item.alerts.some(a=>a.code==="summary_missing")).toBe(true);
 });
 it("rejects cross-country and cross-currency RPC response mixing",()=>{
  expect(()=>summarizeOwnerMarket("sa",summary("iq"),null,[],[],policy)).toThrow("dashboard_summary_market_mismatch");
  expect(()=>summarizeOwnerMarket("ae",null,performance("eg"),[],[],policy)).toThrow("dashboard_performance_market_mismatch");
  expect(()=>summarizeOwnerMarket("om",{...summary("om"),currency:"SAR"},null,[],[],policy)).toThrow();
  expect(()=>summarizeOwnerMarket("usa" as MarketCode,null,null,null,null,null)).toThrow("invalid_market");
 });
 it("surfaces pending owner approvals, data warnings and enabled automation as review only",()=>{
  const catalog:CatalogRow[]=[{listing_id:"1",slug:"coffee",title:"Coffee",listing_status:"approved",variant_count:1,available_count:7}];
  const recommendations:Recommendation[]=[{id:"1",kind:"draft",rationale:"Check",state:"pending",proposal:null,created_at:"2026-11-20"}];
  const warnings=["Finance observations are incomplete"];
  const result=summarizeOwnerMarket("sa",summary("sa"),{...performance("sa"),warnings},catalog,recommendations,{...policy,enabled:true});
  expect(result.pendingRecommendations).toBe(1);
  expect(result.activeAutomation).toBe(true);
  expect(result.alerts.map(a=>a.code)).toEqual(expect.arrayContaining(["inventory_advisory","pending_recommendations","policy_active","report_warning","launch_blocked"]));
  expect(result.releaseStatus).toBe("not_verified");
 });
});
