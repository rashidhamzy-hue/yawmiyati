import { createHash } from "node:crypto";
import { evaluateCodEvidence } from "../../src/lib/store/pricing";
import { markets, type MarketCode } from "../../src/lib/store/markets";
import { selectOffers, type Offer } from "../../src/lib/store/offer-selection";
import { validateEditorialPackage, type EditorialPackage } from "../../src/lib/store/offline-editorial-package";

type PriceSample = { feed?:string; packGtin?:string; market: MarketCode; currency: string; productKey: string; seller: string;
  url: string; observedAt: string; price: number; shipping: number | null };
type DemandSample = { benchmark?:string; market: MarketCode; productKey: string; url: string; observedAt: string;
  metric: "search_interest_index"; value: number };
type Fact = { id: string; text: string; source: string };
export type RecordInput = { packGtin?:string; searchTerm?:string; targetContributionMinor?:number; woo?: {productId:number;variationId:number;observedAt:string;sourceDigest?:string;stockStatus?:string}; offer: Offer; productKey: string; comparisons: PriceSample[]; demand: DemandSample[];
  facts: Fact[]; faq: { question: string; factId: string }[]; media: { file: string; checksum: string; alt: string; factId: string; rights: string }[] };
export type Snapshot = {version: 1; demo: boolean; stores: { market: MarketCode; observedAt?:string; reportedTotal: number | null; records: RecordInput[] }[]};
const urlOK = (s: string) => { try {const u = new URL(s); return u.protocol === "https:" && !u.username && !u.password;} catch {return false;} };
const money = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
const fresh = (s: string, now: number) => {const age=now-Date.parse(s); return age >= 0 && age <= 30 * 86400000;};
export const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

// Find the lowest viable price within the supplier floor and comparable delivered total.
function priceForTarget(offer:Offer, ceiling:number, target:number) {
  if(!money(offer.sellerFloor) || !money(target) || target===0 || !money(ceiling))return null;
  let low=BigInt(Math.max(1,offer.sellerFloor)), high=BigInt(ceiling), chosen:number|null=null;
  while(low<=high){
    const mid=(low+high)/2n;
    const result=evaluateCodEvidence({...offer.economics,price:Number(mid)});
    if(result.state!=="evaluated")return null;
    if(BigInt(result.scenarios[1].expectedContributionMinor)>=BigInt(target)){
      chosen=Number(mid); high=mid-1n;
    }else low=mid+1n;
  }
  return chosen;
}

// Compare alternatives for this exact supplier pack and quoted delivery zone.
// Shopper-paid freight is outside merchandise revenue. A subsidy adds a
// delivered-order expense; failed-order logistics are already in COD evidence.
export function promotionReview(offer:Offer,target:number|undefined,reasons:readonly string[]) {
  const {price, deliveredFees}=offer.economics;
  const shipping=offer.shopperShipping;
  if(reasons.length || !money(target) || target===0 || !money(price) || price===0 ||
     !money(shipping) || !money(deliveredFees) || !money(price+shipping))return [];
  const minimum=priceForTarget(offer,price,target);
  if(minimum===null)return [];
  const candidates=[{kind:"regular",item:price,subsidy:0}];
  if(minimum<price)candidates.push({kind:"maximum_item_discount",item:minimum,subsidy:0});
  if(shipping>0 && money(deliveredFees+shipping))candidates.push({kind:"merchant_funded_shipping",item:price,subsidy:shipping});
  return candidates.flatMap(({kind,item,subsidy})=>{
    const result=evaluateCodEvidence({...offer.economics,price:item,deliveredFees:deliveredFees+subsidy});
    if(result.state!=="evaluated")return [];
    const expected=BigInt(result.scenarios[1].expectedContributionMinor);
    return [{kind,itemMinor:item,shopperShippingMinor:shipping-subsidy,doorTotalMinor:item+shipping-subsidy,
      expectedContributionMinor:expected.toString(),downsideContributionMinor:result.scenarios[0].expectedContributionMinor,
      meetsTarget:expected>=BigInt(target),requiresShippingVerification:subsidy>0}];
  });
}

