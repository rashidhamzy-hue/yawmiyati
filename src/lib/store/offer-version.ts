/**
 * M12 — approved offer versions for the normal storefront.
 *
 * Two layers, deliberately separated:
 *  1. Owner side (`buildOfferVersion`): takes private commercial inputs
 *     (supplier cost, floor, stock, comparable delivered price, COD outcome
 *     split) and decides which packs and add-ons may be shown in each delivery
 *     zone. It refuses to publish without an approval whose digest matches the
 *     exact inputs, so any change to a critical input invalidates approval.
 *  2. Public side (`ApprovedOfferVersion` + `parseOfferVersion`): the only
 *     shape the storefront renders. It carries customer prices, delivery and
 *     eligibility, never cost, floor, stock counts or supplier identity.
 *
 * All money is integer minor units; totals use BigInt. Nothing here performs
 * network calls, submits orders or enables checkout.
 */
import { markets, type MarketCode } from "./markets";
import { formatListingPrice, PUBLIC_CATEGORY_SLUGS, type PublicCategorySlug, type PublicListing } from "./public-catalog";

export const OFFER_CONTRACT = "yawmiyati.offer_version.v1" as const;
export type OfferPackKind = "single" | "same_sku_multipack" | "quantity_tier" | "fixed_mixed_bundle" | "merchant_kit";
const PACK_KINDS: readonly OfferPackKind[] = ["single", "same_sku_multipack", "quantity_tier", "fixed_mixed_bundle", "merchant_kit"];
export type ShippingRule = "zone_rate" | "included";

export type PublicPack = {
  pack_id: string;
  label: string;
  kind: OfferPackKind;
  /** Units of one identical item, only when the pack is a single physical item repeated. */
  units: number | null;
  price_minor: string;
  shipping: ShippingRule;
  /** False for packs reachable only through an approved add-on (for example a kit). */
  selectable: boolean;
};
export type PublicAddOn = { add_on_id: string; label: string; from_pack_id: string; to_pack_id: string; zone_ids: string[] };
export type PublicZone = { zone_id: string; label: string; delivery_minor: string; pack_ids: string[] };
export type ApprovedOfferVersion = {
  contract: typeof OFFER_CONTRACT;
  market: MarketCode;
  currency: string;
  listing_id: string;
  slug: string;
  title: string;
  description: string;
  image: { url: string; alt: string } | null;
  category_slug: PublicCategorySlug | null;
  version_id: string;
  revision: number;
  approved_at: string;
  inputs_digest: string;
  default_pack_id: string;
  packs: PublicPack[];
  add_ons: PublicAddOn[];
  zones: PublicZone[];
};

/* ----------------------------- money helpers ----------------------------- */

const isMinorString = (v: unknown): v is string => typeof v === "string" && /^\d{1,30}$/.test(v);
export function formatMinor(market: MarketCode, minor: string | bigint): string {
  const value = typeof minor === "bigint" ? minor : BigInt(minor);
  if (value <= 0n) throw Error("Only positive amounts are formatted; render zero explicitly");
  const row: PublicListing = { listing_id: "x", slug: "x", title: "x", price_minor: value.toString(), currency: markets[market].currency };
  return formatListingPrice(row, market);
}
/** Exact per-unit price only when it divides evenly; never shows a rounded claim. */
export function exactUnitPrice(pack: PublicPack): bigint | null {
  if (pack.units === null || pack.units < 2) return null;
  const price = BigInt(pack.price_minor), units = BigInt(pack.units);
  return price % units === 0n ? price / units : null;
}
export function doorMinor(pack: PublicPack, zone: PublicZone): bigint {
  return BigInt(pack.price_minor) + (pack.shipping === "zone_rate" ? BigInt(zone.delivery_minor) : 0n);
}

/* ------------------------------ public parser ----------------------------- */

type Loose<T> = { [K in keyof T]?: unknown };
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const ident = (v: unknown): v is string => typeof v === "string" && /^[a-z0-9][a-z0-9_-]{0,79}$/.test(v);

