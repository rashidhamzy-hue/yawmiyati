/**
 * Per-market offer cart kept in the shopper's browser. Each country has its own
 * storage key and parser, so a Saudi cart can never surface in another store.
 * Holds selections only (listing, approved revision, pack, add-on, zone) — no
 * customer details, prices are always recomputed from the current version.
 */
import { useSyncExternalStore } from "react";
import type { MarketCode } from "./markets";
import { parseStoredCart, type OfferCart, type OfferCartLine } from "./offer-version";
import { track } from "../analytics/analytics";

const lineProps = (l: OfferCartLine) => ({ listing_id: l.listing_id, product_slug: l.slug, pack_id: l.pack_id, add_on_id: l.add_on_id });

const EVENT = "yawmiyati:offer-cart";
export const offerCartKey = (market: MarketCode) => "yawmiyati-offer-cart:v1:" + market;
const snapshots = new Map<string, { raw: string | null; cart: OfferCart }>();

function readRaw(market: MarketCode): string | null {
  try { return window.localStorage.getItem(offerCartKey(market)); } catch { return null; }
}
export function readOfferCart(market: MarketCode): OfferCart {
  const raw = typeof window === "undefined" ? null : readRaw(market);
  const cached = snapshots.get(market);
  if (cached && cached.raw === raw) return cached.cart;
  let cart: OfferCart;
  try { cart = parseStoredCart(raw ? JSON.parse(raw) : null, market); } catch { cart = parseStoredCart(null, market); }
  snapshots.set(market, { raw, cart });
  return cart;
}
function write(cart: OfferCart) {
  try { window.localStorage.setItem(offerCartKey(cart.market), JSON.stringify(cart)); } catch { /* storage unavailable: cart stays in memory snapshot */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: cart.market }));
}
export function addOfferLine(market: MarketCode, line: OfferCartLine, zoneId: string | null): "added" | "already" {
  const cart = readOfferCart(market);
  const exists = cart.lines.some(l => l.slug === line.slug && l.pack_id === line.pack_id && l.add_on_id === line.add_on_id);
  write({ ...cart, zone_id: zoneId ?? cart.zone_id, lines: exists ? cart.lines : [...cart.lines, line] });
  if (!exists) track("add_to_cart", { ...lineProps(line), cart_lines: cart.lines.length + 1 });
  return exists ? "already" : "added";
}
/** Replace an existing sample quantity for the same product without duplicating its line. */
export function selectPreviewQuantity(market:MarketCode,line:OfferCartLine,zoneId:string):"added"|"already"{
 const cart=readOfferCart(market);
 const existing=cart.lines.find(l=>l.listing_id===line.listing_id);
 const lines=cart.lines.filter(l=>l.listing_id!==line.listing_id);
 write({...cart,zone_id:zoneId,lines:[...lines,line]});
 if(existing?.pack_id!==line.pack_id)track(existing?"pack_changed":"add_to_cart",{...lineProps(line),previous_pack_id:existing?.pack_id??null});
 return existing?.pack_id===line.pack_id?"already":"added";
}
export function updateOfferLine(market: MarketCode, index: number, line: OfferCartLine) {
  const cart = readOfferCart(market);
  const lines = [...cart.lines];
  if (index < 0 || index >= lines.length) return;
  const before = lines[index];
  lines[index] = line;
  write({ ...cart, lines });
  track("cart_line_updated", { ...lineProps(line), previous_pack_id: before.pack_id, previous_add_on_id: before.add_on_id });
}
export function removeOfferLine(market: MarketCode, index: number) {
  const cart = readOfferCart(market);
  const removed = cart.lines[index];
  write({ ...cart, lines: cart.lines.filter((_, i) => i !== index) });
  if (removed) track("remove_from_cart", { ...lineProps(removed), cart_lines: cart.lines.length - 1 });
}
export function setOfferZone(market: MarketCode, zoneId: string) {
  write({ ...readOfferCart(market), zone_id: zoneId });
  track("delivery_zone_selected", { zone_id: zoneId });
}
export function clearOfferCart(market: MarketCode) {
  write({ market, zone_id: null, lines: [] });
}

const empty = new Map<MarketCode, OfferCart>();
export function useOfferCart(market: MarketCode): OfferCart {
  return useSyncExternalStore(
    notify => {
      const onStorage = (e: StorageEvent) => { if (e.key === offerCartKey(market)) notify(); };
      const onLocal = (e: Event) => { if ((e as CustomEvent).detail === market) notify(); };
      window.addEventListener("storage", onStorage);
      window.addEventListener(EVENT, onLocal);
      return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(EVENT, onLocal); };
    },
    () => readOfferCart(market),
    () => { if (!empty.has(market)) empty.set(market, { market, zone_id: null, lines: [] }); return empty.get(market)!; },
  );
}
