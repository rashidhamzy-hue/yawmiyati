import type {MarketCode} from "@/lib/store/markets";
import type {PublicListing} from "@/lib/store/public-catalog";
import {shopCopy} from "@/lib/store/shop-copy";
import {ProductRail,ProductTile,gridClass} from "./ProductTile";

/**
 * Home merchandising from the released catalogue only: the first picks as a grid, then one rail per
 * section that has enough products. Order comes from the brain's rank; nothing here claims sales or popularity.
 */
export function HomeShelves({market,rows,categories}:{market:MarketCode;rows:readonly PublicListing[];categories:readonly {slug:string;name:string}[]}){
 const copy=shopCopy(market),path="/"+market;
 const picks=rows.slice(0,8),picked=new Set(picks.map(r=>r.listing_id));
 const rails=categories.map(c=>({c,items:rows.filter(r=>r.approved_category_slugs?.includes(c.slug as never))})).filter(x=>x.items.length>=3);
 return <>
  <div className={"mt-5 "+gridClass}>{picks.map((item,i)=><ProductTile key={item.listing_id} item={item} market={market} eager={i<2}/>)}</div>
  {rows.length>picks.length&&<div className="mt-8 text-center"><a href={path+"/search"} className="btn-outline">{copy.allProducts}</a></div>}
  <div className="-mx-4 mt-4 sm:-mx-6 lg:-mx-8">{rails.map(({c,items})=>{
   // Prefer products not already shown in the picks so every rail adds something new.
   const fresh=[...items.filter(i=>!picked.has(i.listing_id)),...items.filter(i=>picked.has(i.listing_id))].slice(0,10);
   return <ProductRail key={c.slug} title={c.name} href={path+"/c/"+c.slug} linkLabel={copy.seeAll}>{fresh.map(item=><ProductTile key={item.listing_id} item={item} market={market}/>)}</ProductRail>;
  })}</div>
 </>;
}
