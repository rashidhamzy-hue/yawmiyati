import {expect,it} from "vitest";
import {relatedVerifiedProducts} from "../lib/store/verified-merchandising";
const a={listing_id:"a",slug:"coffee-maker",title:"آلة تحضير القهوة",price_minor:"12000",currency:"SAR"};
const others=[
 {listing_id:"b",slug:"coffee-cups",title:"أكواب القهوة",price_minor:"2000",currency:"SAR"},
 {listing_id:"c",slug:"coffee-service",title:"صينية تقديم القهوة",price_minor:"14000",currency:"SAR"},
 {listing_id:"d",slug:"shampoo",title:"شامبو للعناية",price_minor:"14000",currency:"SAR"},
 {listing_id:"e",slug:"foreign",title:"صينية تقديم القهوة",price_minor:"14000",currency:"AED"}
];
it("never recommends current or foreign-currency listings",()=>{
 const items=relatedVerifiedProducts(a,[a,...others]);
 expect(items).toHaveLength(3);
 expect(items.map(p=>p.slug)).not.toContain("foreign");
 expect(items.map(p=>p.slug)).not.toContain(a.slug);
});
it("prefers relevant approved titles and is deterministic",()=>{
 const items=relatedVerifiedProducts(a,others,2);
 expect(items.map(x=>x.slug)).toEqual(["coffee-service","coffee-cups"]);
 expect(relatedVerifiedProducts(a,others,0)).toEqual([]);
});
it("rejects unsupported recommendation counts",()=>expect(()=>relatedVerifiedProducts(a,others,20)).toThrow());
