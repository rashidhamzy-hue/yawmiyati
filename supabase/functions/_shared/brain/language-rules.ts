// One set of wording rules for every customer-facing word: the storefront dictionaries (CI guard,
// scripts/check-market-dictionaries.ts) and the pages the brain writes (prompts.ts) both read this file.
// Pure data and functions, no I/O, runs in Bun, Node and Deno.
export type RuleMarket = "sa" | "ae" | "om" | "eg" | "iq";

/** Wording that never reaches a shopper: M9 placeholders, supplier identity, invented urgency or savings. */
export const BANNED_WORDING: [RegExp, string][] = [
  [/المتوقعة|المتوقّعة/, "M9: 'expected' placeholder"],
  [/سيكون متاحاً|سيكون متاحا|قريباً في يومياتي|قبل بدء استقبال الطلبات|عند بدء استقبال الطلبات/, "M9: future-launch placeholder"],
  [/تاجر\b|Taager|المورّد|المورد|المورِّد|الموزّع المعتمد/i, "supplier identity"],
  [/آخر قطعة|آخر القطع|ينتهي العرض|ينتهي خلال|لفترة محدودة|الكمية تنفد|سارعي|لا تفوّتي|لا تفوتي|عرض اليوم فقط/, "invented urgency"],
  [/خصم \d+ ?٪|خصم ٪|تخفيضات حتى|الأكثر مبيعاً|الأكثر مبيعا|الأعلى تقييماً|\d+ ?تقييم|عميلة سعيدة|ضمان استرجاع المال/, "unproven claim (discount, best seller, ratings, guarantee)"],
  [/شحن مجاني لكل الطلبات|توصيل مجاني لكل الطلبات|توصيل مجاني دائماً/, "blanket free delivery"],
];

/** Dialect markers that belong to some markets only. A marker found in another market's text is mixed dialect. */
const B = "(?<![\\u0600-\\u06FF\\u0750-\\u077F])", A = "(?![\\u0600-\\u06FF\\u0750-\\u077F])"; // Arabic word boundaries
const word = (list: string) => new RegExp(B + "(?:" + list + ")" + A);
export const DIALECT_MARKERS: { owner: RuleMarket[]; name: string; re: RegExp }[] = [
  { owner: ["iq"], name: "Iraqi", re: /چ|گ|ڤ/ },
  { owner: ["iq"], name: "Iraqi", re: word("شنو|هسه|هسة|ماكو|أكو|اكو|ويه|هواي|شكد|بيچ|مو متوفر|يمته|هاي") },
  { owner: ["iq", "ae"], name: "Iraqi/Emirati", re: word("شلون") },
  { owner: ["eg"], name: "Egyptian", re: word("دلوقتي|ازاي|إزاي|كده|كدا|مش|إيه|ايه|بتاع|بتاعة|اتفرّجي|اتفرجي|تاني|تانية|كمان|لسه|هنكلمك|مفيش|مافيهاش|مبقتش|مستنية|أوي|دي|ده|بتدوّري|بتدوري") },
  { owner: ["eg", "sa", "ae", "om"], name: "not Iraqi", re: word("عشان|علشان") },
  { owner: ["ae"], name: "Emirati", re: word("شو|هني|وايد|مب|ويا|وياج|يومج|ذوقج|بيتج|سلتج|طلبج|عليج|حياتج|عالمج|يعجبج|يناسبج|اختيارج|تفضيلاتج|بياناتج|اختياراتج|ودّج|ودج|بنتواصل|تلاقين") },
  { owner: ["sa", "om"], name: "Saudi/Omani", re: word("وش|أبغى|ابغى|تبين") },
  { owner: ["sa", "ae", "om"], name: "Gulf", re: word("الحين") },
];

export type LanguageFinding = { kind: "banned" | "dialect"; why: string; hit: string };
/** Every rule a text breaks for one market. `allowRealEndDate` is for the single countdown line built from an approved offer's real end date. */
export function languageFindings(text: string, market: RuleMarket, opts: { allowRealEndDate?: boolean } = {}): LanguageFinding[] {
  const out: LanguageFinding[] = [];
  for (const [re, why] of BANNED_WORDING) {
    if (why === "invented urgency" && opts.allowRealEndDate) continue;
    const hit = text.match(re);
    if (hit) out.push({ kind: "banned", why, hit: hit[0] });
  }
  for (const d of DIALECT_MARKERS) {
    if (d.owner.includes(market)) continue;
    const hit = text.match(d.re);
    if (hit) out.push({ kind: "dialect", why: d.name + " wording", hit: hit[0] });
  }
  return out;
}
