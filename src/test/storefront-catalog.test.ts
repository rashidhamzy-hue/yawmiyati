import {it,expect,vi} from "vitest";
import {parsePublicListings,storefrontMode,fetchPublicCatalog} from "../lib/store/public-catalog";
const row={listing_id:"1",slug:"sample",title:"منتج",price_minor:"1500",currency:"SAR"};
it("does not fall back to demo when unconfigured or partially configured",()=>{
 expect(storefrontMode(undefined,undefined,undefined)).toBe("unconfigured");
 expect(storefrontMode(undefined,undefined,"true")).toBe("demo");
 expect(storefrontMode("https://db.example",undefined,"true")).toBe("unconfigured");
 expect(storefrontMode("https://db.example","key","true")).toBe("catalog");
});
it("rejects malformed rows, duplicate slugs and foreign currencies",()=>{
 expect(parsePublicListings([row],"sa")).toEqual([row]);
 expect(()=>parsePublicListings([{...row,currency:"AED"}],"sa")).toThrow();
 expect(()=>parsePublicListings([{...row,price_minor:"NaN"}],"sa")).toThrow();
 expect(()=>parsePublicListings([row,row],"sa")).toThrow();
});
it("paginates without silently truncating",async()=>{
 const page=Array.from({length:100},(_,i)=>({...row,listing_id:String(i),slug:"item-"+i}));
 const read=vi.fn().mockResolvedValueOnce(Response.json(page)).mockResolvedValueOnce(Response.json([row]));
 expect(await fetchPublicCatalog("https://db.example","test","sa",read)).toHaveLength(101);
 expect(read).toHaveBeenCalledTimes(2);
});
