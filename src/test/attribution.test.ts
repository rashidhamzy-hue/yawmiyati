import {beforeEach,describe,expect,it} from "vitest";
import {attributionProps,captureAttribution,fbcFrom,getAttribution,parseTouch,persistAttributionAfterConsent} from "@/lib/analytics/attribution";

beforeEach(()=>{localStorage.clear();sessionStorage.clear();});
describe("ad attribution",()=>{
 it("reads UTM tags and ad click ids",()=>{
  const t=parseTouch("https://yawmiyati.shop/sa/p/x?utm_source=meta&utm_medium=paid_social&utm_campaign=frother_nov&utm_content=video_a&fbclid=AbC123","",new Date("2026-11-26T10:00:00Z"))!;
  expect(t).toMatchObject({source:"meta",medium:"paid_social",campaign:"frother_nov",content:"video_a",landing_path:"/sa/p/x"});
  expect(t.click_ids.fbclid).toBe("AbC123");
  expect(fbcFrom(t)).toBe("fb.1."+Date.parse("2026-11-26T10:00:00Z")+".AbC123");
 });
 it("infers sources from click ids, search engines and AI assistants; ignores internal navigation",()=>{
  expect(parseTouch("https://yawmiyati.shop/sa?gclid=g1","")).toMatchObject({source:"google",medium:"paid"});
  expect(parseTouch("https://yawmiyati.shop/sa","https://www.google.com/")).toMatchObject({source:"google.com",medium:"organic"});
  expect(parseTouch("https://yawmiyati.shop/sa","https://chatgpt.com/")).toMatchObject({medium:"ai_assistant"});
  expect(parseTouch("https://yawmiyati.shop/sa","https://www.instagram.com/")).toMatchObject({source:"instagram.com",medium:"referral"});
  expect(parseTouch("https://yawmiyati.shop/sa/c/kitchen","https://yawmiyati.shop/sa")).toBeNull();
 });
 it("keeps first touch, updates last touch, session-only until consent",()=>{
  captureAttribution("https://yawmiyati.shop/sa?utm_source=tiktok&utm_campaign=a","");
  captureAttribution("https://yawmiyati.shop/sa?utm_source=meta&utm_campaign=b","");
  captureAttribution("https://yawmiyati.shop/sa/c/home","https://yawmiyati.shop/sa");
  const a=getAttribution();
  expect(a.first?.source).toBe("tiktok");expect(a.last?.source).toBe("meta");
  expect(localStorage.getItem("ym.attr.first.v1")).toBeNull();
  expect(attributionProps(a)).toMatchObject({ym_first_source:"tiktok",ym_last_campaign:"b"});
  localStorage.setItem("yawmiyati.consent.v1","granted");persistAttributionAfterConsent();
  expect(JSON.parse(localStorage.getItem("ym.attr.first.v1")!).source).toBe("tiktok");
 });
 it("strips unsafe characters from tags",()=>{
  expect(parseTouch("https://yawmiyati.shop/sa?utm_source=%3Cscript%3Ex","")!.source).toBe("scriptx");
 });
});
