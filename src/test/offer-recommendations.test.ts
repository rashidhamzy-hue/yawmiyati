import {describe,it,expect} from "vitest";
import {previewOfferVersions} from "../fixtures/preview-catalog";
import {recommendOffers,cartSuggestions} from "../lib/store/offer-recommendations";
import {doorMinor,priceOfferCart} from "../lib/store/offer-version";
describe("product recommendations and optional basket additions",()=>{
 it.each(["sa","ae","om","eg","iq"] as const)("keeps %s recommendations relevant and additions transparent",market=>{
  const versions=previewOfferVersions(market),foreign=previewOfferVersions(market==="sa"?"ae":"sa");
  let suggestionsTested=0;
  for(const current of versions){
   const related=recommendOffers(current,[...versions,...foreign]);
   expect(related.length).toBeLessThanOrEqual(4);
   expect(related.every(v=>v.market===market&&v.slug!==current.slug&&v.title!==current.title)).toBe(true);
   const pack=current.packs[0],zone=current.zones[0];
   const cart={market,zone_id:zone.zone_id,lines:[{listing_id:current.listing_id,slug:current.slug,version_id:current.version_id,revision:current.revision,pack_id:pack.pack_id,add_on_id:null}]};
   const candidates=cartSuggestions(cart,[...versions,...foreign]);
   expect(candidates.length).toBeLessThanOrEqual(2);
   for(const {version,pack:p,zone:z,total} of candidates){
    suggestionsTested++;
    expect(version.market).toBe(market);
    expect(version.listing_id).not.toBe(current.listing_id);
    expect(z.zone_id).toBe(zone.zone_id);
    expect(total).toBe(doorMinor(p,z));
    expect(total*2n<=BigInt(pack.price_minor)).toBe(true);
    const next={...cart,lines:[...cart.lines,{listing_id:version.listing_id,slug:version.slug,version_id:version.version_id,revision:version.revision,pack_id:p.pack_id,add_on_id:null}]};
    expect(priceOfferCart(next,versions).total_door_minor-priceOfferCart(cart,versions).total_door_minor).toBe(total);
   }
  }
  expect(suggestionsTested).toBeGreaterThan(0);
 });
});
