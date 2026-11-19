import {it,expect} from "vitest";
import {assessOrderObservation,type OrderObservation} from "../lib/store/fulfillment-state";
const current={market:"sa" as const,orderId:"fixture",state:"shipped" as const,lastEventAt:"2026-11-19T10:00:00Z"};
const event:OrderObservation={market:"sa",orderId:"fixture",eventId:"one",state:"delivered",occurredAt:"2026-11-19T11:00:00Z",source:"taager",verified:true};
it("permits a verified delivered event for shipped order",()=>expect(assessOrderObservation(current,event).decision).toBe("apply"));
it("rejects cross-market and unverified events",()=>{
 expect(assessOrderObservation(current,{...event,market:"eg"}).decision).toBe("review");
 expect(assessOrderObservation(current,{...event,verified:false}).decision).toBe("review");
 expect(assessOrderObservation(current,{...event,source:"woo"}).decision).toBe("review");
});
it("does not regress or skip states automatically",()=>{
 expect(assessOrderObservation(current,{...event,state:"pending"}).decision).toBe("review");
 expect(assessOrderObservation(current,{...event,occurredAt:"2026-11-18T11:00:00Z"}).decision).toBe("review");
 expect(assessOrderObservation({...current,state:"delivered"},event).decision).toBe("ignore");
 expect(assessOrderObservation({...current,state:"pending"},event).decision).toBe("review");
});
