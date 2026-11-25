import {describe,it,expect} from "vitest";
import {previewOfferVersions} from "../fixtures/preview-catalog";
import {previewCatalogHostAllowed} from "../lib/store/offer-source";
import {markets} from "../lib/store/markets";
import {offerListing,doorMinor,priceOfferCart} from "../lib/store/offer-version";
describe("temporary 600-listing preview",()=>{
 it.each(["sa","ae","om","eg","iq"] as const)("validates every %s listing and checkout total",market=>{
  const versions=previewOfferVersions(market);
  expect(versions).toHaveLength(120);
  expect(new Set(versions.map(v=>v.slug)).size).toBe(120);
  expect(new Set(versions.map(v=>v.category_slug)).size).toBe(6);
  for(const v of versions){
   expect(v.market).toBe(market);
   expect(v.currency).toBe(markets[market].currency);
   expect(v.slug.startsWith("preview-"+market+"-")).toBe(true);
   expect(v.image?.url.startsWith("https://media.taager.com/")).toBe(true);
   const pack=v.packs[0],zone=v.zones[0];
   expect(offerListing(v).price_minor).toBe(pack.price_minor);
   expect(doorMinor(pack,zone)).toBe(BigInt(pack.price_minor)+BigInt(zone.delivery_minor));
  }
 });
 it("never activates on production or unrelated preview hosts",()=>{
  expect(previewCatalogHostAllowed("id-preview--6bc552b8-1629-4a0b-8706-8bc21c5c1279.lovable.app")).toBe(true);
  for(const host of ["yawmiyati.shop","yawmiyati.com","souq-of-saudi.lovable.app","other.lovable.app","localhost","id-preview--6bc552b8-1629-4a0b-8706-8bc21c5c1279.lovable.app.example.com"])expect(previewCatalogHostAllowed(host)).toBe(false);
 });
});
