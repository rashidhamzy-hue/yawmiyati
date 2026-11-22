import {markets} from "../../src/lib/store/markets";
import type {analyze} from "./workspace";
const names={sa:"Saudi Arabia",ae:"United Arab Emirates",om:"Oman",eg:"Egypt",iq:"Iraq"};
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));

export function reviewBoard(report:ReturnType<typeof analyze>, demo:boolean){
  const sections=report.map(store=>{
    const {currency,minorDigits}=markets[store.market];
    function price(n:number|string|null){if(n===null)return "Unknown";return (Number(n)/10**minorDigits).toFixed(minorDigits)+" "+currency;}
    const cards=store.decisions.map(row=>{
      const control=row.selected?'<label><input type="checkbox" data-market="'+store.market+'" data-sku="'+escape(row.sku)+'" value="'+row.revision+'"> Include in approval file</label>':'';
      const reason=row.reasons.length?row.reasons.join(", ").replaceAll("_"," "):row.disposition.replaceAll("_"," ");
      const labels:Record<string,string>={regular:"Regular price",maximum_item_discount:"Largest affordable item discount",merchant_funded_shipping:"Cover this delivery fee"};
      const options=row.promotionOptions.map(option=>'<li><strong>'+labels[option.kind]+'</strong>: '+price(option.doorTotalMinor)+' at the door · expected contribution '+price(option.expectedContributionMinor)+' · downside '+price(option.downsideContributionMinor)+' · '+(option.meetsTarget?'meets target':'below target')+(option.requiresShippingVerification?' · verify courier collection before use':'')+'</li>').join("");
      const promotion=options?'<details><summary>Compare offers for this pack and delivery fee</summary><ul>'+options+'</ul></details>':'';
      return '<article><h3 dir="auto">'+escape(row.title)+'</h3><small>'+escape(row.sku)+'</small><p>'+escape(reason)+'</p><dl><dt>Proposed price</dt><dd>'+price(row.proposedPriceMinor)+'</dd><dt>Expected contribution per order</dt><dd>'+price(row.expectedContributionMinor)+'</dd></dl><details><summary>Evidence and pack contents</summary><p>'+escape((row.components??[]).map(c=>c.quantity+" × "+c.id).join(", ")||"Contents unverified")+'</p><p>Local delivered price: '+price(row.comparison?.deliveredMinor??null)+'</p><p>'+escape(row.comparison?.source??"No matching comparison")+'</p>'+row.research.map(o=>'<p>'+escape(o.factor+" · "+o.score+" · "+o.source)+'</p>').join("")+'</details>'+promotion+control+'</article>';
    }).join("");
    return '<section><h2>'+names[store.market]+'</h2><p>'+store.read+' offers read · '+store.selected.length+' recommended families · '+store.coverage+' coverage</p><div class="grid">'+cards+'</div></section>';
  }).join("");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Yawmiyati catalog review</title>
<style>*{box-sizing:border-box}body{max-width:1150px;margin:auto;padding:clamp(16px,4vw,48px);background:#f7f5ef;color:#1c3228;font:1rem/1.5 system-ui}h1{font-size:clamp(2.1rem,6vw,4rem);letter-spacing:-.055em;margin:.4em 0}h2{margin-bottom:0}section{margin:2.5rem 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:12px}article{background:#fff;border:1px solid #d7dcd6;border-radius:12px;padding:18px;overflow-wrap:anywhere}h3{margin:0;font-size:1.25rem}dt,small{color:#536457}dd{margin:0 0 .5rem;font-weight:650}label,summary{cursor:pointer}label{display:block;margin-top:1rem}button{font:inherit;border:0;border-radius:8px;background:#204f39;color:white;padding:12px 18px;cursor:pointer}button:disabled{opacity:.55}footer{background:#f7f5ef;padding:12px 0;position:sticky;bottom:0;border-top:1px solid #b3c0b6}</style>
<h1>Catalog review</h1><p>${demo?"Fictional five-market catalog. ":""}Select the offers you want to approve.</p>${sections}
<footer><button disabled>Download selected offers</button> <output>0 selected</output></footer>
<script>
const controls=[...document.querySelectorAll("input")],button=document.querySelector("button");
function selected(){return controls.filter(el=>el.checked)}
document.addEventListener("change",()=>{button.disabled=!selected().length;document.querySelector("output").textContent=selected().length+" selected"});
button.onclick=()=>{const items=selected().map(el=>({market:el.dataset.market,sku:el.dataset.sku,revision:el.value}));
const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([JSON.stringify(items,null,2)],{type:"application/json"}));link.download="selected-offers.json";link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000)};
</script></html>`;
}
