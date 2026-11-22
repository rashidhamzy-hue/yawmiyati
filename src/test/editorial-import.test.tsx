// @vitest-environment jsdom
import {fireEvent,render,screen,within} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import {cleanup} from "@testing-library/react";
import {dashboardClient} from "../lib/store/dashboard-client";
import {EditorialImport} from "../components/store/EditorialImport";

afterEach(cleanup);
it("approves a country batch and reopens its saved contents after remount",async()=>{
  const page={title:"رف المطبخ",description:"رف قابل للتعديل",category:"المطبخ",components:[{id:"رف",quantity:3}],
    priceMinor:9000,shippingMinor:1000,images:[],faq:[{question:"ماذا تشمل العبوة؟",answer:"ثلاثة رفوف"}],seoTitle:"رفوف",seoDescription:"رفوف المطبخ"};
  const packet={schema:"yawmiyati-editorial-2",market:"sa",demo:false,sku:"SA-3",woo:{productId:1},page};
  const client=dashboardClient("https://staging.test","public",vi.fn(async(input,init)=>{
    const path=new URL(String(input)).pathname;
    const body=JSON.parse(String(init?.body));
    expect(body.p_store).toBe("sa");
    if(path.endsWith("import_editorial_batch")){
      expect(body.p_items).toEqual([packet]);return Response.json([{sku:"SA-3",listing:"listing-1"}]);
    }
    expect(path).toMatch(/owner_editorial_page$/);expect(body.p_listing).toBe("listing-1");return Response.json(page);
  }));
  const props={client,market:"sa" as const,token:"owner",catalog:[{listing_id:"listing-1",title:"Saved page"}]};
  const view=render(<EditorialImport {...props}/>);
  fireEvent.click(screen.getByText("Batch product pages"));
  fireEvent.change(screen.getByLabelText("Editorial batch"),{target:{files:[{text:async()=>JSON.stringify([packet])}]}});
  fireEvent.click(await screen.findByText("Approve 1 private product pages"));
  await screen.findByText("Saved to private catalog drafts.");
  view.unmount();render(<EditorialImport {...props}/>);
  fireEvent.click(screen.getByText("Batch product pages"));
  fireEvent.change(screen.getByLabelText("Reopen a catalog page"),{target:{value:"listing-1"}});
  const article=await screen.findByRole("article");
  expect(within(article).getByText(page.description)).toBeTruthy();
  expect(within(article).getByText(page.faq[0]!.answer)).toBeTruthy();
});
