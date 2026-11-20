import {prepareContent,validateContentDraft,type VerifiedFact} from "./research-evidence";
import type {MarketCode} from "./markets";
type Channel="storefront"|"seo"|"social"|"ad";
type Reservation={id:string;market:MarketCode;task:"localized_content";dedupeKey:string;reservedMicrousd:bigint};
type ProviderResult={draft:unknown;actualMicrousd:bigint};
type Dependencies={
 reserve:(x:{market:MarketCode;task:"localized_content";dedupeKey:string;estimateMicrousd:bigint})=>Promise<Reservation>;
 claim:(id:string,market:MarketCode)=>Promise<boolean>;
 generate:(brief:ReturnType<typeof prepareContent>,limits:{maxOutputTokens:number;reservationMicrousd:bigint})=>Promise<ProviderResult>;
 complete:(x:{jobId:string;market:MarketCode;listingId:string;actualMicrousd:bigint;draft:ReturnType<typeof validateContentDraft>;brief:ReturnType<typeof prepareContent>})=>Promise<void>;
 fail:(x:{jobId:string;market:MarketCode;reason:"provider_or_validation_failed"|"budget_overrun";actualMicrousd:bigint|null})=>Promise<void>;
};
export async function executeContentDraft(input:{market:MarketCode;listingId:string;dedupeKey:string;facts:readonly VerifiedFact[];channel:Channel;estimateMicrousd:bigint},deps:Dependencies){
 if(!input.listingId.trim()||!input.dedupeKey.trim()||input.dedupeKey.length>128||input.estimateMicrousd<=0n||input.facts.length>50)throw Error("Invalid content job");
 const brief=prepareContent(input.market,input.facts,input.channel);
 if(JSON.stringify(brief).length>30000)throw Error("Content evidence exceeds limit");
 const reservation=await deps.reserve({market:input.market,task:"localized_content",dedupeKey:input.dedupeKey,estimateMicrousd:input.estimateMicrousd});
 if(!reservation.id||reservation.market!==input.market||reservation.task!=="localized_content"||reservation.dedupeKey!==input.dedupeKey||reservation.reservedMicrousd!==input.estimateMicrousd)throw Error("Invalid reservation");
 if(!await deps.claim(reservation.id,input.market))throw Error("Job not claimable");
 let actual:bigint|null=null;
 let reason:"provider_or_validation_failed"|"budget_overrun"="provider_or_validation_failed";
 try{
  const output=await deps.generate(brief,{maxOutputTokens:1200,reservationMicrousd:reservation.reservedMicrousd});
  if(typeof output.actualMicrousd!=="bigint"||output.actualMicrousd<0n)throw Error("Invalid provider usage");
  actual=output.actualMicrousd;
  if(actual>reservation.reservedMicrousd){reason="budget_overrun";throw Error("Provider exceeded reservation");}
  const draft=validateContentDraft(output.draft,brief.facts.map(f=>f.id));
  await deps.complete({jobId:reservation.id,market:input.market,listingId:input.listingId,actualMicrousd:actual,draft,brief});
  return {jobId:reservation.id,state:"needs_human_review" as const};
 }catch(error){
  await deps.fail({jobId:reservation.id,market:input.market,reason,actualMicrousd:actual});
  throw error;
 }
}
// No provider credentials, network calls, automatic retries or publication.
// Persistence must atomically claim/complete jobs and retain failed reservations.
