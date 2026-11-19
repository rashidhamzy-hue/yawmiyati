import {it,expect} from "vitest";
import {assessResearch,prepareContent,validateContentDraft,type Observation} from "../lib/store/research-evidence";
import {scoringWeights} from "../lib/store/intelligence";
const at="2026-11-19T12:00:00Z";
const evidence:Observation[]=Object.keys(scoringWeights).map(factor=>({factor:factor as Observation["factor"],score:80,source:"verified fixture",observedAt:at,market:"sa",sku:"A",verified:true}));
it("does not rank missing, stale, unverified or foreign-market evidence",()=>{
 const base=assessResearch("sa","A",evidence,at);expect(base.score).toBe(80);
 const incomplete=assessResearch("sa","A",evidence.map((o,i)=>i===0?{...o,market:"eg"}:o),at);expect(incomplete.score).toBeNull();expect(incomplete.missing).toContain("profit");
 expect(assessResearch("sa","A",evidence,"2027-01-01T12:00:00Z").score).toBeNull();
 expect(assessResearch("sa","A",evidence.map(o=>({...o,verified:false})),at).score).toBeNull();
});
it("rejects conflicting scores at identical times",()=>expect(()=>assessResearch("sa","A",[...evidence,{...evidence[0],score:10}],at)).toThrow());
it("only passes verified facts into localized content briefs",()=>{
 const brief=prepareContent("eg",[{id:"a",statement:"500 ml capacity",source:"spec sheet",verified:true},{id:"b",statement:"best seller",source:"unverified",verified:false}],"ad");
 expect(brief.locale).toBe("ar-EG");expect(brief.facts.map(f=>f.id)).toEqual(["a"]);
});
it("requires a known fact for each segment but leaves human review mandatory",()=>{
 expect(()=>validateContentDraft({segments:[{text:"100% guaranteed",factIds:["b"]}]},["a"])).toThrow();
 expect(validateContentDraft({segments:[{text:"500 ml",factIds:["a"]}]},["a"]).state).toBe("needs_human_review");
});
