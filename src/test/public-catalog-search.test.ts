import {it,expect,vi} from "vitest";
import {fetchPublicSearch} from "../lib/store/public-catalog";
const row={listing_id:"verified-1",slug:"coffee-set",title:"طقم القهوة",price_minor:"8900",currency:"SAR",relevance:55};
it("requests market-scoped approved title and description search",async()=>{
 const send=vi.fn(async()=>Response.json([row]));
 const result=await fetchPublicSearch("https://db.example","publishable","sa","قهوة",send);
 expect(result).toEqual([{listing_id:row.listing_id,slug:row.slug,title:row.title,price_minor:row.price_minor,currency:"SAR"}]);
 const [url,opts]=send.mock.calls[0];
 expect(String(url)).toContain("/rest/v1/rpc/public_catalog_search");
 expect(JSON.parse(String(opts.body))).toEqual({p_store:"sa",p_query:"قهوة",p_limit:40});
});
it("blocks empty, excessive and cross-market search responses",async()=>{
 const send=vi.fn(async()=>Response.json([{...row,currency:"AED"}]));
 expect(await fetchPublicSearch("https://db.example","key","sa","",send)).toEqual([]);
 expect(send).not.toHaveBeenCalled();
 await expect(fetchPublicSearch("https://db.example","key","sa","قهوة",send)).rejects.toThrow();
 await expect(fetchPublicSearch("http://db.example","key","sa","coffee",send)).rejects.toThrow();
});
