# Staging deployment gate

Do not deploy to a metered team until the owner confirms a zero-additional-cost allowance and spend controls. Vercel team details currently do not expose its billing plan. Do not assume Hobby permits commercial use.

Existing Lovable build defaults to Cloudflare Nitro. Verify the Vercel-specific TanStack/Nitro build target and SSR preview before switching hosts; retain the existing storefront.

Before exposing a preview: require deployment access protection, set X-Robots-Tag: noindex, nofollow on all responses, disable simulated customer data entry, keep checkout and fulfillment disabled in every market. Do not add a custom domain or any production credentials.

Database RPC create_commerce_order is a server-only test transaction, not a public checkout API. No customer data, shipping charges, settlement or live dispatch are implemented. Never expose a service-role credential to the browser. Test order events are quarantined. Verify actual supplier stock freshness and currency precision before production.

Smoke test /sa, category, product, cart, checkout, mobile RTL, SSR, access protection and noindex headers before accepting staging. No paid add-ons or usage upgrades.
