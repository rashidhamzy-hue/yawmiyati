import type {MarketCode} from "./markets";
import {markets} from "./markets";
import {marketIdentity} from "./market-identity";
import {customerServiceCopy} from "./customer-service-copy";
import {commerceFacts} from "@/lib/seo/commerce-facts";
/**
 * The customer-facing part of the facts read from the supplier's own information pages (public_market_facts):
 * delivery fee, delivery days, return window. Only facts that agree with our figures or that the owner confirmed
 * arrive here. Where a confirmed fact differs from the sentence we wrote by hand (customer-service-copy.ts), a
 * sentence in the market's own dialect is built from the confirmed number. Never names the supplier.
 */
export type PolicyFacts={deliveryFeeMinor:number|null;deliveryZones:{places:string[];feeMinor:number}[]|null;deliveryDays:{min:number;max:number}|null;returnDays:number|null;returnDefectOnly:boolean};
const int=(v:unknown,max:number)=>typeof v==="number"&&Number.isSafeInteger(v)&&v>0&&v<=max?v:null;
export function parsePolicyFacts(data:unknown):PolicyFacts|null{
 if(!data||typeof data!=="object")return null;
 const d=data as Record<string,any>;
 const zones=Array.isArray(d.delivery_fee?.zones)?d.delivery_fee.zones.map((z:any)=>({places:Array.isArray(z?.places)?z.places.filter((p:unknown)=>typeof p==="string").slice(0,40):[],feeMinor:int(z?.fee_minor,1e12)})).filter((z:{feeMinor:number|null})=>z.feeMinor!==null):null;
 const min=int(d.delivery_days?.min,60),max=int(d.delivery_days?.max,60);
 return {deliveryFeeMinor:int(d.delivery_fee?.flat_minor,1e12),deliveryZones:zones&&zones.length?zones:null,deliveryDays:min&&max&&min<=max?{min,max}:null,
  returnDays:int(d.returns?.days,90),returnDefectOnly:d.returns?.defect_only===true};
}
const arabic=(n:number|string)=>String(n).replace(/\d/g,x=>"٠١٢٣٤٥٦٧٨٩"[Number(x)]!);
/** "يوم إلى يومين", "٢ إلى ٥ أيام", "٧ أيام", "١٤ يومًا" (Egypt and Iraq say "١٤ يوم"). */
export function daysPhrase(market:MarketCode,min:number,max:number):string{
 const one=(n:number)=>n===1?"يوم واحد":n===2?"يومين":n<=10?arabic(n)+" أيام":arabic(n)+(market==="eg"||market==="iq"?" يوم":" يومًا");
 if(min===max)return one(max);
 if(max===2)return "يوم إلى يومين";
 return arabic(min)+" إلى "+arabic(max)+(max<=10?" أيام":market==="eg"||market==="iq"?" يوم":" يومًا");
}
/** Sentences built from a number, one per market, in that market's dialect. Part of the market dictionary (dictionary.ts). */
export const policyTemplates:Record<MarketCode,{shippingFlat:(fee:string)=>string;deliveryWithin:(days:string)=>string;returnsWithin:(days:string)=>string;returnsDefectWithin:(days:string)=>string}>={
 sa:{shippingFlat:fee=>"رسوم التوصيل داخل المملكة "+fee+" للطلب كاملًا.",deliveryWithin:d=>"عادةً يصل الطلب بعد التأكيد خلال "+d+".",returnsWithin:d=>"يمكنك طلب الاسترجاع خلال "+d+". احتفظي برقم الطلب.",returnsDefectWithin:d=>"إذا وصلك منتج معيب أو مختلف عن الوصف، يمكنك طلب إرجاعه خلال "+d+"."},
 ae:{shippingFlat:fee=>"التوصيل لجميع الإمارات بـ"+fee+" للطلب كاملًا.",deliveryWithin:d=>"يستغرق التوصيل عادةً "+d+" بعد تأكيد الطلب.",returnsWithin:d=>"تقدرين تطلبين الاسترجاع خلال "+d+". احتفظي برقم الطلب.",returnsDefectWithin:d=>"إذا وصلج منتج معيب أو مختلف عن الوصف، تقدرين تطلبين إرجاعه خلال "+d+"."},
 om:{shippingFlat:fee=>"رسوم التوصيل داخل عُمان "+fee+" للطلب كاملًا.",deliveryWithin:d=>"عادةً يوصل الطلب بعد التأكيد خلال "+d+".",returnsWithin:d=>"يمكنك طلب الإرجاع خلال "+d+". احتفظي برقم الطلب.",returnsDefectWithin:d=>"إذا وصلك منتج معيب أو مختلف عن الوصف، يمكنك طلب إرجاعه خلال "+d+"."},
 eg:{shippingFlat:fee=>"الشحن بـ"+fee+" للطلب كله.",deliveryWithin:d=>"التوصيل عادةً بياخد "+d+" بعد تأكيد الطلب.",returnsWithin:d=>"تقدري ترجّعي المنتج أو تستبدليه خلال "+d+". احتفظي بالفاتورة.",returnsDefectWithin:d=>"لو المنتج وصلك فيه عيب أو مختلف عن الوصف، تقدري ترجّعيه خلال "+d+"."},
 iq:{shippingFlat:fee=>"أجرة التوصيل "+fee+" للطلب كله، بكل المحافظات.",deliveryWithin:d=>"التوصيل عادةً ياخذ "+d+" بعد تأكيد الطلب.",returnsWithin:d=>"تگدرين ترجّعين المنتج خلال "+d+". احتفظي برقم الطلب.",returnsDefectWithin:d=>"إذا وصلچ المنتج بيه عيب أو يختلف عن الوصف، تگدرين ترجّعينه خلال "+d+"."},
};
const amount=(market:MarketCode,minor:number)=>{const digits=markets[market].minorDigits,v=minor/10**digits;return arabic(Number.isInteger(v)?v.toLocaleString("en-US").replace(/,/g,"٬"):v.toFixed(digits))+" "+marketIdentity[market].currencyLabel;};
/**
 * The three policy sentences for a market: our hand-written one while the confirmed facts say the same (or say nothing),
 * the template sentence when a confirmed fact differs. Egypt's zone list stays hand-written; only a flat fee is templated.
 */
