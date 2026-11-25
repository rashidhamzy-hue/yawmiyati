/** Owner preview only; not a commercial approval or actual inventory. */
import {previewCatalog} from "./preview-catalog-data";
import {markets,parseMinorUnits,type MarketCode} from "../lib/store/markets";
import {parseOfferVersion,OFFER_CONTRACT,type ApprovedOfferVersion} from "../lib/store/offer-version";
const fees={sa:[28],ae:[19],om:[3],eg:[95,100,105],iq:[7000]} as const;
export function previewOfferVersions(market:MarketCode):ApprovedOfferVersion[]{
 return previewCatalog[market].map(([title,price,url,category],i)=>{
  const slug="preview-"+market+"-"+i;
  const amount=String(parseMinorUnits(market,price));
  return parseOfferVersion({contract:OFFER_CONTRACT,market,currency:markets[market].currency,listing_id:slug,slug,title,description:"عرض تجريبي لمراجعة تجربة التسوق. مواصفات المنتج والتوافر والسعر النهائي تحتاج إلى تحقق قبل البيع.",image:{url,alt:title},category_slug:category,version_id:slug+"-v1",revision:1,approved_at:"2026-11-25T00:00:00Z",inputs_digest:"preview-only-not-commercial-approval",default_pack_id:"single",packs:[{pack_id:"single",label:"قطعة واحدة",kind:"single",units:1,price_minor:amount,shipping:"zone_rate",selectable:true}],add_ons:[],zones:fees[market].map((fee,z)=>({zone_id:"z"+(z+1),label:market==="eg"?["القاهرة والجيزة والإسكندرية","المنطقة الثانية","المنطقة الثالثة"][z]:"جميع المناطق",delivery_minor:String(fee*10**markets[market].minorDigits),pack_ids:["single"]}))},market);
 });
}
