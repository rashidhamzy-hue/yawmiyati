import {useState} from "react";
import type {dashboardClient} from "../../lib/store/dashboard-client";
import type {MarketCode} from "../../lib/store/markets";
import {EditorialPage,type EditorialPageData} from "./EditorialPage";
type Item={schema:string;market:string;demo:boolean;sku:string;page:EditorialPageData};
export function EditorialImport({client,token,market,catalog}:{catalog:{listing_id:string;title:string}[];client:ReturnType<typeof dashboardClient>;token:string;market:MarketCode}){
 const [items,setItems]=useState<Item[]>([]),[index,select]=useState(0),[busy,working]=useState(false),[status,message]=useState("");
 const [saved,setSaved]=useState<{listing:string;sku:string}[]>([]),[preview,show]=useState<EditorialPageData|null>(null);
 async function choose(file?:File){setItems([]);setSaved([]);show(null);select(0);if(!file)return;working(true);
  try{
    const data=JSON.parse(await file.text());
    if(!Array.isArray(data)||!data.length||data.length>150||data.some(x=>x?.schema!=="yawmiyati-editorial-2"||x.market!==market||x.demo!==false||
      !x.woo||typeof x.page?.title!=="string"||!Array.isArray(x.page?.faq)||!Array.isArray(x.page?.images)||!Array.isArray(x.page?.components)||
      x.page.faq.some((q:any)=>typeof q?.answer!=="string"||typeof q?.question!=="string")||x.page.images.some((m:any)=>typeof m?.alt!=="string"||!/^data:image\/(png|jpeg);base64,/.test(m.src))||
      x.page.components.some((c:any)=>typeof c?.id!=="string"||!Number.isInteger(c?.quantity))))throw Error("Choose a non-demo editorial batch for this country.");
    setItems(data);message("Review the pages, then approve this batch.");
  }catch(e){message(e instanceof Error?e.message:"Cannot read file");}finally{working(false);}
 }
 async function approve(){working(true);try{const chunks:Item[][]=[];let chunk:Item[]=[],bytes=0;
    for(const item of items){const size=new Blob([JSON.stringify(item)]).size;
      if(size>20_000_000)throw Error("One page exceeds 20 MB. Reduce its image sizes.");
      if(bytes+size>20_000_000){chunks.push(chunk);chunk=[];bytes=0;}chunk.push(item);bytes+=size;}
    if(chunk.length)chunks.push(chunk);
    for(const part of chunks){const result:{listing:string;sku:string}[]=await client.importEditorial(token,market,part);
      setSaved(previous=>[...previous.filter(x=>!result.some(y=>y.listing===x.listing)),...result]);}
    setItems([]);message("Saved to private catalog drafts.");}catch{message("Import interrupted. Saved pages are listed below. Check freshness, approvals and image sizes, then retry.");}finally{working(false);}}
 return <details className="rounded-xl border p-4"><summary>Batch product pages</summary>
 <input type="file" accept=".json" aria-label="Editorial batch" disabled={busy} onChange={e=>void choose(e.target.files?.[0])}/>
 {items.length>0&&<><select value={index} onChange={e=>select(Number(e.target.value))}>{items.map((x,i)=><option key={x.sku} value={i}>{x.page.title}</option>)}</select>
 <EditorialPage page={items[index]!.page} market={market}/><button disabled={busy} onClick={()=>void approve()}>Approve {items.length} private product pages</button></>}
 {saved.map(x=><button key={x.listing} disabled={busy} onClick={async()=>{working(true);try{show(await client.ownerEditorial(token,market,x.listing));}catch{message("Preview unavailable");}finally{working(false);}}}>{x.sku} · Open saved preview</button>)}
 {catalog.length>0&&<label>Reopen a catalog page <select defaultValue="" disabled={busy} onChange={async e=>{const id=e.target.value;if(!id)return;working(true);try{const page=await client.ownerEditorial(token,market,id);show(page);message(page?"Saved preview opened.":"This listing has no saved editorial page.");}catch{message("Preview unavailable");}finally{working(false);}}}><option value="">Choose a listing</option>{catalog.map(x=><option key={x.listing_id} value={x.listing_id}>{x.title}</option>)}</select></label>}
 {preview&&<EditorialPage page={preview} market={market}/>}<p role="status">{status}</p></details>;
}
