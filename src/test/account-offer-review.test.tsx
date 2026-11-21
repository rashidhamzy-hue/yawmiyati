// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import {AccountOfferReview} from "../components/store/AccountOfferReview";
import type {dashboardClient} from "../lib/store/dashboard-client";
afterEach(cleanup);
it("reviews a native offer, saves its pack and price and revokes with the recorded version",async()=>{
 const p={schema:"yawmiyati-offer-1",market:"sa",sku:"KIT",demo:false,title:"رف",revision:"a".repeat(64),priceMinor:14000,expectedContributionMinor:"2200",components:[{id:"rack",quantity:3}]};
 const read=vi.fn().mockResolvedValue(null);
 const save=vi.fn().mockResolvedValueOnce({approved:true,sequence:"1",proposal:p}).mockResolvedValueOnce({approved:false,sequence:"2",proposal:p});
 const client={offerDecision:read,saveOfferDecision:save} as unknown as ReturnType<typeof dashboardClient>;
 render(<AccountOfferReview market="sa" token="owner" client={client}/>);
 fireEvent.click(screen.getByText("Account offer decisions"));
 const input=screen.getByLabelText("Paste an account proposal from catalog review");
 fireEvent.change(input,{target:{value:JSON.stringify({...p,demo:true})}});
 fireEvent.click(screen.getByText("Review offer"));
 expect(read).not.toHaveBeenCalled();
 fireEvent.change(input,{target:{value:JSON.stringify(p)}});
 fireEvent.click(screen.getByText("Review offer"));
 fireEvent.click(await screen.findByText("Approve this offer"));
 await waitFor(()=>expect(save).toHaveBeenCalledWith("owner","sa",p,true,"0"));
 fireEvent.click(await screen.findByText("Revoke approval"));
 await waitFor(()=>expect(save).toHaveBeenCalledWith("owner","sa",p,false,"1"));
});
