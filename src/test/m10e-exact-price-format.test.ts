import {describe,it,expect} from "vitest";
import {markets,type MarketCode} from "../lib/store/markets";
import {formatListingPrice,type PublicListing} from "../lib/store/public-catalog";
const codes=Object.keys(markets) as MarketCode[];
function item(market:MarketCode,minor:string):PublicListing{
 return {listing_id:"l-1",slug:"verified-sample",title:"منتج معتمد",price_minor:minor,currency:markets[market].currency};
}
describe("M10E exact buyer-facing currency formatting",()=>{
 it.each(codes)("%s keeps every configured minor unit intact at high safe integer",market=>{
  const minor="9007199254740991";
  const rendered=formatListingPrice(item(market,minor),market);
  const precision=markets[market].minorDigits;
  const unit=10n**BigInt(precision);
  const remainder=(BigInt(minor)%unit).toString().padStart(precision,"0");
  const digits=new Intl.NumberFormat(markets[market].locale,{useGrouping:false,minimumIntegerDigits:precision,maximumFractionDigits:0}).format(Number(remainder));
  const separator=new Intl.NumberFormat(markets[market].locale).formatToParts(1.1).find(x=>x.type==="decimal")?.value;
  expect(rendered).toContain(separator+digits);
  const currency=new Intl.NumberFormat(markets[market].locale,{style:"currency",currency:markets[market].currency,minimumFractionDigits:0,maximumFractionDigits:0}).formatToParts(0n).find(p=>p.type==="currency")?.value;
  expect(rendered).toContain(currency);
 });
 it("preserves three-decimal IQD and OMR even where Intl currency defaults to fewer decimals",()=>{
  expect(formatListingPrice(item("om","1999"),"om")).toContain("٫٩٩٩");
  expect(formatListingPrice(item("iq","1999"),"iq")).toContain("٫٩٩٩");
  expect(formatListingPrice(item("sa","1999"),"sa")).toContain("٫٩٩");
  expect(formatListingPrice(item("ae","1001"),"ae")).toContain("10.01"); // ar-AE uses Latin digits and "."
  expect(formatListingPrice(item("eg","1001"),"eg")).toContain("٫٠١");
 });
 it("refuses invalid minor amounts and currency contamination",()=>{
  expect(()=>formatListingPrice(item("sa","0"),"sa")).toThrow();
  expect(()=>formatListingPrice(item("sa","-1"),"sa")).toThrow();
  expect(()=>formatListingPrice(item("sa","NaN"),"sa")).toThrow();
  expect(()=>formatListingPrice({...item("sa","1500"),currency:"AED"},"sa")).toThrow("Currency mismatch");
 });
});
