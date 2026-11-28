# WhatsApp assistant: how to connect the number (owner steps)

**Status (28 Nov 2026):** built and unit-tested, behind a flag, **no number configured**. Source CI-PASSED; database part
tested rollback-only on a local Postgres (`docs/whatsapp-assistant-test.sql`). Never run against Meta.
One WhatsApp Business number serves all five stores. The assistant answers first; you only get real exceptions.

## What it does
| She writes | It answers |
|---|---|
| A product question | Up to 3 published products with the current price and the product link. Nothing fits → it says so. |
| Payment, delivery, returns, the confirmation call | The store's own published sentences for her country, word for word. |
| An order number | The order's state (registered, confirmed, out for delivery, delivered). Only when the message comes from the phone the order was placed with. |
| «تأكيد 1042» (the confirmation tap) | Confirms the order the order form asked her to confirm (customers with one undelivered order in 90 days). |
| «موظفة», or a complaint (damaged, wrong, not arrived) | "I passed your message to our team", and you get a WhatsApp note with her message and a tap-to-chat link. |

It is rule-based and free: no paid AI is called. It keeps no phone number and no message text (message ids for a week,
to answer a retried delivery once). The store comes from her country code; a number from another country is asked
which store she orders from.

## What you must do when you have the SIM
Cost: the Cloud API is free to set up; replies inside 24 hours of her message are free. Nothing here spends money.

1. **Register the number.** Put the SIM in a phone that can receive one SMS or call. The number must NOT be
   registered in the WhatsApp or WhatsApp Business app (delete that account first if it is).
2. **Meta Business account.** business.facebook.com → use the Yawmiyati business (the one that owns the Page).
3. **Create the app.** developers.facebook.com → My Apps → Create App → "Other" → "Business" → name `Yawmiyati
   WhatsApp` → add the product **WhatsApp**.
4. **Add the number.** WhatsApp → API Setup → "Add phone number" → display name `يومياتي` → verify by SMS.
   Copy the **Phone number ID** (a long number, not the phone number).
5. **Permanent token.** Business settings → Users → System users → Add `yawmiyati-assistant` (Admin) → Add assets →
   the app (full control) → Generate new token → app `Yawmiyati WhatsApp` → permissions `whatsapp_business_messaging`
   and `whatsapp_business_management` → expiry "Never". Copy the token.
6. **App secret.** App settings → Basic → App secret → Show. Copy it.
7. **Supabase secrets.** Supabase → project Yawmiyati → Edge Functions → Secrets → add:
   | Name | Value |
   |---|---|
   | `WHATSAPP_PHONE_NUMBER_ID` | from step 4 |
   | `WHATSAPP_TOKEN` | from step 5 |
   | `WHATSAPP_APP_SECRET` | from step 6 |
   | `WHATSAPP_VERIFY_TOKEN` | any 30+ random characters you invent |
   | `OWNER_WHATSAPP` | your own WhatsApp number, digits with country code, e.g. `9613xxxxxx` |
   | `STOREFRONT_ORIGIN` | `https://yawmiyati.shop` |
   | `BLACKLIST_HASH_KEY` | already set for the daily loop; do not change it |
   Leave `WHATSAPP_ENABLED` unset for now.
8. **Webhook.** App → WhatsApp → Configuration → Webhook → Edit:
   Callback URL `https://skhtunkknshvolturqlm.supabase.co/functions/v1/yawmiyati-whatsapp`, Verify token = the
   `WHATSAPP_VERIFY_TOKEN` you invented → Verify and save → Webhook fields → subscribe to **messages**.
9. **Tell Claude** the number is connected. Claude then puts the number into the storefront (`SUPPORT_WHATSAPP`), so
   the "talk to us on WhatsApp" links and the confirmation button point at it, and runs the checks below with you.
10. **Switch on.** Add the secret `WHATSAPP_ENABLED` = `true`. From your own phone send: «مرحبا», «كيف الدفع؟»,
    «موظفة». You should get the greeting, the payment sentence, and (on `OWNER_WHATSAPP`) the handover note.
11. **App mode.** App → switch from Development to **Live** (needs a privacy policy URL:
    `https://yawmiyati.shop/sa/info/privacy`). In Development mode only numbers you added as testers get replies.

To switch it off at any time: delete `WHATSAPP_ENABLED` (or set it to anything but `true`). Messages are then
acknowledged and ignored.

## What is not built
- Sending the first message to a customer (templates need Meta's approval and cost per conversation): the assistant
  only replies. The confirmation tap starts from a wa.me button on the order page, so she writes first.
- Pictures, voice notes and locations are answered with "please write your question".
- Paid AI answers on WhatsApp: off by design; the website assistant's paid path is a separate owner switch.

## G3 dependencies
The confirmation button and the order number appear on the order page, which is part of order submission (G3). Until
then the order lookup and the confirmation tap are proven only by tests.
