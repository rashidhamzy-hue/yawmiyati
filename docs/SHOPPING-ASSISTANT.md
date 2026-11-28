# Yawmiyati shopping assistant (v2, 29 Nov 2026)

**Status:** source CI-PASSED; budget migration `20261129100000_assistant_budget.sql` tested locally on Postgres 16 with every repo migration (`docs/assistant-budget-test.sql`, rollback-only).
**Paid AI answers are OFF for visitors** in all five markets (policy rows disabled, zero budget, public flag unset). The owner switches them on at launch.

## What a visitor gets today (free, no AI call)
The assistant answers in the browser from verified facts only (`assistantAnswer` in `src/lib/store/shop-assistant.ts`, rules in `supabase/functions/_shared/assistant/core.ts`):
- **Policies:** payment, delivery fee and time, returns, order tracking are the store's own published sentences, word for word (`customer-service-copy.ts`); the confirmation call from `assistant-copy.ts`.
- **Sales:** it understands a need and a budget ("هدية لأمي بأقل من 200", Arabic digits, ranges), finds matching published products, shows them as product cards with the price, offer / set / free-delivery hints and an add-to-cart button, lists current offers, and says honestly when nothing fits.
- **Free delivery:** states the approved threshold when one is running, otherwise that there is none.
- **Human handover:** a WhatsApp link when a number is configured (`SUPPORT_WHATSAPP` in `shop-assistant.ts`, none yet), otherwise the help page.
- Words are in each market's dialect (`assistant-copy.ts`, part of the market dictionary and its CI guard).
- Visible from: the floating button on every store page, every market's FAQ ("how do I find…"), empty search / section results, and the product page ("ask about this product").

## Paid answers (edge function `yawmiyati-shopping-assistant`)
Used only for product advice and open questions; policy questions never reach the model.
1. Origin must be an allow-listed storefront (`YAWMIYATI_ASSISTANT_ALLOWED_ORIGINS`).
2. Per-address rate limits in memory only (8 a minute, 60 an hour); injection attempts are answered locally.
3. Facts: the market's released catalogue and approved offers (`public_catalog`, `public_store_offers`) and the storefront's `/api/store-facts/<market>.json` (the same published sentences). No costs, no supplier data.
4. Up to 12 matching products go to the model with numbers; it returns JSON (`reply`, product numbers, optional add-to-cart, handover).
5. **Budget:** `assistant_reserve` reserves the worst-case cost against `shopping_assistant_policy.daily_budget_microusd` before the call; `assistant_settle` records the real tokens and cost in `shopping_assistant_spend` (per-day totals only).
6. **Verification:** `verifyReply` discards a reply that mentions an amount the store did not give, a percentage, a link or a phone number; the visitor then gets the free local answer.
7. Three independent switches must all be on: secret `YAWMIYATI_ASSISTANT_AI_ENABLED=true`, the market's policy row (`/admin`, RPC `assistant_owner_set`), and the public flag `VITE_YAWMIYATI_SHOP_ASSISTANT_API_ENABLED=true`.

**Model and cost** (prices from platform.claude.com/docs/en/about-claude/pricing, checked 28 Nov 2026): Claude Haiku 5.5, $0.10 per million input tokens and $0.50 per million output tokens for prompts up to 100,000 tokens. One answer is about 2,500 tokens in and 300 out: about $0.0004. Recommended launch cap: **$1 a day per market** (about 2,500 paid answers); `assistant_owner_set` derives the request caps from the budget.

**Privacy:** no transcript, no visitor identifier and no address is stored anywhere. Analytics receive only the kind of question, whether products were found and whether the answer was paid, never the text.

## Order status (designed, NOT built: needs orders, gate G3)
- Entry: "وين طلبي؟" in the assistant or the order page. The visitor types the **order number** and the **last four digits of the phone** used on the order.
- Server: one RPC `public_order_status(p_store, p_order_number, p_phone_last4)`, rate-limited per order number (5 tries an hour, then locked for an hour), returning only: status (received / confirmed / shipped / delivered / returned), the last status date and the delivery city. Never the name, full phone, address or items.
- The assistant shows that status in the market's dialect and offers WhatsApp for anything else. No status is ever guessed: unknown order or wrong digits give the same neutral "not found" answer.

## Testing paid answers before launch (builder only)
A market's policy row may carry `eval_token_sha256`. A request with header `x-yawmiyati-eval: <token>` may bring fixture facts and products, needs a budget on that row and does NOT need the visitor switch. Clear the hash and set the budget back to 0 after testing.

## Not built
Order status (above); streaming replies; `/admin` panel for the switch and spend (RPCs `assistant_owner_status` / `assistant_owner_set` exist); deploying the function from CI (`deploy-brain.yml` covers the brain only).
