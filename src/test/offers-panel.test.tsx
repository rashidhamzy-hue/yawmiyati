import {cleanup,fireEvent,render,screen,waitFor,within} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import {OffersPanel} from "../components/owner/OffersPanel";

afterEach(cleanup);
const offer=(o:Record<string,unknown>)=>({listing_id:null,quantity:null,slug:null,title:null,items:[],separate_minor:null,profit_if_split_minor:null,profit_if_split_usd:null,problem:null,detail:null,shown:false,...o});
describe("owner approval of bundles, discounts and offers",()=>{
 it("shows profit per delivered order in US dollars, blocks unsafe offers and sends the owner's decision",async()=>{
  const decisions:unknown[]=[];
  const rows=[
   offer({id:"q1",kind:"quantity",status:"proposed",quantity:2,title:"خلاط",price_minor:25900,price_usd:69.07,separate_minor:29800,profit_minor:8925,profit_usd:23.8}),
   offer({id:"b1",kind:"bundle",status:"proposed",title:"خلاط + رف",price_minor:22900,price_usd:61.07,separate_minor:24800,profit_minor:8670,profit_usd:23.12,profit_if_split_minor:5870,profit_if_split_usd:15.65}),
   offer({id:"b2",kind:"bundle",status:"proposed",title:"خلاط + طقم جاهز",price_minor:24900,price_usd:66.4,profit_minor:100,profit_usd:0.27,problem:"piece_is_supplier_bundle"}),
   offer({id:"f1",kind:"free_delivery",status:"approved",price_minor:40000,price_usd:106.67,profit_minor:595,profit_usd:1.59,detail:"خلاط",shown:true}),
  ];
  const request=vi.fn(async(url:URL|RequestInfo,init?:RequestInit)=>{const fn=String(url).split("/rpc/")[1];if(fn==="brain_offer_decide"){decisions.push(JSON.parse(String(init?.body)));return Response.json({});}return Response.json(rows);}) as unknown as typeof fetch;
  render(<OffersPanel market="sa" origin="https://x.supabase.co" publicKey="pk" token="jwt" request={request}/>);
  await waitFor(()=>expect(screen.getByText("خلاط + رف")).toBeInTheDocument());
  const set=screen.getByText("خلاط + رف").closest("tr")!;
  expect(within(set).getByText("$23.12")).toBeInTheDocument();expect(within(set).getByText(/two parcels: \$15\.65/)).toBeInTheDocument();
  expect(within(set).getByText(/229 SAR/)).toBeInTheDocument();
  const unsafe=screen.getByText("خلاط + طقم جاهز").closest("tr")!;
  expect(within(unsafe).getByRole("button",{name:"Approve"})).toBeDisabled();
  expect(within(unsafe).getByText(/single products only/)).toBeInTheDocument();
  expect(screen.getByText("On the store now")).toBeInTheDocument();
  expect(screen.getByRole("button",{name:"Approve all safe (2)"})).toBeEnabled();
  fireEvent.click(within(set).getByRole("button",{name:"Approve"}));
  await waitFor(()=>expect(decisions).toEqual([{p_store:"sa",p_offer:"b1",p_decision:"approved"}]));
 });
});