export function analyze(snapshot: Snapshot, asOf: string, limit = 150) {
  if (snapshot.version !== 1 || typeof snapshot.demo !== "boolean" || !Array.isArray(snapshot.stores) ||
    snapshot.stores.length !== 5 || new Set(snapshot.stores.map(s=>s.market)).size !== 5) throw Error("Supply all five distinct store snapshots");
  const now = Date.parse(asOf);
  return snapshot.stores.map(({market,reportedTotal,records}) => {
    if (!Object.hasOwn(markets, market) || !Array.isArray(records)) throw Error("Invalid market intake");
    const index = new Map<string, RecordInput>();
    const offers = records.map(record => {
      const {offer, productKey} = record;
      if (!productKey?.trim() || (!snapshot.demo && offer.observations.some(o=>o.source.includes("example.invalid"))) || offer.market !== market || typeof offer.title !== "string" || !offer.title.trim() ||
          [offer.variantsVerified,offer.mediaRightsVerified,offer.commercialCostVerified].some(x=>typeof x !== "boolean")) throw Error("Invalid catalog offer");
      index.set(offer.sku,record);
      const latestPrices=new Map<string,PriceSample>();
      for(const c of record.comparisons){
        if(c.market!==market || c.productKey!==productKey || !fresh(c.observedAt,now) || !urlOK(c.url))continue;
        const previous=latestPrices.get(c.url);
        if(!previous || Date.parse(c.observedAt)>Date.parse(previous.observedAt))latestPrices.set(c.url,c);
        else if(Date.parse(c.observedAt)===Date.parse(previous.observedAt) && (c.price!==previous.price || c.shipping!==previous.shipping || c.currency!==previous.currency))throw Error("Conflicting simultaneous retailer prices");
      }
      const matches = [...latestPrices.values()].filter(c => c.market === market && c.productKey === productKey &&
        c.currency === markets[market].currency && c.seller.trim() && urlOK(c.url) && fresh(c.observedAt,now) &&
        money(c.price) && c.price > 0 && money(c.shipping) && money(c.price+c.shipping))
        .sort((a,b) => (a.price+a.shipping!) - (b.price+b.shipping!) || a.url.localeCompare(b.url));
      const lowest = matches[0];
      const demand = record.demand.filter(d => d.market === market && d.productKey === productKey &&
        d.metric === "search_interest_index" && urlOK(d.url) && fresh(d.observedAt,now) &&
        Number.isFinite(d.value) && d.value >= 0 && d.value <= 100);
      const ceiling=lowest && money(offer.shopperShipping) ? lowest.price+lowest.shipping!-offer.shopperShipping : null;
      let price=offer.economics.price;
      if(record.targetContributionMinor!==undefined){
        if(!money(record.targetContributionMinor) || record.targetContributionMinor===0)throw Error("Invalid target contribution");
        const minimum=ceiling===null?null:priceForTarget(offer,ceiling,record.targetContributionMinor);
        if(price===null)price=minimum;
        else if(minimum===null || price<minimum)price=null;
      }
      const regionalDemand=demand.filter(d=>d.benchmark && new URL(d.url).hostname==="trends.google.com").sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt))[0];
      const hasPackEvidence=matches.some(c=>c.feed && urlOK(c.feed) && record.packGtin && c.packGtin===record.packGtin.padStart(14,"0"));
      return {...offer, measuredDemand:hasPackEvidence && regionalDemand ? regionalDemand.value : undefined, ...(record.woo?.stockStatus && record.woo.stockStatus !== "instock" ? {stockVerifiedAt:""} : {}),economics:{...offer.economics,price}, competitor: lowest ? {source: lowest.url, deliveredMinor: lowest.price+lowest.shipping!, observedAt:lowest.observedAt} : null,
        observations:[...offer.observations.filter(o=>o.factor !== "demand" && o.verified === true && urlOK(o.source)),
          ...demand.map(d=>({factor:"demand" as const, market, sku:offer.sku, score:d.value, source:d.url, verified:true, observedAt:d.observedAt}))]};
    });
    const result=selectOffers(market,offers,reportedTotal,asOf,limit);
    const winners=new Map(result.selected.map(row=>[row.family,row.offer.sku]));
    return {market, ...result, decisions: result.evaluated.map(row=>{
      const input=index.get(row.offer.sku)!;
      return {sku:row.offer.sku, title:row.offer.title, category:row.offer.category, selected:result.selected.includes(row),
        proposedPriceMinor:row.offer.economics.price, sellerFloorMinor:row.offer.sellerFloor, targetContributionMinor:input.targetContributionMinor??null, expectedContributionMinor:row.contribution, familyWinner:winners.get(row.family)??null,
        disposition:row.reasons.length?"held":result.selected.includes(row)?"selected":winners.has(row.family)?"alternative_pack":"outside_family_limit",
        promotionOptions:promotionReview(row.offer,input.targetContributionMinor,row.reasons),
        comparisons:input.comparisons, components:row.offer.components, reasons:row.reasons, score:row.score, comparison:row.offer.competitor,
        rankingMethod:row.rankingMethod, research:row.offer.observations, revision:digest([1,snapshot.demo,market,input,row.offer.economics.price,row.offer.competitor,row.score,row.contribution])};
    })};
  });
}

export function editorial(record:RecordInput, revision:string) {
  const {offer,facts}=record;
  if (!facts.length || facts.some(f=>!f.id.trim() || !f.text.trim() || !urlOK(f.source)) ||
      !facts.some(f=>f.id==="title" && f.text===offer.title)) throw Error("Missing sourced title or facts");
  const ids=facts.map(f=>f.id);
  const fact=(id:string)=>{const f=facts.find(x=>x.id===id);if(!f)throw Error("Unknown fact: "+id);return f;};
  const detail=facts.filter(f=>f.id!=="title");
  if (!detail.length || !record.faq.length) throw Error("Missing product details or FAQ");
  const seg=(text:string,...factIds:string[])=>({text,factIds});
  const proposals:EditorialPackage["proposals"]=[
    {field:"title",segments:[seg(offer.title,"title")]},
    {field:"description",segments:detail.map(f=>seg(f.text,f.id))},
    {field:"seoTitle",segments:[seg(offer.title+" | يومياتي","title")]},
    {field:"seoDescription",segments:[seg(detail[0]!.text,detail[0]!.id)]},
    {field:"faq",segments:record.faq.map(q=>seg(q.question+" "+fact(q.factId).text,q.factId))},
    ...(record.media.length ? [{field:"imageAlt" as const,segments:record.media.map(m=>seg(m.alt,fact(m.factId).id))}] : []),
  ];
  if(record.faq.some(q=>!q.question.trim()) || record.media.some(m=>!m.alt.trim()||!m.rights.trim()))throw Error("Missing editorial evidence");
  const result=validateEditorialPackage({market:offer.market,sku:offer.sku,revision,proposals},ids);
  if(result.status==="rejected")throw Error(result.issues.join(", "));
  return {proposals,facts,faq:record.faq.map(q=>({question:q.question,answer:fact(q.factId).text})),status:result.status};
}
