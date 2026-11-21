# M4D — Policy evidence correction + offline security hardening

**Date:** 21 November 2026. **Branch:** `milestone/4d-security-and-policy-accuracy`, based on main after M4C PR #95 merged. GitHub source only; no supplier, Supabase, Cloudflare, live checkout, billing, production domains, paid AI, or deployments.

## Important correction to M4A's overcorrection

The owner supplied explicit regional supplier delivery policies on 20 November 2026, in `docs/SUPPLIER-POLICIES-2026-11-20.md`. The previous M4A copy incorrectly concealed **known quoted amounts** behind a general "unknown shipping price" message. M4D restores **accurate historical quotation context**, while continuing to say those are NOT currently approved customer checkout charges.

| Market | Owner-provided **historical supplier quote** | Regional delivery estimate provided | Still missing |
|---|---|---|---|
| Saudi Arabia | SAR 28, all regions | Riyadh/Jeddah/Dammam 2–3 days; elsewhere 4–5 days after confirmation | Revalidation, seller legal policy, commercial checkout release |
| UAE | AED 19, nationwide | 24–48 hours, with start point and serviceability still needing confirmation | Revalidation and statutory policy review |
| Oman | OMR 3, nationwide | No supported SLA | Revalidation and final consumer returns |
| Egypt | **No amount**: supplied per-governorate shipping rate field was broken | Cairo/Giza/Alexandria 2 workdays; Lower Egypt/Qalyubia 3; specified remote zones 2–5 | Actual Egypt governorate shipping rate table |
| Iraq | IQD 7,000, nationwide | No supported SLA | Revalidation, Iraqi consumer rights review; contradictory supplier 3-/14-day return text |

In Arabic storefront copy, quoted values must remain visibly qualified as former supplier guidance / `إرشادي` / `تقدير`. A rate may not enter a checkout/order amount until the supplier has been reconnected, the fee has been authenticated and the owner has approved the exact current policy. Do not imply COD can be used today. Supplier return windows are *not* the seller's legally reviewed rights policy. Customer pages show Yawmiyati branding and no provider identity.

The source-of-truth historical-only record is `src/lib/store/historic-supplier-terms.ts`; every market is explicitly `historic_unverified`, `customerPriceAuthorized:false`, `supplierConnected:false`, `checkoutEnabled:false`. It is **not connected to cart, pricing, supplier APIs or public RPCs**.

## M4D security changes

- `src/lib/store/dashboard-client.ts`: owner RPC calls reject invalid market values, empty/malformed tokens, unexpected endpoints; review IDs, draft targets, product IDs and catalog offsets are checked before network calls. Market summary rejects currency/market mismatch, invalid count values and noninteger ledger strings. Performance reports reject currency mismatch.
- `scripts/check-storefront-truth.mjs`: retains noindex, synthetic catalog boundary, and now allows **only source lines that qualify quoted supplier shipping/ETA text**, rejecting bare quoted-rate promises on active storefront files.
- New adversarial test suite covers missing tokens, injected newline headers, forged markets, cross-country data, invalid owner actions, historical prices and policy gaps.
- This is request-side/source-only hardening; full security depends on server-side RLS, authenticated owner roles, signed provider evidence, rate limiting, CSRF/CSP/security headers, production session handling, backups and vulnerability review. Nothing here claims a penetration test or deployed security approval.

## Verification and next steps

Run:
```bash
node scripts/check-simulation-boundary.mjs
node scripts/check-storefront-truth.mjs
node scripts/check-handoff-manifest.mjs
bun run build
bun run test
```
The separate browser workflow tests 5 public markets ×4 widths and 5 offline localhost owner previews ×4 widths, **not live authenticated Supabase admin**.

The next free build is M4E source-only SEO improvement (auditable verified-only sitemap and canonical/hreflang planning; no publishing). Any supplier connection, live policy, real media, orders, domain/hosting action or paid service still requires separate approval. All 40 launch gates remain blocked.
