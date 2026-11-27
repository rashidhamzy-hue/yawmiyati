// Prefilter (no AI), kill rules, final selection and merchandising.
import { familyKey, normalizeTitle, offerKind, economicsInputs, type FieldMapping } from "./catalog-analysis.ts";
import { minorToUsd, type MarketFacts } from "./markets.ts";
import type { OfferRow } from "./woo-normalize.ts";
import type { PriceDecision } from "./economics.ts";

export const STORE_CATEGORIES = ["home", "kitchen", "beauty", "fashion", "wellness", "organize"] as const;
export type StoreCategory = typeof STORE_CATEGORIES[number];

const CATEGORY_WORDS: Record<StoreCategory, RegExp> = {
  kitchen: /مطبخ|طبخ|قهوه|قهوة|شاي|كوب|اكواب|فناجين|اواني|قدر|مقلاه|خلاط|محضر|طاحونه|kitchen|coffee|tea|cook|mug|cup|blender|pan|pot|knife|سكين/,
  organize: /تنظيم|منظم|تخزين|حافظه|علب|رف|ارفف|سله|سلال|شماعه|organi[sz]|storage|rack|shelf|basket|container|hanger/,
  home: /منزل|بيت|ديكور|اناره|اضاءه|سجاد|ستائر|مفارش|وساده|مخده|حمام|غرفه|home|decor|lamp|light|rug|curtain|bedding|pillow|bath|candle|شموع/,
  beauty: /جمال|تجميل|مكياج|بشره|شعر|عطر|عطور|اظافر|سيروم|كريم|مشط|سشوار|مكواه شعر|beauty|makeup|skin|hair|perfume|nail|serum|cream/,
  fashion: /ازياء|ملابس|حقيبه|حقائب|شنطه|ساعه|ساعات|اكسسوار|مجوهرات|نظارات|احذيه|عبايه|fashion|bag|watch|jewel|accessor|sunglass|shoe|abaya|wallet|محفظه/,
  wellness: /صحه|رياضه|استرخاء|مساج|تدليك|نوم|يوغا|لياقه|wellness|massage|fitness|yoga|sleep|relax|posture/,
};

export function mapCategory(o: Pick<OfferRow, "title" | "categories">): StoreCategory | null {
  const text = normalizeTitle([o.title, ...o.categories.map((c) => c.name + " " + c.slug)].join(" "));
  let best: StoreCategory | null = null, hits = 0;
  for (const c of STORE_CATEGORIES) {
    const n = (text.match(new RegExp(CATEGORY_WORDS[c].source, "g")) ?? []).length;
    if (n > hits) { best = c; hits = n; }
  }
  return best;
}

// Hard kills: never sold by Yawmiyati. Soft flags: allowed, but the owner sees them.
// Supplier descriptions are long and full of loose wording ("علاج" for fixing clothes, "no smoke",
// "works with iPhone"), so the broad patterns read only the title and categories; the description
// is checked only for unambiguous terms.
const KILL_TITLE: [string, RegExp][] = [
  ["tobacco_vape", /سجائر|(?<!(?:بدون|بلا|ولا|لا|عديم|خالي من) (?:ال)?)دخان|شيشه|معسل|(?:^|\s)(?:ال)?فيب(?:\s|$)|\bvape|cigar|tobacco|hookah/],
  ["weapons", /سلاح|ذخيره|صاعق(?! (?:لل|ال)?(?:حشرات|ناموس|بعوض|ذباب))|مسدس (?:خرز|كرات|هوائي|ضغط|رصاص|خرطوش|تصويب|صوت|ناري|صوتي)|رشاش (?:كرات|خرز|جل|جيل)|(?:^|\s)رصاص(?:\s|$)|weapon|taser|ammo|airsoft|\bbb gun|gel blaster/],
  ["sexual", /(?:^|\s)(?:ال)?جنسي(?:\s|$|ه\s)|جنسيا|تاخير القذف|منشط(?! (?:ال)?(?:تربه|نمو|شعر|بذور|نبات))|انتصاب|sexual|erection|libido/],
  ["medicine_claims", /علاج|يعالج|(?<!منظم (?:لل|ال)?|منظم حبوب |علبه (?:لل|ال)?)(?:دواء|ادويه)|تخسيس|حرق الدهون|حبوب (?:تخسيس|طبيه|تكبير)|كبسولات(?! (?:ال)?قهوه)|مكمل غذائي|سكري|ضغط الدم|\bcure|\btreat(s|ment)\b|slimming|weight loss pill|supplement|diabet/],
  // Copies and branded items we cannot prove genuine. Accessories that only name a phone ("case for iPhone") are fine.
  ["counterfeit_brands", /\b(airpods|nike|adidas|dior|chanel|gucci|louis vuitton|rolex|high copy|semi original|master copy)\b|(?:^|\s)(?:ال)?(?:ايربودز|نايك|اديداس|ديور|شانيل|غوتشي|جوتشي|رولكس|شبيه|كوبي|ماستر كوبي)(?:\s|$)/],
  ["counterfeit_brands", /^(?!.*(?:جراب|كفر|كافر|غطاء|شاحن|كابل|متوافق|حامل|ستاند|واقي|سوار|\bcase\b|\bcover\b|charger|cable|compatible|\bfor\b|holder|strap)).*(?:\b(?:apple|iphone|samsung|dyson)\b|(?:^|\s)(?:ال)?(?:ايفون|ابل|سامسونج|دايسون)(?:\s|$))/],
];
const KILL_DESCRIPTION: [string, RegExp][] = [
  ["tobacco_vape", /سجائر الكترونيه|معسل|vape|e-cigarette|hookah/],
  ["weapons", /سلاح ناري|ذخيره|taser|ammo/],
  ["sexual", /(?:^|\s)(?:ال)?جنسي(?:\s|$)|جنسيا|تاخير القذف|انتصاب|sexual|erection|libido/],
  ["medicine_claims", /حبوب (?:تخسيس|طبيه|تكبير)|مكمل غذائي|weight loss pill|dietary supplement/],
];

