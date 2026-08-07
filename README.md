# MTN Data Plug — MVP

Vanilla HTML/CSS/JS + Supabase + Paystack + Affordable Data. Ready for GitHub Pages.

## File map

```
index.html                  Home — pick network + bundle
checkout.html                Checkout — beneficiary + payer number
success.html                   Payment successful
failed.html                     Payment failed / retry
js/config.js                     ⚠️ Fill this in first — Supabase URL + keys + function URLs
js/home.js                        Logic for index.html
js/checkout.js                     Logic for checkout.html
js/success.js                        Logic for success.html
js/failed.js                          Logic for failed.html
js/supabase-client.js                  Shared Supabase client setup

admin/login.html                    Admin sign-in
admin/dashboard.html                 Admin dashboard (bundles / transactions / settings)
admin/js/login.js                     Logic for admin/login.html
admin/js/dashboard.js                  Logic for admin/dashboard.html
admin/css/admin.css                     Admin-only styles

supabase/schema.sql                       Run once (safe to re-run) in Supabase SQL Editor
supabase/functions/verify-payment/           Confirms Paystack payment + triggers delivery
supabase/functions/paystack-webhook/          Paystack's server-to-server confirmation (reliable backstop)
supabase/functions/reprocess-delivery/        Retries a failed/stuck delivery
supabase/functions/provider-plans/             Previews Affordable Data's live package prices
```

## 1. Supabase setup

1. Create a project at supabase.com.
2. Open **SQL Editor** and run `supabase/schema.sql` in full.
3. Go to **Authentication > Users > Add user** and create your admin login (email + password). Any user you create here can sign into `/admin`.
4. Go to **Project Settings > API Keys** and copy:
   - Project URL
   - **Publishable key** (`sb_publishable_...`) — safe for the browser, goes in `js/config.js`
   - **Secret key** (`sb_secret_...`) — server-side only, Supabase auto-injects it into your Edge Functions once it exists on your project; never paste it into any file in this project

## 2. Deploy the edge functions

Paystack's secret key and the Affordable Data API key must never touch the browser, so payment verification and data delivery both happen server-side.

```bash
npm install -g supabase
supabase login
supabase link --project-ref euezcqqaucxqopfiqdhb
supabase functions deploy verify-payment --no-verify-jwt
supabase functions deploy paystack-webhook --no-verify-jwt
supabase functions deploy reprocess-delivery --no-verify-jwt
supabase functions deploy provider-plans --no-verify-jwt
```

> `--no-verify-jwt` is required because this project uses Supabase's new `sb_publishable_...` / `sb_secret_...` API keys rather than the legacy JWT-based `anon` / `service_role` keys.

If you deploy from the Supabase **web dashboard** instead of the CLI, each function gets a random name (like `dynamic-service`) instead of the name in its folder — copy the actual URL shown for each one and paste it into `js/config.js`. Also double-check "Enforce JWT Verification" is switched **off** for all 4 functions.

- `verify-payment` — called by the browser right after Paystack's popup reports success; confirms the charge and triggers Affordable Data delivery.
- `paystack-webhook` — Paystack calls this **directly from their servers**, not through the browser, once a Mobile Money charge actually completes (which can take a moment since the customer approves on their phone). This is the reliable backstop — Paystack's own docs say Mobile Money in Ghana needs a webhook to work properly, since the browser might close before the charge resolves. **After deploying, copy this function's URL and paste it into Paystack Dashboard > Settings > API Keys & Webhooks > Webhook URL.**
- `reprocess-delivery` — lets Admin > Transactions retry a failed/stuck delivery without re-charging the customer.
- `provider-plans` — lets Admin > Settings preview Affordable Data's live package prices (informational only — no mapping needed).

## 3. Fill in `js/config.js`

```js
SUPABASE_URL: "https://YOUR-PROJECT-REF.supabase.co",
SUPABASE_PUBLISHABLE_KEY: "sb_publishable_...",
VERIFY_PAYMENT_URL: "https://YOUR-PROJECT-REF.supabase.co/functions/v1/verify-payment",
REPROCESS_DELIVERY_URL: "https://YOUR-PROJECT-REF.supabase.co/functions/v1/reprocess-delivery",
PROVIDER_PLANS_URL: "https://YOUR-PROJECT-REF.supabase.co/functions/v1/provider-plans",
```

If you deployed via the web dashboard, use the actual random URLs Supabase gave each function.

## 4. Get Paystack keys

1. Log into paystack.com.
2. Settings > API Keys & Webhooks — copy your **Public Key** and **Secret Key** (test keys while testing, live keys when ready for real customers).
3. Log into `/admin` > **Settings** tab, paste both, Save Settings.

## 5. Set up Affordable Data auto-delivery

1. In **Admin > Settings**, paste your Affordable Data API key (`afd_live_...`) and save.
2. That's it — no plan mapping needed. Affordable Data's `/purchase` endpoint takes network + data volume (MB) directly, and your bundles already have both fields.
3. Optionally, click **Load Packages** to preview their current live prices per network — useful for checking your margin, but not required for delivery to work.
4. Your bundle price and Affordable Data's price are independent — the difference is your margin.

Once payment is confirmed successful (either via the browser or the `paystack-webhook`), the matching function automatically calls Affordable Data's `/purchase` endpoint using the transaction reference as the idempotency key, and stores the delivery status (`processing` / `success` / `failed`) on the transaction. Failed/stuck deliveries can be retried with the **Retry** button in Admin > Transactions — this never re-charges the customer, since it reuses the same idempotency key.

**Affordable Data's webhook (optional):** if you generated a webhook secret when creating your API key, you can add a second webhook function later so their async `order.status_updated` events also update your transactions automatically for orders that stay in `processing`. Not required to get started.

## 6. Edit your bundles

Bundles are grouped by network in **Admin > Bundles** (MTN / Telecel / AirtelTigo tabs) and sorted automatically by data size. Adjust prices, enable/disable, or remap plan IDs anytime — no redeploy needed.

## 7. Deploy to GitHub Pages

Push this folder to a repo and enable Pages (Settings > Pages > Deploy from branch). No build step required — it's static.

## Notes

- Payment via Mobile Money accepts MTN, Telecel, or AirtelTigo — checkout validates both the beneficiary and payer numbers as general Ghana mobile numbers (10 digits, starting 02 or 05), not tied to a specific network, since numbers can be ported between networks.
- All amounts are in Ghana Cedis (GHS).
- The `settings` table holds a single row (`id = true`) — don't insert a second row.
- Contact buttons (WhatsApp + Call) show on the home, success, and failed pages.
- ExpressPay-related columns (`expresspay_*`, `payment_token`) and `resellerxpress_api_key`/`provider_plan_id` may still exist in your `settings`/`transactions`/`bundles` tables from earlier experiments — harmless, unused, safe to ignore.
