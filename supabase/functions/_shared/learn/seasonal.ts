// Seasonal calendar: the moments Yawmiyati's shoppers buy for, planned about three weeks ahead.
// Dates checked on 28 Nov 2026. Islamic dates are astronomical forecasts and move by a day with the moon sighting,
// so each one carries its confidence and the plan talks about a window, never a promise printed on the store.
//   Ramadan 1448: expected Mon 8 Feb 2027 (Umm al-Qura / UAE astronomy centre forecasts; some countries 9 Feb)
//   Eid al-Fitr: expected Tue 9 or Wed 10 Mar 2027      Arab Mother's Day: 21 Mar (fixed)
//   Eid al-Adha: expected Sun 16 May 2027 (Arafah 15 May)
//   Back to school: UAE ministry calendar 30 Aug 2027; Saudi, Oman, Egypt and Iraq publish theirs later (late Aug to
//   late Sep): the plan uses 29 Aug as a planning date and says so.
//   White Friday: the fourth Friday of November, 26 Nov 2027.
// Proposals only: the owner approves every product batch, set and offer. No countdown or "limited time" wording.
import type { Market } from "../brain/markets.ts";

export type Season = {
  key: string; name: string; date: string; ends?: string; confidence: "fixed" | "astronomical forecast" | "planning estimate"; source: string;
  markets: readonly Market[]; sections: readonly string[]; set_themes: readonly string[]; ideas: readonly string[];
};
const ALL: readonly Market[] = ["sa", "ae", "om", "eg", "iq"];
export const SEASONS: readonly Season[] = [
  { key: "ramadan-2027", name: "Ramadan", date: "2027-02-08", ends: "2027-03-08", confidence: "astronomical forecast", source: "Umm al-Qura calendar and UAE astronomy centre forecasts, checked 28 Nov 2026", markets: ALL,
    sections: ["kitchen", "home", "organize"], set_themes: ["coffee", "kitchen_prep"],
    ideas: ["Hosting and iftar table: serving, coffee and tea sets on the home page", "Kitchen prep and storage as sets (they lift order value past free delivery)", "Prayer-time comfort: home fragrance and wellness as add-ons"] },
  { key: "eid-al-fitr-2027", name: "Eid al-Fitr", date: "2027-03-09", ends: "2027-03-11", confidence: "astronomical forecast", source: "UAE astronomy centre forecast (9 or 10 March), checked 28 Nov 2026", markets: ALL,
    sections: ["fashion", "beauty", "kids", "home"], set_themes: ["makeup", "hair_care", "skin_care"],
    ideas: ["Gifts and getting ready: beauty routines as sets, accessories", "Children's Eid picks in mother & kids", "Order early: delivery slows in the Eid week, so the push ends about 6 days before Eid"] },
  { key: "mothers-day-2027", name: "Arab Mother's Day", date: "2027-03-21", confidence: "fixed", source: "21 March every year across the Arab world", markets: ALL,
    sections: ["kids", "beauty", "wellness", "home"], set_themes: ["relax", "skin_care", "mother_baby"],
    ideas: ["First big moment for mother & kids: a gift shelf on the home page", "Gift-ready sets with the gift note at checkout", "It falls 11 days after Eid al-Fitr: plan both together, one product batch"] },
  { key: "eid-al-adha-2027", name: "Eid al-Adha", date: "2027-05-16", ends: "2027-05-19", confidence: "astronomical forecast", source: "UAE ministry school calendar and astronomy forecasts (16 or 17 May), checked 28 Nov 2026", markets: ALL,
    sections: ["kitchen", "home", "fashion", "kids"], set_themes: ["kitchen_prep", "coffee"],
    ideas: ["Hosting and kitchen: serving and prep sets", "Family visits: home and children's picks", "Push ends about 6 days before Eid for delivery in time"] },
  { key: "back-to-school-2027", name: "Back to school", date: "2027-08-29", confidence: "planning estimate", source: "UAE ministry calendar: 30 Aug 2027; other markets not published yet (late Aug to late Sep)", markets: ALL,
    sections: ["kids", "organize", "kitchen"], set_themes: ["closet", "mother_baby"],
    ideas: ["Lunch boxes, bottles and organisers for mothers", "Room and closet organising sets", "Check each market's real school date in July: Egypt and Iraq usually start later"] },
  { key: "white-friday-2027", name: "White Friday", date: "2027-11-26", ends: "2027-11-29", confidence: "fixed", source: "Fourth Friday of November", markets: ALL,
    sections: ["beauty", "kitchen", "home", "organize", "wellness", "fashion", "kids"], set_themes: ["hair_care", "skin_care", "coffee", "kitchen_prep", "relax"],
    ideas: ["Only real offers: quantity prices, sets and free delivery the margin can pay for", "A crossed-out price only where the product was really sold at it before", "Best-margin products first: the brief lists them"] },
];

export const LEAD_DAYS = 21, PLAN_WINDOW_DAYS = 35;
export type SeasonPlan = {
  key: string; name: string; date: string; confidence: Season["confidence"]; source: string; days_until: number; act_by: string;
  stage: "plan_now" | "live_window"; sections: { section: string; on_store: number; target: number; gap: number }[]; set_themes: string[]; ideas: string[]; next_step: string;
};
const DAY = 86_400_000;
/**
 * Plans for the seasons whose date is within 35 days. `onStoreBySection` = products visible now per store section.
 * About three weeks ahead the assortment should be approved (`act_by`), so pages are indexed and ads can learn.
 */
export function seasonalPlans(now: number, market: Market, onStoreBySection: Record<string, number>, seasons: readonly Season[] = SEASONS): SeasonPlan[] {
  const out: SeasonPlan[] = [];
  for (const s of seasons) {
    if (!s.markets.includes(market)) continue;
    const start = Date.parse(s.date + "T00:00:00Z"), end = Date.parse((s.ends ?? s.date) + "T23:59:59Z");
    const days = Math.ceil((start - now) / DAY);
    if (now > end || days > PLAN_WINDOW_DAYS) continue;
    const stage = days > LEAD_DAYS ? "plan_now" : "live_window";
    const sections = s.sections.map((section) => { const have = onStoreBySection[section] ?? 0, target = section === s.sections[0] ? 12 : 8; return { section, on_store: have, target, gap: Math.max(0, target - have) }; });
    const gap = sections.reduce((n, x) => n + x.gap, 0);
    out.push({ key: s.key, name: s.name, date: s.date, confidence: s.confidence, source: s.source, days_until: Math.max(0, days), act_by: new Date(start - LEAD_DAYS * DAY).toISOString().slice(0, 10), stage,
      sections, set_themes: [...s.set_themes], ideas: [...s.ideas],
      next_step: gap > 0 ? `Add about ${gap} products in ${sections.filter((x) => x.gap > 0).map((x) => x.section).join(", ")} (Build store picks them), then work out sets and offers.`
        : "The assortment is deep enough: work out sets and offers for these sections and choose what leads the home page." });
  }
  return out.sort((a, b) => a.days_until - b.days_until);
}
/** Every season of the calendar with its date and how sure it is (for the owner's calendar view). */
export const seasonCalendar = (now: number) => SEASONS.map((s) => ({ key: s.key, name: s.name, date: s.date, confidence: s.confidence, source: s.source, days_until: Math.ceil((Date.parse(s.date + "T00:00:00Z") - now) / DAY) })).filter((s) => s.days_until > -10);
