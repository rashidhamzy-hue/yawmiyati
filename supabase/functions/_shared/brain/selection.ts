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
const KILL: [string, RegExp][] = [
  ["tobacco_vape", /سجائر|دخان|شيشه|معسل|فيب|vape|cigar|tobacco|hookah/],
  ["weapons", /سلاح|مسدس|صاعق|رصاص|weapon|gun|taser|ammo/],
  ["sexual", /جنسي|تاخير القذف|منشط|انتصاب|sexual|erection|libido/],
  ["medicine_claims", /علاج|يعالج|دواء|ادويه|تخسيس|حرق الدهون|حبوب (?:تخسيس|طبيه|تكبير)|كبسولات|مكمل غذائي|سكري|ضغط الدم|cure|treat(s|ment)|slimming|weight loss pill|capsule|supplement|diabet/],
  ["counterfeit_brands", /\b(apple|iphone|airpods|samsung|nike|adidas|dior|chanel|gucci|louis vuitton|rolex|dyson)\b/],
];
const FLAGS: [string, RegExp][] = [
  ["cosmetic_claims", /تبييض|تفتيح|تجاعيد|حب الشباب|تساقط الشعر|whiten|anti.?aging|wrinkle|acne|hair loss/],
  ["chemicals", /منظف|مزيل|كلور|مبيد|بالوعه|بالوعات|drain|bleach|pesticide|chemical/],
  ["electrical", /كهربائي|شاحن|بطاريه|usb|electric|charger|battery|rechargeable/],
  ["children", /اطفال|طفل|رضع|رضيع|baby|kids|infant|toddler/],
];

export function riskCheck(o: Pick<OfferRow, "title" | "categories" | "description">) {
  const text = normalizeTitle([o.title, ...o.categories.map((c) => c.name), (o.description ?? "").slice(0, 1500)].join(" "));
  return { kills: KILL.filter(([, re]) => re.test(text)).map(([k]) => k), flags: FLAGS.filter(([, re]) => re.test(text)).map(([k]) => k) };
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
    if (o.status && o.status !== "publish") reasons.push("not_published_in_woo");
    if (o.stock_status === "outofstock") reasons.push("out_of_stock");
    if (!o.images.length) reasons.push("no_images");
    if (econ.cost_minor === null || econ.floor_minor === null) reasons.push("economics_unknown");
    else if (econ.floor_minor <= econ.cost_minor) reasons.push("no_margin_at_minimum_price");
    if (reasons.length) { rows.push({ ...base, stage: "excluded", prefilter_score: 0, reasons }); continue; }
    const spreadUsd = minorToUsd(econ.floor_minor! - econ.cost_minor!, m);
    const media = o.images.length >= 3 ? 1 : o.images.length === 2 ? 0.85 : 0.7;
    const text = (o.description ?? "").replace(/<[^>]+>/g, "").length > 200 ? 1 : 0.85;
    const cat = base.category ? 1 : 0.7;
    const kindFactor = kind.kind === "title_claims_multipack" || kind.kind === "bundle_unverified" ? 0.9 : 1;
    const video = o.videos.length ? 1.05 : 1;
    const score = Math.round(Math.min(spreadUsd, 25) * media * text * cat * kindFactor * video * 100) / 100;
    rows.push({ ...base, stage: "shortlisted", prefilter_score: score, reasons: [`spread≈$${spreadUsd.toFixed(2)} at Taager minimum`] });
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
