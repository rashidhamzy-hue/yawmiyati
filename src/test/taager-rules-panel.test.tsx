import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {TaagerRules} from "../components/owner/TaagerRules";

afterEach(()=>cleanup());
const overview={facts:[
 {id:"f1",key:"delivery_fee",value:{flat_minor:3200},summary:"Delivery fee 32 SAR per order, everywhere in Saudi Arabia.",quote:"Shipping costs are 32 Saudi riyals",source_path:"/sa/info",source_read_at:"2026-12-05T08:00:00Z",confidence:"high",decision:"pending",previous_value:{flat_minor:2800},changed_at:"2026-12-05T08:10:00Z"},
 {id:"f2",key:"vat",value:{on_added_profit_bps:1500},summary:"15% of the profit added above Taager's minimum is deducted as VAT.",quote:"15% of the added profit",source_path:"/sa/info",source_read_at:"2026-12-05T08:00:00Z",confidence:"high",decision:"agrees",previous_value:null,changed_at:null}],
 pages:[{path:"/sa/info",title:"Shipping",version:2,read_at:"2026-12-05T08:00:00Z",imported_at:"2026-12-05T08:10:00Z",last_seen_at:"2026-12-05T08:10:00Z",characters:900}],
 guards:{delivery_fee_minor:3200,base_delivery_fee_minor:2800,vat_added_profit_bps:1500,refusal_charge_minor:0,undelivered_cost_minor:0}};
describe("Taager rules in /admin",()=>{
 it("shows each fact with its page and date, both figures of a contradiction, and lets the owner make the page win",async()=>{
  const calls:{fn:string;body:any}[]=[];
  const request=vi.fn(async(url:URL|string,init?:RequestInit)=>{const fn=String(url).split("/rpc/")[1]!;calls.push({fn,body:JSON.parse(String(init!.body))});
   if(fn==="taager_page_versions")return new Response(JSON.stringify([{version:2,title:"",read_at:null,imported_at:"",text:"Shipping costs are 32 Saudi riyals"},{version:1,title:"",read_at:null,imported_at:"",text:"Shipping costs are 28 Saudi riyals"}]));
   return new Response(JSON.stringify(fn==="taager_facts_overview"?overview:{}));}) as unknown as typeof fetch;
  render(<TaagerRules market="sa" origin="https://x.supabase.co" publicKey="k" token="t" request={request}/>);
  await waitFor(()=>expect(screen.getByText(/1 waiting for your decision/)).toBeTruthy());
  const fee=document.querySelector('[data-rule="delivery_fee"]')!;
  expect(fee.textContent).toContain("Our figure: 28 SAR. The page: 32 SAR.");expect(fee.textContent).toContain("prices are already checked against it");
  expect(fee.textContent).toContain("Source: /sa/info · read 5 Dec 2026");expect(fee.textContent).toContain("Changed on 5 Dec 2026");
  expect(screen.getByText(/delivery fee up to/).textContent).toContain("32 SAR ($8.53)");
  expect(document.querySelector('[data-rule="vat"]')!.querySelector("button")).toBeNull(); // nothing to decide when the page agrees
  fireEvent.click(screen.getByRole("button",{name:"Use the page"}));
  await waitFor(()=>expect(calls.some(c=>c.fn==="taager_fact_decide"&&c.body.p_fact==="f1"&&c.body.p_decision==="confirmed")).toBe(true));
  fireEvent.click(screen.getByText(/Pages stored/));fireEvent.click(screen.getByRole("button",{name:"What changed"}));
  await waitFor(()=>expect(screen.getByText("+ Shipping costs are 32 Saudi riyals")).toBeTruthy());
 });
});