// Yawmiyati's audience is women (25-44, Egypt/Iraq/Gulf): the shopper is a woman buying for herself,
// her home and her children. Products clearly made for men, cars, tools, gaming or hunting are left out.
// Read from the title only; children's items stay in (mothers buy them).
const FOR_WOMEN_TOO = /نساء|نسائي|للنساء|النساء|للجنسين|الجنسين|حريمي|بنات|women|unisex|الشعر و ?(?:ال)?لحيه/;
const HOME_OR_KIDS = /اطفال|للاطفال|طفل|لعبه|العاب|منزل|المنزل|للمنزل|بيت|البيت|للبيت|kids|home/;
const NOT_FOR_AUDIENCE: [string, RegExp, RegExp | null][] = [
  ["men", /رجالي|للرجال|(?:^|\s)رجال(?:\s|$)|(?:^|\s)الرجال(?:\s|$)|للرجل|(?:^|\s)الرجل(?:\s|$)|لحيه|ذقن|شنب|\bmen\b|\bmens\b|beard|mustache/, FOR_WOMEN_TOO],
  ["car", /سياره|سيارات|دراجه ناريه|موتوسيكل|اطارات|كفرات|\bcar\b|automotive|motorcycle|dash ?cam/, HOME_OR_KIDS],
  ["tools", /(?<!بدون (?:ال)?|بلا )(?:دريل|مثقاب|شنيور)|مفك|مفاتيح ربط|مفتاح ربط|عده (?:صيانه|عمل|ادوات)|طقم عده|صندوق عده|منشار|(?<!اكياس |الاكياس )لحام(?! (?:و ?اغلاق )?(?:ال)?اكياس)|كماشه|زرديه|\bdrill\b|screwdriver|wrench|soldering|toolbox|tool kit/, null],
  ["gaming", /بلايستيشن|بلاي ستيشن|اكس بوكس|جيمنج|جيمر|قيمنج|قيمرز|ذراع تحكم|يد تحكم|playstation|\bxbox\b|gaming|gamer|joystick|game controller/, null],
  ["hunting_fishing", /(?:^|\s)(?:ال|لل)?صيد(?:\s|$)|صيد (?:ال)?سمك|سناره|شبكه صيد|fishing|hunting/, null],
];
export function audienceCheck(o: Pick<OfferRow, "title">): string[] {
  const head = normalizeTitle(o.title);
  return NOT_FOR_AUDIENCE.filter(([, re, unless]) => re.test(head) && !(unless && unless.test(head))).map(([k]) => k);
}
const FLAGS: [string, RegExp][] = [
  ["cosmetic_claims", /تبييض|تفتيح|تجاعيد|حب الشباب|تساقط الشعر|whiten|anti.?aging|wrinkle|acne|hair loss/],
  ["chemicals", /منظف|مزيل|كلور|مبيد|بالوعه|بالوعات|drain|bleach|pesticide|chemical/],
  ["electrical", /كهربائي|شاحن|بطاريه|usb|electric|charger|battery|rechargeable/],
  ["children", /اطفال|طفل|رضع|رضيع|baby|kids|infant|toddler/],
];

