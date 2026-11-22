import { markets, parseMinorUnits, type MarketCode } from "../../src/lib/store/markets";
import { historicSupplierTerms } from "../../src/lib/store/historic-supplier-terms";
import { egyptScreenshotShippingEvidence } from "../../src/lib/store/egypt-shipping-evidence";
import { demoCatalog } from "../../src/lib/store/offer-selection-demo";
import { digest } from "../catalog/workspace";

// This module is used exclusively by the offline owner CLI.
export function journeyCatalog(market: MarketCode) {
  const { currency, minorDigits } = markets[market];
  const policy = historicSupplierTerms[market];
  const zones = market === "eg"
    ? egyptScreenshotShippingEvidence.bands.map(b => ({ label: b.destinations.join("، "), amount: b.amountEgp }))
    : [{ label: "جميع المناطق", amount: policy.shippingQuote!.amount }];
  const base = demoCatalog(market).offers[0].economics.price!;
  const fraction = (p: number) => Math.round(base * p / 100);
  const regular = {sku:"DEMO-R1", label:"رف مطبخ واحد", kind:"Single", price:base, floor:fraction(80), cost:fraction(48), stock:24, parts:[["rack",1]]};
  const pair = {sku:"DEMO-R2", label:"عبوة رفّين", kind:"Supplier pack SKU", price:fraction(170), floor:fraction(145), cost:fraction(78), stock:8, parts:[["rack",2]]};
  // Distinct market quotes are synthetic. A fixed supplier SKU can have its own stock.
  if(market==="iq") pair.stock=0;
  if(market==="om") pair.cost=fraction(116);
  const kit={...regular,sku:"DEMO-KIT",label:"رف مع خطّاف تنظيم",kind:"Yawmiyati kit",price:fraction(137),floor:fraction(105),cost:fraction(64),stock:Math.min(regular.stock,6),parts:[["rack",1],["hook",1]]};
  const offers = [regular, pair,
    {...regular, label:"رفّان بخصم الكمية", kind:"Two units at quantity tier", price:fraction(177),floor:fraction(152),cost:fraction(89),stock:Math.floor(regular.stock/2),parts:[["rack",2]]},
    kit,
    {...pair, label:"عبوة رفّين مع توصيل مجاني",kind:"Seller-funded shipping"},
    {...regular,sku:"DEMO-CLIP",label:"مشبك شعر",kind:"Low-margin control",cost:market==="eg"?20000:fraction(96), floor:market==="eg"?22000:base,price:market==="eg"?22000:base,parts:[["clip",1]]}];
  // Egyptian screenshots give separate conditional prices for the clip. The cheaper
  // acquisition cost and floor apply only to the additional cart item in this kit.
  if(market==="eg") offers.push({...kit,sku:"DEMO-BRUSH-CLIP",label:"فرشاة شعر مع مشبك",kind:"Brush + optional clip",cost:35400+13100,
    floor:58300+13600,price:73500,stock:12,parts:[["brush",1],["clip",1]]});
  return zones.map((zone,index) => {
    const freight=parseMinorUnits(market,zone.amount);
    const refusalFee=market==="eg"?500:fraction(4);
    const returnFee=market==="eg"?500:fraction(8);
    const ad=fraction(12), target=fraction(10), fees=fraction(4);
    // Per 100 submissions: 80 retained, 15 refused, 5 returned after delivery.
    // Returned stock is assumed recoverable. Refund includes shopper freight.
    const rows=offers.map(o=>{
      const shipping=o.kind==="Seller-funded shipping"?0:freight;
      const door=o.price+shipping;
      // Matched-pack local price fixture. Switch to dated retailer evidence before any real offer.
      const comparableDoor=(o.sku==="DEMO-R2"||o.kind==="Two units at quantity tier"?fraction(180):
        o.sku==="DEMO-KIT"?fraction(145):o.price)+freight;
      const kept=door-o.cost-freight-fees;
      const refused=-freight-refusalFee;
      const returned=-freight-returnFee-fees;
      const beforeAds=Math.floor((80*kept+15*refused+5*returned)/100);
      const expected=beforeAds-ad, maxCpa=beforeAds-target;
      const reason=o.stock<1?"Unavailable":o.price<o.floor?"Below supplier floor":door>comparableDoor?"Above comparable delivered price":expected<target?"Below target after ads and failed deliveries":"Eligible";
      const data={...o,comparableDoor,market,currency,minorDigits,zone:index,shipping,door,kept,refused,returned,expected,maxCpa,reason,ad,target,freight,fees,refusalFee,returnFee};
      return {...data,id:"demo-"+market+"-"+digest([1,data]).slice(0,16)};
    }).sort((a,b)=>b.expected-a.expected);
    const winner=rows.find(r=>r.reason==="Eligible");
    return {market,currency,minorDigits,label:zone.label,terms:policy.supplierReturnQuote??"Egypt after-sales terms vary by category",winner:winner?.id,rows};
  });
}
