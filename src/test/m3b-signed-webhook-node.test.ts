/**
 * Node-only HMAC verification test. Never imported by the owner browser bundle.
 * Synthetic credentials and events; no server/provider calls.
 */
import {describe,it,expect,vi} from "vitest";
import {createSimulatedOutbox} from "../lib/store/simulation/outbox";
import {createSignedSyntheticEvent,acceptSignedSyntheticEvent} from "../lib/store/simulation/signed-webhook";
import {SIMULATION_MODE} from "../lib/store/simulation/fixtures";

describe("M3B signed synthetic webhook tampering — Node-only",()=>{
 for(const market of ["sa","ae","om","eg","iq"] as const){
  it("rejects a tampered HMAC event in "+market+" without queuing work",()=>{
   const secret="offline-test-secret-strong";
   const event=createSignedSyntheticEvent({
    mode:SIMULATION_MODE,market,eventId:"tampered-"+market,
    orderId:"SIM-"+market.toUpperCase()+"-ORDER-00001",
    status:"confirmed",secret,
   });
   const outbox=createSimulatedOutbox();
   const spy=vi.spyOn(globalThis,"fetch");
   try{
    expect(()=>acceptSignedSyntheticEvent({
     mode:SIMULATION_MODE,expectedMarket:market,
     event:{...event,body:new TextEncoder().encode("{}")},
     secret,outbox,nowMs:0,
    })).toThrow("invalid_signature");
    expect(outbox.snapshot().jobs).toHaveLength(0);
    expect(spy).not.toHaveBeenCalled();
   }finally{spy.mockRestore();}
  });
 }
});
