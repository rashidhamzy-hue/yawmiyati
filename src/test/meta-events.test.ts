import {afterEach,describe,expect,it,vi} from "vitest";
import {forwardToMeta,metaEventFor,pixelConfigured} from "@/lib/analytics/meta-events";
import {capiPayload,handleMetaEvents} from "@/lib/analytics/meta-capi.server";

const ID="3f2b8c1e-4d5a-4e6f-8a9b-0c1d2e3f4a5b";
afterEach(()=>{delete (window as unknown as Record<string,unknown>).fbq;delete (window as unknown as Record<string,unknown>)._fbq;document.head.querySelectorAll("script[src*='fbevents']").forEach(s=>s.remove());});

describe("Meta events: browser Pixel and server Conversions API share one event id",()=>{
 it("maps store events to Meta's standard events with slugs as content ids and money in the market's currency",()=>{
  expect(metaEventFor("product_viewed",{market:"sa",slug:"milk-frother",value_minor:"8900"},ID)).toEqual({name:"ViewContent",event_id:ID,market:"sa",params:{content_ids:["milk-frother"],content_type:"product",value:89,currency:"SAR"}});
  expect(metaEventFor("checkout_started",{market:"om",value_minor:4500},ID)!.params).toEqual({value:4.5,currency:"OMR"});
  expect(metaEventFor("search_submitted",{market:"iq",query:"قهوة"},ID)!.params).toEqual({search_string:"قهوة"});
  expect(metaEventFor("$pageview",{market:"eg"},ID)!.name).toBe("PageView");
  // No Meta twin: internal events, events without a market, product events without a product.
  expect(metaEventFor("consent_decided",{market:"sa"},ID)).toBeNull();expect(metaEventFor("product_viewed",{slug:"x"},ID)).toBeNull();expect(metaEventFor("add_to_cart",{market:"sa",slug:"Bad Slug"},ID)).toBeNull();
 });
 it("does nothing without consent or without a Pixel id, and sends both halves with the same id otherwise",()=>{
  const sent:string[]=[];const send=(b:string)=>{sent.push(b);};
  expect(pixelConfigured("123")).toBe(false);expect(pixelConfigured("1234567890123456")).toBe(true);
  expect(forwardToMeta("add_to_cart",{market:"sa",slug:"milk-frother",value_minor:"8900"},"denied",{pixelId:"1234567890123456",send})).toBeNull();
  expect(forwardToMeta("add_to_cart",{market:"sa",slug:"milk-frother",value_minor:"8900"},"granted",{pixelId:undefined,send})).toBeNull();
  expect(sent).toEqual([]);expect((window as unknown as {fbq?:unknown}).fbq).toBeUndefined();
  const e=forwardToMeta("add_to_cart",{market:"sa",slug:"milk-frother",value_minor:"8900",quantity:2},"granted",{pixelId:"1234567890123456",send,newId:()=>ID})!;
  const fbq=(window as unknown as {fbq:{queue:unknown[][]}}).fbq;
  expect(fbq.queue[0]).toEqual(["init","1234567890123456"]);
  expect(fbq.queue[1]).toEqual(["track","AddToCart",{content_ids:["milk-frother"],content_type:"product",value:89,currency:"SAR",num_items:2,market:"sa"},{eventID:ID}]);
  const server=JSON.parse(sent[0]);
  expect(server.event_id).toBe(e.event_id);expect(server.name).toBe("AddToCart");expect(server.params.content_ids).toEqual(["milk-frother"]);
  expect(JSON.stringify(server)).not.toMatch(/phone|email|address|"name":"[^A]/);
 });
 it("server: accepts only well-formed events from our own pages and forwards them once configured",async()=>{
  const body={name:"AddToCart",event_id:ID,market:"sa",params:{content_ids:["milk-frother","<script>"],content_type:"product",value:89,num_items:2},url:"https://yawmiyati.shop/sa/p/milk-frother?utm_source=x"};
  const req=(b:unknown,headers:Record<string,string>={})=>new Request("https://yawmiyati.shop/api/meta-events",{method:"POST",body:JSON.stringify(b),headers:{"content-type":"application/json","user-agent":"UA",cookie:"_fbp=fb.1.123.456; other=1",...headers}});
  const p=capiPayload(body,req(body),1_800_000_000_000)!;
  expect(p).toMatchObject({event_name:"AddToCart",event_id:ID,event_time:1_800_000_000,action_source:"website",event_source_url:"https://yawmiyati.shop/sa/p/milk-frother",
   custom_data:{market:"sa",content_ids:["milk-frother"],content_type:"product",value:89,currency:"SAR",num_items:2},user_data:{client_user_agent:"UA",fbp:"fb.1.123.456"}});
  expect(capiPayload({...body,url:"https://evil.example/sa/p/x"},req(body))).toBeNull();expect(capiPayload({...body,url:"https://yawmiyati.shop/ae/p/x"},req(body))).toBeNull();
  expect(capiPayload({...body,name:"Lead"},req(body))).toBeNull();expect(capiPayload({...body,event_id:"1"},req(body))).toBeNull();expect(capiPayload({...body,market:"us"},req(body))).toBeNull();
  // Not configured: accepted, nothing sent.
  const send=vi.fn(async()=>new Response("{}"));
  const off=await handleMetaEvents(req(body),{},send as unknown as typeof fetch);
  expect(off!.status).toBe(204);expect(off!.headers.get("x-meta-capi")).toBe("not-configured");expect(send).not.toHaveBeenCalled();
  const on=await handleMetaEvents(req(body),{META_PIXEL_ID:"1234567890123456",META_CAPI_TOKEN:"tok"},send as unknown as typeof fetch);
  expect(on!.headers.get("x-meta-capi")).toBe("sent");
  const [url,init]=send.mock.calls[0] as unknown as [string,RequestInit];
  expect(url).toBe("https://graph.facebook.com/v21.0/1234567890123456/events");
  const out=JSON.parse(String(init.body));expect(out.data).toHaveLength(1);expect(out.data[0].event_id).toBe(ID);expect(out.access_token).toBe("tok");
  expect((await handleMetaEvents(req(body,{origin:"https://evil.example"}),{},send as unknown as typeof fetch))!.status).toBe(403);
  expect((await handleMetaEvents(new Request("https://yawmiyati.shop/api/meta-events"),{},send as unknown as typeof fetch))!.status).toBe(405);
  expect(await handleMetaEvents(new Request("https://yawmiyati.shop/sa"),{},send as unknown as typeof fetch)).toBeNull();
 });
});
