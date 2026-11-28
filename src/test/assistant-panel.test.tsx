import {describe,expect,it,vi} from "vitest";
import {render,screen,fireEvent,waitFor} from "@testing-library/react";
import {AssistantPanel} from "@/components/owner/AssistantPanel";

const today=new Date().toISOString().slice(0,10);
const status=(over:Record<string,unknown>={})=>({enabled:false,daily_budget_usd:0,daily_request_cap:0,minute_request_cap:0,model:"claude-haiku-4-5",
 days:[{day:today,calls:12,discarded:1,cost_usd:0.031,input_tokens:9000,output_tokens:1200},{day:"2026-11-01",calls:40,discarded:0,cost_usd:0.2,input_tokens:1,output_tokens:1}],...over});
const jwt="a.b.c";

describe("Shopper assistant panel",()=>{
 it("shows the switch, cap and spend in dollars, and cannot switch on without a cap",async()=>{
  const bodies:string[]=[];
  const request=vi.fn(async(url:URL|string,init?:RequestInit)=>{
   const path=new URL(String(url)).pathname;bodies.push(path.split("/").pop()+" "+String(init?.body));
   if(path.endsWith("assistant_owner_status"))return Response.json(status());
   if(path.endsWith("assistant_owner_set")){const b=JSON.parse(String(init?.body));return Response.json(status({enabled:b.p_enabled,daily_budget_usd:b.p_daily_budget_usd,daily_request_cap:2500,minute_request_cap:20}));}
   return new Response("{}",{status:404});
  }) as unknown as typeof fetch;
  render(<AssistantPanel market="sa" origin="https://x.supabase.co" publicKey="k" token={jwt} request={request}/>);
  await screen.findByText("AI off");
  expect(screen.getAllByText(/\$0\.031/).length).toBeGreaterThanOrEqual(2);
  expect(screen.getByText("$0.231")).toBeTruthy();
  expect(screen.getByText(/52 AI answers in 30 days, 1 thrown away/)).toBeTruthy();
  const on=screen.getByRole("button",{name:"Switch AI on for visitors"}) as HTMLButtonElement;
  expect(on.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText(/Daily cap for this store/),{target:{value:"1"}});
  expect(on.disabled).toBe(false);
  fireEvent.click(screen.getByRole("button",{name:"Save cap, keep off"}));
  await waitFor(()=>expect(bodies.some(b=>b.startsWith("assistant_owner_set")&&b.includes('"p_enabled":false')&&b.includes('"p_daily_budget_usd":1'))).toBe(true));
  await screen.findByText(/it answers from the store's published facts only/);
  expect(screen.getByText("AI off")).toBeTruthy();
 });
 it("refuses a cap above $20 before calling the server",async()=>{
  const request=vi.fn(async(url:URL|string)=>new URL(String(url)).pathname.endsWith("assistant_owner_status")?Response.json(status({enabled:true,daily_budget_usd:2})):Response.json({})) as unknown as typeof fetch;
  render(<AssistantPanel market="eg" origin="https://x.supabase.co" publicKey="k" token={jwt} request={request}/>);
  await screen.findByText("AI on for visitors");
  fireEvent.change(screen.getByLabelText(/Daily cap for this store/),{target:{value:"50"}});
  fireEvent.click(screen.getByRole("button",{name:"Save cap"}));
  await screen.findByText(/between \$0 and \$20/);
  expect((request as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
 });
});
