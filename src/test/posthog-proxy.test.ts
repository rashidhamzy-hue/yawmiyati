import {describe,it,expect} from "vitest";
import {posthogProxyTarget} from "../lib/analytics/posthog-proxy";
describe("first-party analytics proxy",()=>{
 it("routes only /i/* to PostHog, assets to the asset host",()=>{
  expect(posthogProxyTarget(new URL("https://x.test/i/e/?ip=0"))?.toString()).toBe("https://us.i.posthog.com/e/?ip=0");
  expect(posthogProxyTarget(new URL("https://x.test/i/static/array.js"))?.toString()).toBe("https://us-assets.i.posthog.com/static/array.js");
  expect(posthogProxyTarget(new URL("https://x.test/sa")) ).toBeNull();
  expect(posthogProxyTarget(new URL("https://x.test/info/i/x")) ).toBeNull();
 });
});
