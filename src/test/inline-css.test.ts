import {describe,expect,it} from "vitest";
import {inlineStylesheet} from "../lib/inline-css";
const html=(parts:string[],type="text/html; charset=utf-8")=>new Response(new ReadableStream({start(c){for(const p of parts)c.enqueue(new TextEncoder().encode(p));c.close();}}),{headers:{"content-type":type,"content-length":"99"}});
describe("the stylesheet is written into the page",()=>{
 it("goes in just before </head>, once, also when the tag is split across chunks, and Arabic text survives",async()=>{
  const out=await inlineStylesheet(html(["<html><head><title>يومياتي</title></he","ad><body><p>تفاصيل</p><script>'</head>'</script></body></html>"]),"body{color:red}").text();
  expect(out).toBe("<html><head><title>يومياتي</title><style data-ym-css=\"\">body{color:red}</style></head><body><p>تفاصيل</p><script>'</head>'</script></body></html>");
  const one=await inlineStylesheet(html(["<html><head></head><body>x</body></html>"]),"a{}");
  expect(one.headers.get("content-length")).toBeNull();expect(await one.text()).toContain("<style data-ym-css=\"\">a{}</style></head>");
 });
 it("leaves other responses alone and cannot be closed early by the stylesheet's own text",async()=>{
  const json=html(['{"a":"</head>"}'],"application/json");
  expect(inlineStylesheet(json,"a{}")).toBe(json);
  const none=html(["<html><head></head></html>"]);expect(inlineStylesheet(none,"")).toBe(none);
  expect(await inlineStylesheet(html(["<head></head>"]),"a{content:'</style><script>x</script>'}").text()).not.toContain("</style><script>");
  expect(await inlineStylesheet(html(["no head here"]),"a{}").text()).toBe("no head here");
 });
});