/** Strict, fail-closed parse of a public offer version for one market and slug. */
export function parseOfferVersion(raw: unknown, market: MarketCode, slug?: string): ApprovedOfferVersion {
  const fail = (why: string): never => { throw Error("Invalid offer version: " + why); };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("shape");
  const r = raw as Loose<ApprovedOfferVersion>;
  if (r.contract !== OFFER_CONTRACT) fail("contract");
  if (r.market !== market || r.currency !== markets[market].currency) fail("market_or_currency");
  if (!text(r.listing_id, 100) || !text(r.slug, 200) || /[/?#\\]/.test(r.slug as string)) fail("identity");
  if (slug !== undefined && r.slug !== slug) fail("slug");
  if (!text(r.title, 300) || typeof r.description !== "string" || r.description.length > 5000) fail("copy");
  if (!text(r.version_id, 120) || !Number.isSafeInteger(r.revision) || (r.revision as number) < 1) fail("revision");
  if (!text(r.approved_at, 40) || !Number.isFinite(Date.parse(r.approved_at as string))) fail("approved_at");
  if (!text(r.inputs_digest, 64)) fail("digest");
  if (r.category_slug !== null && !PUBLIC_CATEGORY_SLUGS.some(s => s === r.category_slug)) fail("category");
  let image: ApprovedOfferVersion["image"] = null;
  if (r.image !== null) {
    const i = r.image as Loose<{ url: string; alt: string }> | undefined;
    if (!i || !text(i.url, 2000) || !text(i.alt, 240)) fail("image");
    const url = (i as { url: string }).url;
    if (!(url.startsWith("/") && !url.startsWith("//")) && !/^https:\/\//.test(url)) fail("image_url");
    image = { url, alt: (i as { alt: string }).alt };
  }
  if (!Array.isArray(r.packs) || !r.packs.length || r.packs.length > 12) fail("packs");
  const packs: PublicPack[] = (r.packs as unknown[]).map(p => {
    const x = p as Loose<PublicPack>;
    if (!x || !ident(x.pack_id) || !text(x.label, 120) || !PACK_KINDS.includes(x.kind as OfferPackKind)) fail("pack");
    if (!isMinorString(x.price_minor) || BigInt(x.price_minor as string) <= 0n) fail("pack_price");
    if (x.shipping !== "zone_rate" && x.shipping !== "included") fail("pack_shipping");
    if (x.units !== null && !(Number.isSafeInteger(x.units) && (x.units as number) >= 1 && (x.units as number) <= 100)) fail("pack_units");
    if (typeof x.selectable !== "boolean") fail("pack_selectable");
    return { pack_id: x.pack_id as string, label: x.label as string, kind: x.kind as OfferPackKind, units: x.units as number | null,
      price_minor: x.price_minor as string, shipping: x.shipping as ShippingRule, selectable: x.selectable as boolean };
  });
  const packIds = new Set(packs.map(p => p.pack_id));
  if (packIds.size !== packs.length) fail("duplicate_pack");
  if (!Array.isArray(r.zones) || !r.zones.length || r.zones.length > 10) fail("zones");
  const zones: PublicZone[] = (r.zones as unknown[]).map(z => {
    const x = z as Loose<PublicZone>;
    if (!x || !ident(x.zone_id) || !text(x.label, 300) || !isMinorString(x.delivery_minor)) fail("zone");
    if (!Array.isArray(x.pack_ids) || !(x.pack_ids as unknown[]).every(id => typeof id === "string" && packIds.has(id))) fail("zone_packs");
    if (new Set(x.pack_ids as string[]).size !== (x.pack_ids as string[]).length) fail("zone_duplicate_pack");
    return { zone_id: x.zone_id as string, label: x.label as string, delivery_minor: x.delivery_minor as string, pack_ids: [...(x.pack_ids as string[])] };
  });
  const zoneIds = new Set(zones.map(z => z.zone_id));
  if (zoneIds.size !== zones.length) fail("duplicate_zone");
  const listedSomewhere = new Set(zones.flatMap(z => z.pack_ids));
  if (!packs.every(p => listedSomewhere.has(p.pack_id))) fail("pack_without_zone");
  if (!Array.isArray(r.add_ons) || r.add_ons.length > 12) fail("add_ons");
  const addOns: PublicAddOn[] = (r.add_ons as unknown[]).map(a => {
    const x = a as Loose<PublicAddOn>;
    if (!x || !ident(x.add_on_id) || !text(x.label, 120) || !packIds.has(x.from_pack_id as string) || !packIds.has(x.to_pack_id as string) || x.from_pack_id === x.to_pack_id) fail("add_on");
    if (!Array.isArray(x.zone_ids) || !(x.zone_ids as unknown[]).length) fail("add_on_zones");
    for (const id of x.zone_ids as unknown[]) {
      const zone = zones.find(z => z.zone_id === id);
      if (!zone || !zone.pack_ids.includes(x.from_pack_id as string) || !zone.pack_ids.includes(x.to_pack_id as string)) fail("add_on_zone_eligibility");
    }
    const from = packs.find(p => p.pack_id === x.from_pack_id)!, to = packs.find(p => p.pack_id === x.to_pack_id)!;
    if (BigInt(to.price_minor) <= BigInt(from.price_minor)) fail("add_on_price");
    return { add_on_id: x.add_on_id as string, label: x.label as string, from_pack_id: from.pack_id, to_pack_id: to.pack_id, zone_ids: [...(x.zone_ids as string[])] };
  });
  if (new Set(addOns.map(a => a.add_on_id)).size !== addOns.length) fail("duplicate_add_on");
  const def = packs.find(p => p.pack_id === r.default_pack_id);
  if (!def || !def.selectable) fail("default_pack");
  if (!packs.every(p => p.selectable || addOns.some(a => a.to_pack_id === p.pack_id))) fail("unreachable_pack");
  return {
    contract: OFFER_CONTRACT, market, currency: r.currency as string, listing_id: r.listing_id as string, slug: r.slug as string,
    title: r.title as string, description: r.description as string, image, category_slug: r.category_slug as PublicCategorySlug | null,
    version_id: r.version_id as string, revision: r.revision as number, approved_at: r.approved_at as string, inputs_digest: r.inputs_digest as string,
    default_pack_id: r.default_pack_id as string, packs, add_ons: addOns, zones,
  };
}

/** Listing row used by existing grid, search and assistant components. Price shown is the default pack. */
export function offerListing(v: ApprovedOfferVersion): PublicListing {
  const pack = v.packs.find(p => p.pack_id === v.default_pack_id)!;
  return { listing_id: v.listing_id, slug: v.slug, title: v.title, price_minor: pack.price_minor, currency: v.currency,
    ...(v.category_slug ? { approved_category_slugs: [v.category_slug] } : {}) };
}

/* ------------------------------ owner builder ----------------------------- */

export type OwnerPackInput = {
  pack_id: string; label: string; kind: OfferPackKind; selectable: boolean; shipping: ShippingRule;
  /** Explicit component evidence; null means unverified composition. */
  components: readonly { id: string; quantity: number }[] | null;
  price_minor: number; floor_minor: number | null; cost_minor: number | null;
  stock: number | null; stock_checked_at: string | null;
  /** Matched-pack delivered local price per zone, with its source and date. */
  comparison: { door_minor_by_zone: Readonly<Record<string, number>>; source: string; observed_at: string } | null;
};
export type OwnerOfferInput = {
  market: MarketCode; listing_id: string; slug: string; title: string; description: string;
  image: { url: string; alt: string } | null; category_slug: PublicCategorySlug | null;
  as_of: string; stock_max_age_hours: number; comparison_max_age_days: number;
  zones: readonly { zone_id: string; label: string; delivery_minor: number; freight_cost_minor: number }[];
  /** Outcome split per submitted COD order; must sum to 10000. */
  outcomes: { retained_bps: number; refused_bps: number; returned_bps: number };
  fees: { handling_minor: number; refusal_fee_minor: number; return_fee_minor: number };
  acquisition_minor: number; target_minor: number;
  packs: readonly OwnerPackInput[];
  add_ons: readonly { add_on_id: string; label: string; from_pack_id: string; to_pack_id: string }[];
  approval: { revision: number; approved_at: string; approved_inputs_digest: string } | null;
};
export type PackZoneEvaluation = { pack_id: string; zone_id: string; door_minor: number; expected_minor: number | null; reasons: string[] };
export type OfferBuildResult =
  | { status: "publishable"; version: ApprovedOfferVersion; inputs_digest: string; evaluation: PackZoneEvaluation[] }
  | { status: "blocked"; reasons: string[]; inputs_digest: string; evaluation: PackZoneEvaluation[] };

function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + canonical((value as Record<string, unknown>)[k])).join(",") + "}";
  return JSON.stringify(value);
}
/** FNV-1a 64-bit over canonical JSON. Change detection for approvals, not a security signature. */
export function offerInputsDigest(input: OwnerOfferInput): string {
  const { approval: _approval, ...critical } = input;
  void _approval;
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(canonical(critical))) {
    hash ^= BigInt(byte);
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return "fnv1a64:" + hash.toString(16).padStart(16, "0");
}
const floorDiv = (n: bigint, d: bigint) => (n >= 0n ? n / d : -((-n + d - 1n) / d));

/** Expected contribution per submitted COD order, conservative (rounds losses down). */
export function expectedContribution(input: OwnerOfferInput, pack: OwnerPackInput, zone: OwnerOfferInput["zones"][number]): number | null {
  if (pack.cost_minor === null) return null;
  const door = BigInt(pack.price_minor) + (pack.shipping === "zone_rate" ? BigInt(zone.delivery_minor) : 0n);
  const freight = BigInt(zone.freight_cost_minor), handling = BigInt(input.fees.handling_minor);
  const kept = door - BigInt(pack.cost_minor) - freight - handling;
  const refused = -freight - BigInt(input.fees.refusal_fee_minor);
  const returned = -freight - BigInt(input.fees.return_fee_minor) - handling;
  const o = input.outcomes;
  const weighted = BigInt(o.retained_bps) * kept + BigInt(o.refused_bps) * refused + BigInt(o.returned_bps) * returned;
  const result = floorDiv(weighted, 10000n) - BigInt(input.acquisition_minor);
  if (result > BigInt(Number.MAX_SAFE_INTEGER) || result < BigInt(Number.MIN_SAFE_INTEGER)) throw Error("Contribution overflow");
  return Number(result);
}

export function buildOfferVersion(input: OwnerOfferInput): OfferBuildResult {
  const money = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
  const o = input.outcomes;
  if (![o.retained_bps, o.refused_bps, o.returned_bps].every(money) || o.retained_bps + o.refused_bps + o.returned_bps !== 10000) throw Error("Outcome split must sum to 10000 bps");
  if (![input.fees.handling_minor, input.fees.refusal_fee_minor, input.fees.return_fee_minor, input.acquisition_minor, input.target_minor].every(money)) throw Error("Invalid fee input");
  const now = Date.parse(input.as_of);
  if (!Number.isFinite(now)) throw Error("Invalid as_of");
  if (!input.zones.length || new Set(input.zones.map(z => z.zone_id)).size !== input.zones.length) throw Error("Invalid zones");
  if (!input.zones.every(z => ident(z.zone_id) && money(z.delivery_minor) && money(z.freight_cost_minor))) throw Error("Invalid zone input");
  if (new Set(input.packs.map(p => p.pack_id)).size !== input.packs.length) throw Error("Duplicate pack");
  const digest = offerInputsDigest(input);
  const evaluation: PackZoneEvaluation[] = [];
  for (const pack of input.packs) {
    if (!ident(pack.pack_id) || !Number.isSafeInteger(pack.price_minor) || pack.price_minor <= 0) throw Error("Invalid pack " + pack.pack_id);
    const general: string[] = [];
    const parts = pack.components ?? [];
    if (!parts.length || !parts.every(p => p.id.trim() && Number.isSafeInteger(p.quantity) && p.quantity > 0) || new Set(parts.map(p => p.id)).size !== parts.length) general.push("unverified_components");
    if (!money(pack.floor_minor)) general.push("missing_floor");
    else if (pack.price_minor < pack.floor_minor) general.push("below_floor");
    if (!money(pack.cost_minor)) general.push("missing_cost");
    if (!money(pack.stock)) general.push("missing_stock");
    else if (pack.stock < 1) general.push("unavailable");
    const checked = Date.parse(pack.stock_checked_at ?? "");
    if (!(now - checked >= 0 && now - checked <= input.stock_max_age_hours * 3600000)) general.push("stale_stock");
    const cmp = pack.comparison;
    const cmpAge = now - Date.parse(cmp?.observed_at ?? "");
    const cmpValid = !!cmp && !!cmp.source.trim() && cmpAge >= 0 && cmpAge <= input.comparison_max_age_days * 86400000;
    if (!cmpValid) general.push("missing_local_comparison");
    for (const zone of input.zones) {
      const reasons = [...general];
      const door = pack.price_minor + (pack.shipping === "zone_rate" ? zone.delivery_minor : 0);
      if (cmpValid) {
        const comparable = cmp!.door_minor_by_zone[zone.zone_id];
        if (!money(comparable) || comparable === 0) reasons.push("missing_local_comparison");
        else if (door > comparable) reasons.push("above_comparable_delivered_price");
      }
      const expected = expectedContribution(input, pack, zone);
      if (expected !== null && expected < input.target_minor) reasons.push("below_target_contribution");
      evaluation.push({ pack_id: pack.pack_id, zone_id: zone.zone_id, door_minor: door, expected_minor: expected, reasons });
    }
  }
  const expectedOf = (packId: string, zoneId: string) => evaluation.find(e => e.pack_id === packId && e.zone_id === zoneId)!.expected_minor!;
  const byId = new Map(input.packs.map(p => [p.pack_id, p]));
  // One customer option per verified composition: when a supplier pack SKU and a quantity tier
  // deliver the same units, keep only the higher expected contribution in that zone.
  const signature = (p: OwnerPackInput) => JSON.stringify([...(p.components ?? [])].map(c => [c.id, c.quantity]).sort());
  for (const zone of input.zones) {
    const rows = evaluation.filter(e => e.zone_id === zone.zone_id && !e.reasons.length && byId.get(e.pack_id)!.selectable);
    for (const row of rows) {
      const rival = rows.find(other => other !== row && signature(byId.get(other.pack_id)!) === signature(byId.get(row.pack_id)!) &&
        (other.expected_minor! > row.expected_minor! || (other.expected_minor === row.expected_minor && other.pack_id < row.pack_id)));
      if (rival) row.reasons.push("duplicate_composition:" + rival.pack_id);
    }
  }
  const ok = (packId: string, zoneId: string) => evaluation.some(e => e.pack_id === packId && e.zone_id === zoneId && !e.reasons.length);
  // Add-on is offered in a zone only when both packs are eligible there, the upgrade costs the
  // shopper more and it does not lower expected contribution per order (margin-qualified).
  const addOns: PublicAddOn[] = input.add_ons.map(a => {
    const from = byId.get(a.from_pack_id), to = byId.get(a.to_pack_id);
    if (!from || !to || from === to) throw Error("Invalid add-on " + a.add_on_id);
    const zone_ids = input.zones.map(z => z.zone_id).filter(z => ok(from.pack_id, z) && ok(to.pack_id, z) && to.price_minor > from.price_minor && expectedOf(to.pack_id, z) >= expectedOf(from.pack_id, z));
    return { add_on_id: a.add_on_id, label: a.label, from_pack_id: from.pack_id, to_pack_id: to.pack_id, zone_ids };
  }).filter(a => a.zone_ids.length > 0);
  // Non-selectable packs are listed only in zones where an approved add-on reaches them.
  const zones: PublicZone[] = input.zones.map(z => ({
    zone_id: z.zone_id, label: z.label, delivery_minor: String(z.delivery_minor),
    pack_ids: input.packs.filter(p => ok(p.pack_id, z.zone_id) && (p.selectable || addOns.some(a => a.to_pack_id === p.pack_id && a.zone_ids.includes(z.zone_id)))).map(p => p.pack_id),
  }));
  const listed = new Set(zones.flatMap(z => z.pack_ids));
  const packs: PublicPack[] = input.packs.filter(p => listed.has(p.pack_id)).map(p => ({
    pack_id: p.pack_id, label: p.label, kind: p.kind, selectable: p.selectable, shipping: p.shipping, price_minor: String(p.price_minor),
    units: p.components?.length === 1 ? p.components[0]?.quantity ?? null : null,
  }));
  const reasons: string[] = [];
  const defaultPack = [...packs].filter(p => p.selectable).sort((a, b) => {
    const best = (id: string) => Math.max(...input.zones.filter(z => ok(id, z.zone_id)).map(z => expectedOf(id, z.zone_id)));
    return best(b.pack_id) - best(a.pack_id) || a.pack_id.localeCompare(b.pack_id, "en");
  })[0];
  if (!defaultPack) reasons.push("no_eligible_pack");
  if (!input.approval) reasons.push("approval_missing");
  else if (input.approval.approved_inputs_digest !== digest) reasons.push("approval_stale");
  if (reasons.length) return { status: "blocked", reasons, inputs_digest: digest, evaluation };
  const version: ApprovedOfferVersion = {
    contract: OFFER_CONTRACT, market: input.market, currency: markets[input.market].currency,
    listing_id: input.listing_id, slug: input.slug, title: input.title, description: input.description,
    image: input.image, category_slug: input.category_slug,
    version_id: input.listing_id + "@r" + input.approval!.revision, revision: input.approval!.revision,
    approved_at: input.approval!.approved_at, inputs_digest: digest, default_pack_id: defaultPack!.pack_id,
    packs, add_ons: addOns, zones: zones.filter(z => z.pack_ids.length),
  };
  // Round-trip through the public parser so owner output always satisfies the storefront contract.
  return { status: "publishable", version: parseOfferVersion(version, input.market, input.slug), inputs_digest: digest, evaluation };
}

/* --------------------------------- cart ---------------------------------- */

export type OfferCartLine = { listing_id: string; slug: string; version_id: string; revision: number; pack_id: string; add_on_id: string | null };
export type OfferCart = { market: MarketCode; zone_id: string | null; lines: OfferCartLine[] };
export type PricedLine = {
  line: OfferCartLine; version: ApprovedOfferVersion | null; pack: PublicPack | null; addOn: PublicAddOn | null;
  status: "ok" | "missing" | "changed" | "unavailable_in_zone";
  price_minor: bigint; delivery_minor: bigint; door_minor: bigint;
};
export type PricedCart = { zone: PublicZone | null; zones: PublicZone[]; lines: PricedLine[]; total_door_minor: bigint; checkoutReady: boolean };

/** Shared zone list across versions in one market (zones are market-level delivery bands). */
export function marketZones(versions: readonly ApprovedOfferVersion[]): PublicZone[] {
  const seen = new Map<string, PublicZone>();
  for (const v of versions) for (const z of v.zones) if (!seen.has(z.zone_id)) seen.set(z.zone_id, { ...z, pack_ids: [] });
  return [...seen.values()];
}

/**
 * Exact total at the door. Each product line is a separate shipment with its own
 * delivery charge because combined multi-line shipments are not verified.
 * Lines whose approved revision changed or that are not offered in the chosen
 * zone are excluded from the total and block checkout review.
 */
export function priceOfferCart(cart: OfferCart, versions: readonly ApprovedOfferVersion[]): PricedCart {
  if (versions.some(v => v.market !== cart.market)) throw Error("Cross-market offer version");
  const zones = marketZones(versions);
  const zone = zones.find(z => z.zone_id === cart.zone_id) ?? (zones.length === 1 ? zones[0] ?? null : null);
  let total = 0n;
  const lines: PricedLine[] = cart.lines.map(line => {
    const version = versions.find(v => v.slug === line.slug && v.listing_id === line.listing_id) ?? null;
    const empty = { line, version, pack: null, addOn: null, price_minor: 0n, delivery_minor: 0n, door_minor: 0n };
    if (!version) return { ...empty, status: "missing" as const };
    const pack = version.packs.find(p => p.pack_id === line.pack_id) ?? null;
    const addOn = line.add_on_id === null ? null : version.add_ons.find(a => a.add_on_id === line.add_on_id && a.to_pack_id === line.pack_id) ?? null;
    if (version.version_id !== line.version_id || version.revision !== line.revision || !pack || (line.add_on_id !== null && !addOn) || (line.add_on_id === null && !pack.selectable))
      return { ...empty, version, pack, addOn, status: "changed" as const };
    const vz = zone ? version.zones.find(z => z.zone_id === zone.zone_id) : undefined;
    if (!zone || !vz || !vz.pack_ids.includes(pack.pack_id) || (addOn && !addOn.zone_ids.includes(zone.zone_id)))
      return { ...empty, version, pack, addOn, status: "unavailable_in_zone" as const, price_minor: BigInt(pack.price_minor) };
    const price = BigInt(pack.price_minor), delivery = pack.shipping === "zone_rate" ? BigInt(vz.delivery_minor) : 0n;
    total += price + delivery;
    return { line, version, pack, addOn, status: "ok" as const, price_minor: price, delivery_minor: delivery, door_minor: price + delivery };
  });
  return { zone, zones, lines, total_door_minor: total, checkoutReady: !!zone && lines.length > 0 && lines.every(l => l.status === "ok") };
}

export function parseStoredCart(raw: unknown, market: MarketCode): OfferCart {
  const empty: OfferCart = { market, zone_id: null, lines: [] };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return empty;
  const r = raw as Loose<OfferCart>;
  if (r.market !== market || !Array.isArray(r.lines) || r.lines.length > 20) return empty;
  const lines = (r.lines as unknown[]).filter((l): l is OfferCartLine => {
    const x = l as Loose<OfferCartLine>;
    return !!x && text(x.listing_id, 100) && text(x.slug, 200) && text(x.version_id, 120) && Number.isSafeInteger(x.revision)
      && ident(x.pack_id) && (x.add_on_id === null || ident(x.add_on_id));
  }).map(l => ({ listing_id: l.listing_id, slug: l.slug, version_id: l.version_id, revision: l.revision, pack_id: l.pack_id, add_on_id: l.add_on_id }));
  return { market, zone_id: ident(r.zone_id) ? r.zone_id : null, lines };
}
