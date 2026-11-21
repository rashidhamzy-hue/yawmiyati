import {expect,it} from "vitest";
import {readOfflineDraft} from "../lib/store/import-offline-draft";
import type {CandidateRow} from "../lib/store/dashboard-client";
it("loads only an exact current non-demo owner candidate for human review",()=>{
  const observedAt="2026-11-21T12:00:00Z";
  const row={woo_product_id:20,supplier_sku:"A",observed_at:observedAt} as CandidateRow;
  const packet={schema:"yawmiyati-draft-1",sku:"A",market:"sa",demo:false,revision:"a".repeat(64),
    woo:{productId:20,variationId:0,observedAt},title:"رف",description:"رف للمطبخ"};
  const load=(extra:object)=>readOfflineDraft(JSON.stringify({...packet,...extra}),"sa",row);
  expect(load({})).toEqual({title:packet.title,description:packet.description});
  for(const changes of [{demo:true},{market:"om"},{sku:"B"},{woo:null},{woo:{...packet.woo,variationId:1}},
    {woo:{...packet.woo,observedAt:"2020-01-01"}},{revision:""}])expect(()=>load(changes)).toThrow();
});
