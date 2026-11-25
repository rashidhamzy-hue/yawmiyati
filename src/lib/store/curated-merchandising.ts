import type {PublicListing} from "./public-catalog";
/** Diversity-first merchandising, not a sales or popularity prediction. */
export function curateCatalog(rows:readonly PublicListing[],categories:readonly string[]):PublicListing[]{
 const groups=new Map(categories.map(c=>[c,[] as PublicListing[]]));
 const fallback:PublicListing[]=[];
 for(const row of rows){
  const cat=row.approved_category_slugs?.find(c=>groups.has(c));
  if(cat)groups.get(cat)!.push(row);else fallback.push(row);
 }
 const out:PublicListing[]=[];
 const seen=new Set<string>();
 const add=(p:PublicListing)=>{if(!seen.has(p.listing_id)){seen.add(p.listing_id);out.push(p);}};
 while([...groups.values()].some(g=>g.length)){for(const group of groups.values()){const item=group.shift();if(item)add(item);}}
 fallback.forEach(add);
 return out;
}