export function policySentences(market:MarketCode,facts:PolicyFacts|null):{shipping:string;delivery:string;returns:string;changed:("shipping"|"delivery"|"returns")[]}{
 const copy=customerServiceCopy[market],known=commerceFacts[market],t=policyTemplates[market],out={shipping:copy.shipping,delivery:copy.delivery,returns:copy.returns,changed:[] as ("shipping"|"delivery"|"returns")[]};
 if(!facts)return out;
 const digits=markets[market].minorDigits;
 if(facts.deliveryFeeMinor!==null&&!facts.deliveryZones&&known.flatShipping!==null&&facts.deliveryFeeMinor!==Math.round(Number(known.flatShipping)*10**digits)){out.shipping=t.shippingFlat(amount(market,facts.deliveryFeeMinor));out.changed.push("shipping");}
 if(facts.deliveryDays&&(!known.deliveryDays||known.deliveryDays.min!==facts.deliveryDays.min||known.deliveryDays.max!==facts.deliveryDays.max)){out.delivery=t.deliveryWithin(daysPhrase(market,facts.deliveryDays.min,facts.deliveryDays.max));out.changed.push("delivery");}
 const knownReturn=known.returnDays??known.defectiveOnlyReturnDays;
 if(facts.returnDays!==null&&facts.returnDays!==knownReturn){out.returns=(facts.returnDefectOnly?t.returnsDefectWithin:t.returnsWithin)(daysPhrase(market,facts.returnDays,facts.returnDays));out.changed.push("returns");}
 return out;
}
// Read through the public RPC; kept for five minutes per Worker instance (policy facts change a few times a year).
const cache=new Map<string,{at:number;facts:PolicyFacts|null}>();
export async function fetchPolicyFacts(origin:string,key:string,market:MarketCode,request:typeof fetch=fetch,now:number=Date.now()):Promise<PolicyFacts|null>{
 const id=origin+"|"+market,hit=cache.get(id);
 if(hit&&now-hit.at<300_000&&request===fetch)return hit.facts;
 let facts:PolicyFacts|null=null;
 try{
  const url=new URL(origin);
  if(url.protocol!=="https:"||url.pathname!=="/"||!key)return null;
  const response=await request(new URL("/rest/v1/rpc/public_market_facts",url),{method:"POST",headers:{apikey:key,"Content-Type":"application/json"},body:JSON.stringify({p_store:market}),redirect:"error",signal:AbortSignal.timeout(4000)});
  if(response.ok)facts=parsePolicyFacts(await response.json());
 }catch{facts=null;}
 if(request===fetch)cache.set(id,{at:now,facts});
 return facts;
}