export function riskCheck(o: Pick<OfferRow, "title" | "categories" | "description">) {
  const head = normalizeTitle([o.title, ...o.categories.map((c) => c.name)].join(" "));
  const body = normalizeTitle((o.description ?? "").replace(/<[^>]+>/g, " ").slice(0, 1500));
  const kills = new Set([...KILL_TITLE.filter(([, re]) => re.test(head)), ...KILL_DESCRIPTION.filter(([, re]) => re.test(body))].map(([k]) => k));
  const text = head + " " + body;
  return { kills: [...kills], flags: FLAGS.filter(([, re]) => re.test(text)).map(([k]) => k) };
}

export type PrefilterRow = {
  product_id: number; variation_id: number; title: string; family_key: string; offer_kind: string; category: StoreCategory | null;
  stage: "excluded" | "killed" | "shortlisted"; prefilter_score: number; economics: Record<string, unknown>;
  reasons: string[]; flags: string[];
};

/** Deterministic first pass over every offer: who deserves paid research. */
export function prefilter(offers: OfferRow[], mapping: FieldMapping, m: MarketFacts, shortlistSize: number): PrefilterRow[] {
  const rows: PrefilterRow[] = [];
  // Sellable units: simple products, and variations (their parent "variable" row is not itself orderable).
  const sellable = offers.filter((o) => o.product_type !== "variable" && o.product_type !== "grouped");
  for (const o of sellable) {
    const kind = offerKind(o, mapping);
    const econ = economicsInputs(o, mapping, m);
    const risk = riskCheck(o);
    const reasons: string[] = [];
    const base = { product_id: o.product_id, variation_id: o.variation_id, title: o.title, family_key: familyKey(o), offer_kind: kind.kind,
      category: mapCategory(o), economics: { ...econ, pieces_claimed: kind.pieces }, flags: risk.flags };
    if (risk.kills.length) { rows.push({ ...base, stage: "killed", prefilter_score: 0, reasons: risk.kills.map((k) => "kill:" + k) }); continue; }
    for (const a of audienceCheck(o)) reasons.push("not_for_audience:" + a);
    if (o.status && o.status !== "publish") reasons.push("not_published_in_woo");
    if (o.stock_status === "outofstock") reasons.push("out_of_stock");
    if (!o.images.length) reasons.push("no_images");
    if (econ.cost_minor === null || econ.floor_minor === null) reasons.push("economics_unknown");
    else if (econ.floor_minor < econ.cost_minor) reasons.push("minimum_price_below_cost");
    else if (econ.floor_minor === econ.cost_minor && mapping.confidence !== "owner") reasons.push("no_margin_at_minimum_price");
    if (reasons.length) { rows.push({ ...base, stage: "excluded", prefilter_score: 0, reasons }); continue; }
    // Supplier-stated zero minimum profit (Taager): all profit comes from our markup, so rank on a
    // cautious 15% markup at 60% weight; the decide step prices it properly after research.
    const zeroMin = econ.floor_minor === econ.cost_minor;
    const spreadUsd = zeroMin ? minorToUsd(Math.round(econ.floor_minor! * 0.15), m) * 0.6 : minorToUsd(econ.floor_minor! - econ.cost_minor!, m);
    const media = o.images.length >= 3 ? 1 : o.images.length === 2 ? 0.85 : 0.7;
    const text = (o.description ?? "").replace(/<[^>]+>/g, "").length > 200 ? 1 : 0.85;
    const cat = base.category ? 1 : 0.7;
    const kindFactor = kind.kind === "title_claims_multipack" || kind.kind === "bundle_unverified" ? 0.9 : 1;
    const video = o.videos.length ? 1.05 : 1;
    const score = Math.round(Math.min(spreadUsd, 25) * media * text * cat * kindFactor * video * 100) / 100;
    rows.push({ ...base, stage: "shortlisted", prefilter_score: score, reasons: [zeroMin ? `spread≈$${spreadUsd.toFixed(2)} assumed (Taager minimum profit is 0)` : `spread≈$${spreadUsd.toFixed(2)} at Taager minimum`] });
  }
  // Keep the best offer per potential family, then cap categories, then cut to the shortlist size.
  const shortlisted = rows.filter((r) => r.stage === "shortlisted").sort((a, b) => b.prefilter_score - a.prefilter_score);
  const seenFamily = new Set<string>();
  const perCat: Record<string, number> = {};
  const capPerCat = Math.ceil(shortlistSize * 0.35);
  let kept = 0;
  for (const r of shortlisted) {
    const cat = r.category ?? "other";
    if (seenFamily.has(r.family_key)) { r.stage = "excluded"; r.reasons.push("same_family_as_a_stronger_offer"); continue; }
    if ((perCat[cat] ?? 0) >= capPerCat) { r.stage = "excluded"; r.reasons.push("category_cap"); continue; }
    if (kept >= shortlistSize) { r.stage = "excluded"; r.reasons.push("below_shortlist_cut"); continue; }
    seenFamily.add(r.family_key); perCat[cat] = (perCat[cat] ?? 0) + 1; kept++;
  }
  return rows;
}

