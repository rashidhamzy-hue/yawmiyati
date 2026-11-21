import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {markets,type MarketCode} from "../lib/store/markets";
import {infoPageMetadata,categoryPageMetadata,storyPageMetadata,productPageMetadata} from "../lib/store/store-page-metadata";
import {marketIdentity} from "../lib/store/market-identity";
const all=Object.keys(markets) as MarketCode[];
describe("M10A localized prelaunch route metadata",()=>{
 it.each(all)("%s produces local and noindex metadata for info, story, category and generic product",market=>{
  const name=marketIdentity[market].name;
  const pages=[
   infoPageMetadata(market,"help"),infoPageMetadata(market,"privacy"),
   infoPageMetadata(market,"shipping-returns"),infoPageMetadata(market,"terms"),
   categoryPageMetadata(market,"kitchen"),categoryPageMetadata(market,"beauty"),
   storyPageMetadata(market),productPageMetadata(market)
  ];
  expect(pages.every(m=>m.title.includes("يومياتي "+name)&&m.robots==="noindex,nofollow"&&!!m.description)).toBe(true);
  expect(new Set(pages.map(p=>p.title)).size).toBe(pages.length);
  expect(pages.every(p=>!/\|\s*(SA|AE|OM|EG|IQ)\b/.test(p.title))).toBe(true);
  expect(categoryPageMetadata(market,"kitchen").title).toContain("المطبخ");
  expect(categoryPageMetadata(market,"../../admin").title).toContain("القسم غير موجود");
  expect(productPageMetadata(market).title).toContain("تفاصيل المنتج");
 });
 it.each(all)("%s includes verified public listing title only when source data is valid",market=>{
  const row={listing_id:"verified-1",slug:"coffee-kettle",title:"إبريق قهوة بتصميم أنيق",
   currency:markets[market].currency,price_minor:"15200"};
  expect(productPageMetadata(market,row).title).toContain(row.title);
  expect(productPageMetadata(market,{...row,price_minor:"0"}).title).toContain("تفاصيل المنتج");
  expect(productPageMetadata(market,{...row,slug:"demo"}).title).toContain("تفاصيل المنتج");
 });
 it("every five-market route is wired to metadata helpers and remains noindex",()=>{
  for(const market of all){
   for(const [suffix,fn] of [["info.$topic","infoPageMetadata"],["c.$slug","categoryPageMetadata"],["story","storyPageMetadata"],["p.$slug","productPageMetadata"]] as const){
    const file=readFileSync("src/routes/"+market+"."+suffix+".tsx","utf8");
    expect(file).toContain(fn);
    expect(file).toContain("m.robots");
   }
  }
 });
});
