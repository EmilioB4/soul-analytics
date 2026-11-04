# Soul Analytics — Official TikTok Payouts

This update adds TikTok Shop's official Get Unsettled Transactions and Get Payments endpoints to the Payouts tab. It preserves the existing Chase Plaid panel.

## Install in this order
1. Supabase > SQL Editor > regular query: run `supabase/tiktok_official_payouts.sql` (all statements if your editor supports them; otherwise one at a time). No new environment variables or new TikTok scopes; Finance Information (`seller.finance.info`) must be granted to the current token.
2. At the ROOT of your GitHub repository upload these files, keeping their paths: `app/page.tsx`, `app/TikTokOfficialPayouts.tsx`, `app/api/tiktok/finance/official/route.ts`. Upload folders directly, not nested in a parent folder.
3. Commit and check that Vercel deployment is Ready. On Payouts select a date window of 30 days to start, then click `Sync TikTok payouts`.

## How numbers work
- TikTok's estimated **unsettled** settlement is read from `GET /finance/202507/orders/unsettled` and filtered by order creation date. It's only estimated and may disappear when the order settles.
- TikTok **payments** come from `GET /finance/202605/payments` filtered by payment creation date. PAID means TikTok transferred the money; only Chase bank transactions confirm bank receipt.
- Existing **Imported Settled Amount** remains from the old order settlement importer and is attributed to order creation date. These three groups are not additive.
- Adjustments not tied to orders are shown separately.
- Both TikTok endpoints may return partial/empty results or authorization errors. The sync explicitly flags pagination caps.
- A selected date range is not a single livestream unless stream orders are separately attributed.
- Sync is manual; this does not yet schedule unattended refreshes or match individual bank transfers to TikTok payment IDs.

## Security
The APIs require Supabase owner authentication, use the preexisting server-side TikTok token storage, and write private rows with RLS enabled. No banking secrets are included in the zip.

## Validation
Verified: ZIP contents and TS transpile syntax. Full Vercel build and live API responses must still be tested.
