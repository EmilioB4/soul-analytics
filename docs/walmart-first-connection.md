# First Walmart connection on the separate testing website

Use the `soul-analytics-testing` Supabase project and Vercel project. Account signup/login should already work. The test Vercel project's TIKTOK_TOKEN_ENCRYPTION_KEY must already be configured and deployed; do not rotate it after saving credentials.

1. Open supabase/walmart_test_setup.sql on GitHub, click Copy raw file, then paste the complete file into Supabase SQL Editor → New query in the TESTING project. Run once as postgres. Expect Success. No rows returned. This is a generated bundle of the maintained Walmart migrations plus multiuser access rules; existing test users and profiles are preserved. Do not run it against the original production database as part of testing.
2. On the website, sign in and open Connections & settings → Walmart connection → Connect Walmart.
3. The account holder obtains their own Client ID/Client Secret from Walmart Marketplace API Key Management. Use the credentials of the seller they intend to connect, with read access for Orders, Items/listing prices, WFS inventory, Reports/settlements and Returns as available. API access must be available to their seller account. These are API credentials, not the Walmart login password. Do not paste any credential into chat, screenshots, SQL or GitHub.
4. Enter the credentials in the website form, then Verify & save Walmart connection. The form verifies token exchange and stores encrypted credentials for the signed-in user; it does not prove every reporting permission is enabled.
5. Open Walmart Overview, select a date range and click Sync Walmart orders. Confirm imported order/line counts; then refresh if needed. Check WFS Stock separately using its sync action. Sync actual fees separately in Walmart Overview. Enter product COGS and inspect returns/fee coverage before relying on profit. A successful order import is not evidence that all fees or costs are present.
6. Test the second user in a different browser profile or private window. Their Walmart tables should start empty, they must supply their own connection, and neither user should see the other's orders, costs or inventory. The same Client ID cannot be linked twice and a stored Client ID cannot silently switch accounts.

This installer does not enable automatic imports or notifications, and does not configure TikTok or Whatnot. The existing full application may show missing setup for those unused channels or automation. Do not enable those settings yet; the next step after a verified manual Walmart import is configuring background jobs and their CRON_SECRET in this testing project.

## Local validation

After npm install, run `npm run test:walmart-setup` to check that the generated installer matches its sources and to validate fresh installation, reruns, real two-user database read/write isolation, preserved profiles/credentials/sales, denied browser credential access and server-only RPC permissions using in-memory PostgreSQL. No Supabase connection or credentials are needed.
