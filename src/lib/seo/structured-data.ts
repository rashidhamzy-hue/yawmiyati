/**
 * schema.org JSON-LD built only from verified data: store identity, published
 * commerce facts and release-gated public catalog listings. No ratings,
 * reviews, brands, "was" prices or stock counts are ever invented.
 */
import {markets,type MarketCode} from "@/lib/store/markets";
import {marketIdentity} from "@/lib/store/market-identity";
import type {PublicDetail,PublicListing} from "@/lib/store/public-catalog";
import {commerceFacts} from "./commerce-facts";
import {SITE_ORIGIN,marketUrl,minorToDecimal,productSuffix} from "./site";

export const ORG_ID=SITE_ORIGIN+"/#organization";
const websiteId=(market:MarketCode)=>marketUrl(market)+"#website";

export function organizationNode(){
 return {"@type":"Organization","@id":ORG_ID,name:"يومياتي",alternateName:"Yawmiyati",url:SITE_ORIGIN+"/"};
}

export function websiteNode(market:MarketCode){
 return {"@type":"WebSite","@id":websiteId(market),url:marketUrl(market),
  name:"يومياتي "+marketIdentity[market].name,inLanguage:markets[market].locale,
  publisher:{"@id":ORG_ID},
  potentialAction:{"@type":"SearchAction",
   target:{"@type":"EntryPoint",urlTemplate:marketUrl(market,"/search")+"?q={search_term_string}"},
   "query-input":"required name=search_term_string"}};
}

export function breadcrumbNode(market:MarketCode,trail:readonly {name:string;suffix:string}[]){
 return {"@type":"BreadcrumbList",itemListElement:[
  {"@type":"ListItem",position:1,name:"يومياتي "+marketIdentity[market].name,item:marketUrl(market)},
  ...trail.map((step,i)=>({"@type":"ListItem",position:i+2,name:step.name,item:marketUrl(market,step.suffix)})),
 ]};
}

function shippingDetails(market:MarketCode){
 const f=commerceFacts[market],currency=markets[market].currency;
 if(!f.flatShipping)return undefined; // Egypt varies by governorate: no single rate to state.
 return {"@type":"OfferShippingDetails",
  shippingRate:{"@type":"MonetaryAmount",value:f.flatShipping,currency},
  shippingDestination:{"@type":"DefinedRegion",addressCountry:f.countryCode},
  ...(f.deliveryDays?{deliveryTime:{"@type":"ShippingDeliveryTime",
   handlingTime:{"@type":"QuantitativeValue",minValue:0,maxValue:1,unitCode:"DAY"},
   transitTime:{"@type":"QuantitativeValue",minValue:f.deliveryDays.min,maxValue:f.deliveryDays.max,unitCode:"DAY"}}}:{})};
}

function returnPolicy(market:MarketCode){
 const f=commerceFacts[market];
 if(f.returnDays===null)return undefined;
 return {"@type":"MerchantReturnPolicy",applicableCountry:f.countryCode,
  returnPolicyCategory:"https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays:f.returnDays};
}

export type ProductImage={url:string};

/** Product + Offer for one released listing, or null if it is not publishable. */
export function productNode(market:MarketCode,listing:PublicListing|PublicDetail,image?:ProductImage|null){
 const suffix=productSuffix(listing.slug);
 if(!suffix||listing.currency!==markets[market].currency)return null;
 const url=marketUrl(market,suffix);
 const description="description" in listing&&listing.description.trim()?listing.description.replace(/\s+/g," ").trim().slice(0,5000):undefined;
 const shipping=shippingDetails(market),returns=returnPolicy(market);
 return {"@type":"Product","@id":url+"#product",name:listing.title.trim(),url,sku:listing.slug,
  ...(description?{description}:{}),
  ...(image?.url?.startsWith("https://")?{image:[image.url]}:{}),
  offers:{"@type":"Offer",url,priceCurrency:listing.currency,
   price:minorToDecimal(listing.price_minor,markets[market].minorDigits),
   // An owner-approved time-limited price carries its real end date (never invented).
   ...("sale" in listing&&listing.sale?{priceValidUntil:listing.sale.ends_at.slice(0,10)}:{}),
   availability:"https://schema.org/InStock",itemCondition:"https://schema.org/NewCondition",
   acceptedPaymentMethod:{"@type":"PaymentMethod",name:"Cash on delivery"},
   seller:{"@id":ORG_ID},
   ...(shipping?{shippingDetails:shipping}:{}),
   ...(returns?{hasMerchantReturnPolicy:returns}:{})}};
}

/**
 * One of our own sets (2-4 published products sold together): a Product whose single Offer lists what it includes.
 * Built only from the approved set and the released listings of its pieces.
 */
export function bundleNode(market:MarketCode,set:{slug:string;title:string;price_minor:number;tagline?:string},pieces:readonly {title:string;slug:string;quantity:number;image?:string|null}[]){
 if(!/^[a-z0-9][a-z0-9-]{2,119}$/.test(set.slug)||pieces.length<2)return null;
 const url=marketUrl(market,"/set/"+set.slug),shipping=shippingDetails(market),returns=returnPolicy(market);
 const images=pieces.map(p=>p.image).filter((i):i is string=>typeof i==="string"&&i.startsWith("https://"));
 return {"@type":"Product","@id":url+"#set",name:set.title.trim(),url,sku:set.slug,...(set.tagline?{description:set.tagline}:{}),...(images.length?{image:images}:{}),
  offers:{"@type":"Offer",url,priceCurrency:markets[market].currency,price:minorToDecimal(String(set.price_minor),markets[market].minorDigits),
   availability:"https://schema.org/InStock",itemCondition:"https://schema.org/NewCondition",acceptedPaymentMethod:{"@type":"PaymentMethod",name:"Cash on delivery"},seller:{"@id":ORG_ID},
   includesObject:pieces.map(p=>({"@type":"TypeAndQuantityNode",amountOfThisGood:p.quantity,typeOfGood:{"@type":"Product",name:p.title.trim(),...(productSuffix(p.slug)?{url:marketUrl(market,productSuffix(p.slug)!)}:{})}})),
   ...(shipping?{shippingDetails:shipping}:{}),...(returns?{hasMerchantReturnPolicy:returns}:{})}};
}
export function graph(...nodes:(object|null|undefined)[]){
 return {"@context":"https://schema.org","@graph":nodes.filter(Boolean)};
}

/** Safe for an inline <script type="application/ld+json">. */
export function serializeJsonLd(value:unknown):string{
 return JSON.stringify(value).replace(/</g,"\\u003c").replace(/>/g,"\\u003e").replace(/&/g,"\\u0026");
}
