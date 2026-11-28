/**
 * The store's sections in one place: slug, photo, and (per market) the name and the short line under it.
 * Names come from the market dictionary (shop-copy), the short lines and the order from market-experience,
 * so a component never writes a section name itself.
 */
import {img} from "./images";
import {marketExperience} from "./market-experience";
import type {MarketCode} from "./markets";
import {PUBLIC_CATEGORY_SLUGS,type PublicCategorySlug} from "./public-catalog";
import {shopCopy} from "./shop-copy";

export const SECTION_PHOTOS:Record<PublicCategorySlug,string>={
 kids:img["cat-kids"],home:img["cat-home"],kitchen:img["cat-kitchen"],beauty:img["cat-beauty"],
 fashion:img["cat-fashion"],wellness:img["cat-wellness"],organize:img["cat-organize"],
};
export type StoreSection={slug:PublicCategorySlug;name:string;caption:string;photo:string};
export function storeSection(market:MarketCode,slug:string):StoreSection|null{
 const known=PUBLIC_CATEGORY_SLUGS.find(s=>s===slug);
 if(!known)return null;
 return {slug:known,name:shopCopy(market).sectionNames[known]??known,caption:marketExperience[market].categoryCaptions[known]??"",photo:SECTION_PHOTOS[known]};
}
/** Every section, in the order this market shows them (sections the market's order leaves out come last). */
export function storeSections(market:MarketCode):StoreSection[]{
 const order=[...marketExperience[market].categoryOrder,...PUBLIC_CATEGORY_SLUGS];
 return [...new Set(order)].map(slug=>storeSection(market,slug)).filter((s):s is StoreSection=>s!==null);
}
