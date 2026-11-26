import {describe,expect,it,beforeEach} from "vitest";
import {SENTRY_DSN,scrubEvent,sentryEnvironment} from "@/lib/monitoring/sentry-config";
import {__queuedForTests,__resetForTests,captureError,startErrorMonitoring} from "@/lib/monitoring/sentry-client";

describe("Sentry configuration",()=>{
 it("uses the yawmiyati EU project",()=>{
  expect(SENTRY_DSN).toMatch(/^https:\/\/[0-9a-f]+@o\d+\.ingest\.de\.sentry\.io\/\d+$/);
 });
 it("labels environments by host",()=>{
  expect(sentryEnvironment("yawmiyati.shop")).toBe("production");
  expect(sentryEnvironment("www.yawmiyati.shop")).toBe("production");
  expect(sentryEnvironment("yawmiyati-storefront-staging.rashid-hamzy.workers.dev")).toBe("staging");
  expect(sentryEnvironment("staging.yawmiyati.shop")).toBe("staging");
  expect(sentryEnvironment("localhost")).toBe("local");
  expect(sentryEnvironment("127.0.0.1")).toBe("local");
 });
 it("strips shopper data before sending",()=>{
  const event=scrubEvent({
   message:"failed for +966 55 123 4567",
   user:{ip_address:"1.2.3.4"},
   request:{url:"https://yawmiyati.shop/sa/checkout?phone=0551234567",cookies:{a:"b"},data:{name:"x"},query_string:"phone=1",
    headers:{"user-agent":"UA",cookie:"c=1",referer:"https://x.com/a?token=1","x-forwarded-for":"1.2.3.4"}},
  });
  expect(event.user).toBeUndefined();
  expect(event.message).toBe("failed for [phone]");
  expect(event.request).toEqual({url:"https://yawmiyati.shop/sa/checkout",headers:{"user-agent":"UA",referer:"https://x.com/a"}});
 });
});

describe("browser client",()=>{
 beforeEach(()=>__resetForTests());
 it("stays off locally and in tests, but queues early errors safely",()=>{
  expect(startErrorMonitoring()).toBe(false);
  for(let i=0;i<30;i++)captureError(new Error("e"+i));
  expect(__queuedForTests()).toBe(20);
 });
});
