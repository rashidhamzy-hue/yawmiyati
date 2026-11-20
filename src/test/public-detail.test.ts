import {it,expect,vi} from "vitest";
import {fetchPublicDetail,parsePublicDetail} from "../lib/store/public-catalog";
const row={listing_id:"fixture",slug:"supplier-1",title:"Verified title",description:"Verified description",price_minor:"2500",currency:"SAR"};
it("accepts only matching details with market currency",()=>{
 expect(parsePublicDetail([row],"sa","supplier-1")).toEqual(row);
 expect(parsePublicDetail([],"sa","supplier-1")).toBeNull();
 expect(()=>parsePublicDetail([{...row,currency:"AED"}],"sa","supplier-1")).toThrow();
 expect(()=>parsePublicDetail([row],"sa","different")).toThrow();
 expect(()=>parsePublicDetail([{...row,description:123}],"sa","supplier-1")).toThrow();
});
it("uses a dedicated public RPC and no owner token",async()=>{
 const send=vi.fn(async()=>Response.json([row]));
 expect(await fetchPublicDetail("https://db.example","publishable","sa","supplier-1",send)).toEqual(row);
 const init=send.mock.calls[0][1] as RequestInit;
 expect(JSON.parse(String(init.body))).toEqual({p_store:"sa",p_slug:"supplier-1"});
 expect(init.headers).toMatchObject({apikey:"publishable"});
 expect(String(send.mock.calls[0][0])).toContain("/rpc/public_catalog_detail");
});
it("rejects non-product paths",async()=>{
 const send=vi.fn();
 await expect(fetchPublicDetail("https://db.example","key","sa","../foo",send)).rejects.toThrow();
 expect(send).not.toHaveBeenCalled();
});
