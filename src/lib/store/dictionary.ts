import type {MarketCode} from "./markets";
import {marketExperience} from "./market-experience";
import {customerServiceCopy} from "./customer-service-copy";
import {brandStory} from "./brand-story";
import {shopCopy} from "./shop-copy";
import {chromeCopy} from "./chrome-copy";
import {assistantCopy} from "./assistant-copy";
import {policyTemplates} from "./policy-facts";
import {pageCopy} from "./page-copy";

/**
 * ONE dictionary per market: every customer-facing word of the storefront in that market's own dialect.
 *   experience — home, sections, story teaser, questions (market-experience.ts)
 *   service    — payment, delivery, returns facts (customer-service-copy.ts, M9)
 *   story      — the brand story page (brand-story.ts)
 *   shop       — product page, cart, offers, recommendations (shop-copy.ts)
 *   chrome     — navigation, footer, consent, order form, not-found and error pages (chrome-copy.ts)
 *   assistant  — the shopping assistant's own words (assistant-copy.ts)
 *   policy     — delivery and return sentences built from a confirmed number (policy-facts.ts)
 *   pages      — section, story, search, empty cart, help, privacy and terms pages (page-copy.ts)
 * New shopper-facing text goes into one of these, never into a component. `scripts/check-market-dictionaries.ts`
 * fails CI on missing keys, Latin text, banned wording and dialect mixed across markets.
 */
export function marketDictionary(market:MarketCode){
 return {experience:marketExperience[market],service:customerServiceCopy[market],story:brandStory[market],shop:shopCopy(market),chrome:chromeCopy(market),assistant:assistantCopy(market),policy:policyTemplates[market],pages:pageCopy(market)};
}
export type MarketDictionary=ReturnType<typeof marketDictionary>;
