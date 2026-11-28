# Hidden connector sites — exact setup (one per market)

Status: **SOURCE-ONLY runbook.** No connector site exists yet. Nothing here is switched on; buying hosting and pointing DNS are owner steps (money and accounts).

## What a connector site is
Each market has one small WooCommerce site whose only jobs are (1) to hold the official Taager plugin, and (2) to answer our backend over the WooCommerce REST API. Shoppers never see it. The shop people visit is `yawmiyati.shop/sa|ae|om|eg|iq` on Cloudflare.

| Market | Suggested address | Taager account country |
|---|---|---|
| Saudi Arabia | `ops-sa.yawmiyati.shop` | KSA |
| UAE | `ops-ae.yawmiyati.shop` | UAE |
| Oman | `ops-om.yawmiyati.shop` | Oman (fulfilment to be confirmed with Taager) |
| Egypt | `ops-eg.yawmiyati.shop` | Egypt |
| Iraq | `ops-iq.yawmiyati.shop` | Iraq |

The addresses are never linked from the storefront, never listed in a sitemap, and never used in an advert, feed or message.

## Rules that must hold on every connector site
1. **Search engines are told to stay out, three ways.**
   - WordPress → Settings → Reading → tick **Discourage search engines from indexing this site**.
   - A real file `robots.txt` in the site root with exactly:
     ```
     User-agent: *
     Disallow: /
     ```
   - The header `X-Robots-Tag: noindex, nofollow` on every response. On Cloudflare: the zone → Rules → Transform Rules → Modify Response Header → *When hostname equals* `ops-sa.yawmiyati.shop` (repeat per site) → *Set static* `X-Robots-Tag` = `noindex, nofollow`. Without Cloudflare in front, add to `.htaccess`: `Header set X-Robots-Tag "noindex, nofollow"`.
2. **Visitors see nothing.** WooCommerce → Settings → Site visibility → **Coming soon** → tick **Restrict to store pages only: off** (the whole site is covered) and leave **Share with a private link** off. This is WooCommerce's own storefront lock; it does not block the REST API or wp-admin.
   If the installed WooCommerce is older than 9.1 and has no Site visibility tab, update WooCommerce first; do not add a third-party password plugin, because several of them also block the REST API.
3. **Only two things are reachable:** the WooCommerce REST API (`/wp-json/wc/v3/…`, key + secret required) and whatever the Taager plugin needs. Because Taager has not published the plugin's callback paths, no firewall rule is written around them yet (question logged in `claude/taager-questions-for-launch.md`). Until Taager answers, rule 2 is what hides the storefront; a tighter Cloudflare rule comes after G1 shows which paths the plugin calls.
4. **No customer features.** Disable account registration (WooCommerce → Settings → Accounts & Privacy: untick every "allow customers to create an account"), disable reviews (Settings → Products), no payment gateway other than Cash on delivery, no newsletter, no analytics, no pixel.
5. **Keys.** WooCommerce → Settings → Advanced → REST API → Add key, description `yawmiyati-backend`, permissions **Read/Write**. The key and secret go only into Supabase function secrets (`WOO_SA_URL`, `WOO_SA_KEY`, `WOO_SA_SECRET`, same pattern for AE/OM/EG/IQ). Never into the repository, a `VITE_` variable, a document or a chat.
6. **Prices on the connector site are ignored.** Our backend matches products by SKU and sets its own prices; the Woo price is whatever the Taager plugin imported.
7. **Admin login** uses a long unique password and two-step login. One admin user only.

## Order of work for one site (about 20 minutes once hosting exists)
1. Create the subdomain and install WordPress + WooCommerce (current versions).
2. Apply rules 1, 2 and 4 **before** installing anything else.
3. Run the check below; it must pass.
4. Install the Taager plugin from the Taager dashboard for that country and link the store.
5. Create the REST key (rule 5) and add the three secrets in Supabase.
6. Run the check again (the plugin must not have reopened anything).

## The check
```
node scripts/check-connector-hidden.mjs https://ops-sa.yawmiyati.shop
```
It passes only if `robots.txt` blocks everything, the home page and the shop page both send `noindex`, the home page shows no product markup, and the REST API answers (a "needs a key" refusal counts as answering). It sends no keys and changes nothing.

## What is still unknown (G1 must prove)
- Which paths the Taager plugin calls and is called on, and from which addresses.
- Whether "Coming soon" interferes with the plugin (it should not; it only swaps the visitor-facing template).
- The order status names the plugin writes back (needed by the order-lifecycle reader).
