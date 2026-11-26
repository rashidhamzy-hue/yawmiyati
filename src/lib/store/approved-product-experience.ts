/**
 * Milestone 2B: presentation ONLY for the released public catalog.
 * Never import legacy catalog.ts or simulation fixtures here.
 * Current public RPCs expose only listing_id, slug, title, price_minor,
 * currency, and (detail only) description. Nothing implies media, stock,
 * availability, variants, category membership, discounts or delivery.
 */
import { markets, type MarketCode } from "./markets";
import { formatListingPrice, type PublicDetail, type PublicListing } from "./public-catalog";

export type ApprovedSort = "popular" | "default" | "price_asc" | "price_desc" | "title";
export type ApprovedFilter = {
  query?: string;
  sort?: ApprovedSort;
  minPriceMinor?: number;
  maxPriceMinor?: number;
  page?: number;
  pageSize?: number;
};
export type ApprovedResult = {
  products: PublicListing[];
  total: number;
  page: number;
  pages: number;
};

/** Safe client-side refinement of *already released* public RPC results. */
export function filterApprovedListings(rows: readonly PublicListing[], market: MarketCode, filter: ApprovedFilter = {}): ApprovedResult {
  const { query = "", sort = "default", minPriceMinor, maxPriceMinor, page = 1, pageSize = 12 } = filter;
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 48)
    throw Error("invalid_pagination");
  if (!["popular", "default", "price_asc", "price_desc", "title"].includes(sort)) throw Error("invalid_sort");
  if (query.length > 120) throw Error("invalid_query");
  if ([minPriceMinor,maxPriceMinor].some(v => v !== undefined && (!Number.isSafeInteger(v) || v < 0)) ||
      (minPriceMinor !== undefined && maxPriceMinor !== undefined && minPriceMinor > maxPriceMinor))
    throw Error("invalid_price_range");
  const normalized = normalizeArabic(query);
  const seen = new Set<string>();
  const valid = rows.map(row => {
    if (!row || !row.listing_id || !row.slug || !row.title || row.currency !== markets[market].currency ||
        !/^\d+$/.test(row.price_minor) || !Number.isSafeInteger(Number(row.price_minor)) || Number(row.price_minor) <= 0 ||
        seen.has(row.slug)) throw Error("invalid_approved_listing");
    seen.add(row.slug);
    return row;
  });
  const products = valid.filter(row => {
    const price = Number(row.price_minor);
    return (!normalized || normalizeArabic(row.title).includes(normalized)) &&
      (minPriceMinor === undefined || price >= minPriceMinor) &&
      (maxPriceMinor === undefined || price <= maxPriceMinor);
  });
  if (sort === "popular") products.sort((a,b) => (a.popularity_rank??Number.MAX_SAFE_INTEGER)-(b.popularity_rank??Number.MAX_SAFE_INTEGER));
  if (sort === "price_asc") products.sort((a,b) => Number(a.price_minor)-Number(b.price_minor) || a.slug.localeCompare(b.slug));
  if (sort === "price_desc") products.sort((a,b) => Number(b.price_minor)-Number(a.price_minor) || a.slug.localeCompare(b.slug));
  if (sort === "title") products.sort((a,b) => a.title.localeCompare(b.title, "ar") || a.slug.localeCompare(b.slug));
  return { total: products.length, pages: Math.ceil(products.length / pageSize), page, products: products.slice((page-1)*pageSize,page*pageSize) };
}
export function normalizeArabic(s:string):string {
  return s.normalize("NFKC").replace(/[\u064B-\u065F\u0670]/g,"").replace(/[إأآٱ]/g,"ا").replace(/ى/g,"ي").trim().toLocaleLowerCase("ar");
}

/**
 * A separate future OWNER-APPROVED MEDIA CONTRACT, not supplied by the current public RPC.
 * The UI may only accept these extras if a trusted, release-gated public endpoint
 * explicitly returns them; never construct from drafts, supplier data or fixtures.
 */
export type ApprovedExtra = {
  listing_id: string;
  market: MarketCode;
  release: "public_approved";
  images: readonly { id:string; url:string; alt:string; approved:true }[];
  variants: readonly { id:string; label:string; approved:true }[];
  specifications: readonly { label:string; value:string; approved:true }[];
};
export function validateApprovedExtra(raw:unknown, listing:PublicListing, market:MarketCode):ApprovedExtra|null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const data = raw as Record<string,unknown>;
  if (data.listing_id !== listing.listing_id || data.market !== market || data.release !== "public_approved") return null;
  if (!Array.isArray(data.images) || !Array.isArray(data.variants) || !Array.isArray(data.specifications) ||
      data.images.length > 12 || data.variants.length > 30 || data.specifications.length > 40) return null;
  const unique = (items:unknown[], key:string) => new Set(items.map(x=>(x as Record<string,unknown>)[key])).size === items.length;
  const text = (v:unknown,max:number):v is string => typeof v==="string" && !!v.trim() && v.length<=max;
  const images = data.images as unknown[];
  const variants = data.variants as unknown[];
  const specifications = data.specifications as unknown[];
  if (!unique(images.filter(x=>x&&typeof x==="object"),"id") || !unique(variants.filter(x=>x&&typeof x==="object"),"id")) return null;
  if (!images.every(x=>{
    if(!x||typeof x!=="object")return false;
    const v=x as Record<string,unknown>;
    if(!text(v.id,100)||!text(v.alt,240)||v.approved!==true||!text(v.url,2000))return false;
    try { const u=new URL(v.url); return u.protocol==="https:" && !u.username && !u.password && !u.hash && !u.searchParams.has("token"); }
    catch { return false; }
  })) return null;
  if (!variants.every(x=>{if(!x||typeof x!=="object")return false;const v=x as Record<string,unknown>;return text(v.id,100)&&text(v.label,120)&&v.approved===true;})) return null;
  if (!specifications.every(x=>{if(!x||typeof x!=="object")return false;const v=x as Record<string,unknown>;return text(v.label,120)&&text(v.value,500)&&v.approved===true;})) return null;
  return data as ApprovedExtra;
}

/** Current public detail RPC has no approved media/variant/specification fields. */
export function presentApprovedDetail(detail:PublicDetail,market:MarketCode,extras?:unknown) {
  if(detail.currency!==markets[market].currency)throw Error("currency_mismatch");
  const approved = validateApprovedExtra(extras,detail,market);
  return { ...detail, price: formatListingPrice(detail,market), images:approved?.images??[], variants:approved?.variants??[], specifications:approved?.specifications??[] };
}
