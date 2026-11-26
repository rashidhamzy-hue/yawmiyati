/**
 * Ad and traffic attribution: which ad, campaign, influencer or site brought each visitor.
 * Captures UTM tags and ad click ids (Meta fbclid, Google gclid, TikTok ttclid, Snapchat ScCid)
 * on landing, keeps the FIRST touch and the LATEST campaign touch, and exposes them for
 * analytics events now and for orders and Meta Conversions API later (Phase 6/7).
 *
 * Privacy: only campaign parameters and the referring site's host are stored, never the
 * full referrer URL. Without analytics consent they live for the browser session only.
 */
export type Touch = {
  source: string | null; medium: string | null; campaign: string | null; content: string | null; term: string | null;
  click_ids: Partial<Record<"fbclid" | "gclid" | "ttclid" | "sccid", string>>;
  referrer_host: string | null; landing_path: string; at: string;
};
export type Attribution = { first: Touch | null; last: Touch | null; fbc: string | null };

const FIRST = "ym.attr.first.v1", LAST = "ym.attr.last.v1", CONSENT = "yawmiyati.consent.v1";
const CLICK: Record<string, keyof Touch["click_ids"]> = { fbclid: "fbclid", gclid: "gclid", ttclid: "ttclid", sccid: "sccid", ScCid: "sccid" };
const clean = (v: string | null, max = 150) => (v ? v.replace(/[^\p{L}\p{N}_.\-+ |:/]/gu, "").trim().slice(0, max) || null : null);

/** Parse one landing. Returns null when the URL has no campaign signal and the referrer is internal/empty. */
export function parseTouch(href: string, referrer: string, now = new Date()): Touch | null {
  const url = new URL(href);
  const p = url.searchParams;
  const click_ids: Touch["click_ids"] = {};
  for (const [param, name] of Object.entries(CLICK)) { const v = clean(p.get(param), 500); if (v) click_ids[name] = v; }
  let referrer_host: string | null = null;
  try { const r = new URL(referrer); if (r.hostname && r.hostname !== url.hostname) referrer_host = r.hostname.replace(/^www\./, ""); } catch { /* no referrer */ }
  const t: Touch = {
    source: clean(p.get("utm_source")), medium: clean(p.get("utm_medium")), campaign: clean(p.get("utm_campaign")),
    content: clean(p.get("utm_content")), term: clean(p.get("utm_term")), click_ids, referrer_host, landing_path: url.pathname.slice(0, 200), at: now.toISOString(),
  };
  // Infer the obvious source when only a click id or referrer is present.
  if (!t.source) t.source = click_ids.fbclid ? "facebook" : click_ids.gclid ? "google" : click_ids.ttclid ? "tiktok" : click_ids.sccid ? "snapchat" : referrer_host;
  if (!t.medium && (click_ids.fbclid || click_ids.gclid || click_ids.ttclid || click_ids.sccid)) t.medium = "paid";
  if (!t.medium && referrer_host) t.medium = /google\.|bing\.|duckduckgo\.|yahoo\./.test(referrer_host) ? "organic" : /chatgpt|openai|claude|perplexity|gemini|copilot/.test(referrer_host) ? "ai_assistant" : "referral";
  const hasSignal = !!(t.source || t.campaign || Object.keys(click_ids).length);
  return hasSignal ? t : null;
}

/** Meta's _fbc format: fb.1.<landing ms>.<fbclid> */
export function fbcFrom(t: Touch | null): string | null {
  return t?.click_ids.fbclid ? `fb.1.${Date.parse(t.at)}.${t.click_ids.fbclid}` : null;
}

function storage(): Storage | null {
  try { return window.localStorage.getItem(CONSENT) === "granted" ? window.localStorage : window.sessionStorage; } catch { return null; }
}
function read(s: Storage | null, k: string): Touch | null {
  try { const v = s?.getItem(k); return v ? (JSON.parse(v) as Touch) : null; } catch { return null; }
}

/** Call once per page load (client only). */
export function captureAttribution(href = window.location.href, referrer = document.referrer): Attribution {
  const s = storage();
  const touch = parseTouch(href, referrer);
  if (touch && s) {
    try {
      if (!read(s, FIRST)) s.setItem(FIRST, JSON.stringify(touch));
      // A new campaign/click replaces the last touch; plain internal navigation never does.
      s.setItem(LAST, JSON.stringify(touch));
    } catch { /* storage full or blocked */ }
  }
  return getAttribution();
}

export function getAttribution(): Attribution {
  if (typeof window === "undefined") return { first: null, last: null, fbc: null };
  const s = storage();
  const first = read(s, FIRST), last = read(s, LAST);
  return { first, last, fbc: fbcFrom(last) };
}

/** Flat properties added to every analytics event. */
export function attributionProps(a: Attribution = getAttribution()): Record<string, string | null> {
  return {
    ym_first_source: a.first?.source ?? null, ym_first_medium: a.first?.medium ?? null, ym_first_campaign: a.first?.campaign ?? null,
    ym_last_source: a.last?.source ?? null, ym_last_medium: a.last?.medium ?? null, ym_last_campaign: a.last?.campaign ?? null,
    ym_last_content: a.last?.content ?? null, ym_paid_click: a.last && Object.keys(a.last.click_ids).length ? Object.keys(a.last.click_ids)[0] : null,
  };
}

/** When consent is granted mid-session, move the session copy to persistent storage. */
export function persistAttributionAfterConsent() {
  try {
    for (const k of [FIRST, LAST]) { const v = window.sessionStorage.getItem(k); if (v && !window.localStorage.getItem(k)) window.localStorage.setItem(k, v); }
  } catch { /* ignore */ }
}