export type ResearchSummary = { retailers_found: number; exact_matches: number; demand_signals: number; risks: string[] };

export function finalScore(d: PriceDecision, research: ResearchSummary | null, images: number): number {
  if (d.state !== "priced") return 0;
  const exp = Math.max(0, d.expected_profit_usd ?? 0);
  const demand = research ? 0.4 + 0.15 * Math.min(research.retailers_found, 4) + (research.demand_signals > 0 ? 0.1 : 0) : 0.5;
  const confidence = d.competitor_basis === "exact" ? 1 : d.competitor_basis === "similar" ? 0.85 : 0.6;
  const media = images >= 3 ? 1 : images === 2 ? 0.9 : 0.75;
  const fit = d.positioning === "dearer" ? 0.7 : 1;
  return Math.round(exp * demand * confidence * media * fit * 1000) / 1000;
}

export type Candidate = { product_id: number; variation_id: number; family_key: string; category: StoreCategory | null; score: number; blocked: boolean };

export function selectFinal(cands: Candidate[], size: number) {
  const sorted = cands.filter((c) => !c.blocked && c.score > 0).sort((a, b) => b.score - a.score);
  const cap = Math.max(3, Math.ceil(size * 0.35));
  const fam = new Set<string>(), perCat: Record<string, number> = {};
  const chosen: Candidate[] = [];
  for (const c of sorted) {
    if (chosen.length >= size) break;
    const cat = c.category ?? "other";
    if (fam.has(c.family_key) || (perCat[cat] ?? 0) >= cap) continue;
    fam.add(c.family_key); perCat[cat] = (perCat[cat] ?? 0) + 1; chosen.push(c);
  }
  return chosen;
}

const AFFINITY: Record<StoreCategory, StoreCategory[]> = {
  kitchen: ["organize", "home"], organize: ["kitchen", "home"], home: ["organize", "wellness"],
  beauty: ["wellness", "fashion"], fashion: ["beauty", "wellness"], wellness: ["beauty", "home"],
};

/** Featured picks, category order and "complete the set" cross-sells from the selected products. */
export function merchandise(selected: { key: string; category: StoreCategory | null; score: number; price_minor: number; images: number }[]) {
  const byCat = new Map<string, typeof selected>();
  for (const s of selected) byCat.set(s.category ?? "other", [...(byCat.get(s.category ?? "other") ?? []), s]);
  for (const list of byCat.values()) list.sort((a, b) => b.score - a.score);
  const featured: string[] = [];
  const perCat: Record<string, number> = {};
  for (const s of [...selected].sort((a, b) => b.score - a.score)) {
    if (featured.length >= 8) break;
    const c = s.category ?? "other";
    if ((perCat[c] ?? 0) >= 2) continue;
    perCat[c] = (perCat[c] ?? 0) + 1; featured.push(s.key);
  }
  const hero = [...selected].filter((s) => s.images >= 3).sort((a, b) => b.score - a.score)[0]?.key ?? featured[0] ?? null;
  const categoryOrder = [...byCat.entries()].map(([c, l]) => [c, l.reduce((a, s) => a + s.score, 0)] as const)
    .sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const crossSell: Record<string, string[]> = {};
  for (const s of selected) {
    const cats = s.category ? [s.category, ...AFFINITY[s.category]] : ["other"];
    crossSell[s.key] = cats.flatMap((c) => (byCat.get(c) ?? []).filter((x) => x.key !== s.key)).slice(0, 3).map((x) => x.key);
  }
  return { hero, featured, category_order: categoryOrder, cross_sell: crossSell };
}
