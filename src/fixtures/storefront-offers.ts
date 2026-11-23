/**
 * ISOLATED STOREFRONT OFFER FIXTURES — fictional products, prices, stock,
 * delivery fees and approvals. Not supplier evidence, not historic quotes,
 * not customer prices.
 *
 * Loaded ONLY by src/lib/store/offer-source.ts through a dynamic import that
 * is compiled away unless VITE_YAWMIYATI_OFFER_FIXTURES=true, and rendered
 * only on loopback hosts. scripts/check-offer-fixture-isolation.mjs enforces
 * both rules and that production bundles do not contain FIXTURE_MARKER.
 *
 * Every product runs through the real owner gates in offer-version.ts. If you
 * change an input, its approval digest stops matching and the product is
 * withheld until re-approved — that behaviour is part of what this proves.
 */
import { markets, type MarketCode } from "../lib/store/markets";
import { buildOfferVersion, type ApprovedOfferVersion, type OwnerOfferInput, type OwnerPackInput } from "../lib/store/offer-version";

export const FIXTURE_MARKER = "yawmiyati-offer-fixture-v1";
export const FIXTURE_AS_OF = "2026-11-22T08:00:00Z";
const APPROVED_AT = "2026-11-22T07:30:00Z";

// Fictional per-market baselines in whole currency units.
const base: Record<MarketCode, number> = { sa: 65, ae: 60, om: 6, eg: 550, iq: 22000 };
// Fictional customer delivery fees (whole units). Deliberately NOT the historic quotes.
const delivery: Record<MarketCode, readonly number[]> = { sa: [20], ae: [15], om: [2], eg: [70, 80, 90], iq: [5000] };
const zoneLabels: Record<MarketCode, readonly string[]> = {
  sa: ["جميع المناطق"], ae: ["جميع الإمارات"], om: ["جميع المحافظات"], iq: ["جميع المحافظات"],
  eg: ["منطقة التوصيل الأولى", "منطقة التوصيل الثانية", "منطقة التوصيل الثالثة"],
};

/** Approval digests recorded when each fixture revision was approved. */
export const fixtureApprovals: Record<string, string> = {
  "sa:spice-rack": "fnv1a64:9da8fbb52f49e83c", "sa:milk-frother": "fnv1a64:ec4bdc7f2876a680",
  "ae:spice-rack": "fnv1a64:9bc27e96f008e29c", "ae:milk-frother": "fnv1a64:ca8bf545db465c87",
  "om:spice-rack": "fnv1a64:cd26f6525efc9244", "om:milk-frother": "fnv1a64:575e6f381e40327e",
  "eg:spice-rack": "fnv1a64:b13917f2eb1284e7", "eg:milk-frother": "fnv1a64:9e0fb37a4c0b45ab", "eg:hair-brush": "fnv1a64:81ce199b01fcf4b7",
  "iq:spice-rack": "fnv1a64:0afc12893604d8ac",
  // Approved before a later price change: digest no longer matches, so it stays withheld.
  "iq:milk-frother": "fnv1a64:0000000000000000",
};

function scaffold(market: MarketCode, slug: string) {
  const unit = 10 ** markets[market].minorDigits;
  const b = base[market] * unit;
  const pct = (p: number) => Math.round((b * p) / 100);
  const zones = delivery[market].map((fee, i) => ({ zone_id: "z" + (i + 1), label: zoneLabels[market][i] ?? "z" + (i + 1), delivery_minor: fee * unit, freight_cost_minor: fee * unit }));
  const byZone = (extra: (zoneDelivery: number) => number) => Object.fromEntries(zones.map(z => [z.zone_id, extra(z.delivery_minor)]));
  const common = {
    market, as_of: FIXTURE_AS_OF, stock_max_age_hours: 24, comparison_max_age_days: 30,
    zones,
    outcomes: { retained_bps: 8000, refused_bps: 1500, returned_bps: 500 },
    fees: { handling_minor: pct(4), refusal_fee_minor: market === "eg" ? 500 : pct(4), return_fee_minor: market === "eg" ? 500 : pct(8) },
    acquisition_minor: pct(12), target_minor: pct(10),
  };
  const pack = (p: Omit<OwnerPackInput, "stock_checked_at" | "comparison"> & { comparable: (zoneDelivery: number) => number }): OwnerPackInput => {
    const { comparable, ...rest } = p;
    return { ...rest, stock_checked_at: FIXTURE_AS_OF, comparison: { door_minor_by_zone: byZone(comparable), source: "Fictional matched-pack local price", observed_at: FIXTURE_AS_OF } };
  };
  const approval = (key: string) => ({ revision: 1, approved_at: APPROVED_AT, approved_inputs_digest: fixtureApprovals[key] ?? "unapproved" });
  return { b, pct, common, pack, approval, key: market + ":" + slug };
}

