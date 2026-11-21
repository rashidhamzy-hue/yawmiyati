import type { CandidateRow } from "./dashboard-client";
import type { MarketCode } from "./markets";

export function readOfflineDraft(text:string, market:MarketCode, candidate:CandidateRow) {
  if(text.length>250000) throw Error("Draft is too large");
  const d=JSON.parse(text);
  const at=Date.parse(candidate.observed_at);
  if(d?.schema!=="yawmiyati-draft-1" || d.demo!==false || d.market!==market || d.sku!==candidate.supplier_sku ||
    d.woo?.productId!==candidate.woo_product_id || d.woo.variationId!==0 || !Number.isFinite(at) ||
    Date.parse(d.woo.observedAt)!==at || !/^[a-f0-9]{64}$/.test(d.revision) ||
    typeof d.title!=="string" || !d.title.trim() || d.title.length>500 ||
    typeof d.description!=="string" || !d.description.trim() || d.description.length>10000)throw Error("Draft does not match the current candidate");
  return {title:d.title as string,description:d.description as string};
}
