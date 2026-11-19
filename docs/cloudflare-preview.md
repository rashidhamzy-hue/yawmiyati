# Yawmiyati private staging
Use a new Worker named yawmiyati-staging; never select or modify an existing Worker.
Verify account is Workers Free, no paid products enabled for this deployment. Existing Vite config targets Cloudflare via Nitro; inspect generated build output and Wrangler configuration before deploying.
Build with Bun 1.3.14: bun install --frozen-lockfile; bun run test; bun run build.
Set VITE_YAWMIYATI_SUPABASE_URL=https://skhtunkknshvolturqlm.supabase.co and VITE_YAWMIYATI_SUPABASE_PUBLISHABLE_KEY to the actual staging publishable key at build time. Never use service role or Woo credentials in VITE variables.
Require access protection before exposing preview, global noindex, verify no personal data collection and disabled checkout. Confirm /sa and /admin with an actual owner session; check logs and 10ms free CPU constraint. Do not launch commercial traffic on this preview.
Woo sandbox: temporary hosted WordPress or local WooCommerce with HTTPS tunnel only after supplier accepts temporary URLs, verifies plugin compatibility and confirms test orders cannot dispatch. No paid plan or card enrollment without approval.
