import {describe,expect,it} from "vitest";
// @ts-expect-error plain script module
import {pageIsNoindex,restAnswers,robotsBlocksAll,showsProducts} from "../../scripts/check-connector-hidden.mjs";

describe("connector site check",()=>{
 it("robots must block everything for every crawler",()=>{
  expect(robotsBlocksAll("User-agent: *\nDisallow: /\n")).toBe(true);
  expect(robotsBlocksAll("User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php")).toBe(false);
  expect(robotsBlocksAll("User-agent: Googlebot\nDisallow: /")).toBe(false);
  expect(robotsBlocksAll("User-agent: *\nDisallow: /\nAllow: /shop")).toBe(false);
  expect(robotsBlocksAll("")).toBe(false);
 });
 it("reads noindex from the header and from the page",()=>{
  expect(pageIsNoindex(new Headers({"x-robots-tag":"noindex, nofollow"}),"")).toEqual({header:true,meta:false});
  expect(pageIsNoindex(new Headers(),`<meta name='robots' content='noindex, nofollow' />`)).toEqual({header:false,meta:true});
  expect(pageIsNoindex(new Headers(),`<meta name="robots" content="max-image-preview:large">`)).toEqual({header:false,meta:false});
 });
 it("spots a storefront that still shows products",()=>{
  expect(showsProducts(`<ul class="products columns-4"><li class="product type-product">`)).toBe(true);
  expect(showsProducts(`<script type="application/ld+json">{"@type":"Product"}</script>`)).toBe(true);
  expect(showsProducts(`<h1>Coming soon</h1>`)).toBe(false);
 });
 it("an API that asks for a key counts as answering",()=>{
  expect(restAnswers(401)).toBe(true);expect(restAnswers(404)).toBe(false);expect(restAnswers(503)).toBe(false);
 });
});
