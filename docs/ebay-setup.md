# eBay connection and initial PNL dashboard

This adds a dedicated eBay Overview plus Connect eBay cards in both the overview and Integrations. Each user authorizes their own seller account on eBay. No seller pastes an access token into Soul or gets access to Vercel.

## Administrator setup after merge/deployment

1. In the Supabase project used by this deployment, run the entire `supabase/ebay_setup.sql`. It can be rerun; it does not modify Walmart, TikTok, Whatnot or bank tables.
2. Create an eBay Developers Program account and a Production keyset for this application. In the eBay User Tokens / redirect URL settings, create an OAuth redirect entry. Set the Auth accepted URL to `https://YOUR-SITE/api/ebay/callback`, the Auth declined URL to `https://YOUR-SITE/?ebay=cancelled`, and supply the application's privacy-policy URL as required by eBay. Use the generated RuName (redirect entry name) as EBAY_RUNAME, not the callback URL itself.
3. In this Vercel project set EBAY_CLIENT_ID (App ID), EBAY_CLIENT_SECRET (Cert ID), EBAY_RUNAME (generated redirect name), and EBAY_APP_URL (this site's HTTPS origin, without a path). Keep the existing TIKTOK_TOKEN_ENCRYPTION_KEY; it encrypts the eBay account tokens too. Existing Supabase server variables are also required. Never put the client secret or account tokens in NEXT_PUBLIC variables.
4. Redeploy. Connect eBay becomes usable when administrator configuration and database setup are present. Each user opens eBay Overview, clicks Connect eBay, signs in on eBay, and approves the fulfillment-readonly and identity-readonly scopes.
5. A successful callback returns to eBay Overview. Click Sync recent eBay orders to import the last 30 days. Enter per-SKU unit COGS and actual shipping/packaging cost per order. Enter zero only when that cost has been confirmed as zero.

Production API access is subject to eBay's application activation/requirements. This implementation uses production endpoints; do not mix sandbox credentials or sandbox RuNames into it. A real OAuth approval and authenticated import are still required to validate the hosted integration. If a seller wants to change eBay accounts, disconnect the current account first.

## What the initial tracker measures

- USD orders only, up to 2,000 orders per 30-day import. Pagination is fully fetched and validated before the atomic database save. A failed/incomplete batch leaves the previous import intact.
- Counted sales are paid orders, excluding canceled orders. Revenue is merchandise subtotal plus signed item discounts and buyer delivery charges/discounts, excluding taxes. Orders with nonzero pricing adjustments stop the initial import rather than guessing their accounting treatment.
- Reported totalMarketplaceFee is deducted once. Missing fees do not get replaced by an invented percentage.
- Unit COGS and actual outbound shipping/packaging costs are manually entered. A single current SKU cost applies to all imported sales of that SKU; FIFO is not implemented.
- Estimated profit and margin appear only when every counted order has reported fees, COGS and a confirmed shipping cost. Pending/completed refund activity withholds profit until reconciliation is supported. Gross sales and unit counts remain original sale quantities, clearly labelled before refunds.
- This is an initial order-based estimate. Account-level advertising, subscriptions, credits, dispute adjustments and outside expenses are not reconciled yet. Finances API ledger integration is a separate next step. This is not final account PNL.
- Today, Yesterday, 7/30/90 days and YTD filters use America/New_York. Rolling presets end yesterday. A 90-day or YTD selection covers only imported records, not a verified full account history.
- Refresh data reloads stored records. Imports currently require the Sync button. Automatic eBay background imports, eBay Discord alerts and combined-platform totals are not part of this first release.

## Privacy and lifecycle

All eBay tables have RLS enabled with browser-role access revoked. APIs verify the authenticated admitted Soul user and derive owner/account scopes server-side. OAuth state is random, hashed at rest, one-use, ten minutes, browser-cookie bound and profile checked. The callback uses a trusted configured origin and never puts account tokens in a browser URL. Refresh tokens are encrypted with the existing AES-GCM key and refreshed with a database lease and connection-version check. Import leases stop overlapping work and reject saves after disconnect or reauthorization.

Imports retain only order IDs, dates, statuses, SKU/title/quantity, sales and reported fees. Buyer names, addresses, email, payment instruments and raw provider responses are not persisted. Costs and historical records are scoped by Soul owner plus eBay seller ID, so changing connected sellers cannot blend their data. Disconnect deletes local tokens and outstanding OAuth states; private import history is retained. Users can revoke upstream app consent in eBay account settings. Existing platforms and bank integrations remain untouched.

## Validation

`node --experimental-strip-types --test tests/ebay-orders.test.mjs tests/ebay-routes.test.mjs`

`node scripts/validate-ebay.cjs`

`npm run test:isolation`

`npm run build`

The PostgreSQL tests run in PGlite, with no hosted database writes. Route tests use synthetic users/tokens/provider responses. No live eBay connection, real sale, real notification or production configuration is used in automated tests.

Official references: [OAuth authorization](https://developer.ebay.com/develop/guides/sell/authorization), [Fulfillment OpenAPI](https://developer.ebay.com/api-docs/master/sell/fulfillment/openapi/3/sell_fulfillment_v1_oas3.json), [Identity OpenAPI](https://developer.ebay.com/api-docs/master/commerce/identity/openapi/3/commerce_identity_v1_oas3.json).
