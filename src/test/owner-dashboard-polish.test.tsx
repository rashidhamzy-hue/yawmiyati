import {describe,expect,it,vi} from "vitest";
import {render,screen,fireEvent,waitFor,within} from "@testing-library/react";

const calls:string[]=[];
const cur:Record<string,string>={sa:"SAR",ae:"AED",om:"OMR",eg:"EGP",iq:"IQD"};
vi.mock("@/components/store/CommercialReview",()=>({CommercialReview:()=> <div>commercial-review</div>}));
vi.mock("../components/store/EditorialImport",()=>({EditorialImport:()=> <div>editorial-import</div>}));
vi.mock("../components/store/AccountOfferReview",()=>({AccountOfferReview:()=> <div>offer-review</div>}));
vi.mock("../components/owner/OfferSelectionDemo",()=>({OfferSelectionDemo:()=> <div>offer-demo</div>}));
vi.mock("@/components/store/OwnerActionQueue",()=>({OwnerActionQueue:()=> <div>action-queue</div>}));
vi.mock("../lib/store/dashboard-client",()=>({dashboardClient:()=>({
 signIn:async()=>"token-1",signInSession:async()=>({access:"token-1",refresh:null,expiresIn:3600}),
 summary:async(_t:string,m:string)=>{calls.push("summary:"+m);return {store:m,currency:cur[m],orders:12,customers:9,order_statuses:{delivered:7,confirmation_pending:3,refused:2},recorded_net_minor:"15050"};},
 catalog:async()=>[{listing_id:"1",slug:"cup",title:"Coffee cup",listing_status:"approved",variant_count:2,available_count:1}],
 recommendations:async()=>[{id:"r1",kind:"price_change",rationale:"Margin below floor",state:"pending",proposal:{price:"99"},created_at:"2026-11-26"}],
 policy:async()=>({enabled:false,daily_budget_microusd:0,auto_pricing_enabled:false,auto_publish_enabled:false}),
 performance:async(_t:string,m:string)=>({store:m,currency:cur[m],window_days:30,orders:{recorded:12,delivered:7,failed:1,cancelled:1,returned:2,unknown:1,booked_total_minor:"0"},ledger:{entries:3,recorded_net_minor:"15050"},marketing_observations:{records:0,impressions:"0",clicks:"0",submitted_orders:"0",delivered_orders:"0",spend_minor:"0"},warnings:[]}),
 review:async()=>undefined,pauseAi:async()=>undefined,
})}));

const {Route}=await import("../routes/admin");
const Dashboard=Route.options.component as () => JSX.Element;

describe("polished owner dashboard",()=>{
 it("signs in, shows KPIs, catalog, approvals and switches markets",async()=>{
  render(<Dashboard/>);
  expect(screen.getByRole("heading",{name:"Owner sign in"})).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Email"),{target:{value:"o@x.com"}});
  fireEvent.change(screen.getByLabelText("Password"),{target:{value:"pw"}});
  fireEvent.click(screen.getByRole("button",{name:"Sign in"}));
  await screen.findByText("Coffee cup",undefined,{timeout:3000}).catch(()=>null);
  await waitFor(()=>expect(screen.getAllByText("Coffee cup").length).toBeGreaterThan(0));
  const overview=screen.getByRole("region",{name:"Market overview"});
  expect(within(overview).getByText("Recorded orders").parentElement!.textContent).toContain("12");
  expect(within(overview).getByText("150.50 SAR")).toBeInTheDocument();
  expect(screen.getByRole("button",{name:"Approve proposal"})).toBeInTheDocument();
  expect(screen.getByText("Proposal details")).toBeInTheDocument();
  expect(screen.getByText("action-queue")).toBeInTheDocument();
  expect(screen.getByRole("img",{name:/Delivered 7, Returned 2, Failed 1/})).toBeInTheDocument();
  const selector=screen.getByRole("radiogroup",{name:"Owner market selector"});
  expect(within(selector).getAllByRole("radio")).toHaveLength(5);
  fireEvent.click(within(selector).getByRole("radio",{name:/Egypt/}));
  await waitFor(()=>expect(calls).toContain("summary:eg"));
  await waitFor(()=>expect(within(selector).getByRole("radio",{name:/Egypt/})).toHaveAttribute("aria-checked","true"));
  fireEvent.click(screen.getByRole("button",{name:/Sign out/}));
  expect(screen.getByRole("heading",{name:"Owner sign in"})).toBeInTheDocument();
 });
});
