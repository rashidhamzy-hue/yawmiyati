/**
 * Single entry point that supplies approved offer versions to the storefront.
 *
 * Today there is no release-gated public RPC for offer versions, so the normal
 * storefront renders offers ONLY in isolated fixture mode:
 *   - VITE_YAWMIYATI_OFFER_FIXTURES=true at build/dev time (statically replaced,
 *     so the fixture chunk is not emitted at all without it), and
 *   - a loopback/.test hostname at runtime.
 * In fixture mode the storefront does not contact Supabase, so fixtures never
 * mix with released catalog data. Without fixture mode the hook reports "off"
 * and every existing catalog/guard path is unchanged.
 */
import { useEffect, useState } from "react";
import type { MarketCode } from "./markets";
import { parseOfferVersion, type ApprovedOfferVersion } from "./offer-version";

export type OfferSourceState =
  | { state: "off" }
  | { state: "loading" }
  | { state: "ready"; mode: "fixtures"; versions: ApprovedOfferVersion[] };

export const offerFixturesRequested = import.meta.env.VITE_YAWMIYATI_OFFER_FIXTURES === "true";

/** Temporary review host; never matches the public custom domain or published lovable.app slug. */
export function previewCatalogHostAllowed(hostname:string):boolean {
  return hostname === "id-preview--6bc552b8-1629-4a0b-8706-8bc21c5c1279.lovable.app" || hostname === "preview-catalog.test";
}
/** Explicit review session also works when Lovable uses a different iframe hostname.
 * Never auto-enables on a published storefront. Session storage is per tab/origin.
 * This is a display switch, not authentication; samples must contain no secrets.
 */
export function previewCatalogActive():boolean {
 if(typeof window==="undefined")return false;
 if(previewCatalogHostAllowed(window.location.hostname))return true;
 try {
  const mode=new URLSearchParams(window.location.search).get("catalog");
  if(mode==="preview"){window.sessionStorage.setItem("yawmiyati-catalog-preview","1");return true;}
  if(mode==="off"){window.sessionStorage.removeItem("yawmiyati-catalog-preview");return false;}
  if(window.sessionStorage.getItem("yawmiyati-catalog-preview")==="1")return true;
 }catch{/* storage may be blocked in embedded previews */}
 const host=window.location.hostname;
 return host==="6bc552b8-1629-4a0b-8706-8bc21c5c1279.lovableproject.com" ||
  host==="id-preview--6bc552b8-1629-4a0b-8706-8bc21c5c1279.lovableproject.com";
}
export function fixtureHostAllowed(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]" || hostname === "::1" ||
    hostname.endsWith(".localhost") || hostname.endsWith(".test");
}

const cache = new Map<MarketCode, Promise<ApprovedOfferVersion[]>>();
const previewCache = new Map<MarketCode, Promise<ApprovedOfferVersion[]>>();
function loadPreviewVersions(market:MarketCode){
 let pending=previewCache.get(market);
 if(!pending){pending=import("../../fixtures/preview-catalog").then(m=>m.previewOfferVersions(market));previewCache.set(market,pending);}
 return pending;
}
function loadFixtureVersions(market: MarketCode): Promise<ApprovedOfferVersion[]> {
  if (import.meta.env.VITE_YAWMIYATI_OFFER_FIXTURES === "true") {
    let pending = cache.get(market);
    if (!pending) {
      pending = import("../../fixtures/storefront-offers").then(mod => {
        const loaded = mod.fixtureOfferVersions(market);
        if (loaded.marker !== mod.FIXTURE_MARKER) throw Error("Unexpected fixture module");
        // Re-parse per market: a fixture for another country can never render here.
        return loaded.versions.map(v => parseOfferVersion(v, market));
      });
      cache.set(market, pending);
    }
    return pending;
  }
  return Promise.resolve([]);
}

export function useOfferVersions(market: MarketCode): OfferSourceState {
  const [source, setSource] = useState<OfferSourceState>(offerFixturesRequested ? { state: "loading" } : { state: "off" });
  useEffect(() => {
    const preview=previewCatalogActive();
    if (!offerFixturesRequested && !preview) return;
    if (!preview && !fixtureHostAllowed(window.location.hostname)) { setSource({ state: "ready", mode: "fixtures", versions: [] }); return; }
    let live = true;
    setSource({ state: "loading" });
    (preview?loadPreviewVersions(market):loadFixtureVersions(market))
      .then(versions => { if (live) setSource({ state: "ready", mode: "fixtures", versions }); })
      .catch(error => { console.error("Preview catalog failed to load",error); if (live) setSource({ state: "ready", mode: "fixtures", versions: [] }); });
    return () => { live = false; };
  }, [market]);
  return source;
}
