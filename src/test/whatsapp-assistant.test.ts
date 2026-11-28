import {describe,expect,it,vi} from "vitest";
import {marketInText,marketOfPhone,orderNumberIn,ownerNote,parseFacts,parseIncoming,planMessage,planOrderReply,sendText,validSignature,verifyChallenge} from "../../supabase/functions/_shared/assistant/whatsapp.ts";
import {storeFacts} from "@/lib/seo/endpoints";
import type {AssistantProduct} from "../../supabase/functions/_shared/assistant/core.ts";

const O="https://yawmiyati.shop";
const facts=(m:"sa"|"ae"|"om"|"eg"|"iq")=>parseFacts(JSON.parse(JSON.stringify(storeFacts(m))),m)!;
const products:AssistantProduct[]=[{slug:"milk-frother-1",title:"خفاقة حليب كهربائية",price_minor:8900,category:"kitchen"},{slug:"hair-towel-2",title:"منشفة شعر سريعة التجفيف",price_minor:4900,category:"beauty"}];
const webhook=(messages:unknown[],phoneId="111222333")=>({object:"whatsapp_business_account",entry:[{changes:[{value:{metadata:{phone_number_id:phoneId},contacts:[{profile:{name:"Private Name"}}],messages}}]}]});

describe("WhatsApp assistant: one number for the five stores",()=>{
 it("verifies Meta's webhook and its signatures",async()=>{
  const q=(t:string)=>new URLSearchParams({"hub.mode":"subscribe","hub.verify_token":t,"hub.challenge":"12345"});
  expect(verifyChallenge(q("a-long-verify-token-1"),"a-long-verify-token-1")).toBe("12345");
  expect(verifyChallenge(q("wrong"),"a-long-verify-token-1")).toBeNull();expect(verifyChallenge(q("short"),"short")).toBeNull();expect(verifyChallenge(q("x"),undefined)).toBeNull();
  const body='{"object":"whatsapp_business_account"}',secret="app-secret";
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig="sha256="+[...new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(body)))].map(b=>b.toString(16).padStart(2,"0")).join("");
  expect(await validSignature(body,sig,secret)).toBe(true);
  expect(await validSignature(body+" ",sig,secret)).toBe(false);expect(await validSignature(body,sig,"other")).toBe(false);expect(await validSignature(body,null,secret)).toBe(false);expect(await validSignature(body,sig,undefined)).toBe(false);
 });
 it("reads text messages only, and never the sender's name",()=>{
  const msgs=parseIncoming(webhook([{id:"wamid.1",from:"966501234567",type:"text",text:{body:"كيف الدفع؟"}},{id:"wamid.2",from:"966501234567",type:"image",image:{id:"x"}},{id:"wamid.3",from:"not-a-number",type:"text",text:{body:"x"}}]));
  expect(msgs.map(m=>[m.id,m.type,m.text])).toEqual([["wamid.1","text","كيف الدفع؟"],["wamid.2","image",""]]);
  expect(JSON.stringify(msgs)).not.toContain("Private Name");
  expect(parseIncoming({object:"page"})).toEqual([]);expect(parseIncoming(null)).toEqual([]);
 });
 it("knows the store from the number, or from the country she names",()=>{
  expect([marketOfPhone("966501234567"),marketOfPhone("971501234567"),marketOfPhone("96891234567"),marketOfPhone("201012345678"),marketOfPhone("9647701234567")]).toEqual(["sa","ae","om","eg","iq"]);
  expect(marketOfPhone("447911123456")).toBeNull();
  expect(marketInText("أنا في مصر")).toBe("eg");expect(marketInText("أطلب للسعودية")).toBe("sa");expect(marketInText("مرحبا")).toBeNull();
  expect(orderNumberIn("طلبي رقم #1042")).toBe("1042");expect(orderNumberIn("YM-20031")).toBe("20031");expect(orderNumberIn("رقم ١٠٤٢")).toBe("1042");expect(orderNumberIn("كم السعر")).toBeNull();
 });
 it("answers policy questions with the store's own published sentences, in each market's words",()=>{
  for(const m of ["sa","ae","om","eg","iq"] as const){
   const f=facts(m);
   expect(planMessage({text:"كيف الدفع؟",type:"text"},f,products,O)).toEqual({kind:"reply",text:f.payment,intent:"payment"});
   const d=planMessage({text:"كم مدة التوصيل؟",type:"text"},f,products,O);
   expect(d).toMatchObject({kind:"reply",intent:"delivery"});expect((d as {text:string}).text).toContain(f.delivery);
   expect(planMessage({text:"كيف أرجع المنتج؟",type:"text"},f,products,O)).toEqual({kind:"reply",text:f.returns,intent:"returns"});
  }
  expect(facts("eg").assistant.greeting).not.toBe(facts("sa").assistant.greeting);
 });
 it("shows real products with their current price and link, and admits when nothing fits",()=>{
  const f=facts("sa");
  const hit=planMessage({text:"عندكم خفاقة حليب؟",type:"text"},f,products,O) as {kind:string;text:string};
  expect(hit.kind).toBe("reply");expect(hit.text).toContain("خفاقة حليب كهربائية");expect(hit.text).toContain("https://yawmiyati.shop/sa/p/milk-frother-1");expect(hit.text).toMatch(/89/);
  const none=planMessage({text:"هل عندكم ثلاجات؟",type:"text"},f,products,O) as {kind:string;text:string};
  expect(none.kind).toBe("reply");expect(none.text).toContain(f.assistant.dont_know);
  expect(planMessage({text:"",type:"image"},f,products,O)).toEqual({kind:"reply",text:f.assistant.text_only,intent:"non_text"});
 });
 it("tells an order's status only after a lookup, records the confirmation tap, and hands exceptions to a person",()=>{
  const f=facts("iq");
  expect(planMessage({text:"وين طلبي 1042",type:"text"},f,products,O)).toEqual({kind:"lookup_order",number:"1042",confirm:false});
  expect(planMessage({text:"1042",type:"text"},f,products,O)).toEqual({kind:"lookup_order",number:"1042",confirm:false});
  expect(planMessage({text:f.assistant.confirm_word+" 1042",type:"text"},f,products,O)).toEqual({kind:"lookup_order",number:"1042",confirm:true});
  expect(planMessage({text:f.assistant.confirm_word,type:"text"},f,products,O)).toMatchObject({kind:"reply",text:f.assistant.order_ask});
  expect(planOrderReply(f,{status:"shipped"},{asked:false,done:false})).toMatchObject({kind:"reply"});
  expect((planOrderReply(f,{status:"shipped"},{asked:false,done:false}) as {text:string}).text).toContain(f.assistant.status.shipped);
  expect(planOrderReply(f,{status:"refused"},{asked:false,done:false})).toMatchObject({text:f.assistant.status.closed});
  expect(planOrderReply(f,null,{asked:false,done:false})).toMatchObject({text:f.assistant.order_not_found});
  expect(planOrderReply(f,{status:"unknown"},{asked:false,done:false})).toMatchObject({kind:"handover",reason:"order_status_unknown"});
  expect(planOrderReply(f,null,{asked:true,done:true})).toMatchObject({text:f.assistant.confirm_done});
  expect(planOrderReply(f,null,{asked:true,done:false})).toMatchObject({text:f.assistant.confirm_unknown});
  expect(planMessage({text:"أريد "+f.assistant.human_word,type:"text"},f,products,O)).toMatchObject({kind:"handover",reason:"asked_for_a_person"});
  expect(planMessage({text:"المنتج وصل مكسور",type:"text"},f,products,O)).toMatchObject({kind:"handover",reason:"possible_complaint"});
  expect(ownerNote("iq","9647701234567","المنتج وصل مكسور","possible_complaint")).toBe('Yawmiyati IQ · customer needs you (possible complaint)\n"المنتج وصل مكسور"\nReply to her: https://wa.me/9647701234567');
 });
 it("refuses to answer without the store's complete published sentences",()=>{
  const raw=JSON.parse(JSON.stringify(storeFacts("sa")));
  expect(parseFacts(raw,"ae")).toBeNull();expect(parseFacts({...raw,payment:""},"sa")).toBeNull();expect(parseFacts({...raw,assistant:{...raw.assistant,status:{}}},"sa")).toBeNull();
 });
 it("sends plain text through the Cloud API and nothing else",async()=>{
  const f=vi.fn(async()=>new Response("{}",{status:200}));
  expect(await sendText({token:"T",phoneNumberId:"111222333"},"966501234567","x".repeat(3000),f as unknown as typeof fetch)).toBe(true);
  const [url,init]=f.mock.calls[0] as unknown as [string,RequestInit];
  expect(url).toBe("https://graph.facebook.com/v21.0/111222333/messages");
  const body=JSON.parse(String(init.body));expect(body).toMatchObject({messaging_product:"whatsapp",to:"966501234567",type:"text"});expect(body.text.body).toHaveLength(1500);
  expect(await sendText({token:"T",phoneNumberId:"111222333"},"not-a-number","x",f as unknown as typeof fetch)).toBe(false);
 });
});