function spiceRack(market: MarketCode): OwnerOfferInput {
  const { pct, common, pack, approval, key } = scaffold(market, "spice-rack");
  const rack = (q: number) => [{ id: "fixture-spice-rack", quantity: q }];
  const packs: OwnerPackInput[] = [
    pack({ pack_id: "single", label: "حامل واحد", kind: "single", selectable: true, shipping: "zone_rate", components: rack(1),
      price_minor: pct(100), floor_minor: pct(80), cost_minor: pct(48), stock: 24, comparable: d => pct(100) + d }),
    // Separately stocked two-pack SKU.
    pack({ pack_id: "pair-pack", label: "عبوة حاملين", kind: "same_sku_multipack", selectable: true, shipping: "zone_rate", components: rack(2),
      price_minor: pct(170), floor_minor: pct(145), cost_minor: market === "om" ? pct(116) : pct(78), stock: market === "iq" ? 0 : 8,
      comparable: d => pct(180) + d }),
    // Same two units sold as a quantity tier of the single SKU; competes with the two-pack for the same slot.
    pack({ pack_id: "pair-tier", label: "حاملان", kind: "quantity_tier", selectable: true, shipping: "zone_rate", components: rack(2),
      price_minor: pct(177), floor_minor: pct(152), cost_minor: pct(89), stock: 12, comparable: d => pct(180) + d }),
    // Yawmiyati kit reachable only as an add-on to the single rack.
    pack({ pack_id: "rack-hook-kit", label: "حامل مع خطّاف تنظيم", kind: "merchant_kit", selectable: false, shipping: "zone_rate",
      components: [...rack(1), { id: "fixture-organiser-hook", quantity: 1 }],
      price_minor: pct(137), floor_minor: pct(105), cost_minor: market === "ae" ? pct(92) : pct(64), stock: 6, comparable: d => pct(145) + d }),
  ];
  return { ...common, listing_id: "fx-" + market + "-spice-rack", slug: "spice-rack", title: "حامل عبوات التوابل",
    description: "حامل بثلاثة رفوف لتنظيم عبوات التوابل على سطح المطبخ.\n(منتج تجريبي لاختبار المتجر محلياً.)",
    image: { url: "/browse/spice-jars.webp", alt: "عبوات توابل مرتبة على حامل" }, category_slug: "organize",
    packs, add_ons: [{ add_on_id: "hook", label: "أضيفي خطّاف تنظيم", from_pack_id: "single", to_pack_id: "rack-hook-kit" }],
    approval: approval(key) };
}

function milkFrother(market: MarketCode): OwnerOfferInput {
  const { pct, common, pack, approval, key } = scaffold(market, "milk-frother");
  const price = market === "iq" ? pct(95) : pct(90); // IQ price changed after approval.
  return { ...common, listing_id: "fx-" + market + "-milk-frother", slug: "milk-frother", title: "خفّاقة حليب يدوية",
    description: "خفّاقة صغيرة تعمل بالبطارية لرغوة الحليب في القهوة.\n(منتج تجريبي لاختبار المتجر محلياً.)",
    image: { url: "/browse/coffee-frother.webp", alt: "خفّاقة حليب بجانب كوب قهوة" }, category_slug: "kitchen",
    packs: [pack({ pack_id: "single", label: "خفّاقة واحدة", kind: "single", selectable: true, shipping: "zone_rate",
      components: [{ id: "fixture-frother", quantity: 1 }], price_minor: price, floor_minor: pct(75), cost_minor: pct(40), stock: 30,
      comparable: d => price + d })],
    add_ons: [], approval: approval(key) };
}

/** Egypt only: brush with an optional clip whose conditional terms apply only inside the kit. */
function hairBrush(): OwnerOfferInput {
  const { common, pack, approval, key } = scaffold("eg", "hair-brush");
  return { ...common, listing_id: "fx-eg-hair-brush", slug: "hair-brush", title: "فرشاة تصفيف الشعر",
    description: "فرشاة دائرية لتصفيف الشعر بالسشوار.\n(منتج تجريبي لاختبار المتجر محلياً.)",
    image: { url: "/browse/hair-styling.webp", alt: "أدوات تصفيف الشعر" }, category_slug: "beauty",
    packs: [
      pack({ pack_id: "single", label: "فرشاة واحدة", kind: "single", selectable: true, shipping: "zone_rate",
        components: [{ id: "fixture-brush", quantity: 1 }], price_minor: 59900, floor_minor: 58300, cost_minor: 35400, stock: 12,
        comparable: d => 59900 + d }),
      // Matched local comparison is cheaper in the third zone, so the kit is withheld there.
      pack({ pack_id: "brush-clip-kit", label: "فرشاة مع مشبك", kind: "merchant_kit", selectable: false, shipping: "zone_rate",
        components: [{ id: "fixture-brush", quantity: 1 }, { id: "fixture-clip", quantity: 1 }],
        price_minor: 73500, floor_minor: 71900, cost_minor: 48500, stock: 12,
        comparable: d => (d === 9000 ? 73500 + d - 100 : 76000 + d) }),
    ],
    add_ons: [{ add_on_id: "clip", label: "أضيفي مشبك شعر", from_pack_id: "single", to_pack_id: "brush-clip-kit" }],
    approval: approval(key) };
}

export function fixtureOfferInputs(market: MarketCode): OwnerOfferInput[] {
  return [spiceRack(market), milkFrother(market), ...(market === "eg" ? [hairBrush()] : [])];
}

export function fixtureOfferVersions(market: MarketCode): { marker: typeof FIXTURE_MARKER; versions: ApprovedOfferVersion[]; withheld: { slug: string; reasons: string[] }[] } {
  const versions: ApprovedOfferVersion[] = [], withheld: { slug: string; reasons: string[] }[] = [];
  for (const input of fixtureOfferInputs(market)) {
    const result = buildOfferVersion(input);
    if (result.status === "publishable") versions.push(result.version);
    else withheld.push({ slug: input.slug, reasons: result.reasons });
  }
  return { marker: FIXTURE_MARKER, versions, withheld };
}
