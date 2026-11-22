import {useEffect,useState} from "react";
import {markets,type MarketCode} from "../../lib/store/markets";

export type EditorialPageData={title:string;description:string;category:string;components:{id:string;quantity:number}[];
  priceMinor:number;shippingMinor:number;images:{src:string;alt:string}[];faq:{question:string;answer:string}[];seoTitle:string;seoDescription:string};
export function EditorialPage({page,market,metadata=false}:{page:EditorialPageData;market:MarketCode;metadata?:boolean}){
  useEffect(()=>{
    if(!metadata)return;
    const previous=document.title,meta=document.querySelector<HTMLMetaElement>('meta[name="description"]'),desc=meta?.content;
    document.title=page.seoTitle;if(meta)meta.content=page.seoDescription;
    return ()=>{if(document.title===page.seoTitle)document.title=previous;if(meta&&desc!==undefined&&meta.content===page.seoDescription)meta.content=desc;};
  },[page,metadata]);
  const m=markets[market],amount=(n:number)=>new Intl.NumberFormat(m.locale,{style:"currency",currency:m.currency,minimumFractionDigits:m.minorDigits,maximumFractionDigits:m.minorDigits}).format(n/10**m.minorDigits);
  return <article dir="rtl" lang={m.locale} className="mx-auto max-w-4xl space-y-5 rounded-2xl border bg-card p-5">
    <p>{page.category}</p><h2 className="font-display text-3xl font-bold">{page.title}</h2>
    <div className="grid gap-3 sm:grid-cols-2">{page.images.map((img,i)=><img key={i} src={img.src} alt={img.alt} loading="lazy" className="w-full rounded-xl"/>)}</div>
    <p>{page.description}</p><ul>{page.components.map(c=><li key={c.id}>{c.quantity.toLocaleString(m.locale)} × {c.id}</li>)}</ul>
    <dl><dt>سعر المنتج</dt><dd>{amount(page.priceMinor)}</dd><dt>الشحن</dt><dd>{amount(page.shippingMinor)}</dd><dt>الإجمالي مع الشحن</dt><dd>{amount(page.priceMinor+page.shippingMinor)}</dd></dl>
    {page.faq.map((q,i)=><details key={i}><summary>{q.question}</summary><p>{q.answer}</p></details>)}
  </article>;
}
export function ReleasedEditorial({origin,apiKey,market,slug,fallback}:{origin:string;apiKey:string;market:MarketCode;slug:string;fallback:React.ReactNode}){
  const [page,setPage]=useState<EditorialPageData|null>(null);
  useEffect(()=>{const controller=new AbortController();
    fetch(new URL("/rest/v1/rpc/public_editorial_page",origin),{method:"POST",headers:{apikey:apiKey,"Content-Type":"application/json"},
      body:JSON.stringify({p_store:market,p_slug:slug}),signal:controller.signal,cache:"no-store"})
      .then(r=>r.ok?r.json():null).then(p=>{if(!controller.signal.aborted)setPage(p);}).catch(()=>{});
    return ()=>controller.abort();
  },[origin,apiKey,market,slug]);
  return page?<EditorialPage page={page} market={market} metadata/>:<>{fallback}</>;
}
