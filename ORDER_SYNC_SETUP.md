# Soul Analytics — TikTok Order Sync (first live test)

This release preserves the existing TikTok seller authorization, adds a **manual** import of up to 1,000 orders created during the previous 30 days, and shows imported order count plus USD product subtotals. **It does not yet run automatically or compute profit, fees, refunds, or settlements.**

## Before deployment

1. Supabase → SQL Editor → create a **new SQL snippet** (not a Logs query).
2. Open `supabase/tiktok_orders.sql`. Run the `CREATE TABLE ...;` statement first. Run the `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` statement separately if your editor allows only one statement.
3. Confirm the existing `tiktok_connections` row is untouched; do not reauthorize.
4. Check the TikTok Partner Center app has the **Shop Authorized Information** and **Order Information** API scopes. These are required by TikTok's Get Authorized Shops and Get Order List endpoints. If not approved, the sync will show a TikTok API error.
5. Vercel Production must already include `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TIKTOK_SHOP_APP_KEY`, `TIKTOK_SHOP_APP_SECRET`, `TIKTOK_TOKEN_ENCRYPTION_KEY`, and `TIKTOK_SHOP_AUTH_URL`. Do not copy real values into GitHub.
6. Upload the **contents at this ZIP's top level** to your GitHub repo **root**, not the ZIP or a containing folder. You can leave the older accidentally nested folders alone for now. Wait for the Vercel deployment to be Ready.
7. In the dashboard, click **Sync last 30 days of orders**. Results appear after a successful import.

## Important limitations and cautions

- This is a first integration to test against your **real shop**; API permissions, token refresh, TikTok signing, and response compatibility cannot be verified without a live authorized request.
- The importer assumes one authorized shop. It stops with a clear error if more than one is returned rather than mixing data.
- Imports are idempotent: `(owner_id, shop_id, order_id)` forms the order key, so importing the same order again updates it instead of duplicating it.
- Import cap: ten pages of 100 orders each. If TikTok indicates more pages, the UI flags the partial import. No historical all-time backfill yet.
- Product subtotals are **buyer-facing order subtotals**, not seller settlement proceeds or net profit. They exclude shipping/tax, and unpaid/cancelled orders are excluded from the displayed product subtotal.
- The browser never receives TikTok tokens, the service-role key, or the encryption key.
- A session must be authenticated as a provisioned Soul owner for sync and summary endpoints.
- If TikTok reports authorization or refresh errors, stop and inspect the error text, but do **not** share credentials, authorization codes, token strings, or buyer personal information.

Official API references:
- https://partner.tiktokshop.com/docv2/page/6507ead7b99d5302be949ba9 (Get Authorized Shops)
- https://partner.tiktokshop.com/docv2/page/get-order-list-202309 (Get Order List)
- https://partner.tiktokshop.com/docv2/page/common-parameters (Signing and authentication)
