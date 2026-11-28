import {useEffect,useRef,useState} from "react";
import {Play} from "lucide-react";
import type {MarketCode} from "@/lib/store/markets";
import {productMediaPath,productVideoPath} from "@/lib/store/product-media";
import {shopCopy} from "@/lib/store/shop-copy";

type Slide={type:"image";id:string;alt:string}|{type:"video";id:string};
/**
 * Swipeable gallery (native scroll snapping, no library). The first picture paints from the small
 * card-size file the listing grid already cached, then sharpens once the page is idle. Videos load
 * only when the shopper presses play.
 */
export function ProductGallery({market,images,videos}:{market:MarketCode;images:{id:string;alt:string}[];videos:string[]}){
 const copy=shopCopy(market);
 // The first video sits right after the first picture, where shoppers look for it.
 const slides:Slide[]=[...images.slice(0,1).map(i=>({type:"image" as const,...i})),...videos.slice(0,1).map(id=>({type:"video" as const,id})),...images.slice(1).map(i=>({type:"image" as const,...i})),...videos.slice(1,2).map(id=>({type:"video" as const,id}))];
 const [index,setIndex]=useState(0),[sharp,setSharp]=useState(false),[playing,setPlaying]=useState<string|null>(null);
 const strip=useRef<HTMLDivElement>(null);
 useEffect(()=>{const t=window.setTimeout(()=>setSharp(true),1200);return()=>window.clearTimeout(t);},[]);
 const go=(i:number)=>{const el=strip.current?.children[i] as HTMLElement|undefined;if(el&&strip.current)strip.current.scrollTo({left:el.offsetLeft-strip.current.offsetLeft,behavior:"smooth"});setIndex(i);};
 const onScroll=()=>{const el=strip.current;if(!el)return;const i=Math.round(Math.abs(el.scrollLeft)/Math.max(1,el.clientWidth));if(i!==index&&i<slides.length)setIndex(i);};
 const poster=images[0]?productMediaPath(images[0].id,360):undefined;
 return <div className="min-w-0" data-product-gallery="">
  <div className="relative overflow-hidden rounded-3xl bg-surface">
   <div ref={strip} onScroll={onScroll} role="group" aria-roledescription="carousel" aria-label={copy.gallery} className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    {slides.map((s,i)=><div key={s.type+s.id} className="relative aspect-square w-full flex-none snap-center" aria-label={s.type==="image"?copy.photo(i+1,slides.length):copy.video}>
     {s.type==="image"
      ?<img src={i===0&&!sharp?productMediaPath(s.id,360):productMediaPath(s.id)} alt={s.alt} width={800} height={800} {...(i===0?{fetchPriority:"high" as const}:{loading:"lazy" as const})} decoding="async" className="h-full w-full object-contain"/>
      :playing===s.id
       ?<video controls autoPlay playsInline poster={poster} className="h-full w-full bg-black object-contain"><source src={productVideoPath(s.id)} type="video/mp4"/></video>
       :<button type="button" onClick={()=>setPlaying(s.id)} aria-label={copy.watchVideo} className="group relative block h-full w-full">
         {poster&&<img src={poster} alt="" width={360} height={360} loading="lazy" decoding="async" className="h-full w-full object-cover opacity-80"/>}
         <span className="absolute inset-0 grid place-items-center bg-black/25"><span className="grid h-16 w-16 place-items-center rounded-full bg-card text-foreground shadow-lift transition-transform group-hover:scale-105"><Play className="ms-1 h-7 w-7" fill="currentColor" aria-hidden="true"/></span></span>
        </button>}
    </div>)}
   </div>
   {slides.length>1&&<span className="pointer-events-none absolute bottom-3 start-3 rounded-full bg-foreground/75 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-background" dir="ltr" aria-hidden="true">{index+1} / {slides.length}</span>}
  </div>
  {slides.length>1&&<div className="ym-scroller mt-3">
   {slides.map((s,i)=><button key={s.type+s.id} type="button" onClick={()=>go(i)} aria-label={s.type==="image"?copy.photo(i+1,slides.length):copy.video} aria-current={i===index?"true":undefined}
     className={"relative h-16 w-16 overflow-hidden rounded-xl bg-surface ring-2 ring-offset-2 ring-offset-background transition-shadow "+(i===index?"ring-foreground":"ring-transparent")}>
     <img src={s.type==="image"?productMediaPath(s.id,360):poster??""} alt="" width={64} height={64} loading="lazy" decoding="async" className="h-full w-full object-cover"/>
     {s.type==="video"&&<span className="absolute inset-0 grid place-items-center bg-black/35 text-white"><Play className="h-5 w-5" fill="currentColor" aria-hidden="true"/></span>}
    </button>)}
  </div>}
 </div>;
}
