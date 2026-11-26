// Capability audit, families/duplicates, offer kinds and field mapping.
// M11 rules: never merge offers by title or image alone (families here are only
// "potential duplicates" for selection diversity), never infer bundle components
// from titles, and keep every unclear composition as "needs review".
import { decimalToMinor, type MarketFacts } from "./markets.ts";
import type { OfferRow } from "./woo-normalize.ts";

const AR_DIGITS = /[٠-٩]/g;
const toLatinDigits = (s: string) => s.replace(AR_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660));

export function normalizeTitle(title: string): string {
  return toLatinDigits(title).toLowerCase()
    .replace(/[ً-ٟـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

const PIECE_WORDS: [RegExp, number][] = [
  [/(?:^|\s)(?:قطعتين|قطعتان|حبتين|حبتان|عبوتين|زوج)(?:\s|$)/, 2],
  [/(?:^|\s)(\d{1,2})\s*(?:قطع|قطعه|قطعة|حبات|حبه|حبة|عبوات|عبوه|عبوة|pcs?|pieces?|pack|x)(?:\s|$)/i, -1],
  [/(?:^|\s)(?:x|×)\s*(\d{1,2})(?:\s|$)/i, -1],
  [/(?:^|\s)(?:طقم|مجموعه|مجموعة|set of)\s*(\d{1,2})?/i, 0],
];
/** Quantity a title CLAIMS (unverified). 0 = "set" with no count. null = no claim. */
export function titleClaimedPieces(title: string): number | null {
  const t = normalizeTitle(title);
  for (const [re, fixed] of PIECE_WORDS) {
    const m = re.exec(t);
    if (!m) continue;
    if (fixed > 0) return fixed;
    const n = m[1] ? Number(m[1]) : 0;
    if (fixed === 0) return n || 0;
    if (n >= 2 && n <= 50) return n;
  }
  return null;
}

const STRIP_QTY = /(?:\d{1,2}\s*(?:قطع|قطعه|حبات|حبه|عبوات|عبوه|pcs?|pieces?|pack|x)|(?:x|×)\s*\d{1,2}|قطعتين|قطعتان|حبتين|حبتان|عبوتين|طقم|مجموعه|عرض|باقه|bundle|offer|set|of)/gi;
/** Potential-duplicate family: title without quantity words + first image file name. Diversity only. */
export function familyKey(offer: Pick<OfferRow, "title" | "images">): string {
  // Only piece-count phrases are removed: other numbers (sizes, tiers, models) distinguish real products.
  const stem = normalizeTitle(offer.title).replace(STRIP_QTY, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 7).join(" ");
  return stem || normalizeTitle(offer.title).slice(0, 40);
}

const BUNDLE_WORDS = /bundle|باق|عرض|عروض|offer|combo|كومبو|مجموعه|طقم|set/i;
export type OfferKind = "single" | "variable_parent" | "variation" | "verified_multipack" | "title_claims_multipack" | "bundle_unverified" | "verified_bundle" | "grouped";

export function offerKind(o: OfferRow, mapping: FieldMapping): { kind: OfferKind; pieces: number | null; components: unknown } {
  const components = mapping.components_key ? o.meta[mapping.components_key] ?? null : null;
  if (o.product_type === "grouped") return { kind: "grouped", pieces: null, components };
  if (components && (Array.isArray(components) ? components.length > 0 : true)) return { kind: "verified_bundle", pieces: null, components };
  const qtyRaw = mapping.quantity_key ? o.meta[mapping.quantity_key] : null;
  const qty = typeof qtyRaw === "number" ? qtyRaw : typeof qtyRaw === "string" && /^\d+$/.test(qtyRaw) ? Number(qtyRaw) : null;
  if (qty && qty >= 2) return { kind: "verified_multipack", pieces: qty, components: null };
  if (o.product_type === "variable") return { kind: "variable_parent", pieces: null, components: null };
  const claimed = titleClaimedPieces(o.title);
  const inBundleCategory = o.categories.some((c) => BUNDLE_WORDS.test(c.name) || BUNDLE_WORDS.test(c.slug));
  if (inBundleCategory) return { kind: "bundle_unverified", pieces: claimed, components: null };
  if (claimed !== null) return { kind: "title_claims_multipack", pieces: claimed, components: null };
  return { kind: o.product_type === "variation" ? "variation" : "single", pieces: null, components: null };
}

// ---------- Field mapping: where Taager keeps cost, minimum price, etc. ----------
export type FieldMapping = {
  cost_key?: string | null;            // Taager product price (what we pay)
  floor_key?: string | null;           // Taager minimum selling price
  suggested_key?: string | null;       // Taager suggested retail price
  profit_key?: string | null;          // Taager "minimum profit" if given instead of a floor
  quantity_key?: string | null;        // units in an offer
  components_key?: string | null;      // explicit bundle components
  taager_sku_key?: string | null;
  floor_source?: "meta" | "woo_regular_price" | "woo_price" | null;
  cost_source?: "meta" | null;
  confidence?: "heuristic" | "ai" | "owner";
  notes?: string[];
};

const KEY_HINTS: [keyof FieldMapping, RegExp][] = [
  ["cost_key", /(taager|tgr|supplier|merchant|wholesale|base|cost|purchase)[_ -]?(price|cost)|^_?cost$|product[_ -]?price/i],
  ["floor_key", /(min|minimum|lowest)[_ -]?(selling|sale|sell)?[_ -]?price|price[_ -]?min/i],
  ["suggested_key", /(suggest|recommend|retail|rrp|msrp)[_ -]?(ed)?[_ -]?price/i],
  ["profit_key", /(min|minimum)?[_ -]?profit|commission|margin/i],
  ["quantity_key", /(pieces|piece|qty|quantity|units|pack[_ -]?size|count)$/i],
  ["components_key", /(bundle|component|kit|items)[_ -]?(items|skus|products|components)?$/i],
  ["taager_sku_key", /taager.*(sku|id)|(sku|product)[_ -]?id.*taager/i],
];

export function heuristicMapping(keyStats: Record<string, { count: number; numericShare: number }>): FieldMapping {
  const mapping: FieldMapping = { confidence: "heuristic", notes: [] };
  const keys = Object.entries(keyStats).sort((a, b) => b[1].count - a[1].count);
  for (const [field, re] of KEY_HINTS) {
    const numeric = field !== "components_key" && field !== "taager_sku_key";
    const hit = keys.find(([k, s]) => re.test(k) && (!numeric || s.numericShare >= 0.8) && !Object.values(mapping).includes(k));
    if (hit) (mapping as Record<string, unknown>)[field] = hit[0];
  }
  mapping.cost_source = mapping.cost_key ? "meta" : null;
  mapping.floor_source = mapping.floor_key ? "meta" : null;
  if (!mapping.cost_key) mapping.notes!.push("No supplier-cost field recognised: economics stay incomplete until mapped.");
  if (!mapping.floor_key && !mapping.profit_key) mapping.notes!.push("No minimum-price field recognised: WooCommerce price is NOT assumed to be Taager's floor.");
  return mapping;
}

export type Economics = { cost_minor: number | null; floor_minor: number | null; suggested_minor: number | null; source: string[] };
/** Pull cost / floor / suggested price for one offer using the mapping. Unknown stays null (never zero). */
export function economicsInputs(o: OfferRow, mapping: FieldMapping, m: MarketFacts): Economics {
  const read = (key?: string | null) => (key ? decimalToMinor(o.meta[key] as unknown, m.minorDigits) : null);
  const cost = mapping.cost_key ? read(mapping.cost_key) : null;
  let floor = mapping.floor_key ? read(mapping.floor_key) : null;
  const source: string[] = [];
  if (cost !== null) source.push("cost:meta." + mapping.cost_key);
  if (floor !== null) source.push("floor:meta." + mapping.floor_key);
  if (floor === null && cost !== null && mapping.profit_key) {
    const profit = read(mapping.profit_key);
    if (profit !== null) { floor = cost + profit; source.push("floor:cost+meta." + mapping.profit_key); }
  }
  if (floor === null && mapping.floor_source === "woo_regular_price" && o.regular_price_minor) { floor = o.regular_price_minor; source.push("floor:woo.regular_price(owner-mapped)"); }
  if (floor === null && mapping.floor_source === "woo_price" && o.price_minor) { floor = o.price_minor; source.push("floor:woo.price(owner-mapped)"); }
  const suggested = mapping.suggested_key ? read(mapping.suggested_key) : null;
  return { cost_minor: cost, floor_minor: floor, suggested_minor: suggested, source };
}

// ---------- Capability report ----------
export type CapabilityReport = ReturnType<typeof capabilityReport>;

function bucket(n: number) { return n === 0 ? "0" : n === 1 ? "1" : n <= 4 ? "2-4" : n <= 9 ? "5-9" : "10+"; }

export function capabilityReport(offers: OfferRow[], m: MarketFacts) {
  const parents = offers.filter((o) => o.variation_id === 0);
  const variations = offers.filter((o) => o.variation_id > 0);
  const count = <T extends string>(xs: T[]) => xs.reduce((acc, x) => ((acc[x] = (acc[x] ?? 0) + 1), acc), {} as Record<string, number>);
  const keyStats: Record<string, { count: number; numericShare: number; samples: string[] }> = {};
  for (const o of offers) for (const [k, v] of Object.entries(o.meta)) {
    const s = (keyStats[k] ??= { count: 0, numericShare: 0, samples: [] });
    s.count++;
    const isNum = decimalToMinor(v as unknown, 2) !== null;
    s.numericShare += isNum ? 1 : 0;
    if (s.samples.length < 3) s.samples.push((typeof v === "string" ? v : JSON.stringify(v)).slice(0, 120));
  }
  for (const s of Object.values(keyStats)) s.numericShare = s.count ? Math.round((s.numericShare / s.count) * 100) / 100 : 0;
  const mapping = heuristicMapping(keyStats);

  const skuCounts = count(offers.map((o) => o.sku).filter((s): s is string => !!s));
  const dupSkus = Object.entries(skuCounts).filter(([, n]) => n > 1);
  const titleGroups = new Map<string, OfferRow[]>();
  const imageGroups = new Map<string, OfferRow[]>();
  const famGroups = new Map<string, OfferRow[]>();
  for (const o of parents) {
    const t = normalizeTitle(o.title); titleGroups.set(t, [...(titleGroups.get(t) ?? []), o]);
    const img = o.images[0]?.src.split("?")[0]; if (img) imageGroups.set(img, [...(imageGroups.get(img) ?? []), o]);
    const f = familyKey(o); famGroups.set(f, [...(famGroups.get(f) ?? []), o]);
  }
  const groups = (g: Map<string, OfferRow[]>) => [...g.values()].filter((x) => x.length > 1);
  const kinds = offers.map((o) => offerKind(o, mapping).kind);
  const priced = offers.filter((o) => o.price_minor !== null);
  const prices = priced.map((o) => o.price_minor!).sort((a, b) => a - b);
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
  const withVideo = offers.filter((o) => o.videos.length);
  const categories = count(parents.flatMap((o) => o.categories.map((c) => c.name || c.slug)));
  const attributeNames = count(offers.flatMap((o) => o.attributes.map((a) => a.name)));
  const sample = (xs: OfferRow[], n = 5) => xs.slice(0, n).map((o) => ({ product_id: o.product_id, variation_id: o.variation_id, sku: o.sku, title: o.title }));

  return {
    market: m.code, currency: m.currency, generated_at: new Date().toISOString(),
    totals: {
      products: parents.length, variations: variations.length, offers: offers.length,
      by_type: count(parents.map((o) => o.product_type)), by_status: count(parents.map((o) => o.status ?? "unknown")),
      stock: count(offers.map((o) => o.stock_status ?? "unknown")),
      with_stock_quantity: offers.filter((o) => o.stock_quantity !== null).length,
    },
    prices: {
      with_price_pct: pct(priced.length, offers.length),
      with_regular_price_pct: pct(offers.filter((o) => o.regular_price_minor !== null).length, offers.length),
      on_sale: offers.filter((o) => o.sale_price_minor !== null && o.regular_price_minor !== null && o.sale_price_minor < o.regular_price_minor).length,
      min_minor: prices[0] ?? null, median_minor: prices[Math.floor(prices.length / 2)] ?? null, max_minor: prices[prices.length - 1] ?? null,
    },
    media: {
      images_per_offer: count(offers.map((o) => bucket(o.images.length))),
      max_images: Math.max(0, ...offers.map((o) => o.images.length)),
      image_hosts: count(offers.flatMap((o) => o.images.map((i) => { try { return new URL(i.src).hostname; } catch { return "invalid"; } }))),
      offers_with_video: withVideo.length, video_hosts: count(withVideo.flatMap((o) => o.videos.map((v) => v.host))),
      video_examples: withVideo.slice(0, 3).map((o) => ({ product_id: o.product_id, url: o.videos[0].url })),
    },
    content: {
      empty_description_pct: pct(offers.filter((o) => !o.description).length, offers.length),
      median_description_chars: (() => { const l = parents.map((o) => (o.description ?? "").length).sort((a, b) => a - b); return l[Math.floor(l.length / 2)] ?? 0; })(),
    },
    sku: { with_sku_pct: pct(Object.values(skuCounts).reduce((a, b) => a + b, 0), offers.length), duplicate_skus: dupSkus.length, duplicate_sku_examples: dupSkus.slice(0, 5).map(([s]) => s) },
    duplicates: {
      same_title_groups: groups(titleGroups).length, same_first_image_groups: groups(imageGroups).length, potential_family_groups: groups(famGroups).length,
      examples: groups(famGroups).slice(0, 5).map((g) => sample(g, 4)),
    },
    offer_kinds: count(kinds),
    bundles_and_packs: {
      bundle_like_categories: Object.keys(categories).filter((c) => BUNDLE_WORDS.test(c)),
      title_claims_multipack: sample(offers.filter((_, i) => kinds[i] === "title_claims_multipack")),
      bundle_unverified: sample(offers.filter((_, i) => kinds[i] === "bundle_unverified")),
      grouped_products: parents.filter((o) => o.product_type === "grouped").length,
      linked_products: parents.filter((o) => {
        const r = o.raw as Record<string, unknown>;
        return ["upsell_ids", "cross_sell_ids", "grouped_products"].some((k) => Array.isArray(r[k]) && (r[k] as unknown[]).length > 0);
      }).length,
    },
    categories: Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 40),
    attributes: Object.entries(attributeNames).sort((a, b) => b[1] - a[1]).slice(0, 30),
    meta_keys: Object.entries(keyStats).sort((a, b) => b[1].count - a[1].count).slice(0, 80)
      .map(([key, s]) => ({ key, count: s.count, numeric_share: s.numericShare, samples: s.samples })),
    field_mapping: mapping,
    key_stats: Object.fromEntries(Object.entries(keyStats).map(([k, s]) => [k, { count: s.count, numericShare: s.numericShare }])),
  };
}
