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

export function fixtureHostAllowed(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]" || hostname === "::1" ||
    hostname.endsWith(".localhost") || hostname.endsWith(".test");
}

const cache = new Map<MarketCode, Promise<ApprovedOfferVersion[]>>();
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
    if (!offerFixturesRequested) return;
    if (!fixtureHostAllowed(window.location.hostname)) { setSource({ state: "ready", mode: "fixtures", versions: [] }); return; }
    let live = true;
    setSource({ state: "loading" });
    loadFixtureVersions(market)
      .then(versions => { if (live) setSource({ state: "ready", mode: "fixtures", versions }); })
      .catch(() => { if (live) setSource({ state: "ready", mode: "fixtures", versions: [] }); });
    return () => { live = false; };
  }, [market]);
  return source;
}
