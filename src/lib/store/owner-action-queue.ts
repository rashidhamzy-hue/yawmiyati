/**
 * M5G: actionable, observational owner queue from existing market-scoped
 * dashboard RPC responses. Does not create or approve releases.
 */
import {markets,type MarketCode} from "./markets";
import type {AiPolicy,CatalogRow,Recommendation} from "./dashboard-client";
export type OwnerAction={
 readonly code:string;readonly urgency:"review"|"information";
 readonly title:string;readonly explanation:string;
 readonly destination:"#approvals"|"#catalog"|"#safety";
};
export type OwnerActionSummary={
 readonly market:MarketCode;readonly pendingProposalCount:number|null;
 readonly catalogRecordCount:number|null;readonly aiPolicyKnown:boolean;
 readonly liveReleaseVerified:false;readonly actions:readonly OwnerAction[];
};
export function summarizeOwnerActions(
 market:MarketCode,catalog:readonly CatalogRow[]|null,
 recommendations:readonly Recommendation[]|null,policy:AiPolicy|null,
):OwnerActionSummary{
 if(!Object.hasOwn(markets,market))throw Error("Invalid owner market");
 const actions:OwnerAction[]=[];
 const add=(code:string,urgency:OwnerAction["urgency"],title:string,explanation:string,destination:OwnerAction["destination"])=>
  actions.push({code,urgency,title,explanation,destination});
 if(policy===null)add("policy_not_loaded","review","Verify AI operating policy",
  "The selected market's AI settings were not confirmed. Do not infer that automation is enabled or disabled.","#safety");
 else if(policy.enabled||policy.auto_pricing_enabled||policy.auto_publish_enabled)
  add("automation_enabled","review","Check automation and pause if necessary",
  "The selected market reports an enabled AI or automatic-change setting. Confirm budgets and approvals before any live operation.","#safety");
 const pending=recommendations?.filter(r=>r.state==="pending").length??null;
 if(recommendations===null)add("proposals_unknown","review","Check the proposal queue",
  "Owner review items could not be confirmed from the selected market.","#approvals");
 else if(pending!==null&&pending>0)add("proposals_pending","review",pending+" proposal"+(pending===1?"":"s")+" awaiting your decision",
  "Review source evidence, costs and proposed content before acting. Reviewing a proposal is not publication.","#approvals");
 if(catalog===null)add("catalog_unknown","review","Check catalog records",
  "No catalog response is available for this market.","#catalog");
 else if(catalog.length===0)add("catalog_empty","information","Catalog has no returned listings",
  "No listings were returned. This does not prove the supplier has no products or that any import was attempted.","#catalog");
 else if(catalog.some(r=>r.available_count>0))
  add("inventory_observation","review","Confirm current stock before selling",
  "Recorded available units are observations, not a verified current supplier stock feed.","#catalog");
 add("release_requirements","review","Keep commercial launch blocked",
  "Verify country-specific supplier contracts, shipping/COD, approved media, legal pages and checkout before enabling sales.","#safety");
 return {market,pendingProposalCount:pending,catalogRecordCount:catalog?.length??null,
  aiPolicyKnown:policy!==null,liveReleaseVerified:false,actions};
}
