/** Market + page classification for analytics. Pure, so it is unit-tested. */
export type MarketCode="sa"|"ae"|"om"|"eg"|"iq";
const currency:Record<MarketCode,string>={sa:"SAR",ae:"AED",om:"OMR",eg:"EGP",iq:"IQD"};
export type PageType="market_select"|"home"|"category"|"product"|"search"|"cart"|"checkout"|"order"|"info"|"story"|"help"|"admin"|"other";
export function pageContext(pathname:string):{market:MarketCode|null;currency:string|null;page_type:PageType;page_slug:string|null}{
 const parts=pathname.split("/").filter(Boolean);
 const m=parts[0] as MarketCode|undefined;
 const market=m&&m in currency?m:null;
 if(!parts.length)return {market:null,currency:null,page_type:"market_select",page_slug:null};
 if(parts[0]==="admin")return {market:null,currency:null,page_type:"admin",page_slug:null};
 if(!market)return {market:null,currency:null,page_type:"other",page_slug:null};
 const [,section,slug]=parts;
 const map:Record<string,PageType>={c:"category",p:"product",search:"search",cart:"cart",checkout:"checkout",order:"order",info:"info",story:"story",help:"help"};
 const page_type:PageType=section===undefined?"home":(map[section]??"other");
 return {market,currency:currency[market],page_type,page_slug:slug??null};
}
