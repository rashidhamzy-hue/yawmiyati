# Yawmiyati shopping assistant — owner-reviewed integration

## Customer experience
- One floating, mobile-friendly assistant in the shared five-market storefront, with Arabic greeting, quick questions, interactive chat and local grounded responses even if the paid provider is unavailable.
- No coming-soon UI or false promises. The assistant answers from currently approved public catalog listings only; it cannot access private supplier costs or customer records.
- No checkout/order dispatch, personal-data collection, marketing broadcast, or fabricated stock, discounts, delivery dates, refunds or product claims.
- Assistant messages are ephemeral browser state; no chat transcript storage in the current implementation. A message reminds visitors not to send private information.

## Anthropic integration — NOT YET ACTIVE
Frontend `ShoppingAssistant.tsx` calls `/functions/v1/yawmiyati-shopping-assistant` only if `VITE_YAWMIYATI_SHOP_ASSISTANT_API_ENABLED=true`. This flag is public and must only be set after securing the backend; **never** put Anthropic secrets in VITE variables.

The Supabase Edge Function is designed to use:
- `ANTHROPIC_API_KEY` (server secret only)
- `YAWMIYATI_ASSISTANT_MODEL` (explicit operator-selected model, current verified pricing required)
- `YAWMIYATI_ASSISTANT_AI_ENABLED=true` (independent server gate)
- `YAWMIYATI_ASSISTANT_ALLOWED_ORIGINS` (optional comma-separated exact production domains)
- Built-in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (server only)

The default-disabled `shopping_assistant_policy` database table provides an additional independent hard gate, with per-market atomic minute and daily request caps. All values are disabled/0 until the owner approves a concrete maximum budget and model. A model turn is bounded to 300 output tokens and a short verified product list. The rate cap limits count, NOT precise USD charges: actual costs depend on provider billing, input/output tokens, caching and model rates. Before activation, implement real usage/reconciliation and confirm monetary safety. No provider API calls have been made in this build.

The Edge Function must be deployed with `verify_jwt=false` only after the budget policy and CORS restrictions have been verified. Public API origin checking is defense-in-depth, not a replacement for the server budget cap. Anonymous requests and use of the service key require security review.

## Readiness checklist
1. Run GitHub build/tests; review Arabic copy and the assistant on desktop/mobile and all five country routes.
2. Apply `20261120102000_shopping_assistant_budget_gate.sql` to ONLY staging `skhtunkknshvolturqlm`; verify every policy row is disabled and daily_request_cap=0.
3. Deploy Edge Function code only after confirming host deployment restrictions, legitimate server secrets and rate quotas; leaving it undeployed is safe because the UI has a local fallback.
4. With explicit owner authorization and a small test-only budget, configure Anthropic model/pricing and secret server-side. Run synthetic prompts and adversarial tests for hallucinations, prompt injection, shipping claims, budget exhaust and API errors; never use live order details as context.
5. Activate the public browser feature flag last, after successful model and cost audits. Production rollout requires on-call alerting, usage monitoring, abuse controls and a kill switch.

## Known limitations
- Without verified catalog items, assistant cannot recommend real products.
- Local replies are rules-based and should not be misrepresented as live Anthropic completions.
- The owner dashboard's AI content-drafting workflow is separate from this consumer shopping assistant; neither requires auto-publishing.
- The original staged WooCommerce/TasteWP supplier feed is retired; configure only newly approved hosted supplier integrations when ready.
