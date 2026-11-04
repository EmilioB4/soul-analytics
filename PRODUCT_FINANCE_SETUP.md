# Soul Analytics — Product COGS + settled finance (pilot)

## Important: this is a pilot, not a fully reconciled accounting ledger
- Preserves your existing TikTok authorization and order importer.
- TikTok order lines are now saved per SKU during **Sync last 30 days of orders**. The product image comes from TikTok's line-item sku_image when provided.
- You can edit **unit cost per SKU** in the dashboard. Saved COGS is applied to historical and future imported order lines for that SKU. It does NOT track cost changes across inventory lots.
- **Import settled fees** requests final settled order financial details through GET `/finance/202501/orders/{order_id}/statement_transactions`. It attempts up to 15 orders per click from the newest 150 orders, and does not backfill all history.
- If TikTok hasn't settled an order, its finances are not assumed to be zero. TikTok can return different codes for unsettled/unavailable records; if this occurs, report the error without sharing tokens.
- Contribution profit = TikTok settlement amount minus product COGS, for settled, USD, fully costed orders only. Settlement already reflects TikTok fees and shipping components, avoiding double subtraction. This is not net profit after overhead or taxes.
- Returns, historical fee adjustments, mixed currencies, multi-shop setups, multiple inventory cost batches, scheduled auto-sync, GMV reconciliation, and >5000-row totals are not complete. Don't use for tax filings.

## Database setup FIRST
Supabase -> SQL Editor -> New snippet (NOT Logs): open `supabase/product_finance.sql`.
Run each of the three `CREATE TABLE` statements separately. Then run each of the three `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` statements separately. No client access policies needed, because server endpoints check the authorized owner and use the service role key.

## Deploy
1. Download a GitHub backup first.
2. Upload the **contents** of this ZIP to the **root** of your GitHub repository, not into an extra folder, and commit. `app`, `lib`, `supabase`, and `package.json` must be in the root.
3. In Vercel, confirm newest deployment is Ready. Do not copy or expose environment variable values. No additional environment variables are needed.
4. On Soul Analytics click **Sync last 30 days of orders** again to fetch product lines.
5. Under Products & profitability click **Refresh products**; enter COGS and click Save on each row.
6. Click **Import settled fees**. If successful, review the settled order counts and contribution profit. Repeat to import more settled records in batches.

## Verification
Compare a few settled order financial amounts with TikTok Seller Center. Do not assume product line item sales equal TikTok GMV. If any error occurs, send only the error message, never token strings, secret values, or authorization codes.

## API references
https://partner.tiktokshop.com/docv2/page/get-transactions-by-order
https://partner.tiktokshop.com/docv2/page/get-order-list-202309
